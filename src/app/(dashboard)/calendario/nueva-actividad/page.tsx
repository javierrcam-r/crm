'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Loader2, Users, Calendar as CalendarIcon, Video, MapPin, CheckCircle, Bell, Repeat } from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import { REMINDER_OPTIONS } from '@/components/ui/ActivityReminder';
import { createActivity, addMultipleParticipants, getAllUsersForSelection } from '@/lib/services/activities';
import type { ActivityInsert, ActivityType, ActivityPriority, UserProfile, RecurrenceType } from '@/types/database';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

const RECURRENCE_OPTIONS = [
  { value: 'none', label: 'No se repite' },
  { value: 'daily', label: 'Todos los días' },
  { value: 'weekly', label: 'Cada semana' },
  { value: 'biweekly', label: 'Cada 2 semanas' },
  { value: 'monthly', label: 'Cada mes' },
  { value: 'yearly', label: 'Cada año' },
  { value: 'weekdays', label: 'Cada día de la semana (Lun-Vie)' },
];

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
    </div>
  );
}

export default function NuevaActividadPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <NuevaActividadContent />
    </Suspense>
  );
}

function NuevaActividadContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedDate = searchParams.get('date');

  const [users, setUsers] = useState<Pick<UserProfile, 'id' | 'nombre_completo' | 'email' | 'rol'>[]>([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<ActivityInsert & { participantes: string[]; recordatorio_minutos: number | null; recurrencia: RecurrenceType; recurrencia_fin: string }>({
    titulo: '',
    descripcion: '',
    tipo: 'tarea', // Por defecto actividad diaria
    prioridad: 'media',
    fecha_inicio: preselectedDate
      ? format(new Date(preselectedDate), "yyyy-MM-dd'T'HH:mm")
      : format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    fecha_fin: '',
    fecha_limite: '',
    ubicacion: '',
    es_virtual: false,
    enlace_reunion: '',
    notas: '',
    participantes: [],
    recordatorio_minutos: null,
    recurrencia: 'none',
    recurrencia_fin: ''
  });

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const data = await getAllUsersForSelection();
      setUsers(data);
    } catch (error) {
      console.error('Error cargando usuarios:', error);
      toast.error('Error al cargar usuarios');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.titulo) {
      toast.error('El título es obligatorio');
      return;
    }

    if (!formData.fecha_inicio) {
      toast.error('La fecha y hora de inicio son obligatorias');
      return;
    }

    setLoading(true);

    try {
      // Crear la actividad
      const newActivity = await createActivity({
        titulo: formData.titulo,
        descripcion: formData.descripcion || null,
        tipo: formData.tipo,
        prioridad: formData.prioridad,
        fecha_inicio: new Date(formData.fecha_inicio).toISOString(),
        fecha_fin: formData.fecha_fin ? new Date(formData.fecha_fin).toISOString() : null,
        fecha_limite: formData.fecha_limite ? new Date(formData.fecha_limite).toISOString() : null,
        ubicacion: formData.ubicacion || null,
        es_virtual: formData.es_virtual,
        enlace_reunion: formData.enlace_reunion || null,
        notas: formData.notas || null,
        recordatorio_minutos: formData.recordatorio_minutos,
        recurrencia: formData.recurrencia !== 'none' ? formData.recurrencia : null,
        recurrencia_fin: formData.recurrencia_fin ? new Date(formData.recurrencia_fin).toISOString() : null
      });

      // Agregar participantes si hay
      if (formData.participantes.length > 0 && newActivity?.id) {
        try {
          await addMultipleParticipants(newActivity.id, formData.participantes);
        } catch (partError) {
          console.error('Error agregando participantes:', partError);
          toast.error('Actividad creada, pero hubo error al agregar involucrados');
        }
      }

      toast.success('Actividad diaria creada exitosamente');
      router.push('/calendario');
    } catch (error: any) {
      console.error('Error creando actividad:', error);
      toast.error(error?.message || 'Error al crear la actividad');
    } finally {
      setLoading(false);
    }
  };

  const tipoOptions: { value: ActivityType; label: string }[] = [
    { value: 'tarea', label: 'Tarea' },
    { value: 'otro', label: 'Otro' }
  ];

  const prioridadOptions: { value: ActivityPriority; label: string }[] = [
    { value: 'baja', label: 'Baja' },
    { value: 'media', label: 'Media' },
    { value: 'alta', label: 'Alta' },
    { value: 'urgente', label: 'Urgente' }
  ];

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/calendario">
          <Button variant="ghost" size="sm" icon={<ArrowLeft className="h-4 w-4" />}>
            Volver
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Nueva Actividad Diaria</h1>
          <p className="text-gray-500">Crea una actividad y asigna participantes</p>
        </div>
      </div>

      {/* Form */}
      <Card>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Información básica */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">
              Información Básica
            </h3>
            <Input
              label="Título *"
              value={formData.titulo}
              onChange={e => setFormData({ ...formData, titulo: e.target.value })}
              placeholder="Ej: Revisión de reportes semanales"
              required
            />
            
            <Textarea
              label="Descripción"
              value={formData.descripcion || ''}
              onChange={e => setFormData({ ...formData, descripcion: e.target.value })}
              placeholder="Describe la actividad..."
              rows={3}
            />
          </div>

          {/* Tipo y Prioridad */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Tipo *</label>
              <select
                value={formData.tipo}
                onChange={e => setFormData({ ...formData, tipo: e.target.value as ActivityType })}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors bg-white"
                required
              >
                {tipoOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Prioridad</label>
              <select
                value={formData.prioridad}
                onChange={e => setFormData({ ...formData, prioridad: e.target.value as ActivityPriority })}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors bg-white"
              >
                {prioridadOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Fechas */}
          <div className="bg-blue-50 rounded-xl p-4 space-y-4">
            <h4 className="text-xs font-semibold text-blue-600 uppercase tracking-wide flex items-center gap-1.5">
              <CalendarIcon className="h-3.5 w-3.5" />
              Fechas y horarios
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Fecha y Hora de Inicio *"
                type="datetime-local"
                value={formData.fecha_inicio}
                onChange={e => setFormData({ ...formData, fecha_inicio: e.target.value })}
                required
              />
              
              <Input
                label="Fecha y Hora de Fin"
                type="datetime-local"
                value={formData.fecha_fin || ''}
                onChange={e => setFormData({ ...formData, fecha_fin: e.target.value })}
              />
            </div>
            
            <Input
              label="Fecha límite (opcional)"
              type="datetime-local"
              value={formData.fecha_limite || ''}
              onChange={e => setFormData({ ...formData, fecha_limite: e.target.value })}
            />
          </div>

          {/* Ubicación */}
          <div className="bg-purple-50 rounded-xl p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold text-purple-600 uppercase tracking-wide flex items-center gap-1.5">
                {formData.es_virtual ? <Video className="h-3.5 w-3.5" /> : <MapPin className="h-3.5 w-3.5" />}
                {formData.es_virtual ? 'Reunión Virtual' : 'Ubicación'}
              </h4>
              <label className="flex items-center gap-2 cursor-pointer">
                <span className="text-xs text-purple-600">Virtual</span>
                <input
                  type="checkbox"
                  checked={formData.es_virtual}
                  onChange={e => setFormData({ ...formData, es_virtual: e.target.checked })}
                  className="rounded border-purple-300 text-purple-600 focus:ring-purple-500 h-4 w-4"
                />
              </label>
            </div>
            
            {formData.es_virtual ? (
              <Input
                label="Enlace de la reunión"
                value={formData.enlace_reunion || ''}
                onChange={e => setFormData({ ...formData, enlace_reunion: e.target.value })}
                placeholder="https://meet.google.com/... o https://zoom.us/..."
              />
            ) : (
              <Input
                label="Lugar"
                value={formData.ubicacion || ''}
                onChange={e => setFormData({ ...formData, ubicacion: e.target.value })}
                placeholder="Ej: Oficina principal, Sala de reuniones"
              />
            )}
          </div>

          {/* Recurrencia */}
          <div className="bg-teal-50 rounded-xl p-4 space-y-4">
            <h4 className="text-xs font-semibold text-teal-600 uppercase tracking-wide flex items-center gap-1.5">
              <Repeat className="h-3.5 w-3.5" />
              Programar Recurrente
            </h4>
            <div className="space-y-3">
              <select
                value={formData.recurrencia}
                onChange={e => setFormData({ ...formData, recurrencia: e.target.value as RecurrenceType })}
                className="w-full px-3 py-2.5 border border-teal-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white"
              >
                {RECURRENCE_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>

              {formData.recurrencia !== 'none' && (
                <div className="pt-2 border-t border-teal-100">
                  <Input
                    label="Termina el (opcional)"
                    type="date"
                    value={formData.recurrencia_fin || ''}
                    onChange={e => setFormData({ ...formData, recurrencia_fin: e.target.value })}
                  />
                  <p className="text-xs text-teal-600 mt-1">
                    Si no especificas fecha, se repetirá indefinidamente
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Recordatorio */}
          <div className="bg-amber-50 rounded-xl p-4 space-y-3">
            <h4 className="text-xs font-semibold text-amber-600 uppercase tracking-wide flex items-center gap-1.5">
              <Bell className="h-3.5 w-3.5" />
              Recuérdamelo
            </h4>
            <select
              value={formData.recordatorio_minutos ?? ''}
              onChange={e => setFormData({ 
                ...formData, 
                recordatorio_minutos: e.target.value ? parseInt(e.target.value) : null 
              })}
              className="w-full px-4 py-2.5 border border-amber-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-colors bg-white"
            >
              <option value="">Sin recordatorio</option>
              {REMINDER_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {formData.recordatorio_minutos !== null && formData.participantes.length > 0 && (
              <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-100 p-2 rounded-lg">
                <Bell className="h-3.5 w-3.5" />
                <span>Se enviará un recordatorio a los {formData.participantes.length} involucrado(s)</span>
              </div>
            )}
          </div>

          {/* Participantes/Involucrados */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2 mb-4">
              Participantes
            </h3>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
              <Users className="h-3.5 w-3.5" />
              Selecciona los involucrados ({users.length} disponibles)
            </label>
            <div className="border border-gray-200 rounded-xl max-h-64 overflow-y-auto bg-gray-50">
              {users.length === 0 ? (
                <p className="p-4 text-center text-gray-500 text-sm">No hay usuarios disponibles</p>
              ) : (
                users.map(user => {
                  const isSelected = formData.participantes.includes(user.id);
                  const rolColors: Record<string, string> = {
                    admin: 'bg-red-100 text-red-700',
                    vendedor: 'bg-blue-100 text-blue-700',
                    supervisor: 'bg-green-100 text-green-700',
                    supervisor_nivel1: 'bg-purple-100 text-purple-700',
                    supervisor_vendedor: 'bg-indigo-100 text-indigo-700',
                    marketing: 'bg-emerald-100 text-emerald-700',
                    tecnico: 'bg-amber-100 text-amber-700'
                  };
                  return (
                    <label 
                      key={user.id} 
                      className={`flex items-center gap-3 p-3 cursor-pointer border-b border-gray-100 last:border-b-0 transition-all ${
                        isSelected ? 'bg-indigo-50 border-indigo-100' : 'hover:bg-white'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={e => {
                          if (e.target.checked) {
                            setFormData({ ...formData, participantes: [...formData.participantes, user.id] });
                          } else {
                            setFormData({ ...formData, participantes: formData.participantes.filter(id => id !== user.id) });
                          }
                        }}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                      />
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center flex-shrink-0">
                        <span className="text-white font-semibold text-sm">
                          {user.nombre_completo?.charAt(0) || '?'}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-gray-900">{user.nombre_completo}</p>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${rolColors[user.rol] || 'bg-gray-100 text-gray-700'}`}>
                            {user.rol === 'supervisor_nivel1' ? 'Sup. N1' : 
                            user.rol === 'supervisor_vendedor' ? 'Sup.+Vend.' :
                            user.rol === 'marketing' ? 'Marketing' :
                            user.rol === 'tecnico' ? 'Técnico' : user.rol}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 truncate">{user.email}</p>
                      </div>
                      {isSelected && (
                        <CheckCircle className="h-5 w-5 text-indigo-600 flex-shrink-0" />
                      )}
                    </label>
                  );
                })
              )}
            </div>
            {formData.participantes.length > 0 && (
              <div className="mt-3 p-3 bg-indigo-50 rounded-xl border border-indigo-100">
                <p className="text-sm text-indigo-700 font-medium flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  {formData.participantes.length} participante(s) seleccionado(s)
                </p>
              </div>
            )}
          </div>

          {/* Notas adicionales */}
          <div>
            <Textarea
              label="Notas adicionales"
              value={formData.notas || ''}
              onChange={e => setFormData({ ...formData, notas: e.target.value })}
              placeholder="Notas o recordatorios adicionales..."
              rows={2}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <Link href="/calendario">
              <Button variant="secondary">Cancelar</Button>
            </Link>
            <Button type="submit" loading={loading}>
              Crear Actividad
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

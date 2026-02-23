'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Calendar } from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { createEvent, createEventActivity, getActiveUsers, type EventType, type EventModality } from '@/lib/services/events';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { CheckCircle } from 'lucide-react';

const BRAND_OPTIONS = ['Schwarzkopf', 'Hipertín', 'Keyra', 'Sutra', 'Myrialis', 'Sin Marca'];

export default function NuevoEventoPage() {
  const router = useRouter();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    nombre: '', descripcion: '', tipo: 'curso' as EventType, modalidad: 'presencial' as EventModality,
    fecha_inicio: format(new Date(), "yyyy-MM-dd'T'HH:mm"), fecha_fin: '', ubicacion: '', plataforma: '', objetivo: '',
    responsable_id: '', presupuesto_total: '', margen_objetivo: '', costo_fijo_total: '',
    costo_variable_por_persona: '', cupo_minimo: '', cupo_maximo: '', precio_por_persona: '',
    marcas: [] as string[],
  });

  useEffect(() => { getActiveUsers().then(setUsers).catch(console.error); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nombre || !form.fecha_inicio || !form.responsable_id) {
      toast.error('Nombre, fecha de inicio y responsable son requeridos');
      return;
    }
    setLoading(true);
    try {
      const event = await createEvent({
        nombre: form.nombre, descripcion: form.descripcion || null, tipo: form.tipo, modalidad: form.modalidad,
        fecha_inicio: new Date(form.fecha_inicio).toISOString(),
        fecha_fin: form.fecha_fin ? new Date(form.fecha_fin).toISOString() : null,
        ubicacion: form.ubicacion || null, plataforma: form.plataforma || null, objetivo: form.objetivo || null,
        responsable_id: form.responsable_id,
        marcas: form.marcas,
        presupuesto_total: Number(form.presupuesto_total) || 0,
        margen_objetivo: Number(form.margen_objetivo) || 0,
        costo_fijo_total: Number(form.costo_fijo_total) || 0,
        costo_variable_por_persona: Number(form.costo_variable_por_persona) || 0,
        cupo_minimo: Number(form.cupo_minimo) || 0,
        cupo_maximo: Number(form.cupo_maximo) || 0,
        precio_por_persona: Number(form.precio_por_persona) || 0,
      });

      const eventDate = form.fecha_fin || form.fecha_inicio;
      await createEventActivity({
        event_id: event.id,
        nombre: form.nombre.toUpperCase(),
        descripcion: null,
        tipo: 'operativa',
        responsable_id: form.responsable_id,
        fecha_inicio: new Date(eventDate).toISOString(),
        fecha_fin: null,
        prioridad: 'alta',
        estado: 'pendiente',
        porcentaje_avance: 0,
        es_hito: true,
        notas: null,
      });

      toast.success('Evento creado exitosamente');
      router.push(`/eventos/${event.id}`);
    } catch (err: any) {
      toast.error(err?.message || 'Error al crear evento');
    } finally { setLoading(false); }
  };

  const set = (field: string, value: any) => setForm(p => ({ ...p, [field]: value }));

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/eventos"><Button variant="ghost" size="sm" icon={<ArrowLeft className="h-4 w-4" />}>Volver</Button></Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Nuevo Evento</h1>
          <p className="text-gray-500">Configura un nuevo evento o curso</p>
        </div>
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Info básica */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Información General</h3>
            <Input label="Nombre del evento *" value={form.nombre} onChange={e => set('nombre', e.target.value)} placeholder="Ej: Curso de Marketing Digital" required />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Descripción</label>
              <textarea value={form.descripcion} onChange={e => set('descripcion', e.target.value)} rows={3} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 resize-none" placeholder="Describe el evento..." />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Objetivo</label>
              <textarea value={form.objetivo} onChange={e => set('objetivo', e.target.value)} rows={2} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 resize-none" placeholder="¿Cuál es el objetivo del evento?" />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Tipo *</label>
                <select value={form.tipo} onChange={e => set('tipo', e.target.value)} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl bg-white">
                  <option value="curso">Curso</option><option value="taller">Taller</option><option value="conferencia">Conferencia</option>
                  <option value="evento_corporativo">Evento Corp.</option><option value="seminario">Seminario</option><option value="otro">Otro</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Modalidad</label>
                <select value={form.modalidad} onChange={e => set('modalidad', e.target.value)} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl bg-white">
                  <option value="presencial">Presencial</option><option value="virtual">Virtual</option><option value="hibrido">Híbrido</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Responsable *</label>
                <select value={form.responsable_id} onChange={e => set('responsable_id', e.target.value)} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl bg-white" required>
                  <option value="">Seleccionar...</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.nombre_completo}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Marcas */}
          <div className="bg-amber-50 rounded-xl p-4 space-y-3">
            <h4 className="text-xs font-semibold text-amber-600 uppercase tracking-wide">🏷️ Marcas del Evento</h4>
            <div className="flex flex-wrap gap-2">
              {BRAND_OPTIONS.map(brand => {
                const selected = form.marcas.includes(brand);
                return (
                  <button
                    key={brand}
                    type="button"
                    onClick={() => set('marcas', selected ? form.marcas.filter((b: string) => b !== brand) : [...form.marcas, brand])}
                    className={`text-sm px-3 py-1.5 rounded-full border transition-all ${
                      selected
                        ? 'bg-amber-200 text-amber-800 border-amber-400 font-semibold'
                        : 'bg-white text-gray-500 border-gray-200 hover:border-amber-300 hover:text-amber-600'
                    }`}
                  >
                    {selected && <CheckCircle className="h-3.5 w-3.5 inline mr-1" />}
                    {brand}
                  </button>
                );
              })}
            </div>
            {form.marcas.length > 0 && (
              <p className="text-xs text-amber-700 font-medium">{form.marcas.length} marca(s) seleccionada(s)</p>
            )}
          </div>

          {/* Fechas y Ubicación */}
          <div className="bg-blue-50 rounded-xl p-4 space-y-4">
            <h4 className="text-xs font-semibold text-blue-600 uppercase tracking-wide flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" />Fechas y Ubicación</h4>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Fecha inicio *" type="datetime-local" value={form.fecha_inicio} onChange={e => set('fecha_inicio', e.target.value)} required />
              <Input label="Fecha fin" type="datetime-local" value={form.fecha_fin} onChange={e => set('fecha_fin', e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Ubicación" value={form.ubicacion} onChange={e => set('ubicacion', e.target.value)} placeholder="Dirección o lugar" />
              <Input label="Plataforma (virtual)" value={form.plataforma} onChange={e => set('plataforma', e.target.value)} placeholder="Zoom, Teams, etc." />
            </div>
          </div>

          {/* Presupuesto y Costeo */}
          <div className="bg-green-50 rounded-xl p-4 space-y-4">
            <h4 className="text-xs font-semibold text-green-600 uppercase tracking-wide">💰 Presupuesto y Costeo</h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <Input label="Presupuesto total ($)" type="number" step="0.01" value={form.presupuesto_total} onChange={e => set('presupuesto_total', e.target.value)} placeholder="0.00" />
              <Input label="Margen objetivo (%)" type="number" step="0.01" value={form.margen_objetivo} onChange={e => set('margen_objetivo', e.target.value)} placeholder="20" />
              <Input label="Costo fijo total ($)" type="number" step="0.01" value={form.costo_fijo_total} onChange={e => set('costo_fijo_total', e.target.value)} placeholder="0.00" />
              <Input label="Costo var. por persona ($)" type="number" step="0.01" value={form.costo_variable_por_persona} onChange={e => set('costo_variable_por_persona', e.target.value)} placeholder="0.00" />
              <Input label="Precio por persona ($)" type="number" step="0.01" value={form.precio_por_persona} onChange={e => set('precio_por_persona', e.target.value)} placeholder="0.00" />
            </div>
          </div>

          {/* Cupos */}
          <div className="bg-purple-50 rounded-xl p-4 space-y-4">
            <h4 className="text-xs font-semibold text-purple-600 uppercase tracking-wide">👥 Cupos</h4>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Cupo mínimo" type="number" value={form.cupo_minimo} onChange={e => set('cupo_minimo', e.target.value)} placeholder="0" />
              <Input label="Cupo máximo" type="number" value={form.cupo_maximo} onChange={e => set('cupo_maximo', e.target.value)} placeholder="0" />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Link href="/eventos"><Button variant="secondary">Cancelar</Button></Link>
            <Button type="submit" loading={loading}>Crear Evento</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

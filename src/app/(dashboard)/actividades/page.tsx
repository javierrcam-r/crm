'use client';

import { useState, useEffect } from 'react';
import { 
  Plus, 
  Calendar as CalendarIcon, 
  LayoutGrid, 
  List,
  Clock,
  Users,
  MapPin,
  Video,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  Edit,
  Trash2,
  CheckCircle,
  Circle,
  AlertCircle,
  Filter,
  Search
} from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import { useAuth } from '@/contexts/AuthContext';
import { 
  getActivities, 
  createActivity, 
  updateActivity, 
  updateActivityStatus,
  deleteActivity,
  addMultipleParticipants,
  getAllUsersForSelection
} from '@/lib/services/activities';
import type { Activity, ActivityInsert, ActivityStatus, ActivityType, ActivityPriority, UserProfile } from '@/types/database';
import toast from 'react-hot-toast';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, isToday, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

type ViewMode = 'kanban' | 'calendar' | 'list';

const tipoLabels: Record<ActivityType, string> = {
  reunion: 'Reunión',
  tarea: 'Tarea',
  seguimiento: 'Seguimiento',
  capacitacion: 'Capacitación',
  otro: 'Otro'
};

const tipoColors: Record<ActivityType, string> = {
  reunion: 'bg-blue-100 text-blue-700',
  tarea: 'bg-purple-100 text-purple-700',
  seguimiento: 'bg-amber-100 text-amber-700',
  capacitacion: 'bg-green-100 text-green-700',
  otro: 'bg-gray-100 text-gray-700'
};

const prioridadLabels: Record<ActivityPriority, string> = {
  baja: 'Baja',
  media: 'Media',
  alta: 'Alta',
  urgente: 'Urgente'
};

const prioridadColors: Record<ActivityPriority, string> = {
  baja: 'bg-gray-100 text-gray-600',
  media: 'bg-blue-100 text-blue-600',
  alta: 'bg-orange-100 text-orange-600',
  urgente: 'bg-red-100 text-red-600'
};

const estadoLabels: Record<ActivityStatus, string> = {
  planificacion: 'Planificación',
  haciendo: 'En Progreso',
  realizado: 'Realizado',
  cancelado: 'Cancelado'
};

const estadoColors: Record<ActivityStatus, { bg: string; border: string; text: string }> = {
  planificacion: { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-700' },
  haciendo: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700' },
  realizado: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700' },
  cancelado: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700' }
};

export default function ActividadesPage() {
  const { userProfile } = useAuth();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [users, setUsers] = useState<Pick<UserProfile, 'id' | 'nombre_completo' | 'email' | 'rol'>[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('kanban');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTipo, setFilterTipo] = useState<ActivityType | ''>('');
  const [filterPrioridad, setFilterPrioridad] = useState<ActivityPriority | ''>('');
  const [tableNotExists, setTableNotExists] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState<ActivityInsert & { participantes: string[] }>({
    titulo: '',
    descripcion: '',
    tipo: 'reunion',
    prioridad: 'media',
    fecha_inicio: '',
    fecha_fin: '',
    fecha_limite: '',
    ubicacion: '',
    es_virtual: false,
    enlace_reunion: '',
    notas: '',
    participantes: []
  });
  
  useEffect(() => {
    loadData();
  }, []);
  
  async function loadData() {
    try {
      setLoading(true);
      
      // Cargar usuarios primero (siempre debería funcionar)
      const usersData = await getAllUsersForSelection();
      setUsers(usersData);
      console.log('Usuarios cargados:', usersData.length);
      
      // Intentar cargar actividades (puede fallar si la tabla no existe)
      try {
        const activitiesData = await getActivities();
        console.log('Actividades cargadas:', activitiesData.length, activitiesData);
        setActivities(activitiesData);
        setTableNotExists(false);
      } catch (activityError: any) {
        console.error('Error loading activities:', activityError);
        // Si es error de tabla no existe, mostrar mensaje específico
        if (activityError?.message?.includes('does not exist') || 
            activityError?.message?.includes('relation') ||
            activityError?.code === '42P01' ||
            activityError?.code === 'PGRST204') {
          setTableNotExists(true);
        } else {
          toast.error('Error cargando actividades: ' + (activityError?.message || 'Error desconocido'));
        }
        setActivities([]);
      }
    } catch (error: any) {
      console.error('Error loading data:', error);
      toast.error('Error al cargar datos: ' + (error?.message || 'Error desconocido'));
    } finally {
      setLoading(false);
    }
  }
  
  // Filter activities
  const filteredActivities = activities.filter(activity => {
    const matchesSearch = activity.titulo.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         activity.descripcion?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTipo = !filterTipo || activity.tipo === filterTipo;
    const matchesPrioridad = !filterPrioridad || activity.prioridad === filterPrioridad;
    return matchesSearch && matchesTipo && matchesPrioridad;
  });
  
  // Group by status for Kanban
  const kanbanColumns: { status: ActivityStatus; activities: Activity[] }[] = [
    { status: 'planificacion', activities: filteredActivities.filter(a => a.estado === 'planificacion') },
    { status: 'haciendo', activities: filteredActivities.filter(a => a.estado === 'haciendo') },
    { status: 'realizado', activities: filteredActivities.filter(a => a.estado === 'realizado') }
  ];
  
  async function handleCreateActivity() {
    if (!formData.titulo || !formData.fecha_inicio) {
      toast.error('Título y fecha de inicio son requeridos');
      return;
    }
    
    try {
      console.log('Creando actividad con datos:', formData);
      
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
        notas: formData.notas || null
      });
      
      console.log('Actividad creada:', newActivity);
      
      // Add participants/involucrados
      if (formData.participantes.length > 0 && newActivity?.id) {
        console.log('Agregando participantes:', formData.participantes);
        try {
          const participantsResult = await addMultipleParticipants(newActivity.id, formData.participantes);
          console.log('Participantes agregados:', participantsResult);
        } catch (partError) {
          console.error('Error agregando participantes:', partError);
          toast.error('Actividad creada, pero hubo error al agregar involucrados');
        }
      }
      
      toast.success('Actividad creada exitosamente');
      setShowCreateModal(false);
      resetForm();
      setTableNotExists(false);
      loadData();
    } catch (error: any) {
      console.error('Error creating activity:', error);
      toast.error(error?.message || 'Error al crear la actividad');
    }
  }
  
  async function handleStatusChange(activityId: string, newStatus: ActivityStatus) {
    try {
      await updateActivityStatus(activityId, newStatus);
      setActivities(prev => prev.map(a => 
        a.id === activityId ? { ...a, estado: newStatus } : a
      ));
      toast.success('Estado actualizado');
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Error al actualizar el estado');
    }
  }
  
  async function handleDeleteActivity(activityId: string) {
    if (!confirm('¿Estás seguro de eliminar esta actividad?')) return;
    
    try {
      await deleteActivity(activityId);
      setActivities(prev => prev.filter(a => a.id !== activityId));
      setShowDetailModal(false);
      toast.success('Actividad eliminada');
    } catch (error) {
      console.error('Error deleting activity:', error);
      toast.error('Error al eliminar la actividad');
    }
  }
  
  function resetForm() {
    setFormData({
      titulo: '',
      descripcion: '',
      tipo: 'reunion',
      prioridad: 'media',
      fecha_inicio: '',
      fecha_fin: '',
      fecha_limite: '',
      ubicacion: '',
      es_virtual: false,
      enlace_reunion: '',
      notas: '',
      participantes: []
    });
  }
  
  function openActivityDetail(activity: Activity) {
    setSelectedActivity(activity);
    setShowDetailModal(true);
  }
  
  // Calendar helpers
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
  
  // Get activities for a specific day
  function getActivitiesForDay(day: Date) {
    return filteredActivities.filter(activity => 
      isSameDay(parseISO(activity.fecha_inicio), day)
    );
  }
  
  // Activity Card Component
  const ActivityCard = ({ activity, compact = false }: { activity: Activity; compact?: boolean }) => (
    <div 
      className={`bg-white rounded-lg border shadow-sm p-3 cursor-pointer hover:shadow-md transition-shadow ${
        compact ? 'p-2' : ''
      }`}
      onClick={() => openActivityDetail(activity)}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className={`text-xs px-2 py-0.5 rounded-full ${tipoColors[activity.tipo]}`}>
          {tipoLabels[activity.tipo]}
        </span>
        <span className={`text-xs px-2 py-0.5 rounded-full ${prioridadColors[activity.prioridad]}`}>
          {prioridadLabels[activity.prioridad]}
        </span>
      </div>
      
      <h4 className={`font-medium text-gray-900 ${compact ? 'text-sm' : ''} line-clamp-2`}>
        {activity.titulo}
      </h4>
      
      {!compact && activity.descripcion && (
        <p className="text-sm text-gray-500 mt-1 line-clamp-2">{activity.descripcion}</p>
      )}
      
      <div className="mt-2 flex items-center gap-3 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {format(parseISO(activity.fecha_inicio), 'HH:mm', { locale: es })}
        </span>
        
        {activity.participants && activity.participants.length > 0 && (
          <span className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            {activity.participants.length}
          </span>
        )}
        
        {activity.es_virtual ? (
          <Video className="h-3 w-3 text-blue-500" />
        ) : activity.ubicacion && (
          <MapPin className="h-3 w-3" />
        )}
      </div>
    </div>
  );
  
  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }
  
  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Alerta si las tablas no existen */}
      {tableNotExists && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-6 w-6 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-amber-800">Configuración Requerida</h3>
              <p className="text-sm text-amber-700 mt-1">
                Las tablas de actividades no existen en la base de datos. 
                Ejecuta la migración SQL en Supabase para habilitar esta funcionalidad.
              </p>
              <p className="text-xs text-amber-600 mt-2">
                Ve a Supabase → SQL Editor → Ejecuta el contenido de <code className="bg-amber-100 px-1 rounded">021_supervisor_nivel1.sql</code>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Actividades y Reuniones</h1>
          <p className="text-gray-500 mt-1">Gestiona reuniones, tareas y seguimientos con tu equipo</p>
        </div>
        
        <Button onClick={() => setShowCreateModal(true)} disabled={tableNotExists}>
          <Plus className="h-4 w-4 mr-2" />
          Nueva Actividad
        </Button>
      </div>
      
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {kanbanColumns.map(col => (
          <Card key={col.status} className={`${estadoColors[col.status].bg} border ${estadoColors[col.status].border}`}>
            <div className="p-4">
              <p className={`text-sm font-medium ${estadoColors[col.status].text}`}>
                {estadoLabels[col.status]}
              </p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{col.activities.length}</p>
            </div>
          </Card>
        ))}
        <Card className="bg-gray-50 border border-gray-200">
          <div className="p-4">
            <p className="text-sm font-medium text-gray-600">Total</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{filteredActivities.length}</p>
          </div>
        </Card>
      </div>
      
      {/* View Toggle & Filters */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex gap-2">
          <Button
            variant={viewMode === 'kanban' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setViewMode('kanban')}
          >
            <LayoutGrid className="h-4 w-4 mr-1" />
            Kanban
          </Button>
          <Button
            variant={viewMode === 'calendar' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setViewMode('calendar')}
          >
            <CalendarIcon className="h-4 w-4 mr-1" />
            Calendario
          </Button>
          <Button
            variant={viewMode === 'list' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setViewMode('list')}
          >
            <List className="h-4 w-4 mr-1" />
            Lista
          </Button>
        </div>
        
        <div className="flex gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-none">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 border rounded-lg text-sm w-full sm:w-48"
            />
          </div>
          
          <select
            value={filterTipo}
            onChange={e => setFilterTipo(e.target.value as ActivityType | '')}
            className="px-3 py-2 border rounded-lg text-sm"
          >
            <option value="">Todos los tipos</option>
            {Object.entries(tipoLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          
          <select
            value={filterPrioridad}
            onChange={e => setFilterPrioridad(e.target.value as ActivityPriority | '')}
            className="px-3 py-2 border rounded-lg text-sm"
          >
            <option value="">Todas las prioridades</option>
            {Object.entries(prioridadLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
      </div>
      
      {/* Kanban View */}
      {viewMode === 'kanban' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {kanbanColumns.map(column => (
            <div 
              key={column.status} 
              className={`rounded-xl p-4 ${estadoColors[column.status].bg} border ${estadoColors[column.status].border}`}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className={`font-semibold ${estadoColors[column.status].text}`}>
                  {estadoLabels[column.status]}
                </h3>
                <span className="text-sm text-gray-500">{column.activities.length}</span>
              </div>
              
              <div className="space-y-3">
                {column.activities.length === 0 ? (
                  <div className="text-center py-8 text-gray-400 text-sm">
                    Sin actividades
                  </div>
                ) : (
                  column.activities.map(activity => (
                    <div key={activity.id} className="group relative">
                      <ActivityCard activity={activity} />
                      
                      {/* Quick status change buttons */}
                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="flex gap-1 bg-white rounded-lg shadow-lg p-1">
                          {column.status !== 'planificacion' && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleStatusChange(activity.id, 'planificacion'); }}
                              className="p-1 hover:bg-gray-100 rounded"
                              title="Mover a Planificación"
                            >
                              <Circle className="h-4 w-4 text-slate-500" />
                            </button>
                          )}
                          {column.status !== 'haciendo' && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleStatusChange(activity.id, 'haciendo'); }}
                              className="p-1 hover:bg-gray-100 rounded"
                              title="Mover a En Progreso"
                            >
                              <AlertCircle className="h-4 w-4 text-blue-500" />
                            </button>
                          )}
                          {column.status !== 'realizado' && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleStatusChange(activity.id, 'realizado'); }}
                              className="p-1 hover:bg-gray-100 rounded"
                              title="Marcar como Realizado"
                            >
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* Calendar View */}
      {viewMode === 'calendar' && (
        <Card>
          <div className="p-4 border-b flex items-center justify-between">
            <button 
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <h3 className="font-semibold text-lg">
              {format(currentMonth, 'MMMM yyyy', { locale: es })}
            </h3>
            <button 
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
          
          <div className="p-4">
            {/* Days header */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(day => (
                <div key={day} className="text-center text-sm font-medium text-gray-500 py-2">
                  {day}
                </div>
              ))}
            </div>
            
            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-1">
              {/* Empty cells for days before month start */}
              {Array.from({ length: (monthStart.getDay() + 6) % 7 }).map((_, i) => (
                <div key={`empty-${i}`} className="h-24 bg-gray-50 rounded-lg" />
              ))}
              
              {calendarDays.map(day => {
                const dayActivities = getActivitiesForDay(day);
                const isCurrentDay = isToday(day);
                
                return (
                  <div 
                    key={day.toISOString()} 
                    className={`h-24 border rounded-lg p-1 overflow-hidden ${
                      isCurrentDay ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-gray-100'
                    }`}
                  >
                    <div className={`text-sm font-medium mb-1 ${
                      isCurrentDay ? 'text-indigo-600' : 'text-gray-700'
                    }`}>
                      {format(day, 'd')}
                    </div>
                    
                    <div className="space-y-0.5 overflow-hidden">
                      {dayActivities.slice(0, 2).map(activity => (
                        <div 
                          key={activity.id}
                          onClick={() => openActivityDetail(activity)}
                          className={`text-xs px-1 py-0.5 rounded truncate cursor-pointer ${tipoColors[activity.tipo]}`}
                        >
                          {activity.titulo}
                        </div>
                      ))}
                      {dayActivities.length > 2 && (
                        <div className="text-xs text-gray-500 px-1">
                          +{dayActivities.length - 2} más
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
      )}
      
      {/* List View */}
      {viewMode === 'list' && (
        <Card>
          <div className="divide-y">
            {filteredActivities.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                No hay actividades que coincidan con los filtros
              </div>
            ) : (
              filteredActivities.map(activity => (
                <div 
                  key={activity.id}
                  className="p-4 hover:bg-gray-50 cursor-pointer flex items-center gap-4"
                  onClick={() => openActivityDetail(activity)}
                >
                  <div className="flex-shrink-0">
                    <span className={`px-2 py-1 rounded-full text-xs ${estadoColors[activity.estado].bg} ${estadoColors[activity.estado].text}`}>
                      {estadoLabels[activity.estado]}
                    </span>
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-gray-900">{activity.titulo}</h4>
                    {activity.descripcion && (
                      <p className="text-sm text-gray-500 truncate">{activity.descripcion}</p>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${tipoColors[activity.tipo]}`}>
                      {tipoLabels[activity.tipo]}
                    </span>
                    <span>{format(parseISO(activity.fecha_inicio), 'dd/MM/yyyy HH:mm', { locale: es })}</span>
                    {activity.participants && activity.participants.length > 0 && (
                      <span className="flex items-center gap-1">
                        <Users className="h-4 w-4" />
                        {activity.participants.length}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      )}
      
      {/* Create Activity Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => { setShowCreateModal(false); resetForm(); }}
        title="Nueva Actividad"
        size="lg"
      >
        <div className="space-y-4">
          <Input
            label="Título *"
            value={formData.titulo}
            onChange={e => setFormData(prev => ({ ...prev, titulo: e.target.value }))}
            placeholder="Ej: Reunión de equipo semanal"
          />
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
            <textarea
              value={formData.descripcion || ''}
              onChange={e => setFormData(prev => ({ ...prev, descripcion: e.target.value }))}
              rows={3}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
              placeholder="Describe el objetivo de la actividad..."
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
              <select
                value={formData.tipo}
                onChange={e => setFormData(prev => ({ ...prev, tipo: e.target.value as ActivityType }))}
                className="w-full px-3 py-2 border rounded-lg"
              >
                {Object.entries(tipoLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Prioridad</label>
              <select
                value={formData.prioridad}
                onChange={e => setFormData(prev => ({ ...prev, prioridad: e.target.value as ActivityPriority }))}
                className="w-full px-3 py-2 border rounded-lg"
              >
                {Object.entries(prioridadLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Fecha y hora de inicio *"
              type="datetime-local"
              value={formData.fecha_inicio}
              onChange={e => setFormData(prev => ({ ...prev, fecha_inicio: e.target.value }))}
            />
            
            <Input
              label="Fecha y hora de fin"
              type="datetime-local"
              value={formData.fecha_fin || ''}
              onChange={e => setFormData(prev => ({ ...prev, fecha_fin: e.target.value }))}
            />
          </div>
          
          <Input
            label="Fecha límite"
            type="datetime-local"
            value={formData.fecha_limite || ''}
            onChange={e => setFormData(prev => ({ ...prev, fecha_limite: e.target.value }))}
          />
          
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.es_virtual}
                onChange={e => setFormData(prev => ({ ...prev, es_virtual: e.target.checked }))}
                className="rounded"
              />
              <span className="text-sm">Reunión virtual</span>
            </label>
          </div>
          
          {formData.es_virtual ? (
            <Input
              label="Enlace de la reunión"
              value={formData.enlace_reunion || ''}
              onChange={e => setFormData(prev => ({ ...prev, enlace_reunion: e.target.value }))}
              placeholder="https://meet.google.com/... o https://zoom.us/..."
            />
          ) : (
            <Input
              label="Ubicación"
              value={formData.ubicacion || ''}
              onChange={e => setFormData(prev => ({ ...prev, ubicacion: e.target.value }))}
              placeholder="Ej: Sala de reuniones 1"
            />
          )}
          
          {/* Involucrados/Participantes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Users className="h-4 w-4 inline mr-1" />
              Involucrados ({users.length} usuarios disponibles)
            </label>
            <div className="border rounded-lg max-h-64 overflow-y-auto bg-gray-50">
              {users.length === 0 ? (
                <p className="p-4 text-center text-gray-500 text-sm">No hay usuarios disponibles</p>
              ) : (
                users.map(user => {
                  const isSelected = formData.participantes.includes(user.id);
                  const rolColors: Record<string, string> = {
                    admin: 'bg-red-100 text-red-700',
                    vendedor: 'bg-blue-100 text-blue-700',
                    supervisor: 'bg-green-100 text-green-700',
                    supervisor_nivel1: 'bg-purple-100 text-purple-700'
                  };
                  return (
                    <label 
                      key={user.id} 
                      className={`flex items-center gap-3 p-3 cursor-pointer border-b last:border-b-0 transition-colors ${
                        isSelected ? 'bg-indigo-50' : 'hover:bg-white'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={e => {
                          if (e.target.checked) {
                            setFormData(prev => ({ ...prev, participantes: [...prev.participantes, user.id] }));
                          } else {
                            setFormData(prev => ({ ...prev, participantes: prev.participantes.filter(id => id !== user.id) }));
                          }
                        }}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-gray-900">{user.nombre_completo}</p>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${rolColors[user.rol] || 'bg-gray-100 text-gray-700'}`}>
                            {user.rol === 'supervisor_nivel1' ? 'Sup. N1' : user.rol}
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
              <div className="mt-2 p-2 bg-indigo-50 rounded-lg">
                <p className="text-sm text-indigo-700 font-medium">
                  ✓ {formData.participantes.length} involucrado(s) seleccionado(s)
                </p>
              </div>
            )}
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notas adicionales</label>
            <textarea
              value={formData.notas || ''}
              onChange={e => setFormData(prev => ({ ...prev, notas: e.target.value }))}
              rows={2}
              className="w-full px-3 py-2 border rounded-lg"
              placeholder="Notas o recordatorios..."
            />
          </div>
          
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="secondary" onClick={() => { setShowCreateModal(false); resetForm(); }}>
              Cancelar
            </Button>
            <Button onClick={handleCreateActivity}>
              Crear Actividad
            </Button>
          </div>
        </div>
      </Modal>
      
      {/* Activity Detail Modal */}
      <Modal
        isOpen={showDetailModal}
        onClose={() => { setShowDetailModal(false); setSelectedActivity(null); }}
        title={selectedActivity?.titulo || 'Detalle de Actividad'}
        size="lg"
      >
        {selectedActivity && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`px-3 py-1 rounded-full text-sm ${tipoColors[selectedActivity.tipo]}`}>
                {tipoLabels[selectedActivity.tipo]}
              </span>
              <span className={`px-3 py-1 rounded-full text-sm ${prioridadColors[selectedActivity.prioridad]}`}>
                {prioridadLabels[selectedActivity.prioridad]}
              </span>
              <span className={`px-3 py-1 rounded-full text-sm ${estadoColors[selectedActivity.estado].bg} ${estadoColors[selectedActivity.estado].text}`}>
                {estadoLabels[selectedActivity.estado]}
              </span>
            </div>
            
            {selectedActivity.descripcion && (
              <div>
                <h4 className="text-sm font-medium text-gray-500 mb-1">Descripción</h4>
                <p className="text-gray-700">{selectedActivity.descripcion}</p>
              </div>
            )}
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h4 className="text-sm font-medium text-gray-500 mb-1">Fecha inicio</h4>
                <p className="text-gray-700 flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4" />
                  {format(parseISO(selectedActivity.fecha_inicio), "PPPp", { locale: es })}
                </p>
              </div>
              
              {selectedActivity.fecha_fin && (
                <div>
                  <h4 className="text-sm font-medium text-gray-500 mb-1">Fecha fin</h4>
                  <p className="text-gray-700">
                    {format(parseISO(selectedActivity.fecha_fin), "PPPp", { locale: es })}
                  </p>
                </div>
              )}
            </div>
            
            {selectedActivity.ubicacion && (
              <div>
                <h4 className="text-sm font-medium text-gray-500 mb-1">Ubicación</h4>
                <p className="text-gray-700 flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  {selectedActivity.ubicacion}
                </p>
              </div>
            )}
            
            {selectedActivity.es_virtual && selectedActivity.enlace_reunion && (
              <div>
                <h4 className="text-sm font-medium text-gray-500 mb-1">Enlace de reunión</h4>
                <a 
                  href={selectedActivity.enlace_reunion} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-indigo-600 hover:underline flex items-center gap-2"
                >
                  <Video className="h-4 w-4" />
                  Unirse a la reunión
                </a>
              </div>
            )}
            
            {/* Participants */}
            {selectedActivity.participants && selectedActivity.participants.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-500 mb-2">
                  Participantes ({selectedActivity.participants.length})
                </h4>
                <div className="space-y-2">
                  {selectedActivity.participants.map(p => (
                    <div key={p.id} className="flex items-center justify-between bg-gray-50 rounded-lg p-2">
                      <div>
                        <p className="font-medium text-sm">{p.user_profile?.nombre_completo}</p>
                        <p className="text-xs text-gray-500">{p.user_profile?.email}</p>
                      </div>
                      <Badge variant={
                        p.estado_confirmacion === 'confirmado' ? 'green' :
                        p.estado_confirmacion === 'rechazado' ? 'red' :
                        p.estado_confirmacion === 'tentativo' ? 'yellow' : 'gray'
                      }>
                        {p.estado_confirmacion}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {selectedActivity.notas && (
              <div>
                <h4 className="text-sm font-medium text-gray-500 mb-1">Notas</h4>
                <p className="text-gray-700 bg-gray-50 p-3 rounded-lg">{selectedActivity.notas}</p>
              </div>
            )}
            
            {/* Change status */}
            <div>
              <h4 className="text-sm font-medium text-gray-500 mb-2">Cambiar estado</h4>
              <div className="flex gap-2">
                {(['planificacion', 'haciendo', 'realizado'] as ActivityStatus[]).map(status => (
                  <button
                    key={status}
                    onClick={() => handleStatusChange(selectedActivity.id, status)}
                    disabled={selectedActivity.estado === status}
                    className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                      selectedActivity.estado === status 
                        ? `${estadoColors[status].bg} ${estadoColors[status].text} border ${estadoColors[status].border}` 
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {estadoLabels[status]}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="flex justify-between pt-4 border-t">
              <Button 
                variant="danger" 
                size="sm"
                onClick={() => handleDeleteActivity(selectedActivity.id)}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Eliminar
              </Button>
              
              <Button variant="secondary" onClick={() => setShowDetailModal(false)}>
                Cerrar
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

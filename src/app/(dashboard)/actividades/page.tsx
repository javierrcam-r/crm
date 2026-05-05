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
  ChevronDown,
  ChevronUp,
  MoreVertical,
  Edit,
  Trash2,
  CheckCircle,
  Circle,
  AlertCircle,
  Filter,
  Search,
  Minus,
  Bell,
  Mail,
  MessageSquare,
  Send,
  Repeat
} from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import ActivityReminder, { REMINDER_OPTIONS } from '@/components/ui/ActivityReminder';
import { useAuth } from '@/contexts/AuthContext';
import { fuzzySearch } from '@/lib/search';
import VoiceSearch from '@/components/ui/VoiceSearch';
import { 
  getActivities, 
  createActivity, 
  updateActivity, 
  updateActivityStatus,
  deleteActivity,
  addMultipleParticipants,
  removeAllParticipants,
  getAllUsersForSelection,
  addComment,
  getActivityComments
} from '@/lib/services/activities';
import type { Activity, ActivityInsert, ActivityStatus, ActivityType, ActivityPriority, UserProfile, ActivityComment, RecurrenceType } from '@/types/database';
import toast from 'react-hot-toast';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, isToday, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

type ViewMode = 'kanban' | 'calendar' | 'list';

const tipoLabels: Record<ActivityType, string> = {
  reunion: 'Reunión',
  tarea: 'Tarea',
  seguimiento: 'Seguimiento',
  capacitacion: 'Capacitación',
  tecnico: 'Técnico',
  otro: 'Otro'
};

const tipoColors: Record<ActivityType, string> = {
  reunion: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
  tarea: 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300',
  seguimiento: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
  capacitacion: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300',
  tecnico: 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 ring-1 ring-amber-400',
  otro: 'bg-gray-100 dark:bg-gray-700/40 text-gray-700 dark:text-gray-300'
};

const prioridadLabels: Record<ActivityPriority, string> = {
  baja: 'Baja',
  media: 'Media',
  alta: 'Alta',
  urgente: 'Urgente'
};

const prioridadColors: Record<ActivityPriority, string> = {
  baja: 'bg-gray-100 dark:bg-gray-700/40 text-gray-600 dark:text-gray-300',
  media: 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300',
  alta: 'bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-300',
  urgente: 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-300'
};

const estadoLabels: Record<ActivityStatus, string> = {
  planificacion: 'Planificación',
  haciendo: 'En Progreso',
  realizado: 'Realizado',
  cancelado: 'Cancelado'
};

const estadoColors: Record<ActivityStatus, { bg: string; border: string; text: string }> = {
  planificacion: { bg: 'bg-slate-50 dark:bg-slate-800/50', border: 'border-slate-200 dark:border-slate-700', text: 'text-slate-700 dark:text-slate-300' },
  haciendo: { bg: 'bg-blue-50 dark:bg-blue-900/30', border: 'border-blue-200 dark:border-blue-800', text: 'text-blue-700 dark:text-blue-300' },
  realizado: { bg: 'bg-green-50 dark:bg-green-900/30', border: 'border-green-200 dark:border-green-800', text: 'text-green-700 dark:text-green-300' },
  cancelado: { bg: 'bg-red-50 dark:bg-red-900/30', border: 'border-red-200 dark:border-red-800', text: 'text-red-700 dark:text-red-300' }
};

// Opciones de recurrencia tipo Google Calendar
const RECURRENCE_OPTIONS = [
  { value: 'none', label: 'No se repite' },
  { value: 'daily', label: 'Todos los días' },
  { value: 'weekly', label: 'Cada semana' },
  { value: 'biweekly', label: 'Cada 2 semanas' },
  { value: 'monthly', label: 'Cada mes' },
  { value: 'yearly', label: 'Cada año' },
  { value: 'weekdays', label: 'Cada día de la semana (Lun-Vie)' },
];

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
  const [filterPersona, setFilterPersona] = useState<string>('');
  const [tableNotExists, setTableNotExists] = useState(false);
  const isSupervisorN1 = userProfile?.rol === 'supervisor_nivel1';
  const [showRealizados, setShowRealizados] = useState(isSupervisorN1); // Solo Supervisor N1 tiene abierto por defecto
  const [isEditing, setIsEditing] = useState(false);
  const [editingActivityId, setEditingActivityId] = useState<string | null>(null);
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState<ActivityInsert & { participantes: string[]; recordatorio_minutos: number | null; recurrencia: RecurrenceType; recurrencia_fin: string }>({
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
    participantes: [],
    recordatorio_minutos: null,
    recurrencia: 'none',
    recurrencia_fin: ''
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
    const matchesSearch = !searchTerm || fuzzySearch(searchTerm, activity.titulo) > 0 ||
                         fuzzySearch(searchTerm, activity.descripcion || '') > 0;
    const matchesTipo = !filterTipo || activity.tipo === filterTipo;
    const matchesPrioridad = !filterPrioridad || activity.prioridad === filterPrioridad;

    // Filtro de visibilidad por rol
    const rol = userProfile?.rol;
    const currentId = userProfile?.id;
    const isCreator = activity.created_by_user_id === currentId;
    const isParticipant = Array.isArray(activity.participants) &&
                         activity.participants.some(p => p.user_profile_id === currentId);
    // Objetivos Estratégicos: SOLO reunión, capacitación y seguimiento.
    // Las actividades diarias (tarea/otro) se gestionan desde el Calendario, no aquí.
    const isStrategicType = activity.tipo === 'reunion' || activity.tipo === 'capacitacion' || activity.tipo === 'seguimiento';
    if (!isStrategicType) return false;

    // Filtro de visibilidad por rol (solo actividades estratégicas o con participantes)
    let matchesVisibility = true;
    if (rol === 'admin' || rol === 'supervisor_nivel1' || rol === 'supervisor' || rol === 'supervisor_vendedor') {
      matchesVisibility = true; // Supervisores ven todas las estratégicas
    } else {
      // Vendedores y otros: solo las suyas o donde participan
      matchesVisibility = isCreator || isParticipant;
    }

    // Filtro por persona (solo para Supervisor N1)
    const matchesPersona = !filterPersona ||
                          activity.created_by_user_id === filterPersona ||
                          (Array.isArray(activity.participants) &&
                           activity.participants.some(p => p.user_profile_id === filterPersona));

    // Mostrar TODAS las actividades de todos los usuarios.
    // Supervisor N1 y admin ven todo; vendedores solo ven las suyas (filtrado arriba en matchesVisibility).
    return matchesSearch && matchesTipo && matchesPrioridad && matchesPersona && matchesVisibility;
  });
  
  // Group by status for Kanban
  // Solo Supervisor N1 ve la columna "Realizado", otros roles no la ven
  const kanbanColumns: { status: ActivityStatus; activities: Activity[] }[] =
    isSupervisorN1
      ? [
          { status: 'planificacion', activities: filteredActivities.filter(a => a.estado === 'planificacion') },
          { status: 'haciendo', activities: filteredActivities.filter(a => a.estado === 'haciendo') },
          { status: 'realizado', activities: filteredActivities.filter(a => a.estado === 'realizado') }
        ]
      : [
          { status: 'planificacion', activities: filteredActivities.filter(a => a.estado === 'planificacion') },
          { status: 'haciendo', activities: filteredActivities.filter(a => a.estado === 'haciendo') }
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
    // Solo Supervisor N1 puede marcar como "Realizado"
    if (newStatus === 'realizado' && !isSupervisorN1) {
      toast.error('Solo Supervisores Nivel 1 pueden marcar actividades como Realizado');
      return;
    }

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
      participantes: [],
      recordatorio_minutos: null,
      recurrencia: 'none',
      recurrencia_fin: ''
    });
    setIsEditing(false);
    setEditingActivityId(null);
  }

  function openEditModal(activity: Activity) {
    setIsEditing(true);
    setEditingActivityId(activity.id);
    setFormData({
      titulo: activity.titulo,
      descripcion: activity.descripcion || '',
      tipo: activity.tipo,
      prioridad: activity.prioridad,
      fecha_inicio: activity.fecha_inicio ? format(parseISO(activity.fecha_inicio), "yyyy-MM-dd'T'HH:mm") : '',
      fecha_fin: activity.fecha_fin ? format(parseISO(activity.fecha_fin), "yyyy-MM-dd'T'HH:mm") : '',
      fecha_limite: activity.fecha_limite ? format(parseISO(activity.fecha_limite), "yyyy-MM-dd'T'HH:mm") : '',
      ubicacion: activity.ubicacion || '',
      es_virtual: activity.es_virtual,
      enlace_reunion: activity.enlace_reunion || '',
      notas: activity.notas || '',
      participantes: activity.participants?.map(p => p.user_profile_id) || [],
      recordatorio_minutos: activity.recordatorio_minutos,
      recurrencia: activity.recurrencia || 'none',
      recurrencia_fin: activity.recurrencia_fin || ''
    });
    setShowCreateModal(true);
  }

  async function handleSaveActivity() {
    if (!formData.titulo || !formData.fecha_inicio) {
      toast.error('Título y fecha de inicio son requeridos');
      return;
    }
    
    try {
      const activityData = {
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
      };

      if (isEditing && editingActivityId) {
        // Actualizar actividad existente
        await updateActivity(editingActivityId, activityData);
        
        // Actualizar participantes: primero eliminar todos, luego agregar los nuevos
        await removeAllParticipants(editingActivityId);
        if (formData.participantes.length > 0) {
          await addMultipleParticipants(editingActivityId, formData.participantes);
        }
        
        toast.success('Actividad actualizada exitosamente');
      } else {
        // Crear nueva actividad
        const newActivity = await createActivity(activityData);
        
        if (formData.participantes.length > 0 && newActivity?.id) {
          await addMultipleParticipants(newActivity.id, formData.participantes);
        }
        
        toast.success('Actividad creada exitosamente');
      }
      
      setShowCreateModal(false);
      resetForm();
      setTableNotExists(false);
      loadData();
    } catch (error: any) {
      console.error('Error saving activity:', error);
      toast.error(error?.message || 'Error al guardar la actividad');
    }
  }
  
  async function openActivityDetail(activity: Activity) {
    setSelectedActivity(activity);
    setShowDetailModal(true);
    setNewComment('');
    
    // Cargar comentarios actualizados si no están incluidos
    if (!activity.comments) {
      try {
        const comments = await getActivityComments(activity.id);
        setSelectedActivity(prev => prev ? { ...prev, comments } : null);
      } catch (error) {
        console.error('Error loading comments:', error);
      }
    }
  }
  
  async function handleAddComment() {
    if (!selectedActivity || !newComment.trim()) return;
    
    try {
      setSubmittingComment(true);
      const comment = await addComment({
        activity_id: selectedActivity.id,
        comentario: newComment.trim()
      });
      
      // Actualizar la actividad con el nuevo comentario
      setSelectedActivity(prev => prev ? {
        ...prev,
        comments: [...(prev.comments || []), comment]
      } : null);
      
      // Actualizar también en la lista de actividades
      setActivities(prev => prev.map(a => 
        a.id === selectedActivity.id 
          ? { ...a, comments: [...(a.comments || []), comment] }
          : a
      ));
      
      setNewComment('');
      toast.success('Comentario agregado');
    } catch (error: any) {
      console.error('Error adding comment:', error);
      toast.error(error?.message || 'Error al agregar el comentario');
    } finally {
      setSubmittingComment(false);
    }
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
      className={`bg-white dark:bg-dark-600 rounded-lg border border-gray-200 dark:border-dark-500 shadow-sm p-3 cursor-pointer hover:shadow-md transition-shadow ${
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
      
      <h4 className={`font-medium text-gray-900 dark:text-white ${compact ? 'text-sm' : ''} line-clamp-2`}>
        {activity.titulo}
      </h4>
      
      {!compact && activity.descripcion && (
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{activity.descripcion}</p>
      )}
      
      <div className="mt-2 flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
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
          <Video className="h-3 w-3 text-blue-500 dark:text-blue-400" />
        ) : activity.ubicacion && (
          <MapPin className="h-3 w-3" />
        )}
      </div>
      
      {/* Información del creador */}
      {activity.creator && (
        <div className="mt-2 pt-2 border-t border-gray-100 dark:border-dark-500">
          <div className="text-xs text-gray-500 dark:text-gray-400">
            <span className="text-gray-700 dark:text-gray-300">{activity.creator.nombre_completo}</span>
          </div>
        </div>
      )}
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
      {/* Sistema de notificaciones de recordatorio */}
      <ActivityReminder
        activities={activities}
        currentUserId={userProfile?.id}
        onView={(activityId) => {
          const activity = activities.find(a => a.id === activityId);
          if (activity) openActivityDetail(activity);
        }}
      />

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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Objetivos Estratégicos</h1>
          <p className="text-gray-500 dark:text-gray-300 text-xs sm:text-base mt-0.5 sm:mt-1 hidden sm:block">
            {isSupervisorN1
              ? 'Gestiona y supervisa reuniones, capacitaciones y seguimientos del equipo'
              : 'Gestiona reuniones, capacitaciones y seguimientos con tu equipo'}
          </p>
        </div>

        <Button size="sm" onClick={() => setShowCreateModal(true)} disabled={tableNotExists}>
          <Plus className="h-4 w-4 mr-1 sm:mr-2" />
          <span className="hidden sm:inline">Nuevo Objetivo Estratégico</span>
          <span className="sm:hidden">Nueva Actividad</span>
        </Button>
      </div>
      
      {/* Stats */}
      <div className={`grid gap-4 ${isSupervisorN1 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2 sm:grid-cols-3'}`}>
        {kanbanColumns.filter(col => col.status !== 'realizado').map(col => (
          <Card key={col.status} className={`${estadoColors[col.status].bg} border ${estadoColors[col.status].border}`}>
            <div className="p-4">
              <p className={`text-sm font-medium ${estadoColors[col.status].text}`}>
                {estadoLabels[col.status]}
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{col.activities.length}</p>
            </div>
          </Card>
        ))}
        {/* Realizado - Colapsable - Solo para Supervisor N1 */}
        {isSupervisorN1 && (
          <div 
            className={`${estadoColors.realizado.bg} border ${estadoColors.realizado.border} cursor-pointer hover:shadow-md transition-shadow rounded-xl`}
            onClick={() => setShowRealizados(!showRealizados)}
          >
            <div className="p-4">
              <div className="flex items-center justify-between">
                <p className={`text-sm font-medium ${estadoColors.realizado.text}`}>
                  {estadoLabels.realizado}
                </p>
                <button className="p-1 hover:bg-green-100 dark:hover:bg-green-900/40 rounded-lg transition-colors">
                  {showRealizados ? (
                    <Minus className="h-4 w-4 text-green-600 dark:text-green-400" />
                  ) : (
                    <Plus className="h-4 w-4 text-green-600 dark:text-green-400" />
                  )}
                </button>
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                {filteredActivities.filter(a => a.estado === 'realizado').length}
              </p>
              <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                {showRealizados ? 'Clic para ocultar' : 'Clic para ver'}
              </p>
            </div>
          </div>
        )}
        <Card className="bg-gray-50 dark:bg-dark-600 border border-gray-200 dark:border-dark-500">
          <div className="p-4">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Total</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{filteredActivities.length}</p>
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
        
        <div className="flex gap-2 w-full sm:w-auto flex-wrap">
          <div className="flex items-center gap-1.5 flex-1 sm:flex-none">
            <div className="relative flex-1 sm:flex-none">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-9 pr-4 py-2 border border-gray-200 dark:border-dark-500 rounded-lg text-sm w-full sm:w-48 bg-white dark:bg-dark-600 text-gray-900 dark:text-white"
              />
            </div>
            <VoiceSearch onResult={(text) => setSearchTerm(text)} />
          </div>

          <select
            value={filterTipo}
            onChange={e => setFilterTipo(e.target.value as ActivityType | '')}
            className="px-3 py-2 border border-gray-200 dark:border-dark-500 rounded-lg text-sm bg-white dark:bg-dark-600 text-gray-900 dark:text-white"
          >
            <option value="">Todos los tipos</option>
            <option value="reunion">Reunión</option>
            <option value="capacitacion">Capacitación</option>
            <option value="seguimiento">Seguimiento</option>
          </select>

          <select
            value={filterPrioridad}
            onChange={e => setFilterPrioridad(e.target.value as ActivityPriority | '')}
            className="px-3 py-2 border border-gray-200 dark:border-dark-500 rounded-lg text-sm bg-white dark:bg-dark-600 text-gray-900 dark:text-white"
          >
            <option value="">Todas las prioridades</option>
            {Object.entries(prioridadLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>

          {/* Filtro por persona - Supervisores y Admin */}
          {(userProfile?.rol === 'admin' || userProfile?.rol?.includes('supervisor')) && (
            <select
              value={filterPersona}
              onChange={e => setFilterPersona(e.target.value)}
              className="px-3 py-2 border rounded-lg text-sm bg-purple-50 dark:bg-purple-900/30 border-purple-200 dark:border-purple-800 text-gray-900 dark:text-white"
            >
              <option value="">👥 Todas las personas</option>
              {users.map(user => (
                <option key={user.id} value={user.id}>
                  {user.nombre_completo}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>
      
      {/* Kanban View */}
      {viewMode === 'kanban' && (
        <div className={`grid grid-cols-1 gap-4 ${
          userProfile?.rol === 'vendedor' 
            ? 'md:grid-cols-2' 
            : showRealizados 
              ? 'md:grid-cols-3' 
              : 'md:grid-cols-2'
        }`}>
          {kanbanColumns
            .filter(column => column.status !== 'realizado' || showRealizados)
            .map(column => (
            <div 
              key={column.status} 
              className={`rounded-xl p-4 ${estadoColors[column.status].bg} border ${estadoColors[column.status].border}`}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className={`font-semibold ${estadoColors[column.status].text}`}>
                  {estadoLabels[column.status]}
                </h3>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500 dark:text-gray-400">{column.activities.length}</span>
                  {column.status === 'realizado' && (
                    <button
                      onClick={() => setShowRealizados(false)}
                      className="p-1 hover:bg-green-100 dark:hover:bg-green-900/40 rounded-lg transition-colors"
                      title="Ocultar Realizados"
                    >
                      <Minus className="h-4 w-4 text-green-600 dark:text-green-400" />
                    </button>
                  )}
                </div>
              </div>
              
              <div className="space-y-3">
                {column.activities.length === 0 ? (
                  <div className="text-center py-8 text-gray-400 dark:text-gray-500 text-sm">
                    Sin actividades
                  </div>
                ) : (
                  column.activities.map(activity => (
                    <div key={activity.id} className="group relative">
                      <ActivityCard activity={activity} />
                      
                      {/* Quick status change buttons */}
                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="flex gap-1 bg-white dark:bg-dark-600 rounded-lg shadow-lg p-1">
                          {column.status !== 'planificacion' && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleStatusChange(activity.id, 'planificacion'); }}
                              className="p-1 hover:bg-gray-100 dark:hover:bg-dark-500 rounded"
                              title="Mover a Planificación"
                            >
                              <Circle className="h-4 w-4 text-slate-500" />
                            </button>
                          )}
                          {column.status !== 'haciendo' && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleStatusChange(activity.id, 'haciendo'); }}
                              className="p-1 hover:bg-gray-100 dark:hover:bg-dark-500 rounded"
                              title="Mover a En Progreso"
                            >
                              <AlertCircle className="h-4 w-4 text-blue-500 dark:text-blue-400" />
                            </button>
                          )}
                          {column.status !== 'realizado' && isSupervisorN1 && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleStatusChange(activity.id, 'realizado'); }}
                              className="p-1 hover:bg-gray-100 dark:hover:bg-dark-500 rounded"
                              title="Marcar como Realizado (Solo Supervisor N1)"
                            >
                              <CheckCircle className="h-4 w-4 text-green-500 dark:text-green-400" />
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
          <div className="p-3 sm:p-4 border-b flex items-center justify-between">
            <button 
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <h3 className="font-semibold text-sm sm:text-lg capitalize">
              {format(currentMonth, 'MMMM yyyy', { locale: es })}
            </h3>
            <button 
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
          
          {/* Desktop: grid mensual */}
          <div className="hidden sm:block p-4">
            <div className="grid grid-cols-7 gap-1 mb-2">
              {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(day => (
                <div key={day} className="text-center text-sm font-medium text-gray-500 py-2">
                  {day}
                </div>
              ))}
            </div>
            
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: (monthStart.getDay() + 6) % 7 }).map((_, i) => (
                <div key={`empty-${i}`} className="h-24 bg-gray-50 dark:bg-dark-800 rounded-lg" />
              ))}
              
              {calendarDays.map(day => {
                const dayActivities = getActivitiesForDay(day);
                const isCurrentDay = isToday(day);
                
                return (
                  <div 
                    key={day.toISOString()} 
                    className={`h-24 border rounded-lg p-1 overflow-hidden ${
                      isCurrentDay ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-700' : 'bg-white dark:bg-dark-700 border-gray-100 dark:border-dark-500'
                    }`}
                  >
                    <div className={`text-sm font-medium mb-1 ${
                      isCurrentDay ? 'text-indigo-600 dark:text-indigo-300' : 'text-gray-700 dark:text-gray-200'
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
                        <div className="text-xs text-gray-500 dark:text-gray-300 px-1">
                          +{dayActivities.length - 2} más
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Móvil: lista de días con actividades */}
          <div className="sm:hidden divide-y divide-gray-100 dark:divide-dark-500">
            {calendarDays.filter(day => getActivitiesForDay(day).length > 0).length === 0 ? (
              <div className="p-8 text-center text-gray-500 dark:text-gray-300 text-sm">Sin actividades este mes</div>
            ) : (
              calendarDays.filter(day => getActivitiesForDay(day).length > 0).map(day => {
                const dayActivities = getActivitiesForDay(day);
                const isCurrentDay = isToday(day);
                return (
                  <div key={day.toISOString()} className={`p-3 ${isCurrentDay ? 'bg-indigo-50/50 dark:bg-indigo-900/20' : ''}`}>
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`w-9 h-9 rounded-full flex flex-col items-center justify-center flex-shrink-0 ${
                        isCurrentDay ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-dark-600 text-gray-700 dark:text-gray-200'
                      }`}>
                        <span className="text-[10px] leading-none uppercase font-medium">
                          {format(day, 'EEE', { locale: es })}
                        </span>
                        <span className="text-sm font-bold leading-none">{format(day, 'd')}</span>
                      </div>
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-200 capitalize">
                        {format(day, 'EEEE d', { locale: es })}
                      </span>
                      <span className="ml-auto text-xs text-gray-400 dark:text-gray-500">{dayActivities.length}</span>
                    </div>
                    <div className="space-y-1.5 ml-12">
                      {dayActivities.map(activity => (
                        <div 
                          key={activity.id}
                          onClick={() => openActivityDetail(activity)}
                          className={`text-xs px-2.5 py-1.5 rounded-lg cursor-pointer ${tipoColors[activity.tipo]} flex items-center justify-between`}
                        >
                          <span className="truncate font-medium">{activity.titulo}</span>
                          <ChevronRight className="h-3.5 w-3.5 flex-shrink-0 opacity-50" />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>
      )}
      
      {/* List View */}
      {viewMode === 'list' && (
        <Card>
          <div className="divide-y divide-gray-200 dark:divide-dark-500">
            {filteredActivities.length === 0 ? (
              <div className="p-8 text-center text-gray-500 dark:text-gray-300">
                No hay actividades que coincidan con los filtros
              </div>
            ) : (
              filteredActivities.map(activity => (
                <div 
                  key={activity.id}
                  className="p-3 sm:p-4 hover:bg-gray-50 dark:hover:bg-dark-600 cursor-pointer flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4"
                  onClick={() => openActivityDetail(activity)}
                >
                  <div className="flex-shrink-0">
                    <span className={`px-2 py-1 rounded-full text-xs ${estadoColors[activity.estado].bg} ${estadoColors[activity.estado].text}`}>
                      {estadoLabels[activity.estado]}
                    </span>
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-gray-900 dark:text-white">{activity.titulo}</h4>
                    {activity.descripcion && (
                      <p className="text-sm text-gray-500 dark:text-gray-300 truncate">{activity.descripcion}</p>
                    )}
                  </div>
                  
                  <div className="flex items-center flex-wrap gap-2 sm:gap-4 text-xs sm:text-sm text-gray-500 dark:text-gray-300">
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
      
      {/* Create/Edit Activity Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => { setShowCreateModal(false); resetForm(); }}
        title={isEditing ? "Editar Objetivo Estratégico" : "Nuevo Objetivo Estratégico"}
        size="lg"
      >
        <div className="space-y-5">
          {/* Información básica */}
          <div className="space-y-4">
            <Input
              label="Título *"
              value={formData.titulo}
              onChange={e => setFormData(prev => ({ ...prev, titulo: e.target.value }))}
              placeholder="Ej: Reunión de equipo semanal"
            />
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">Descripción</label>
              <textarea
                value={formData.descripcion || ''}
                onChange={e => setFormData(prev => ({ ...prev, descripcion: e.target.value }))}
                rows={3}
                className="w-full px-4 py-2.5 border border-gray-200 dark:border-dark-500 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors resize-none bg-white dark:bg-dark-700 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500"
                placeholder="Describe el objetivo de la actividad..."
              />
            </div>
          </div>
          
          {/* Tipo y Prioridad */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">Tipo</label>
              <select
                value={formData.tipo}
                onChange={e => setFormData(prev => ({ ...prev, tipo: e.target.value as ActivityType }))}
                className="w-full px-4 py-2.5 border border-gray-200 dark:border-dark-500 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors bg-white dark:bg-dark-700 text-gray-900 dark:text-white"
              >
                <option value="reunion" className="dark:bg-dark-700">Reunión</option>
                <option value="capacitacion" className="dark:bg-dark-700">Capacitación</option>
                <option value="seguimiento" className="dark:bg-dark-700">Seguimiento</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">Prioridad</label>
              <select
                value={formData.prioridad}
                onChange={e => setFormData(prev => ({ ...prev, prioridad: e.target.value as ActivityPriority }))}
                className="w-full px-4 py-2.5 border border-gray-200 dark:border-dark-500 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors bg-white dark:bg-dark-700 text-gray-900 dark:text-white"
              >
                {Object.entries(prioridadLabels).map(([value, label]) => (
                  <option key={value} value={value} className="dark:bg-dark-700">{label}</option>
                ))}
              </select>
            </div>
          </div>
          
          {/* Fechas */}
          <div className="bg-blue-50 dark:bg-blue-900/30 border border-transparent dark:border-blue-800 rounded-xl p-3 sm:p-4 space-y-4">
            <h4 className="text-xs font-semibold text-blue-600 dark:text-blue-300 uppercase tracking-wide flex items-center gap-1.5">
              <CalendarIcon className="h-3.5 w-3.5" />
              Fechas y horarios
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <Input
                label="Inicio *"
                type="datetime-local"
                value={formData.fecha_inicio}
                onChange={e => setFormData(prev => ({ ...prev, fecha_inicio: e.target.value }))}
              />
              
              <Input
                label="Fin"
                type="datetime-local"
                value={formData.fecha_fin || ''}
                onChange={e => setFormData(prev => ({ ...prev, fecha_fin: e.target.value }))}
              />
            </div>
            
            <Input
              label="Fecha límite (opcional)"
              type="datetime-local"
              value={formData.fecha_limite || ''}
              onChange={e => setFormData(prev => ({ ...prev, fecha_limite: e.target.value }))}
            />
          </div>

          {/* Recurrencia */}
          <div className="bg-teal-50 dark:bg-teal-900/30 border border-transparent dark:border-teal-800 rounded-xl p-3 sm:p-4 space-y-4">
            <h4 className="text-xs font-semibold text-teal-600 dark:text-teal-300 uppercase tracking-wide flex items-center gap-1.5">
              <Repeat className="h-3.5 w-3.5" />
              Programar Recurrente
            </h4>
            <div className="space-y-3">
              <select
                value={formData.recurrencia}
                onChange={e => setFormData(prev => ({ ...prev, recurrencia: e.target.value as RecurrenceType }))}
                className="w-full px-3 py-2.5 border border-teal-200 dark:border-teal-700 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-dark-700 text-gray-900 dark:text-white"
              >
                {RECURRENCE_OPTIONS.map(option => (
                  <option key={option.value} value={option.value} className="dark:bg-dark-700">{option.label}</option>
                ))}
              </select>

              {formData.recurrencia !== 'none' && (
                <div className="pt-2 border-t border-teal-100 dark:border-teal-800">
                  <Input
                    label="Termina el (opcional)"
                    type="date"
                    value={formData.recurrencia_fin || ''}
                    onChange={e => setFormData(prev => ({ ...prev, recurrencia_fin: e.target.value }))}
                  />
                  <p className="text-xs text-teal-600 dark:text-teal-300 mt-1">
                    Si no especificas fecha, se repetirá indefinidamente
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Ubicación */}
          <div className="bg-purple-50 dark:bg-purple-900/30 border border-transparent dark:border-purple-800 rounded-xl p-3 sm:p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold text-purple-600 dark:text-purple-300 uppercase tracking-wide flex items-center gap-1.5">
                {formData.es_virtual ? <Video className="h-3.5 w-3.5" /> : <MapPin className="h-3.5 w-3.5" />}
                {formData.es_virtual ? 'Reunión Virtual' : 'Ubicación'}
              </h4>
              <label className="flex items-center gap-2 cursor-pointer">
                <span className="text-xs text-purple-600 dark:text-purple-300">Virtual</span>
                <input
                  type="checkbox"
                  checked={formData.es_virtual}
                  onChange={e => setFormData(prev => ({ ...prev, es_virtual: e.target.checked }))}
                  className="rounded border-purple-300 dark:border-purple-700 text-purple-600 focus:ring-purple-500 h-4 w-4"
                />
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
                label="Lugar"
                value={formData.ubicacion || ''}
                onChange={e => setFormData(prev => ({ ...prev, ubicacion: e.target.value }))}
                placeholder="Ej: Sala de reuniones 1"
              />
            )}
          </div>
          
          {/* Involucrados/Participantes */}
          <div>
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wide mb-3 flex items-center gap-2">
              <Users className="h-3.5 w-3.5" />
              Involucrados ({users.length} disponibles)
            </label>
            <div className="border border-gray-200 dark:border-dark-500 rounded-xl max-h-56 overflow-y-auto bg-gray-50 dark:bg-dark-800">
              {users.length === 0 ? (
                <p className="p-4 text-center text-gray-500 dark:text-gray-300 text-sm">No hay usuarios disponibles</p>
              ) : (
                users.map(user => {
                  const isSelected = formData.participantes.includes(user.id);
                  const rolColors: Record<string, string> = {
                    admin: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-200',
                    vendedor: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200',
                    supervisor: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-200',
                    supervisor_nivel1: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-200',
                    supervisor_vendedor: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-200',
                    vendedor_tecnico: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
                    marketing: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200',
                    tecnico: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200'
                  };
                  return (
                    <label 
                      key={user.id} 
                      className={`flex items-center gap-3 p-3 cursor-pointer border-b border-gray-100 dark:border-dark-600 last:border-b-0 transition-all ${
                        isSelected ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-100 dark:border-indigo-800' : 'hover:bg-white dark:hover:bg-dark-700'
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
                        className="rounded border-gray-300 dark:border-dark-500 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                      />
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center flex-shrink-0">
                        <span className="text-white font-semibold text-sm">
                          {user.nombre_completo?.charAt(0) || '?'}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{user.nombre_completo}</p>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${rolColors[user.rol] || 'bg-gray-100 text-gray-700 dark:bg-dark-600 dark:text-gray-200'}`}>
                            {user.rol === 'supervisor_nivel1' ? 'Sup. N1' :
                            user.rol === 'supervisor_vendedor' ? 'Sup.+Vend.' :
                            user.rol === 'vendedor_tecnico' ? 'Vend.+Téc.' :
                            user.rol === 'marketing' ? 'Marketing' :
                            user.rol === 'tecnico' ? 'Técnico' : user.rol}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-300 truncate">{user.email}</p>
                      </div>
                      {isSelected && (
                        <CheckCircle className="h-5 w-5 text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
                      )}
                    </label>
                  );
                })
              )}
            </div>
            {formData.participantes.length > 0 && (
              <div className="mt-3 p-3 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl border border-indigo-100 dark:border-indigo-800">
                <p className="text-sm text-indigo-700 dark:text-indigo-200 font-medium flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  {formData.participantes.length} involucrado(s) seleccionado(s)
                </p>
              </div>
            )}
          </div>
          
          {/* Recordatorio */}
          <div className="bg-amber-50 dark:bg-amber-900/30 border border-transparent dark:border-amber-800 rounded-xl p-3 sm:p-4 space-y-3">
            <h4 className="text-xs font-semibold text-amber-600 dark:text-amber-300 uppercase tracking-wide flex items-center gap-1.5">
              <Bell className="h-3.5 w-3.5" />
              Recuérdamelo
            </h4>
            <select
              value={formData.recordatorio_minutos ?? ''}
              onChange={e => setFormData(prev => ({ 
                ...prev, 
                recordatorio_minutos: e.target.value ? parseInt(e.target.value) : null 
              }))}
              className="w-full px-4 py-2.5 border border-amber-200 dark:border-amber-700 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-colors bg-white dark:bg-dark-700 text-gray-900 dark:text-white"
            >
              <option value="" className="dark:bg-dark-700">Sin recordatorio</option>
              {REMINDER_OPTIONS.map(option => (
                <option key={option.value} value={option.value} className="dark:bg-dark-700">
                  {option.label}
                </option>
              ))}
            </select>
            {formData.recordatorio_minutos !== null && formData.participantes.length > 0 && (
              <div className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-200 bg-amber-100 dark:bg-amber-900/40 p-2 rounded-lg">
                <Mail className="h-3.5 w-3.5" />
                <span>Se enviará un correo a los {formData.participantes.length} involucrado(s)</span>
              </div>
            )}
          </div>

          {/* Notas */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">Notas adicionales</label>
            <textarea
              value={formData.notas || ''}
              onChange={e => setFormData(prev => ({ ...prev, notas: e.target.value }))}
              rows={2}
              className="w-full px-4 py-2.5 border border-gray-200 dark:border-dark-500 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors resize-none bg-white dark:bg-dark-700 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500"
              placeholder="Notas o recordatorios..."
            />
          </div>
          
          {/* Acciones */}
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-5 border-t border-gray-200 dark:border-dark-500">
            <Button variant="secondary" onClick={() => { setShowCreateModal(false); resetForm(); }} className="w-full sm:w-auto">
              Cancelar
            </Button>
            <Button onClick={handleSaveActivity} className="w-full sm:w-auto">
              {isEditing ? 'Guardar Cambios' : 'Crear Actividad'}
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
          <div className="space-y-6">
            {/* Header con badges */}
            <div className="flex items-center gap-2 flex-wrap pb-4 border-b border-gray-100">
              <span className={`px-3 py-1.5 rounded-lg text-sm font-medium ${tipoColors[selectedActivity.tipo]}`}>
                {tipoLabels[selectedActivity.tipo]}
              </span>
              <span className={`px-3 py-1.5 rounded-lg text-sm font-medium ${prioridadColors[selectedActivity.prioridad]}`}>
                {prioridadLabels[selectedActivity.prioridad]}
              </span>
              <span className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${estadoColors[selectedActivity.estado].bg} ${estadoColors[selectedActivity.estado].text} ${estadoColors[selectedActivity.estado].border}`}>
                {estadoLabels[selectedActivity.estado]}
              </span>
            </div>
            
            {/* Descripción */}
            {selectedActivity.descripcion && (
              <div className="bg-gray-50 dark:bg-dark-800 rounded-xl p-4">
                <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wide mb-2">Descripción</h4>
                <p className="text-gray-700 dark:text-gray-200 leading-relaxed">{selectedActivity.descripcion}</p>
              </div>
            )}
            
            {/* Fechas */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div className="bg-blue-50 dark:bg-blue-900/30 rounded-xl p-4">
                <h4 className="text-xs font-semibold text-blue-600 dark:text-blue-300 uppercase tracking-wide mb-2 flex items-center gap-1">
                  <CalendarIcon className="h-3.5 w-3.5" />
                  Fecha inicio
                </h4>
                <p className="text-gray-800 dark:text-white font-medium">
                  {format(parseISO(selectedActivity.fecha_inicio), "d 'de' MMMM 'de' yyyy", { locale: es })}
                </p>
                <p className="text-blue-600 dark:text-blue-300 text-sm font-medium mt-0.5">
                  {format(parseISO(selectedActivity.fecha_inicio), "HH:mm", { locale: es })} hrs
                </p>
              </div>
              
              {selectedActivity.fecha_fin && (
                <div className="bg-green-50 dark:bg-green-900/30 rounded-xl p-4">
                  <h4 className="text-xs font-semibold text-green-600 dark:text-green-300 uppercase tracking-wide mb-2 flex items-center gap-1">
                    <CalendarIcon className="h-3.5 w-3.5" />
                    Fecha fin
                  </h4>
                  <p className="text-gray-800 dark:text-white font-medium">
                    {format(parseISO(selectedActivity.fecha_fin), "d 'de' MMMM 'de' yyyy", { locale: es })}
                  </p>
                  <p className="text-green-600 dark:text-green-300 text-sm font-medium mt-0.5">
                    {format(parseISO(selectedActivity.fecha_fin), "HH:mm", { locale: es })} hrs
                  </p>
                </div>
              )}
            </div>
            
            {/* Ubicación o Virtual */}
            {(selectedActivity.ubicacion || (selectedActivity.es_virtual && selectedActivity.enlace_reunion)) && (
              <div className="bg-purple-50 dark:bg-purple-900/30 rounded-xl p-4">
                {selectedActivity.es_virtual && selectedActivity.enlace_reunion ? (
                  <>
                    <h4 className="text-xs font-semibold text-purple-600 dark:text-purple-300 uppercase tracking-wide mb-2 flex items-center gap-1">
                      <Video className="h-3.5 w-3.5" />
                      Reunión Virtual
                    </h4>
                    <a 
                      href={selectedActivity.enlace_reunion} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
                    >
                      <Video className="h-4 w-4" />
                      Unirse a la reunión
                    </a>
                  </>
                ) : selectedActivity.ubicacion && (
                  <>
                    <h4 className="text-xs font-semibold text-purple-600 dark:text-purple-300 uppercase tracking-wide mb-2 flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" />
                      Ubicación
                    </h4>
                    <p className="text-gray-800 dark:text-white font-medium">{selectedActivity.ubicacion}</p>
                  </>
                )}
              </div>
            )}
            
            {/* Participantes */}
            {selectedActivity.participants && selectedActivity.participants.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wide mb-3 flex items-center gap-2">
                  <Users className="h-3.5 w-3.5" />
                  Participantes ({selectedActivity.participants.length})
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {selectedActivity.participants.map(p => (
                    <div key={p.id} className="flex items-center justify-between gap-2 bg-gray-50 dark:bg-dark-800 hover:bg-gray-100 dark:hover:bg-dark-600 transition-colors rounded-xl p-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center flex-shrink-0">
                          <span className="text-indigo-600 dark:text-indigo-300 font-semibold text-sm">
                            {p.user_profile?.nombre_completo?.charAt(0) || '?'}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-sm text-gray-900 dark:text-white truncate">{p.user_profile?.nombre_completo}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-300 truncate">{p.user_profile?.email}</p>
                        </div>
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
            
            {/* Notas */}
            {selectedActivity.notas && (
              <div className="bg-amber-50 dark:bg-amber-900/30 rounded-xl p-4">
                <h4 className="text-xs font-semibold text-amber-600 dark:text-amber-300 uppercase tracking-wide mb-2">Notas</h4>
                <p className="text-gray-700 dark:text-gray-200 leading-relaxed">{selectedActivity.notas}</p>
              </div>
            )}

            {/* Comentarios */}
            <div className="bg-gray-50 dark:bg-dark-800 rounded-xl p-4">
              <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wide mb-3 flex items-center gap-2">
                <MessageSquare className="h-3.5 w-3.5" />
                Comentarios ({selectedActivity.comments?.length || 0})
              </h4>
              
              {/* Lista de comentarios */}
              <div className="space-y-3 mb-4 max-h-64 overflow-y-auto">
                {selectedActivity.comments && selectedActivity.comments.length > 0 ? (
                  selectedActivity.comments.map(comment => (
                    <div key={comment.id} className="bg-white dark:bg-dark-700 rounded-lg p-3 border border-gray-200 dark:border-dark-500">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center flex-shrink-0">
                          <span className="text-indigo-600 dark:text-indigo-300 font-semibold text-sm">
                            {comment.user_profile?.nombre_completo?.charAt(0) || '?'}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                              {comment.user_profile?.nombre_completo || 'Usuario'}
                            </p>
                            <span className="text-xs text-gray-500 dark:text-gray-300">
                              {format(parseISO(comment.created_at), "dd/MM/yyyy HH:mm", { locale: es })}
                            </span>
                          </div>
                          <p className="text-sm text-gray-700 dark:text-gray-200 whitespace-pre-wrap break-words">
                            {comment.comentario}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-6 text-gray-400 dark:text-gray-500 text-sm">
                    No hay comentarios aún. Sé el primero en comentar.
                  </div>
                )}
              </div>
              
              {/* Formulario para agregar comentario */}
              <div className="border-t border-gray-200 dark:border-dark-500 pt-4">
                <div className="flex gap-2">
                  <textarea
                    value={newComment}
                    onChange={e => setNewComment(e.target.value)}
                    placeholder="Escribe un comentario..."
                    rows={2}
                    className="flex-1 px-4 py-2.5 border border-gray-200 dark:border-dark-500 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors resize-none text-sm bg-white dark:bg-dark-700 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                        e.preventDefault();
                        handleAddComment();
                      }
                    }}
                  />
                  <Button
                    onClick={handleAddComment}
                    disabled={!newComment.trim() || submittingComment}
                    size="sm"
                    className="self-end"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-300 mt-2">
                  Presiona Ctrl+Enter para enviar
                </p>
              </div>
            </div>

            {/* Recordatorio */}
            {selectedActivity.recordatorio_minutos !== null && (
              <div className="bg-yellow-50 dark:bg-yellow-900/30 rounded-xl p-4 border border-yellow-200 dark:border-yellow-700">
                <h4 className="text-xs font-semibold text-yellow-700 dark:text-yellow-300 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <Bell className="h-3.5 w-3.5" />
                  Recordatorio configurado
                </h4>
                <p className="text-yellow-800 dark:text-yellow-200 font-medium">
                  {REMINDER_OPTIONS.find(o => o.value === selectedActivity.recordatorio_minutos)?.label || 
                   `${selectedActivity.recordatorio_minutos} minutos antes`}
                </p>
              </div>
            )}
            
            {/* Cambiar estado */}
            <div className="bg-gray-50 dark:bg-dark-800 rounded-xl p-4">
              <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wide mb-3">Cambiar estado</h4>
              <div className="flex gap-2 flex-wrap">
                {(['planificacion', 'haciendo', 'realizado'] as ActivityStatus[]).map(status => (
                  <button
                    key={status}
                    onClick={() => handleStatusChange(selectedActivity.id, status)}
                    disabled={selectedActivity.estado === status || (status === 'realizado' && !isSupervisorN1 && ['reunion', 'capacitacion', 'seguimiento'].includes(selectedActivity.tipo))}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                      selectedActivity.estado === status
                        ? `${estadoColors[status].bg} ${estadoColors[status].text} border-2 ${estadoColors[status].border} ring-2 ring-offset-1 ring-current/20`
                        : (status === 'realizado' && !isSupervisorN1 && ['reunion', 'capacitacion', 'seguimiento'].includes(selectedActivity.tipo))
                        ? 'bg-gray-200 dark:bg-dark-600 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                        : 'bg-white dark:bg-dark-700 text-gray-600 dark:text-gray-200 border border-gray-200 dark:border-dark-500 hover:bg-gray-100 dark:hover:bg-dark-600 hover:border-gray-300'
                    }`}
                    title={status === 'realizado' && !isSupervisorN1 && ['reunion', 'capacitacion', 'seguimiento'].includes(selectedActivity.tipo) ? 'Solo Supervisor N1 puede marcar como Realizado' : ''}
                  >
                    {estadoLabels[status]}
                    {status === 'realizado' && !isSupervisorN1 && ['reunion', 'capacitacion', 'seguimiento'].includes(selectedActivity.tipo) && ' 🔒'}
                  </button>
                ))}
              </div>
              {!isSupervisorN1 && ['reunion', 'capacitacion', 'seguimiento'].includes(selectedActivity.tipo) && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-3 flex items-center gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5" />
                  Solo Supervisores Nivel 1 pueden marcar objetivos estratégicos como Realizado
                </p>
              )}
            </div>
            
            {/* Acciones */}
            <div className="flex flex-col-reverse sm:flex-row sm:justify-between sm:items-center gap-3 pt-4 border-t border-gray-200 dark:border-dark-500">
              <Button 
                variant="danger" 
                size="sm"
                onClick={() => handleDeleteActivity(selectedActivity.id)}
                className="gap-1.5 w-full sm:w-auto justify-center"
              >
                <Trash2 className="h-4 w-4" />
                Eliminar
              </Button>
              
              <div className="flex flex-col sm:flex-row gap-2">
                <Button 
                  variant="secondary" 
                  onClick={() => {
                    setShowDetailModal(false);
                    openEditModal(selectedActivity);
                  }}
                  className="gap-1.5 w-full sm:w-auto justify-center"
                >
                  <Edit className="h-4 w-4" />
                  Editar
                </Button>
                <Button variant="secondary" onClick={() => setShowDetailModal(false)} className="w-full sm:w-auto">
                  Cerrar
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

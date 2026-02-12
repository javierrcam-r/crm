'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  List,
  Grid,
  Clock,
  AlertTriangle,
  Star,
  Users,
  MapPin,
  Video,
  Bell,
  Repeat,
  Edit,
  Trash2,
  Send,
} from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Input from '@/components/ui/Input';
import EmptyState from '@/components/ui/EmptyState';
import Modal from '@/components/ui/Modal';
import { REMINDER_OPTIONS } from '@/components/ui/ActivityReminder';
import { getVisits, getPendingVisits, type Visit } from '@/lib/services/visits';
import { 
  getActivities, 
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
import { useAuth } from '@/contexts/AuthContext';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  parseISO,
} from 'date-fns';
import { es } from 'date-fns/locale';
import {
  formatTime,
  visitStatusLabels,
  cn,
} from '@/lib/utils';
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

const estadoLabels: Record<string, string> = {
  planificacion: 'Planificación',
  haciendo: 'En Progreso',
  realizado: 'Realizado',
  cancelado: 'Cancelado',
};

type ViewType = 'month' | 'week' | 'list';

export default function CalendarioPage() {
  const { userProfile } = useAuth();
  const [visits, setVisits] = useState<Visit[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [pendingVisits, setPendingVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<ViewType>('month');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [isEditingActivity, setIsEditingActivity] = useState(false);
  const [users, setUsers] = useState<Pick<UserProfile, 'id' | 'nombre_completo' | 'email' | 'rol'>[]>([]);
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [editFormData, setEditFormData] = useState<ActivityInsert & { participantes: string[]; recordatorio_minutos: number | null; recurrencia: RecurrenceType; recurrencia_fin: string }>({
    titulo: '',
    descripcion: '',
    tipo: 'tarea',
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
    loadUsers();
  }, [currentDate, view]);

  const loadData = async () => {
    try {
      let dateFrom: string;
      let dateTo: string;

      if (view === 'month') {
        const start = startOfWeek(startOfMonth(currentDate), { locale: es });
        const end = endOfWeek(endOfMonth(currentDate), { locale: es });
        dateFrom = start.toISOString();
        dateTo = end.toISOString();
      } else if (view === 'week') {
        const start = startOfWeek(currentDate, { locale: es });
        const end = endOfWeek(currentDate, { locale: es });
        dateFrom = start.toISOString();
        dateTo = end.toISOString();
      } else {
        const start = new Date();
        start.setDate(start.getDate() - 7);
        const end = new Date();
        end.setDate(end.getDate() + 30);
        dateFrom = start.toISOString();
        dateTo = end.toISOString();
      }

      // Cargar visitas y actividades estratégicas
      const [visitsData, pendingData, activitiesData] = await Promise.all([
        getVisits({ date_from: dateFrom, date_to: dateTo }),
        getPendingVisits(),
        getActivities().catch(() => [] as Activity[]), // Si falla, devolver array vacío
      ]);

      setVisits(visitsData);
      setPendingVisits(pendingData);
      
      // Filtrar actividades según el rol
      const currentId = userProfile?.id;
      const currentRol = userProfile?.rol;
      const myActivities = activitiesData.filter(activity => {
        const isCreator = activity.created_by_user_id === currentId;
        const isParticipant = Array.isArray(activity.participants) && 
          activity.participants.some(p => p.user_profile_id === currentId);
        
        if (currentRol === 'admin') return true;
        
        // Supervisores: ven sus propias + las que tienen participantes + las estratégicas
        // NO ven tareas/otro personales de OTROS usuarios
        if (currentRol === 'supervisor_nivel1' || currentRol === 'supervisor' || currentRol === 'supervisor_vendedor') {
          // Siempre ver las propias y donde participa
          if (isCreator || isParticipant) return true;
          // Si es tipo estratégico, siempre ver
          if (activity.tipo === 'reunion' || activity.tipo === 'capacitacion' || activity.tipo === 'seguimiento') return true;
          // Si tiene participantes, es colaborativa → ver
          if (Array.isArray(activity.participants) && activity.participants.length > 0) return true;
          // Es tarea/otro sin participantes de OTRO usuario → NO ver
          return false;
        }
        
        // Otros roles: solo sus propias o donde participan
        return isCreator || isParticipant;
      });
      setActivities(myActivities);
    } catch (error) {
      console.error('Error cargando datos:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const data = await getAllUsersForSelection();
      setUsers(data);
    } catch (error) {
      console.error('Error cargando usuarios:', error);
    }
  };

  async function openActivityDetail(activity: Activity) {
    setSelectedActivity(activity);
    setIsEditingActivity(false);
    setNewComment('');
    
    if (!activity.comments) {
      try {
        const comments = await getActivityComments(activity.id);
        setSelectedActivity(prev => prev ? { ...prev, comments } : null);
      } catch (error) {
        console.error('Error loading comments:', error);
      }
    }
  }

  function openEditMode(activity: Activity) {
    setEditFormData({
      titulo: activity.titulo,
      descripcion: activity.descripcion || '',
      tipo: activity.tipo,
      prioridad: activity.prioridad,
      fecha_inicio: activity.fecha_inicio ? format(new Date(activity.fecha_inicio), "yyyy-MM-dd'T'HH:mm") : '',
      fecha_fin: activity.fecha_fin ? format(new Date(activity.fecha_fin), "yyyy-MM-dd'T'HH:mm") : '',
      fecha_limite: activity.fecha_limite ? format(new Date(activity.fecha_limite), "yyyy-MM-dd'T'HH:mm") : '',
      ubicacion: activity.ubicacion || '',
      es_virtual: activity.es_virtual,
      enlace_reunion: activity.enlace_reunion || '',
      notas: activity.notas || '',
      participantes: activity.participants?.map(p => p.user_profile_id) || [],
      recordatorio_minutos: activity.recordatorio_minutos,
      recurrencia: activity.recurrencia || 'none',
      recurrencia_fin: activity.recurrencia_fin || ''
    });
    setIsEditingActivity(true);
  }

  async function handleSaveEdit() {
    if (!selectedActivity || !editFormData.titulo || !editFormData.fecha_inicio) {
      toast.error('Título y fecha de inicio son requeridos');
      return;
    }

    try {
      const activityData = {
        titulo: editFormData.titulo,
        descripcion: editFormData.descripcion || null,
        tipo: editFormData.tipo,
        prioridad: editFormData.prioridad,
        fecha_inicio: new Date(editFormData.fecha_inicio).toISOString(),
        fecha_fin: editFormData.fecha_fin ? new Date(editFormData.fecha_fin).toISOString() : null,
        fecha_limite: editFormData.fecha_limite ? new Date(editFormData.fecha_limite).toISOString() : null,
        ubicacion: editFormData.ubicacion || null,
        es_virtual: editFormData.es_virtual,
        enlace_reunion: editFormData.enlace_reunion || null,
        notas: editFormData.notas || null,
        recordatorio_minutos: editFormData.recordatorio_minutos,
        recurrencia: editFormData.recurrencia !== 'none' ? editFormData.recurrencia : null,
        recurrencia_fin: editFormData.recurrencia_fin ? new Date(editFormData.recurrencia_fin).toISOString() : null
      };

      await updateActivity(selectedActivity.id, activityData);
      await removeAllParticipants(selectedActivity.id);
      if (editFormData.participantes.length > 0) {
        await addMultipleParticipants(selectedActivity.id, editFormData.participantes);
      }

      toast.success('Actividad actualizada exitosamente');
      setIsEditingActivity(false);
      setSelectedActivity(null);
      loadData();
    } catch (error: any) {
      console.error('Error updating activity:', error);
      toast.error(error?.message || 'Error al actualizar la actividad');
    }
  }

  async function handleDeleteActivityAction(activityId: string) {
    if (!confirm('¿Estás seguro de eliminar esta actividad?')) return;
    
    try {
      await deleteActivity(activityId);
      toast.success('Actividad eliminada');
      setSelectedActivity(null);
      loadData();
    } catch (error: any) {
      toast.error(error?.message || 'Error al eliminar');
    }
  }

  async function handleStatusChange(activityId: string, newStatus: ActivityStatus) {
    try {
      await updateActivityStatus(activityId, newStatus);
      toast.success('Estado actualizado');
      setSelectedActivity(prev => prev ? { ...prev, estado: newStatus } : null);
      loadData();
    } catch (error: any) {
      toast.error(error?.message || 'Error al actualizar estado');
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
      
      setSelectedActivity(prev => prev ? {
        ...prev,
        comments: [...(prev.comments || []), comment]
      } : null);
      
      setNewComment('');
      toast.success('Comentario agregado');
    } catch (error: any) {
      console.error('Error adding comment:', error);
      toast.error(error?.message || 'Error al agregar comentario');
    } finally {
      setSubmittingComment(false);
    }
  }

  const navigatePrevious = () => {
    if (view === 'month') {
      setCurrentDate(subMonths(currentDate, 1));
    } else if (view === 'week') {
      setCurrentDate(subWeeks(currentDate, 1));
    }
  };

  const navigateNext = () => {
    if (view === 'month') {
      setCurrentDate(addMonths(currentDate, 1));
    } else if (view === 'week') {
      setCurrentDate(addWeeks(currentDate, 1));
    }
  };

  const goToToday = () => {
    setCurrentDate(new Date());
    setSelectedDate(new Date());
  };

  const getVisitsForDay = (date: Date) => {
    return visits.filter((visit) =>
      isSameDay(new Date(visit.scheduled_at), date)
    );
  };

  // Roles que pueden gestionar actividades diarias desde el calendario
  const isSupervisorN1 = userProfile?.rol === 'supervisor_nivel1';
  const canManageDailyActivities = isSupervisorN1 || userProfile?.rol === 'supervisor' || userProfile?.rol === 'marketing' || userProfile?.rol === 'tecnico';

  const getActivitiesForDay = (date: Date) => {
    return activities.filter((activity) =>
      isSameDay(new Date(activity.fecha_inicio), date)
    );
  };

  // Separar actividades estratégicas de actividades diarias
  // Diaria: SOLO si tipo tarea/otro, SIN participantes, Y creada por el supervisor_nivel1 actual
  // Todo lo demás es estratégica (incluye actividades de vendedores que son siempre estratégicas)
  const isActivityStrategic = (activity: Activity) => {
    const isStrategicType = activity.tipo === 'reunion' || activity.tipo === 'capacitacion' || activity.tipo === 'seguimiento';
    if (isStrategicType) return true;
    
    const hasParticipants = activity.participants && activity.participants.length > 0;
    if (hasParticipants) return true;
    
    // Solo es "diaria" si la creó el supervisor_nivel1 actual como tarea personal
    const createdByCurrentUser = canManageDailyActivities && activity.created_by_user_id === userProfile?.id;
    if (!createdByCurrentUser) return true; // Si la creó otro usuario, es estratégica
    
    return false; // Es diaria: tarea/otro, sin participantes, creada por el supervisor actual
  };

  const getStrategicActivitiesForDay = (date: Date) => {
    return getActivitiesForDay(date).filter(activity => isActivityStrategic(activity));
  };

  const getDailyActivitiesForDay = (date: Date) => {
    return getActivitiesForDay(date).filter(activity => !isActivityStrategic(activity));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completada': return 'bg-emerald-50 text-emerald-700';
      case 'programada': return 'bg-blue-50 text-blue-700';
      case 'cancelada': return 'bg-gray-100 text-gray-600';
      case 'no_atendio': return 'bg-amber-50 text-amber-700';
      default: return 'bg-purple-50 text-purple-700';
    }
  };

  // Generar días del calendario
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart, { locale: es });
  const calendarEnd = endOfWeek(monthEnd, { locale: es });
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  // Semana actual
  const weekStart = startOfWeek(currentDate, { locale: es });
  const weekEnd = endOfWeek(currentDate, { locale: es });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Cargando calendario...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Calendario</h1>
          <p className="text-gray-500 mt-1">
            {canManageDailyActivities ? 'Gestiona tus actividades diarias y estratégicas' : 'Gestiona tu agenda de visitas'}
          </p>
        </div>
        <div className="flex gap-2">
          {canManageDailyActivities ? (
            <Link href="/calendario/nueva-actividad">
              <Button icon={<Plus className="h-4 w-4" />}>Nueva Actividad Diaria</Button>
            </Link>
          ) : (
            <Link href="/calendario/nueva">
              <Button icon={<Plus className="h-4 w-4" />}>Nueva Visita</Button>
            </Link>
          )}
        </div>
      </div>

      {/* Visitas Pendientes */}
      {pendingVisits.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/30">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            <h2 className="font-semibold text-gray-900">
              Visitas Vencidas
              <Badge variant="yellow" className="ml-2">{pendingVisits.length}</Badge>
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {pendingVisits.slice(0, 6).map((visit) => (
              <Link
                key={visit.id}
                href={`/calendario/${visit.id}`}
                className="flex items-center gap-3 p-3 rounded-lg bg-amber-100/50 hover:bg-amber-100 transition-colors"
              >
                <Clock className="h-4 w-4 text-amber-600" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">
                    {visit.customer?.nombre}
                  </p>
                  <p className="text-xs text-gray-500">
                    {format(new Date(visit.scheduled_at), "dd MMM 'a las' HH:mm", { locale: es })}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </Card>
      )}

      {/* Calendar Controls */}
      <Card padding="sm">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={navigatePrevious}>
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <h2 className="text-lg font-semibold text-gray-900 min-w-[200px] text-center">
              {view === 'month'
                ? format(currentDate, 'MMMM yyyy', { locale: es })
                : view === 'week'
                ? `${format(weekStart, 'd MMM', { locale: es })} - ${format(weekEnd, 'd MMM yyyy', { locale: es })}`
                : 'Próximas Visitas'}
            </h2>
            <Button variant="ghost" size="sm" onClick={navigateNext}>
              <ChevronRight className="h-5 w-5" />
            </Button>
            <Button variant="secondary" size="sm" onClick={goToToday} className="ml-2">
              Hoy
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={view === 'month' ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setView('month')}
              icon={<Grid className="h-4 w-4" />}
            >
              Mes
            </Button>
            <Button
              variant={view === 'week' ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setView('week')}
              icon={<CalendarIcon className="h-4 w-4" />}
            >
              Semana
            </Button>
            <Button
              variant={view === 'list' ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setView('list')}
              icon={<List className="h-4 w-4" />}
            >
              Lista
            </Button>
          </div>
        </div>
      </Card>

      {/* Calendar Views */}
      {view === 'month' && (
        <Card padding="none">
          {/* Days Header */}
          <div className="grid grid-cols-7 border-b border-gray-200">
            {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((day) => (
              <div
                key={day}
                className="p-3 text-center text-sm font-semibold text-gray-500 bg-gray-50"
              >
                {day}
              </div>
            ))}
          </div>
          {/* Calendar Grid */}
          <div className="grid grid-cols-7">
            {calendarDays.map((day, index) => {
              const dayVisits = getVisitsForDay(day);
              const dayActivities = getActivitiesForDay(day);
              const strategicActivities = getStrategicActivitiesForDay(day);
              const dailyActivities = getDailyActivitiesForDay(day);
              const isCurrentMonth = isSameMonth(day, currentDate);
              const isSelected = selectedDate && isSameDay(day, selectedDate);
              const today = isToday(day);
              
              // Para supervisor_nivel1: priorizar actividades, para otros: priorizar visitas
              const totalItems = canManageDailyActivities 
                ? dayActivities.length + dayVisits.length
                : dayVisits.length + dayActivities.length;

              return (
                <div
                  key={index}
                  onClick={() => setSelectedDate(day)}
                  className={cn(
                    'calendar-day min-h-[100px] cursor-pointer',
                    !isCurrentMonth && 'calendar-day-other-month',
                    today && 'calendar-day-today',
                    isSelected && 'ring-2 ring-indigo-500 ring-inset'
                  )}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className={cn(
                        'text-sm font-medium',
                        today ? 'bg-indigo-500 text-white px-2 py-0.5 rounded' : 'text-gray-900'
                      )}
                    >
                      {format(day, 'd')}
                    </span>
                    {strategicActivities.length > 0 && (
                      <Star className="h-3 w-3 text-purple-500 fill-purple-500" />
                    )}
                  </div>
                  <div className="space-y-1">
                    {canManageDailyActivities ? (
                      <>
                        {/* Actividades Estratégicas (color púrpura) - Prioridad alta */}
                        {strategicActivities.slice(0, 2).map((activity) => (
                          <div
                            key={`act-strategic-${activity.id}`}
                            onClick={(e) => { e.stopPropagation(); openActivityDetail(activity); }}
                            className="calendar-event block bg-purple-100 text-purple-700 border-l-2 border-purple-500 cursor-pointer hover:bg-purple-200 transition-colors"
                          >
                            <span className="font-medium">{format(new Date(activity.fecha_inicio), 'HH:mm')}</span>
                            <span className="ml-1 truncate">⭐{activity.titulo}</span>
                          </div>
                        ))}
                        {/* Actividades Diarias (color azul) */}
                        {dailyActivities.slice(0, strategicActivities.length > 0 ? 1 : 2).map((activity) => (
                          <div
                            key={`act-daily-${activity.id}`}
                            onClick={(e) => { e.stopPropagation(); openActivityDetail(activity); }}
                            className="calendar-event block bg-blue-100 text-blue-700 border-l-2 border-blue-500 cursor-pointer hover:bg-blue-200 transition-colors"
                          >
                            <span className="font-medium">{format(new Date(activity.fecha_inicio), 'HH:mm')}</span>
                            <span className="ml-1 truncate">📋{activity.titulo}</span>
                          </div>
                        ))}
                        {/* Visitas (color gris, secundario) */}
                        {dayVisits.slice(0, (strategicActivities.length + dailyActivities.length) > 0 ? 0 : 2).map((visit) => (
                          <Link
                            key={visit.id}
                            href={`/calendario/${visit.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className={cn(
                              'calendar-event block bg-gray-100 text-gray-600 border-l-2 border-gray-400'
                            )}
                          >
                            <span className="font-medium">{formatTime(visit.scheduled_at)}</span>
                            <span className="ml-1 truncate">{visit.customer?.nombre}</span>
                          </Link>
                        ))}
                      </>
                    ) : (
                      <>
                        {/* Actividades Estratégicas (color púrpura) */}
                        {dayActivities.slice(0, 2).map((activity) => (
                          <div
                            key={`act-${activity.id}`}
                            onClick={(e) => { e.stopPropagation(); openActivityDetail(activity); }}
                            className="calendar-event block bg-purple-100 text-purple-700 border-l-2 border-purple-500 cursor-pointer hover:bg-purple-200 transition-colors"
                          >
                            <span className="font-medium">{format(new Date(activity.fecha_inicio), 'HH:mm')}</span>
                            <span className="ml-1 truncate">⭐ {activity.titulo}</span>
                          </div>
                        ))}
                        {/* Visitas */}
                        {dayVisits.slice(0, dayActivities.length > 0 ? 1 : 3).map((visit) => (
                          <Link
                            key={visit.id}
                            href={`/calendario/${visit.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className={cn(
                              'calendar-event block',
                              getStatusColor(visit.status)
                            )}
                          >
                            <span className="font-medium">{formatTime(visit.scheduled_at)}</span>
                            <span className="ml-1 truncate">{visit.customer?.nombre}</span>
                          </Link>
                        ))}
                      </>
                    )}
                    {totalItems > 3 && (
                      <p className="text-xs text-gray-400 pl-1">
                        +{totalItems - 3} más
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {view === 'week' && (
        <Card padding="none">
          <div className="grid grid-cols-7 divide-x divide-gray-200">
            {weekDays.map((day, index) => {
              const dayVisits = getVisitsForDay(day);
              const dayActivities = getActivitiesForDay(day);
              const today = isToday(day);

              return (
                <div key={index} className="min-h-[400px]">
                  <div
                    className={cn(
                      'p-3 text-center border-b border-gray-200',
                      today && 'bg-indigo-50'
                    )}
                  >
                    <p className="text-xs text-gray-500 flex items-center justify-center gap-1">
                      {format(day, 'EEEE', { locale: es })}
                      {dayActivities.length > 0 && (
                        <Star className="h-3 w-3 text-purple-500 fill-purple-500" />
                      )}
                    </p>
                    <p
                      className={cn(
                        'text-xl font-bold mt-1',
                        today ? 'text-indigo-600' : 'text-gray-900'
                      )}
                    >
                      {format(day, 'd')}
                    </p>
                  </div>
                  <div className="p-2 space-y-2">
                    {canManageDailyActivities ? (
                      <>
                        {/* Actividades Estratégicas (color púrpura) */}
                        {getStrategicActivitiesForDay(day).map((activity) => (
                          <div
                            key={`act-strategic-${activity.id}`}
                            className="block p-2 rounded-lg text-sm bg-purple-100 text-purple-700 border-l-4 border-purple-500 cursor-pointer hover:bg-purple-200 transition-colors"
                            onClick={() => openActivityDetail(activity)}
                          >
                            <div className="flex items-center justify-between mb-0.5">
                              <p className="font-semibold flex items-center gap-1">
                                <Star className="h-3 w-3 fill-purple-500" />
                                {format(new Date(activity.fecha_inicio), 'HH:mm')}
                              </p>
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-200 text-purple-800 font-medium">Estratégica</span>
                            </div>
                            <p className="truncate font-medium">{activity.titulo}</p>
                            {activity.descripcion && (
                              <p className="text-xs opacity-80 truncate mt-1">
                                {activity.descripcion}
                              </p>
                            )}
                          </div>
                        ))}
                        {/* Actividades Diarias (color azul) */}
                        {getDailyActivitiesForDay(day).map((activity) => (
                          <div
                            key={`act-daily-${activity.id}`}
                            className="block p-2 rounded-lg text-sm bg-blue-100 text-blue-700 border-l-4 border-blue-500 cursor-pointer hover:bg-blue-200 transition-colors"
                            onClick={() => openActivityDetail(activity)}
                          >
                            <div className="flex items-center justify-between mb-0.5">
                              <p className="font-semibold">
                                {format(new Date(activity.fecha_inicio), 'HH:mm')}
                              </p>
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-200 text-blue-800 font-medium">Diaria</span>
                            </div>
                            <p className="truncate font-medium">{activity.titulo}</p>
                            {activity.descripcion && (
                              <p className="text-xs opacity-80 truncate mt-1">
                                {activity.descripcion}
                              </p>
                            )}
                          </div>
                        ))}
                        {/* Visitas (secundario) */}
                        {dayVisits.map((visit) => (
                          <Link
                            key={visit.id}
                            href={`/calendario/${visit.id}`}
                            className="block p-2 rounded-lg text-sm bg-gray-100 text-gray-600 border-l-4 border-gray-400"
                          >
                            <p className="font-semibold">{formatTime(visit.scheduled_at)}</p>
                            <p className="truncate">{visit.customer?.nombre}</p>
                            {visit.objetivo && (
                              <p className="text-xs opacity-80 truncate mt-1">
                                {visit.objetivo}
                              </p>
                            )}
                          </Link>
                        ))}
                      </>
                    ) : (
                      <>
                        {/* Actividades Estratégicas */}
                        {dayActivities.map((activity) => (
                          <div
                            key={`act-${activity.id}`}
                            className="block p-2 rounded-lg text-sm bg-purple-100 text-purple-700 border-l-4 border-purple-500 cursor-pointer hover:bg-purple-200 transition-colors"
                            onClick={() => openActivityDetail(activity)}
                          >
                            <p className="font-semibold flex items-center gap-1">
                              <Star className="h-3 w-3 fill-purple-500" />
                              {format(new Date(activity.fecha_inicio), 'HH:mm')}
                            </p>
                            <p className="truncate font-medium">{activity.titulo}</p>
                            {activity.descripcion && (
                              <p className="text-xs opacity-80 truncate mt-1">
                                {activity.descripcion}
                              </p>
                            )}
                          </div>
                        ))}
                        {/* Visitas */}
                        {dayVisits.map((visit) => (
                          <Link
                            key={visit.id}
                            href={`/calendario/${visit.id}`}
                            className={cn(
                              'block p-2 rounded-lg text-sm',
                              getStatusColor(visit.status)
                            )}
                          >
                            <p className="font-semibold">{formatTime(visit.scheduled_at)}</p>
                            <p className="truncate">{visit.customer?.nombre}</p>
                            {visit.objetivo && (
                              <p className="text-xs opacity-80 truncate mt-1">
                                {visit.objetivo}
                              </p>
                            )}
                          </Link>
                        ))}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {view === 'list' && (
        <Card>
          {canManageDailyActivities ? (
            activities.length === 0 ? (
              <EmptyState
                icon={CalendarIcon}
                title="No hay actividades programadas"
                description="Crea tu primera actividad diaria"
                action={{
                  label: 'Nueva Actividad Diaria',
                  onClick: () => (window.location.href = '/calendario/nueva-actividad'),
                }}
              />
            ) : (
              <div className="space-y-3">
                {activities.map((activity) => {
                  const isStrategic = isActivityStrategic(activity);
                  return (
                    <div
                      key={activity.id}
                      onClick={() => openActivityDetail(activity)}
                      className={cn(
                        'flex items-center justify-between p-4 rounded-lg transition-colors cursor-pointer',
                        isStrategic 
                          ? 'bg-purple-50 hover:bg-purple-100 border-l-4 border-purple-500' 
                          : 'bg-blue-50 hover:bg-blue-100 border-l-4 border-blue-500'
                      )}
                    >
                      <div className="flex items-center gap-4">
                        <div className="text-center min-w-[60px]">
                          <p className="text-xs text-gray-500">
                            {format(new Date(activity.fecha_inicio), 'EEE', { locale: es })}
                          </p>
                          <p className="text-lg font-bold text-gray-900">
                            {format(new Date(activity.fecha_inicio), 'd')}
                          </p>
                          <p className="text-xs text-gray-500">
                            {format(new Date(activity.fecha_inicio), 'MMM', { locale: es })}
                          </p>
                        </div>
                        <div className="border-l border-gray-200 pl-4 flex-1 min-w-0">
                          <p className={cn(
                            'font-semibold',
                            isStrategic ? 'text-purple-600' : 'text-blue-600'
                          )}>
                            {format(new Date(activity.fecha_inicio), 'HH:mm', { locale: es })}
                          </p>
                          <p className="font-medium text-gray-900 flex items-center gap-1">
                            {isStrategic && <Star className="h-3 w-3 text-purple-500 fill-purple-500" />}
                            {activity.titulo}
                          </p>
                          {activity.descripcion && (
                            <p className="text-sm text-gray-500 mt-1 line-clamp-1">
                              {activity.descripcion}
                            </p>
                          )}
                          <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                            {activity.creator && (
                              <span className="flex items-center gap-1">
                                <span className="font-medium">Creado por:</span>
                                <span>{activity.creator.nombre_completo}</span>
                              </span>
                            )}
                            {activity.participants && activity.participants.length > 0 && (
                              <span className="flex items-center gap-1">
                                <Users className="h-3 w-3" />
                                <span>{activity.participants.length} involucrado{activity.participants.length > 1 ? 's' : ''}</span>
                                {activity.participants.length <= 3 && (
                                  <span className="text-gray-400">
                                    ({activity.participants.map(p => p.user_profile?.nombre_completo || 'Usuario').join(', ')})
                                  </span>
                                )}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <Badge
                        variant={
                          activity.estado === 'realizado' ? 'green' :
                          activity.estado === 'haciendo' ? 'blue' :
                          activity.estado === 'cancelado' ? 'gray' : 'yellow'
                        }
                      >
                        {activity.estado}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            visits.length === 0 && activities.length === 0 ? (
              <EmptyState
                icon={CalendarIcon}
                title="No hay visitas ni actividades programadas"
                description="Programa tu primera visita"
                action={{
                  label: 'Nueva Visita',
                  onClick: () => (window.location.href = '/calendario/nueva'),
                }}
              />
            ) : (
              <div className="space-y-3">
                {/* Actividades estratégicas */}
                {activities.length > 0 && (
                  <>
                    <h3 className="text-sm font-semibold text-purple-700 flex items-center gap-2 mb-2">
                      <Star className="h-4 w-4 fill-purple-500" />
                      Actividades Estratégicas ({activities.length})
                    </h3>
                    {activities.map((activity) => {
                      const isStrategic = isActivityStrategic(activity);
                      return (
                        <div
                          key={activity.id}
                          onClick={() => openActivityDetail(activity)}
                          className={cn(
                            'flex items-center justify-between p-4 rounded-lg transition-colors cursor-pointer',
                            isStrategic
                              ? 'bg-purple-50 hover:bg-purple-100 border-l-4 border-purple-500'
                              : 'bg-blue-50 hover:bg-blue-100 border-l-4 border-blue-500'
                          )}
                        >
                          <div className="flex items-center gap-4">
                            <div className="text-center min-w-[60px]">
                              <p className="text-xs text-gray-500">
                                {format(new Date(activity.fecha_inicio), 'EEE', { locale: es })}
                              </p>
                              <p className="text-lg font-bold text-gray-900">
                                {format(new Date(activity.fecha_inicio), 'd')}
                              </p>
                              <p className="text-xs text-gray-500">
                                {format(new Date(activity.fecha_inicio), 'MMM', { locale: es })}
                              </p>
                            </div>
                            <div className="border-l border-gray-200 pl-4 flex-1 min-w-0">
                              <p className={cn(
                                'font-semibold',
                                isStrategic ? 'text-purple-600' : 'text-blue-600'
                              )}>
                                {format(new Date(activity.fecha_inicio), 'HH:mm', { locale: es })}
                              </p>
                              <p className="font-medium text-gray-900 flex items-center gap-1">
                                {isStrategic && <Star className="h-3 w-3 text-purple-500 fill-purple-500" />}
                                {activity.titulo}
                              </p>
                              {activity.descripcion && (
                                <p className="text-sm text-gray-500 mt-1 line-clamp-1">
                                  {activity.descripcion}
                                </p>
                              )}
                              <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                                {activity.creator && (
                                  <span className="flex items-center gap-1">
                                    <span className="font-medium">Creado por:</span>
                                    <span>{activity.creator.nombre_completo}</span>
                                  </span>
                                )}
                                {activity.participants && activity.participants.length > 0 && (
                                  <span className="flex items-center gap-1">
                                    <Users className="h-3 w-3" />
                                    <span>{activity.participants.length} involucrado{activity.participants.length > 1 ? 's' : ''}</span>
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <Badge
                            variant={
                              activity.estado === 'realizado' ? 'green' :
                              activity.estado === 'haciendo' ? 'blue' :
                              activity.estado === 'cancelado' ? 'gray' : 'yellow'
                            }
                          >
                            {activity.estado}
                          </Badge>
                        </div>
                      );
                    })}
                  </>
                )}

                {/* Visitas */}
                {visits.length > 0 && (
                  <>
                    <h3 className="text-sm font-semibold text-indigo-700 flex items-center gap-2 mt-4 mb-2">
                      <CalendarIcon className="h-4 w-4" />
                      Visitas ({visits.length})
                    </h3>
                    {visits.map((visit) => (
                      <Link
                        key={visit.id}
                        href={`/calendario/${visit.id}`}
                        className="flex items-center justify-between p-4 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <div className="text-center min-w-[60px]">
                            <p className="text-xs text-gray-500">
                              {format(new Date(visit.scheduled_at), 'EEE', { locale: es })}
                            </p>
                            <p className="text-lg font-bold text-gray-900">
                              {format(new Date(visit.scheduled_at), 'd')}
                            </p>
                            <p className="text-xs text-gray-500">
                              {format(new Date(visit.scheduled_at), 'MMM', { locale: es })}
                            </p>
                          </div>
                          <div className="border-l border-gray-200 pl-4">
                            <p className="font-semibold text-indigo-600">
                              {formatTime(visit.scheduled_at)}
                            </p>
                            <p className="font-medium text-gray-900">
                              {visit.customer?.nombre}
                            </p>
                            {visit.objetivo && (
                              <p className="text-sm text-gray-500 mt-1">
                                {visit.objetivo}
                              </p>
                            )}
                          </div>
                        </div>
                        <Badge
                          variant={
                            visit.status === 'completada' ? 'green' :
                            visit.status === 'programada' ? 'blue' :
                            visit.status === 'cancelada' ? 'gray' : 'yellow'
                          }
                        >
                          {visitStatusLabels[visit.status]}
                        </Badge>
                      </Link>
                    ))}
                  </>
                )}
              </div>
            )
          )}
        </Card>
      )}

      {/* Selected Day Detail */}
      {selectedDate && view === 'month' && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">
              {format(selectedDate, "EEEE d 'de' MMMM", { locale: es })}
            </h3>
            {canManageDailyActivities ? (
              <Link href={`/calendario/nueva-actividad?date=${selectedDate.toISOString()}`}>
                <Button variant="secondary" size="sm" icon={<Plus className="h-4 w-4" />}>
                  Nueva Actividad
                </Button>
              </Link>
            ) : (
              <Link href={`/calendario/nueva?date=${selectedDate.toISOString()}`}>
                <Button variant="secondary" size="sm" icon={<Plus className="h-4 w-4" />}>
                  Agregar
                </Button>
              </Link>
            )}
          </div>
          {canManageDailyActivities ? (
            <>
              {/* Actividades Estratégicas */}
              {getStrategicActivitiesForDay(selectedDate).length > 0 && (
                <div className="mb-4">
                  <h4 className="text-sm font-semibold text-purple-700 mb-3 flex items-center gap-1">
                    <Star className="h-4 w-4 fill-purple-500" />
                    Actividades Estratégicas ({getStrategicActivitiesForDay(selectedDate).length})
                  </h4>
                  <div className="space-y-3">
                    {getStrategicActivitiesForDay(selectedDate).map((activity) => (
                      <div
                        key={activity.id}
                        onClick={() => openActivityDetail(activity)}
                        className="block p-4 rounded-lg bg-purple-50 border-l-4 border-purple-500 cursor-pointer hover:bg-purple-100 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-semibold text-purple-700">
                                {format(new Date(activity.fecha_inicio), 'HH:mm')}
                              </p>
                              {activity.fecha_fin && (
                                <span className="text-xs text-purple-600">
                                  - {format(new Date(activity.fecha_fin), 'HH:mm')}
                                </span>
                              )}
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-200 text-purple-800 font-medium">Estratégica</span>
                            </div>
                            <p className="font-medium text-gray-900 mb-1">{activity.titulo}</p>
                            {activity.descripcion && (
                              <p className="text-sm text-gray-600 mb-2 line-clamp-2">{activity.descripcion}</p>
                            )}
                            <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 mt-2">
                              {activity.creator && (
                                <span className="flex items-center gap-1">
                                  <span className="font-medium">Creado por:</span>
                                  <span>{activity.creator.nombre_completo}</span>
                                </span>
                              )}
                              {activity.participants && activity.participants.length > 0 && (
                                <span className="flex items-center gap-1">
                                  <Users className="h-3 w-3" />
                                  <span>{activity.participants.length} involucrado{activity.participants.length > 1 ? 's' : ''}</span>
                                  {activity.participants.length <= 2 && (
                                    <span className="text-gray-400">
                                      ({activity.participants.map(p => p.user_profile?.nombre_completo || 'Usuario').join(', ')})
                                    </span>
                                  )}
                                </span>
                              )}
                              {activity.ubicacion && (
                                <span className="flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  <span>{activity.ubicacion}</span>
                                </span>
                              )}
                              {activity.es_virtual && activity.enlace_reunion && (
                                <span className="flex items-center gap-1 text-purple-600">
                                  <Video className="h-3 w-3" />
                                  <span>Virtual</span>
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <Badge
                              variant={
                                activity.estado === 'realizado' ? 'green' :
                                activity.estado === 'haciendo' ? 'blue' :
                                activity.estado === 'cancelado' ? 'gray' : 'yellow'
                              }
                            >
                              {activity.estado}
                            </Badge>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              activity.prioridad === 'urgente' ? 'bg-red-100 text-red-700' :
                              activity.prioridad === 'alta' ? 'bg-orange-100 text-orange-700' :
                              activity.prioridad === 'media' ? 'bg-blue-100 text-blue-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {activity.prioridad}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* Actividades Diarias */}
              {getDailyActivitiesForDay(selectedDate).length > 0 && (
                <div className="mb-4">
                  <h4 className="text-sm font-semibold text-blue-700 mb-3 flex items-center gap-1">
                    📋 Actividades Diarias ({getDailyActivitiesForDay(selectedDate).length})
                  </h4>
                  <div className="space-y-3">
                    {getDailyActivitiesForDay(selectedDate).map((activity) => (
                      <div
                        key={activity.id}
                        onClick={() => openActivityDetail(activity)}
                        className="block p-4 rounded-lg bg-blue-50 border-l-4 border-blue-500 cursor-pointer hover:bg-blue-100 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-semibold text-blue-700">
                                {format(new Date(activity.fecha_inicio), 'HH:mm')}
                              </p>
                              {activity.fecha_fin && (
                                <span className="text-xs text-blue-600">
                                  - {format(new Date(activity.fecha_fin), 'HH:mm')}
                                </span>
                              )}
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-200 text-blue-800 font-medium">Diaria</span>
                            </div>
                            <p className="font-medium text-gray-900 mb-1">{activity.titulo}</p>
                            {activity.descripcion && (
                              <p className="text-sm text-gray-600 mb-2 line-clamp-2">{activity.descripcion}</p>
                            )}
                            <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 mt-2">
                              {activity.creator && (
                                <span className="flex items-center gap-1">
                                  <span className="font-medium">Creado por:</span>
                                  <span>{activity.creator.nombre_completo}</span>
                                </span>
                              )}
                              {activity.participants && activity.participants.length > 0 && (
                                <span className="flex items-center gap-1">
                                  <Users className="h-3 w-3" />
                                  <span>{activity.participants.length} involucrado{activity.participants.length > 1 ? 's' : ''}</span>
                                  {activity.participants.length <= 2 && (
                                    <span className="text-gray-400">
                                      ({activity.participants.map(p => p.user_profile?.nombre_completo || 'Usuario').join(', ')})
                                    </span>
                                  )}
                                </span>
                              )}
                              {activity.ubicacion && (
                                <span className="flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  <span>{activity.ubicacion}</span>
                                </span>
                              )}
                              {activity.es_virtual && activity.enlace_reunion && (
                                <span className="flex items-center gap-1 text-blue-600">
                                  <Video className="h-3 w-3" />
                                  <span>Virtual</span>
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <Badge
                              variant={
                                activity.estado === 'realizado' ? 'green' :
                                activity.estado === 'haciendo' ? 'blue' :
                                activity.estado === 'cancelado' ? 'gray' : 'yellow'
                              }
                            >
                              {activity.estado}
                            </Badge>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              activity.prioridad === 'urgente' ? 'bg-red-100 text-red-700' :
                              activity.prioridad === 'alta' ? 'bg-orange-100 text-orange-700' :
                              activity.prioridad === 'media' ? 'bg-blue-100 text-blue-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {activity.prioridad}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* Visitas (secundario) */}
              {getVisitsForDay(selectedDate).length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-600 mb-2">Visitas</h4>
                  <div className="space-y-2">
                    {getVisitsForDay(selectedDate).map((visit) => (
                      <Link
                        key={visit.id}
                        href={`/calendario/${visit.id}`}
                        className="flex items-center justify-between p-3 rounded-lg bg-gray-100 text-gray-600"
                      >
                        <div>
                          <p className="font-semibold">{formatTime(visit.scheduled_at)}</p>
                          <p>{visit.customer?.nombre}</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
              {getActivitiesForDay(selectedDate).length === 0 && getVisitsForDay(selectedDate).length === 0 && (
                <p className="text-center text-gray-500 py-4">
                  No hay actividades para este día
                </p>
              )}
            </>
          ) : (
            <>
              {/* Actividades Estratégicas para vendedores */}
              {getActivitiesForDay(selectedDate).length > 0 && (
                <div className="mb-4">
                  <h4 className="text-sm font-semibold text-purple-700 mb-3 flex items-center gap-1">
                    <Star className="h-4 w-4 fill-purple-500" />
                    Mis Actividades Estratégicas ({getActivitiesForDay(selectedDate).length})
                  </h4>
                  <div className="space-y-3">
                    {getActivitiesForDay(selectedDate).map((activity) => (
                      <div
                        key={activity.id}
                        className="block p-4 rounded-lg bg-purple-50 border-l-4 border-purple-500"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-semibold text-purple-700">
                                {format(new Date(activity.fecha_inicio), 'HH:mm')}
                              </p>
                              {activity.fecha_fin && (
                                <span className="text-xs text-purple-600">
                                  - {format(new Date(activity.fecha_fin), 'HH:mm')}
                                </span>
                              )}
                            </div>
                            <p className="font-medium text-gray-900 mb-1">{activity.titulo}</p>
                            {activity.descripcion && (
                              <p className="text-sm text-gray-600 mb-2 line-clamp-2">{activity.descripcion}</p>
                            )}
                            <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 mt-2">
                              {activity.creator && (
                                <span className="flex items-center gap-1">
                                  <span className="font-medium">Creado por:</span>
                                  <span>{activity.creator.nombre_completo}</span>
                                </span>
                              )}
                              {activity.participants && activity.participants.length > 0 && (
                                <span className="flex items-center gap-1">
                                  <Users className="h-3 w-3" />
                                  <span>{activity.participants.length} involucrado{activity.participants.length > 1 ? 's' : ''}</span>
                                </span>
                              )}
                              {activity.ubicacion && (
                                <span className="flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  <span>{activity.ubicacion}</span>
                                </span>
                              )}
                              {activity.es_virtual && activity.enlace_reunion && (
                                <span className="flex items-center gap-1 text-purple-600">
                                  <Video className="h-3 w-3" />
                                  <span>Virtual</span>
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <Badge
                              variant={
                                activity.estado === 'realizado' ? 'green' :
                                activity.estado === 'haciendo' ? 'blue' :
                                activity.estado === 'cancelado' ? 'gray' : 'yellow'
                              }
                            >
                              {activity.estado}
                            </Badge>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              activity.prioridad === 'urgente' ? 'bg-red-100 text-red-700' :
                              activity.prioridad === 'alta' ? 'bg-orange-100 text-orange-700' :
                              activity.prioridad === 'media' ? 'bg-blue-100 text-blue-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {activity.prioridad}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* Visitas para vendedores */}
              {getVisitsForDay(selectedDate).length > 0 && (
                <div className="mb-4">
                  <h4 className="text-sm font-semibold text-indigo-700 mb-3">
                    Mis Visitas ({getVisitsForDay(selectedDate).length})
                  </h4>
                  <div className="space-y-2">
                    {getVisitsForDay(selectedDate).map((visit) => (
                      <Link
                        key={visit.id}
                        href={`/calendario/${visit.id}`}
                        className={cn(
                          'flex items-center justify-between p-3 rounded-lg',
                          getStatusColor(visit.status)
                        )}
                      >
                        <div>
                          <p className="font-semibold">{formatTime(visit.scheduled_at)}</p>
                          <p>{visit.customer?.nombre}</p>
                        </div>
                        <Badge
                          variant={
                            visit.status === 'completada' ? 'green' :
                            visit.status === 'programada' ? 'blue' : 'gray'
                          }
                        >
                          {visitStatusLabels[visit.status]}
                        </Badge>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
              {getActivitiesForDay(selectedDate).length === 0 && getVisitsForDay(selectedDate).length === 0 && (
                <p className="text-center text-gray-500 py-4">
                  No hay actividades ni visitas para este día
                </p>
              )}
            </>
          )}
        </Card>
      )}

      {/* Modal de detalle de actividad */}
      <Modal
        isOpen={!!selectedActivity}
        onClose={() => { setSelectedActivity(null); setIsEditingActivity(false); }}
        title={isEditingActivity ? 'Editar Actividad' : (selectedActivity?.titulo || 'Detalle de Actividad')}

        size="lg"
      >
        {selectedActivity && !isEditingActivity && (() => {
          const isStrategicActivity = isActivityStrategic(selectedActivity);
          return (
          <div className="space-y-4">
            {/* Tipo de actividad badge */}
            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold ${
              isStrategicActivity 
                ? 'bg-purple-100 text-purple-800 border border-purple-200' 
                : 'bg-blue-100 text-blue-800 border border-blue-200'
            }`}>
              {isStrategicActivity ? '⭐ Actividad Estratégica' : '📋 Actividad Diaria'}
            </div>

            {/* Badges */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`px-3 py-1 rounded-lg text-sm font-medium ${
                selectedActivity.tipo === 'reunion' ? 'bg-blue-100 text-blue-700' :
                selectedActivity.tipo === 'capacitacion' ? 'bg-green-100 text-green-700' :
                selectedActivity.tipo === 'seguimiento' ? 'bg-amber-100 text-amber-700' :
                selectedActivity.tipo === 'tarea' ? 'bg-purple-100 text-purple-700' :
                'bg-gray-100 text-gray-700'
              }`}>
                {selectedActivity.tipo === 'reunion' ? 'Reunión' :
                 selectedActivity.tipo === 'capacitacion' ? 'Capacitación' :
                 selectedActivity.tipo === 'seguimiento' ? 'Seguimiento' :
                 selectedActivity.tipo === 'tarea' ? 'Tarea' : 'Otro'}
              </span>
              <span className={`px-3 py-1 rounded-lg text-sm font-medium ${
                selectedActivity.prioridad === 'urgente' ? 'bg-red-100 text-red-700' :
                selectedActivity.prioridad === 'alta' ? 'bg-orange-100 text-orange-700' :
                selectedActivity.prioridad === 'media' ? 'bg-blue-100 text-blue-700' :
                'bg-gray-100 text-gray-700'
              }`}>
                {selectedActivity.prioridad}
              </span>
              <span className={`px-3 py-1 rounded-lg text-sm font-medium ${
                selectedActivity.estado === 'realizado' ? 'bg-green-100 text-green-700' :
                selectedActivity.estado === 'haciendo' ? 'bg-blue-100 text-blue-700' :
                selectedActivity.estado === 'cancelado' ? 'bg-red-100 text-red-700' :
                'bg-slate-100 text-slate-700'
              }`}>
                {estadoLabels[selectedActivity.estado] || selectedActivity.estado}
              </span>
            </div>

            {/* Descripción */}
            {selectedActivity.descripcion && (
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Descripción</h4>
                <p className="text-gray-700">{selectedActivity.descripcion}</p>
              </div>
            )}

            {/* Fechas */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-blue-50 rounded-lg p-4">
                <h4 className="text-xs font-semibold text-blue-600 uppercase mb-1 flex items-center gap-1">
                  <CalendarIcon className="h-3.5 w-3.5" />
                  Fecha inicio
                </h4>
                <p className="text-gray-800 font-medium">
                  {format(new Date(selectedActivity.fecha_inicio), "d 'de' MMMM 'de' yyyy", { locale: es })}
                </p>
                <p className="text-blue-600 text-sm font-medium">
                  {format(new Date(selectedActivity.fecha_inicio), "HH:mm", { locale: es })} hrs
                </p>
              </div>
              {selectedActivity.fecha_fin && (
                <div className="bg-green-50 rounded-lg p-4">
                  <h4 className="text-xs font-semibold text-green-600 uppercase mb-1 flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    Fecha fin
                  </h4>
                  <p className="text-gray-800 font-medium">
                    {format(new Date(selectedActivity.fecha_fin), "d 'de' MMMM 'de' yyyy", { locale: es })}
                  </p>
                  <p className="text-green-600 text-sm font-medium">
                    {format(new Date(selectedActivity.fecha_fin), "HH:mm", { locale: es })} hrs
                  </p>
                </div>
              )}
            </div>

            {/* Ubicación o Virtual */}
            {(selectedActivity.ubicacion || (selectedActivity.es_virtual && selectedActivity.enlace_reunion)) && (
              <div className="bg-purple-50 rounded-lg p-4">
                {selectedActivity.es_virtual && selectedActivity.enlace_reunion ? (
                  <>
                    <h4 className="text-xs font-semibold text-purple-600 uppercase mb-2 flex items-center gap-1">
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
                    <h4 className="text-xs font-semibold text-purple-600 uppercase mb-2 flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" />
                      Ubicación
                    </h4>
                    <p className="text-gray-800 font-medium">{selectedActivity.ubicacion}</p>
                  </>
                )}
              </div>
            )}

            {/* Recordatorio */}
            {selectedActivity.recordatorio_minutos !== null && selectedActivity.recordatorio_minutos !== undefined && (
              <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
                <h4 className="text-xs font-semibold text-yellow-700 uppercase mb-2 flex items-center gap-1.5">
                  <Bell className="h-3.5 w-3.5" />
                  Recordatorio configurado
                </h4>
                <p className="text-yellow-800 font-medium">
                  {REMINDER_OPTIONS.find(o => o.value === selectedActivity.recordatorio_minutos)?.label || 
                   `${selectedActivity.recordatorio_minutos} minutos antes`}
                </p>
              </div>
            )}

            {/* Recurrencia */}
            {selectedActivity.recurrencia && selectedActivity.recurrencia !== 'none' && (
              <div className="bg-teal-50 rounded-lg p-4 border border-teal-200">
                <h4 className="text-xs font-semibold text-teal-700 uppercase mb-2 flex items-center gap-1.5">
                  <Repeat className="h-3.5 w-3.5" />
                  Recurrencia
                </h4>
                <p className="text-teal-800 font-medium">
                  {RECURRENCE_OPTIONS.find(o => o.value === selectedActivity.recurrencia)?.label || selectedActivity.recurrencia}
                </p>
                {selectedActivity.recurrencia_fin && (
                  <p className="text-teal-600 text-sm mt-1">
                    Hasta: {format(new Date(selectedActivity.recurrencia_fin), "d 'de' MMMM 'de' yyyy", { locale: es })}
                  </p>
                )}
              </div>
            )}

            {/* Participantes */}
            {selectedActivity.participants && selectedActivity.participants.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase mb-3 flex items-center gap-2">
                  <Users className="h-3.5 w-3.5" />
                  Participantes ({selectedActivity.participants.length})
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {selectedActivity.participants.map(p => (
                    <div key={p.id} className="flex items-center gap-3 bg-gray-50 rounded-lg p-3">
                      <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
                        <span className="text-indigo-600 font-semibold text-sm">
                          {p.user_profile?.nombre_completo?.charAt(0) || '?'}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-sm text-gray-900">{p.user_profile?.nombre_completo}</p>
                        <p className="text-xs text-gray-500">{p.user_profile?.email}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Creador */}
            {selectedActivity.creator && (
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Creado por</h4>
                <p className="text-gray-800 font-medium">{selectedActivity.creator.nombre_completo}</p>
              </div>
            )}

            {/* Notas */}
            {selectedActivity.notas && (
              <div className="bg-amber-50 rounded-lg p-4">
                <h4 className="text-xs font-semibold text-amber-600 uppercase mb-2">Notas</h4>
                <p className="text-gray-700">{selectedActivity.notas}</p>
              </div>
            )}

            {/* Comentarios */}
            <div className="border rounded-xl p-4">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
                Comentarios ({selectedActivity.comments?.length || 0})
              </h4>
              <div className="max-h-48 overflow-y-auto space-y-3 mb-4">
                {selectedActivity.comments && selectedActivity.comments.length > 0 ? (
                  selectedActivity.comments.map((comment) => (
                    <div key={comment.id} className="flex gap-3">
                      <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-indigo-600 font-semibold text-xs">
                          {comment.user_profile?.nombre_completo?.charAt(0) || '?'}
                        </span>
                      </div>
                      <div className="flex-1 bg-gray-50 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-medium text-gray-900">
                            {comment.user_profile?.nombre_completo || 'Usuario'}
                          </p>
                          <span className="text-xs text-gray-500">
                            {format(parseISO(comment.created_at), "dd/MM/yyyy HH:mm", { locale: es })}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">
                          {comment.comentario}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-4 text-gray-400 text-sm">
                    No hay comentarios aún.
                  </div>
                )}
              </div>
              <div className="border-t border-gray-200 pt-3">
                <div className="flex gap-2">
                  <textarea
                    value={newComment}
                    onChange={e => setNewComment(e.target.value)}
                    placeholder="Escribe un comentario..."
                    rows={2}
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors resize-none text-sm"
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
              </div>
            </div>

            {/* Cambiar estado */}
            <div className="bg-gray-50 rounded-xl p-4">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Cambiar estado</h4>
              <div className="flex gap-2 flex-wrap">
                {(['planificacion', 'haciendo', 'realizado'] as ActivityStatus[]).map(status => (
                  <button
                    key={status}
                    onClick={() => handleStatusChange(selectedActivity.id, status)}
                    disabled={selectedActivity.estado === status || (status === 'realizado' && !isSupervisorN1)}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                      selectedActivity.estado === status
                        ? 'bg-indigo-100 text-indigo-700 border-2 border-indigo-300 ring-2 ring-offset-1 ring-indigo-200'
                        : (status === 'realizado' && !isSupervisorN1)
                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                        : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100 hover:border-gray-300'
                    }`}
                    title={status === 'realizado' && !isSupervisorN1 ? 'Solo Supervisor N1 puede marcar como Realizado' : ''}
                  >
                    {estadoLabels[status]}
                    {status === 'realizado' && !isSupervisorN1 && ' 🔒'}
                  </button>
                ))}
              </div>
            </div>

            {/* Acciones */}
            <div className="flex justify-between items-center pt-4 border-t">
              <Button 
                variant="danger" 
                size="sm"
                onClick={() => handleDeleteActivityAction(selectedActivity.id)}
                className="gap-1.5"
              >
                <Trash2 className="h-4 w-4" />
                Eliminar
              </Button>
              
              <div className="flex gap-2">
                <Button 
                  variant="secondary" 
                  size="sm"
                  onClick={() => openEditMode(selectedActivity)}
                  className="gap-1.5"
                >
                  <Edit className="h-4 w-4" />
                  Editar
                </Button>
                {isStrategicActivity && (
                  <Link href="/actividades">
                    <Button variant="secondary" size="sm">
                      Ver en Estratégicas
                    </Button>
                  </Link>
                )}
                <Button variant="secondary" onClick={() => setSelectedActivity(null)}>
                  Cerrar
                </Button>
              </div>
            </div>
          </div>
          );
        })()}

        {/* Edit Mode */}
        {selectedActivity && isEditingActivity && (
          <div className="space-y-5">
            {/* Título y Descripción */}
            <div className="space-y-4">
              <Input
                label="Título *"
                value={editFormData.titulo}
                onChange={e => setEditFormData({ ...editFormData, titulo: e.target.value })}
                placeholder="Título de la actividad"
                required
              />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Descripción</label>
                <textarea
                  value={editFormData.descripcion || ''}
                  onChange={e => setEditFormData({ ...editFormData, descripcion: e.target.value })}
                  placeholder="Describe la actividad..."
                  rows={3}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors resize-none"
                />
              </div>
            </div>

            {/* Tipo y Prioridad */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Tipo</label>
                <select
                  value={editFormData.tipo}
                  onChange={e => setEditFormData({ ...editFormData, tipo: e.target.value as ActivityType })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors bg-white"
                >
                  <option value="tarea">Tarea</option>
                  <option value="otro">Otro</option>
                  <option value="reunion">Reunión</option>
                  <option value="capacitacion">Capacitación</option>
                  <option value="seguimiento">Seguimiento</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Prioridad</label>
                <select
                  value={editFormData.prioridad}
                  onChange={e => setEditFormData({ ...editFormData, prioridad: e.target.value as ActivityPriority })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors bg-white"
                >
                  <option value="baja">Baja</option>
                  <option value="media">Media</option>
                  <option value="alta">Alta</option>
                  <option value="urgente">Urgente</option>
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
                  value={editFormData.fecha_inicio}
                  onChange={e => setEditFormData({ ...editFormData, fecha_inicio: e.target.value })}
                  required
                />
                <Input
                  label="Fecha y Hora de Fin"
                  type="datetime-local"
                  value={editFormData.fecha_fin || ''}
                  onChange={e => setEditFormData({ ...editFormData, fecha_fin: e.target.value })}
                />
              </div>
              <Input
                label="Fecha límite (opcional)"
                type="datetime-local"
                value={editFormData.fecha_limite || ''}
                onChange={e => setEditFormData({ ...editFormData, fecha_limite: e.target.value })}
              />
            </div>

            {/* Recurrencia */}
            <div className="bg-teal-50 rounded-xl p-4 space-y-4">
              <h4 className="text-xs font-semibold text-teal-600 uppercase tracking-wide flex items-center gap-1.5">
                <Repeat className="h-3.5 w-3.5" />
                Programar Recurrente
              </h4>
              <div className="space-y-3">
                <select
                  value={editFormData.recurrencia}
                  onChange={e => setEditFormData({ ...editFormData, recurrencia: e.target.value as RecurrenceType })}
                  className="w-full px-3 py-2.5 border border-teal-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white"
                >
                  {RECURRENCE_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>

                {editFormData.recurrencia !== 'none' && (
                  <div className="pt-2 border-t border-teal-100">
                    <Input
                      label="Termina el (opcional)"
                      type="date"
                      value={editFormData.recurrencia_fin || ''}
                      onChange={e => setEditFormData({ ...editFormData, recurrencia_fin: e.target.value })}
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
                value={editFormData.recordatorio_minutos ?? ''}
                onChange={e => setEditFormData({ 
                  ...editFormData, 
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
            </div>

            {/* Ubicación */}
            <div className="bg-purple-50 rounded-xl p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-purple-600 uppercase tracking-wide flex items-center gap-1.5">
                  {editFormData.es_virtual ? <Video className="h-3.5 w-3.5" /> : <MapPin className="h-3.5 w-3.5" />}
                  {editFormData.es_virtual ? 'Reunión Virtual' : 'Ubicación'}
                </h4>
                <label className="flex items-center gap-2 cursor-pointer">
                  <span className="text-xs text-purple-600">Virtual</span>
                  <input
                    type="checkbox"
                    checked={editFormData.es_virtual}
                    onChange={e => setEditFormData({ ...editFormData, es_virtual: e.target.checked })}
                    className="rounded border-purple-300 text-purple-600 focus:ring-purple-500 h-4 w-4"
                  />
                </label>
              </div>
              {editFormData.es_virtual ? (
                <Input
                  label="Enlace de la reunión"
                  value={editFormData.enlace_reunion || ''}
                  onChange={e => setEditFormData({ ...editFormData, enlace_reunion: e.target.value })}
                  placeholder="https://meet.google.com/... o https://zoom.us/..."
                />
              ) : (
                <Input
                  label="Lugar"
                  value={editFormData.ubicacion || ''}
                  onChange={e => setEditFormData({ ...editFormData, ubicacion: e.target.value })}
                  placeholder="Ej: Oficina principal, Sala de reuniones"
                />
              )}
            </div>

            {/* Participantes */}
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
                <Users className="h-3.5 w-3.5" />
                Participantes ({users.length} disponibles)
              </label>
              <div className="border border-gray-200 rounded-xl max-h-48 overflow-y-auto bg-gray-50">
                {users.length === 0 ? (
                  <p className="p-4 text-center text-gray-500 text-sm">No hay usuarios disponibles</p>
                ) : (
                  users.map(user => {
                    const isSelected = editFormData.participantes.includes(user.id);
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
                              setEditFormData({ ...editFormData, participantes: [...editFormData.participantes, user.id] });
                            } else {
                              setEditFormData({ ...editFormData, participantes: editFormData.participantes.filter(id => id !== user.id) });
                            }
                          }}
                          className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                        />
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center flex-shrink-0">
                          <span className="text-white font-semibold text-xs">
                            {user.nombre_completo?.charAt(0) || '?'}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900">{user.nombre_completo}</p>
                          <p className="text-xs text-gray-500 truncate">{user.email}</p>
                        </div>
                      </label>
                    );
                  })
                )}
              </div>
            </div>

            {/* Notas */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Notas adicionales</label>
              <textarea
                value={editFormData.notas || ''}
                onChange={e => setEditFormData({ ...editFormData, notas: e.target.value })}
                rows={2}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors resize-none"
                placeholder="Notas o recordatorios..."
              />
            </div>

            {/* Acciones */}
            <div className="flex justify-end gap-3 pt-5 border-t border-gray-200">
              <Button variant="secondary" onClick={() => setIsEditingActivity(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveEdit}>
                Guardar Cambios
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

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
  X,
  Target,
  Filter,
  CalendarOff,
} from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
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
  getActivityComments,
  getStrategicObjectivesForSelection
} from '@/lib/services/activities';
import { getAllEventActivitiesForCalendar, type EventActivity } from '@/lib/services/events';
import { getBlockedDays, isDateBlocked } from '@/lib/services/blockedDays';
import { getUsersOnVacationOnDate } from '@/lib/services/vacations';
import { createNotificationsForUsers } from '@/lib/services/notificationsDb';
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
type CalendarFilterType = 'todos' | 'visitas' | 'diarias' | 'estrategicas' | 'eventos';

type EventActivityWithEvent = EventActivity & { events: { id: string; nombre: string; estado: string } | null };

export default function CalendarioPage() {
  const { userProfile } = useAuth();
  const [visits, setVisits] = useState<Visit[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [eventActivities, setEventActivities] = useState<EventActivityWithEvent[]>([]);
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
  const [showTecnicoActivities, setShowTecnicoActivities] = useState(false);
  const [tecnicoUserIds, setTecnicoUserIds] = useState<string[]>([]);
  const [isMobile, setIsMobile] = useState(false);
  const [filterByUser, setFilterByUser] = useState<string>('');
  const [selectedDayMobile, setSelectedDayMobile] = useState<Date | null>(null);
  const [calendarFilter, setCalendarFilter] = useState<CalendarFilterType>('todos');
  const [blockedDaysSet, setBlockedDaysSet] = useState<Set<string>>(new Set());

  // Detectar móvil
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  const [editFormData, setEditFormData] = useState<ActivityInsert & { participantes: string[]; recordatorio_minutos: number | null; recurrencia: RecurrenceType; recurrencia_fin: string; notificar: boolean; objetivo_estrategico_id: string }>({
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
    recurrencia_fin: '',
    notificar: true,
    objetivo_estrategico_id: '',
  });
  const [strategicObjectives, setStrategicObjectives] = useState<Pick<Activity, 'id' | 'titulo' | 'tipo' | 'fecha_inicio' | 'estado'>[]>([]);

  useEffect(() => {
    loadData();
  }, [currentDate, view, showTecnicoActivities, filterByUser]);

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

      const currentId = userProfile?.id;
      const currentRol = userProfile?.rol;
      const isSup = currentRol === 'admin' || currentRol === 'supervisor' || currentRol === 'supervisor_nivel1' || currentRol === 'supervisor_vendedor';

      // Supervisores/admin ven todas las actividades de eventos; otros solo las suyas
      const eventActUserId = isSup ? undefined : currentId;

      const dateFromShort = dateFrom.slice(0, 10);
      const dateToShort = dateTo.slice(0, 10);

      const [visitsData, pendingData, activitiesData, eventActivitiesData, blockedDaysData] = await Promise.all([
        getVisits({ date_from: dateFrom, date_to: dateTo }),
        getPendingVisits(),
        getActivities().catch(() => [] as Activity[]),
        getAllEventActivitiesForCalendar(eventActUserId).catch(() => [] as EventActivityWithEvent[]),
        getBlockedDays(dateFromShort, dateToShort).catch(() => []),
      ]);
      setBlockedDaysSet(new Set(blockedDaysData.map((d) => d.fecha)));

      // Cargar usuarios para mapeo y filtros
      const [allUsers, stratObjData] = await Promise.all([
        getAllUsersForSelection(),
        getStrategicObjectivesForSelection().catch(() => []),
      ]);
      setUsers(allUsers);
      setStrategicObjectives(stratObjData);

      // Filtrar visitas por usuario si hay filtro activo
      // filterByUser es users_profile.id, pero visit.user_id es auth UUID
      let filteredVisits = visitsData;
      let filteredPending = pendingData;
      if (filterByUser && isSup) {
        const selectedUser = allUsers.find(u => u.id === filterByUser);
        const authUid = (selectedUser as any)?.user_id || filterByUser;
        filteredVisits = visitsData.filter(v => v.user_id === authUid);
        filteredPending = pendingData.filter(v => v.user_id === authUid);
      }
      
      setVisits(filteredVisits);
      setPendingVisits(filteredPending);
      
      // Obtener IDs de técnicos si el filtro está activo
      let tecnicoIds: string[] = [];
      if (showTecnicoActivities) {
        tecnicoIds = allUsers.filter(u => u.rol === 'tecnico').map(u => u.id);
        setTecnicoUserIds(tecnicoIds);
      } else {
        setTecnicoUserIds([]);
      }
      
      // Filtrar actividades según el rol
      const myActivities = activitiesData.filter(activity => {
        const isCreator = activity.created_by_user_id === currentId;
        const isParticipant = Array.isArray(activity.participants) && 
          activity.participants.some(p => p.user_profile_id === currentId);
        
        if (showTecnicoActivities) {
          const createdByTecnico = tecnicoIds.includes(activity.created_by_user_id || '');
          const involvesTecnico = Array.isArray(activity.participants) &&
            activity.participants.some(p => tecnicoIds.includes(p.user_profile_id));
          if (createdByTecnico || involvesTecnico) return true;
        }
        
        if (currentRol === 'admin') return true;
        
        // Supervisores: ven TODO (diarias, estratégicas, de todos)
        if (currentRol === 'supervisor_nivel1' || currentRol === 'supervisor' || currentRol === 'supervisor_vendedor') {
          return true;
        }
        
        // Otros roles: solo sus propias o donde participan
        return isCreator || isParticipant;
      });
      
      // Si hay filtro por usuario, filtrar actividades y actividades de eventos
      let finalActivities = myActivities;
      let finalEventActivities = eventActivitiesData;
      if (filterByUser && isSup) {
        finalActivities = myActivities.filter(a => 
          a.created_by_user_id === filterByUser ||
          (Array.isArray(a.participants) && a.participants.some(p => p.user_profile_id === filterByUser))
        );
        finalEventActivities = eventActivitiesData.filter(ea => ea.responsable_id === filterByUser);
      }
      
      setActivities(finalActivities);
      setEventActivities(finalEventActivities);
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
      recurrencia_fin: activity.recurrencia_fin || '',
      notificar: true,
      objetivo_estrategico_id: activity.objetivo_estrategico_id || '',
    });
    setIsEditingActivity(true);
  }

  async function handleSaveEdit() {
    if (!selectedActivity || !editFormData.titulo || !editFormData.fecha_inicio) {
      toast.error('Título y fecha de inicio son requeridos');
      return;
    }
    try {
      const blocked = await isDateBlocked(new Date(editFormData.fecha_inicio));
      if (blocked) {
        toast.error('No se puede programar en un día no laborable. Elige otra fecha.');
        return;
      }
      const idsToCheck = [...new Set([selectedActivity.created_by_user_id, ...editFormData.participantes].filter(Boolean) as string[])];
      if (idsToCheck.length > 0) {
        const onVacationIds = await getUsersOnVacationOnDate(idsToCheck, editFormData.fecha_inicio);
        if (onVacationIds.length > 0) {
          const names = users.filter(u => onVacationIds.includes(u.id)).map(u => u.nombre_completo).join(', ');
          toast.error(`No se puede asignar: tienen vacaciones aprobadas ese día: ${names || 'Participante(s)'}`);
          return;
        }
      }
    } catch {
      // Si falla la consulta, permitir continuar
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
        recurrencia_fin: editFormData.recurrencia_fin ? new Date(editFormData.recurrencia_fin).toISOString() : null,
        objetivo_estrategico_id: editFormData.objetivo_estrategico_id || null
      };

      await updateActivity(selectedActivity.id, activityData);
      await removeAllParticipants(selectedActivity.id);
      if (editFormData.participantes.length > 0) {
        await addMultipleParticipants(selectedActivity.id, editFormData.participantes);
      }

      if (editFormData.notificar && editFormData.participantes.length > 0) {
        try {
          await createNotificationsForUsers(editFormData.participantes, {
            title: `Actividad actualizada: ${editFormData.titulo}`,
            body: `La actividad "${editFormData.titulo}" ha sido modificada`,
            type: 'actividad',
            reference_id: selectedActivity.id,
            reference_url: '/calendario',
          });
        } catch {}
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
  // Todos los usuarios pueden crear y ver sus propias actividades diarias
  const isSupervisorN1 = userProfile?.rol === 'supervisor_nivel1';
  const canManageDailyActivities = true; // Todos pueden gestionar sus actividades diarias

  const getActivitiesForDay = (date: Date) => {
    return activities.filter((activity) =>
      isSameDay(new Date(activity.fecha_inicio), date)
    );
  };

  // Separar actividades estratégicas de actividades diarias
  // Diaria: tipo tarea/otro (aunque tenga participantes)
  // Estratégica: SOLO reunion, capacitacion, seguimiento
  const isActivityStrategic = (activity: Activity) => {
    return activity.tipo === 'reunion' || activity.tipo === 'capacitacion' || activity.tipo === 'seguimiento';
  };

  const getStrategicActivitiesForDay = (date: Date) => {
    return getActivitiesForDay(date).filter(activity => isActivityStrategic(activity));
  };

  const getDailyActivitiesForDay = (date: Date) => {
    return getActivitiesForDay(date).filter(activity => !isActivityStrategic(activity));
  };

  const isActivityFromTecnico = (activity: Activity) => {
    if (!showTecnicoActivities) return false;
    const createdByTecnico = tecnicoUserIds.includes(activity.created_by_user_id || '');
    const involvesTecnico = Array.isArray(activity.participants) &&
      activity.participants.some(p => tecnicoUserIds.includes(p.user_profile_id));
    return createdByTecnico || involvesTecnico;
  };

  const getEventActivitiesForDay = (date: Date) => {
    if (calendarFilter !== 'todos' && calendarFilter !== 'eventos') return [];
    return eventActivities.filter((ea) =>
      isSameDay(new Date(ea.fecha_inicio), date)
    );
  };

  const isDayBlocked = (date: Date) => blockedDaysSet.has(format(date, 'yyyy-MM-dd'));

  const getFilteredVisitsForDay = (date: Date) => {
    if (calendarFilter !== 'todos' && calendarFilter !== 'visitas') return [];
    return getVisitsForDay(date);
  };

  const getFilteredStrategicForDay = (date: Date) => {
    if (calendarFilter !== 'todos' && calendarFilter !== 'estrategicas') return [];
    return getStrategicActivitiesForDay(date);
  };

  const getFilteredDailyForDay = (date: Date) => {
    if (calendarFilter !== 'todos' && calendarFilter !== 'diarias') return [];
    return getDailyActivitiesForDay(date);
  };

  const getFilteredActivitiesForDay = (date: Date) => {
    return [...getFilteredStrategicForDay(date), ...getFilteredDailyForDay(date)];
  };

  // Obtener clases de estilo para actividad (estratégica, diaria o técnico)
  const getActivityStyle = (activity: Activity, isStrategic: boolean) => {
    if (isActivityFromTecnico(activity)) {
      return {
        bg: 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 border-l-2 border-amber-500 hover:bg-amber-200 dark:hover:bg-amber-900/60',
        bgLarge: 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 border-l-4 border-amber-500 hover:bg-amber-200 dark:hover:bg-amber-900/60',
        icon: '👷',
        badge: 'Técnico',
        badgeClass: 'bg-amber-200 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200',
        dotColor: 'bg-amber-500'
      };
    }
    if (isStrategic) {
      return {
        bg: 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-200 border-l-2 border-purple-500 hover:bg-purple-200 dark:hover:bg-purple-900/60',
        bgLarge: 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-200 border-l-4 border-purple-500 hover:bg-purple-200 dark:hover:bg-purple-900/60',
        icon: '⭐',
        badge: 'Obj. Estratégico',
        badgeClass: 'bg-purple-200 dark:bg-purple-900/60 text-purple-800 dark:text-purple-200',
        dotColor: 'bg-purple-500'
      };
    }
    return {
      bg: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-200 border-l-2 border-blue-500 hover:bg-blue-200 dark:hover:bg-blue-900/60',
      bgLarge: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-200 border-l-4 border-blue-500 hover:bg-blue-200 dark:hover:bg-blue-900/60',
      icon: '📋',
      badge: 'Diaria',
      badgeClass: 'bg-blue-200 dark:bg-blue-900/60 text-blue-800 dark:text-blue-200',
      dotColor: 'bg-blue-500'
    };
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completada': return 'bg-emerald-50 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300';
      case 'programada': return 'bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300';
      case 'cancelada': return 'bg-gray-100 dark:bg-gray-700/40 text-gray-600 dark:text-gray-300';
      case 'no_atendio': return 'bg-amber-50 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300';
      default: return 'bg-purple-50 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300';
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
        <div className="text-gray-500 dark:text-gray-300">Cargando calendario...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6 px-2 sm:px-0">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl sm:text-3xl font-bold text-gray-900 dark:text-white">Calendario</h1>
            <p className="text-gray-500 dark:text-gray-300 text-xs sm:text-base mt-0.5 sm:mt-1 hidden sm:block">
              Gestiona tus actividades diarias, visitas y eventos estratégicos
            </p>
          </div>
          <div className="flex gap-1.5 sm:gap-2">
            <Link href="/calendario/nueva-actividad">
              <Button size={isMobile ? 'sm' : 'md'} icon={<Plus className="h-4 w-4" />}>
                <span className="hidden sm:inline">Actividad Diaria</span>
                <span className="sm:hidden">Actividad</span>
              </Button>
            </Link>
            <Link href="/calendario/nueva">
              <Button variant="secondary" size={isMobile ? 'sm' : 'md'} icon={<Plus className="h-4 w-4" />}>
                <span className="hidden sm:inline">Nueva Visita</span>
                <span className="sm:hidden">Visita</span>
              </Button>
            </Link>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Filtro por tipo */}
          <div className="flex items-center bg-gray-100 dark:bg-dark-600 rounded-xl p-0.5 gap-0.5">
            {([
              { value: 'todos', label: 'Todos', icon: '📅' },
              { value: 'visitas', label: 'Visitas', icon: '🏠' },
              { value: 'diarias', label: 'Diarias', icon: '📋' },
              { value: 'estrategicas', label: 'Obj. Estratégicos', icon: '⭐' },
              { value: 'eventos', label: 'Eventos', icon: '🎯' },
            ] as { value: CalendarFilterType; label: string; icon: string }[]).map((f) => (
              <button
                key={f.value}
                onClick={() => setCalendarFilter(f.value)}
                className={`px-2 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all flex items-center gap-1 ${
                  calendarFilter === f.value 
                    ? 'bg-white dark:bg-dark-800 text-indigo-700 dark:text-indigo-300 shadow-sm' 
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <span className="hidden sm:inline">{f.icon}</span>
                <span className="hidden sm:inline">{f.label}</span>
                <span className="sm:hidden">{f.icon}</span>
              </button>
            ))}
          </div>

          <button 
            onClick={() => setShowTecnicoActivities(!showTecnicoActivities)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${
              showTecnicoActivities 
                ? 'bg-amber-500 text-white shadow-md ring-2 ring-amber-300' 
                : 'bg-amber-100 text-amber-700 hover:bg-amber-200 border border-amber-300'
            }`}
          >
            <span className="text-base">{showTecnicoActivities ? '✓' : '👷'}</span>
            {showTecnicoActivities ? 'Viendo Técnico' : 'Ver Técnico'}
          </button>
          
          {/* Filtro por persona - Solo supervisores */}
          {(userProfile?.rol === 'admin' || userProfile?.rol?.includes('supervisor')) && (
            <Select
              value={filterByUser}
              onChange={(e) => setFilterByUser(e.target.value)}
              className="w-full sm:w-48 text-sm"
            >
              <option value="">👥 Todos</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nombre_completo}
                </option>
              ))}
            </Select>
          )}
        </div>
      </div>

      {/* Visitas Pendientes */}
      {pendingVisits.length > 0 && (
        <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/30 dark:bg-amber-900/20">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            <h2 className="font-semibold text-gray-900 dark:text-white">
              Visitas Vencidas
              <Badge variant="yellow" className="ml-2">{pendingVisits.length}</Badge>
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {pendingVisits.slice(0, 6).map((visit) => (
              <Link
                key={visit.id}
                href={`/calendario/${visit.id}`}
                className="flex items-center gap-3 p-3 rounded-lg bg-amber-100/50 dark:bg-amber-900/30 hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors"
              >
                <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 dark:text-white truncate">
                    {visit.customer?.nombre}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
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
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1 sm:gap-2 flex-1 min-w-0">
            <Button variant="ghost" size="sm" onClick={navigatePrevious}>
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <h2 className="text-sm sm:text-lg font-semibold text-gray-900 dark:text-white text-center truncate">
              {view === 'month'
                ? format(currentDate, 'MMMM yyyy', { locale: es })
                : view === 'week'
                ? `${format(weekStart, 'd MMM', { locale: es })} - ${format(weekEnd, 'd MMM', { locale: es })}`
                : 'Próximas'}
            </h2>
            <Button variant="ghost" size="sm" onClick={navigateNext}>
              <ChevronRight className="h-5 w-5" />
            </Button>
            <Button variant="secondary" size="sm" onClick={goToToday} className="ml-1 hidden sm:flex">
              Hoy
            </Button>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant={view === 'month' ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => { setView('month'); setSelectedDayMobile(null); }}
            >
              <Grid className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">Mes</span>
            </Button>
            <Button
              variant={view === 'week' ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => { setView('week'); setSelectedDayMobile(null); }}
            >
              <CalendarIcon className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">Semana</span>
            </Button>
            <Button
              variant={view === 'list' ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setView('list')}
            >
              <List className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">Lista</span>
            </Button>
          </div>
        </div>
      </Card>

      {/* Calendar Views */}
      {view === 'month' && (
        <Card padding="none" className="hidden md:block">
          {/* Days Header */}
          <div className="grid grid-cols-7 border-b border-gray-200 dark:border-dark-500">
            {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((day) => (
              <div
                key={day}
                className="p-2 lg:p-3 text-center text-xs lg:text-sm font-semibold text-gray-500 dark:text-gray-300 bg-gray-50 dark:bg-dark-700"
              >
                {day}
              </div>
            ))}
          </div>
          {/* Calendar Grid */}
          <div className="grid grid-cols-7">
            {calendarDays.map((day, index) => {
              const dayVisits = getFilteredVisitsForDay(day);
              const strategicActivities = getFilteredStrategicForDay(day);
              const dailyActivities = getFilteredDailyForDay(day);
              const dayEventActs = getEventActivitiesForDay(day);
              const isCurrentMonth = isSameMonth(day, currentDate);
              const isSelected = selectedDate && isSameDay(day, selectedDate);
              const today = isToday(day);
              const isBlocked = isDayBlocked(day);
              const totalItems = strategicActivities.length + dailyActivities.length + dayVisits.length + dayEventActs.length;

              return (
                <div
                  key={index}
                  onClick={() => setSelectedDate(day)}
                  className={cn(
                    'calendar-day min-h-[80px] lg:min-h-[100px] cursor-pointer',
                    !isCurrentMonth && 'calendar-day-other-month',
                    today && 'calendar-day-today',
                    isSelected && 'ring-2 ring-indigo-500 ring-inset',
                    isBlocked && 'bg-amber-50/70 dark:bg-amber-900/20'
                  )}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className={cn(
                        'text-sm font-medium',
                        today ? 'bg-indigo-500 text-white px-2 py-0.5 rounded' : 'text-gray-900 dark:text-white'
                      )}
                    >
                      {format(day, 'd')}
                    </span>
                    {isBlocked && (
                      <span title="Día no laborable">
                        <CalendarOff className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                      </span>
                    )}
                    <div className="flex gap-0.5">
                      {strategicActivities.length > 0 && <Star className="h-3 w-3 text-purple-500 fill-purple-500" />}
                      {dayEventActs.length > 0 && <Target className="h-3 w-3 text-rose-500" />}
                    </div>
                  </div>
                  <div className="space-y-1">
                    {/* Actividades de Eventos */}
                    {dayEventActs.slice(0, 1).map((ea) => (
                      <Link
                        key={`evt-${ea.id}`}
                        href={`/eventos/${ea.event_id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="calendar-event block cursor-pointer bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-200 border-l-2 border-rose-500 hover:bg-rose-200 dark:hover:bg-rose-900/60"
                      >
                        <span className="font-medium">{format(new Date(ea.fecha_inicio), 'HH:mm')}</span>
                        <span className="ml-1 truncate">🎯{ea.nombre}</span>
                      </Link>
                    ))}
                    {/* Objetivos Estratégicos */}
                    {strategicActivities.slice(0, dayEventActs.length > 0 ? 1 : 2).map((activity) => {
                      const style = getActivityStyle(activity, true);
                      return (
                        <div
                          key={`act-strategic-${activity.id}`}
                          onClick={(e) => { e.stopPropagation(); openActivityDetail(activity); }}
                          className={`calendar-event block cursor-pointer transition-colors ${style.bg}`}
                        >
                          <span className="font-medium">{format(new Date(activity.fecha_inicio), 'HH:mm')}</span>
                          <span className="ml-1 truncate">{style.icon}{activity.titulo}</span>
                        </div>
                      );
                    })}
                    {/* Actividades Diarias */}
                    {dailyActivities.slice(0, (strategicActivities.length + dayEventActs.length) > 0 ? 0 : 2).map((activity) => {
                      const style = getActivityStyle(activity, false);
                      return (
                        <div
                          key={`act-daily-${activity.id}`}
                          onClick={(e) => { e.stopPropagation(); openActivityDetail(activity); }}
                          className={`calendar-event block cursor-pointer transition-colors ${style.bg}`}
                        >
                          <span className="font-medium">{format(new Date(activity.fecha_inicio), 'HH:mm')}</span>
                          <span className="ml-1 truncate">{style.icon}{activity.titulo}</span>
                        </div>
                      );
                    })}
                    {/* Visitas */}
                    {dayVisits.slice(0, (strategicActivities.length + dailyActivities.length + dayEventActs.length) > 0 ? 0 : 2).map((visit) => (
                      <Link
                        key={visit.id}
                        href={`/calendario/${visit.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className={cn(
                          'calendar-event block bg-gray-100 dark:bg-gray-700/40 text-gray-600 dark:text-gray-300 border-l-2 border-gray-400'
                        )}
                      >
                        <span className="font-medium">{formatTime(visit.scheduled_at)}</span>
                        <span className="ml-1 truncate">{visit.customer?.nombre}</span>
                      </Link>
                    ))}
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

      {/* Vista Mes - Móvil */}
      {view === 'month' && (
        <Card padding="none" className="md:hidden">
          {/* Encabezado días */}
          <div className="grid grid-cols-7 bg-gray-50 dark:bg-dark-700 border-b dark:border-dark-500">
            {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((d) => (
              <div key={d} className="py-2 text-center text-xs font-semibold text-gray-500 dark:text-gray-300">
                {d}
              </div>
            ))}
          </div>
          
          {/* Grid de días del mes */}
          <div className="grid grid-cols-7">
            {calendarDays.map((day, index) => {
              const dayVisits = getFilteredVisitsForDay(day);
              const strategicActivities = getFilteredStrategicForDay(day);
              const dailyActivities = getFilteredDailyForDay(day);
              const dayAllAct = getFilteredActivitiesForDay(day);
              const dayEventActs = getEventActivitiesForDay(day);
              const isCurrentMonth = isSameMonth(day, currentDate);
              const isSelected = selectedDayMobile && isSameDay(day, selectedDayMobile);
              const today = isToday(day);
              const isBlocked = isDayBlocked(day);
              const totalItems = strategicActivities.length + dailyActivities.length + dayVisits.length + dayEventActs.length;
              
              const hasTecnicoActivities = dayAllAct.some(a => isActivityFromTecnico(a));
              const hasNonTecnicoStrategic = strategicActivities.some(a => !isActivityFromTecnico(a));
              const hasNonTecnicoDaily = dailyActivities.some(a => !isActivityFromTecnico(a));

              return (
                <div
                  key={index}
                  onClick={() => setSelectedDayMobile(isSelected ? null : day)}
                  className={cn(
                    'min-h-[52px] p-1 border-r border-b dark:border-dark-500 cursor-pointer transition-all',
                    (index + 1) % 7 === 0 && 'border-r-0',
                    !isCurrentMonth && 'bg-gray-50 dark:bg-dark-700 opacity-50',
                    today && 'bg-indigo-50 dark:bg-indigo-900/30',
                    isSelected && 'ring-2 ring-indigo-500 ring-inset bg-indigo-100 dark:bg-indigo-900/50',
                    isBlocked && 'bg-amber-50/80 dark:bg-amber-900/20'
                  )}
                >
                  <div className="flex flex-col items-center">
                    <span className={cn(
                      'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold',
                      today ? 'bg-indigo-600 text-white' : isCurrentMonth ? 'text-gray-700 dark:text-white' : 'text-gray-400 dark:text-gray-500'
                    )}>
                      {format(day, 'd')}
                    </span>
                    {isBlocked && <CalendarOff className="h-2.5 w-2.5 text-amber-600 mt-0.5" />}
                    {totalItems > 0 && (
                      <span className="text-[8px] font-medium text-gray-500 dark:text-gray-300 bg-gray-100 dark:bg-dark-500 px-1 rounded-full mt-0.5">
                        {totalItems}
                      </span>
                    )}
                    <div className="flex gap-0.5 mt-0.5 flex-wrap justify-center">
                      {dayEventActs.length > 0 && <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>}
                      {hasTecnicoActivities && <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>}
                      {hasNonTecnicoStrategic && <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>}
                      {hasNonTecnicoDaily && <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>}
                      {dayVisits.length > 0 && <span className="w-1.5 h-1.5 rounded-full bg-gray-400"></span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          
          {/* Panel de día seleccionado */}
          {selectedDayMobile && (
            <div className="border-t dark:border-dark-500 animate-in slide-in-from-top-2 duration-200">
              <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
                <div>
                  <p className="font-bold">{format(selectedDayMobile, "EEEE d 'de' MMMM", { locale: es })}</p>
                  <p className="text-indigo-100 text-sm">
                    {(() => {
                      const dv = getFilteredVisitsForDay(selectedDayMobile);
                      const ds = getFilteredStrategicForDay(selectedDayMobile);
                      const dd = getFilteredDailyForDay(selectedDayMobile);
                      const de = getEventActivitiesForDay(selectedDayMobile);
                      const total = ds.length + dd.length + dv.length + de.length;
                      return `${total} elemento${total !== 1 ? 's' : ''}`;
                    })()}
                  </p>
                </div>
                <button 
                  onClick={(e) => { e.stopPropagation(); setSelectedDayMobile(null); }}
                  className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              
              <div className="p-3 max-h-[250px] overflow-y-auto bg-white dark:bg-dark-700">
                {isDayBlocked(selectedDayMobile) && (
                  <div className="mb-3 p-2.5 rounded-lg bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 flex items-center gap-2 text-amber-800 dark:text-amber-200 text-sm">
                    <CalendarOff className="h-4 w-4 flex-shrink-0" />
                    <span>Día no laborable: no se puede programar.</span>
                  </div>
                )}
                {(() => {
                  const dayVisits = getFilteredVisitsForDay(selectedDayMobile);
                  const dayStrategic = getFilteredStrategicForDay(selectedDayMobile);
                  const dayDaily = getFilteredDailyForDay(selectedDayMobile);
                  const dayEventActs = getEventActivitiesForDay(selectedDayMobile);
                  const hasItems = (dayStrategic.length + dayDaily.length + dayVisits.length + dayEventActs.length) > 0;

                  if (!hasItems) {
                    return (
                      <div className="text-center py-6">
                        <CalendarIcon className="h-10 w-10 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                        <p className="text-gray-500 dark:text-gray-400 text-sm">Sin actividades para este día</p>
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-2">
                      {dayEventActs.map((ea) => (
                        <Link key={`me-${ea.id}`} href={`/eventos/${ea.event_id}`} className="block p-3 rounded-lg bg-rose-100 dark:bg-rose-900/40 text-rose-800 dark:text-rose-200 border-l-4 border-rose-500 hover:bg-rose-200 dark:hover:bg-rose-900/60 active:opacity-80">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-bold">🎯 {format(new Date(ea.fecha_inicio), 'HH:mm')}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-rose-200 dark:bg-rose-900/60 text-rose-800 dark:text-rose-200">Evento</span>
                          </div>
                          <p className="font-medium">{ea.nombre}</p>
                          {ea.events && <p className="text-xs opacity-70 mt-0.5">{ea.events.nombre}</p>}
                        </Link>
                      ))}
                      {dayStrategic.map((activity) => {
                        const style = getActivityStyle(activity, true);
                        return (
                          <div key={`ms-${activity.id}`} onClick={() => openActivityDetail(activity)} className={`p-3 rounded-lg cursor-pointer active:opacity-80 ${style.bgLarge}`}>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-bold">{style.icon} {format(new Date(activity.fecha_inicio), 'HH:mm')}</span>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${style.badgeClass}`}>{style.badge}</span>
                            </div>
                            <p className="font-medium">{activity.titulo}</p>
                          </div>
                        );
                      })}
                      {dayDaily.map((activity) => {
                        const style = getActivityStyle(activity, false);
                        return (
                          <div key={`md-${activity.id}`} onClick={() => openActivityDetail(activity)} className={`p-3 rounded-lg cursor-pointer active:opacity-80 ${style.bgLarge}`}>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-bold">{style.icon} {format(new Date(activity.fecha_inicio), 'HH:mm')}</span>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${style.badgeClass}`}>{style.badge}</span>
                            </div>
                            <p className="font-medium">{activity.titulo}</p>
                          </div>
                        );
                      })}
                      {dayVisits.map((visit) => (
                        <Link key={visit.id} href={`/calendario/${visit.id}`} className="block p-3 rounded-lg bg-gray-50 dark:bg-dark-600 border-l-4 border-gray-400">
                          <span className="text-xs font-bold text-gray-600 dark:text-gray-300">{formatTime(visit.scheduled_at)}</span>
                          <p className="font-medium text-gray-900 dark:text-white">{visit.customer?.nombre}</p>
                          {visit.customer?.direccion && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-1">
                              <MapPin className="h-3 w-3" />
                              {visit.customer.direccion}
                            </p>
                          )}
                        </Link>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </div>
          )}
        </Card>
      )}

      {view === 'week' && (
        <Card padding="none">
          {/* Desktop: grid 7 columnas */}
          <div className="hidden md:grid grid-cols-7 divide-x divide-gray-200 dark:divide-dark-500">
            {weekDays.map((day, index) => {
              const dayVisits = getFilteredVisitsForDay(day);
              const dayEventActs = getEventActivitiesForDay(day);
              const today = isToday(day);

              return (
                <div key={index} className="min-h-[400px]">
                  <div className={cn('p-3 text-center border-b border-gray-200 dark:border-dark-500', today && 'bg-indigo-50 dark:bg-indigo-900/30')}>
                    <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center justify-center gap-1">
                      {format(day, 'EEEE', { locale: es })}
                      {getFilteredStrategicForDay(day).length > 0 && <Star className="h-3 w-3 text-purple-500 fill-purple-500" />}
                      {dayEventActs.length > 0 && <Target className="h-3 w-3 text-rose-500" />}
                    </p>
                    <p className={cn('text-xl font-bold mt-1', today ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-900 dark:text-white')}>
                      {format(day, 'd')}
                    </p>
                  </div>
                  <div className="p-2 space-y-2">
                    {dayEventActs.map((ea) => (
                      <Link key={`wevt-${ea.id}`} href={`/eventos/${ea.event_id}`} className="block p-2 rounded-lg text-sm bg-rose-100 dark:bg-rose-900/40 text-rose-800 dark:text-rose-200 border-l-4 border-rose-500 hover:bg-rose-200 dark:hover:bg-rose-900/60 transition-colors">
                        <div className="flex items-center justify-between mb-0.5">
                          <p className="font-semibold flex items-center gap-1">🎯 {format(new Date(ea.fecha_inicio), 'HH:mm')}</p>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-rose-200 dark:bg-rose-900/60 text-rose-800 dark:text-rose-200">Evento</span>
                        </div>
                        <p className="truncate font-medium">{ea.nombre}</p>
                        {ea.events && <p className="text-[10px] opacity-70 truncate">{ea.events.nombre}</p>}
                      </Link>
                    ))}
                    {getFilteredStrategicForDay(day).map((activity) => {
                      const style = getActivityStyle(activity, true);
                      return (
                        <div key={`act-strategic-${activity.id}`} className={`block p-2 rounded-lg text-sm cursor-pointer transition-colors ${style.bgLarge}`} onClick={() => openActivityDetail(activity)}>
                          <div className="flex items-center justify-between mb-0.5">
                            <p className="font-semibold flex items-center gap-1">{style.icon} {format(new Date(activity.fecha_inicio), 'HH:mm')}</p>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${style.badgeClass}`}>{style.badge}</span>
                          </div>
                          <p className="truncate font-medium">{activity.titulo}</p>
                        </div>
                      );
                    })}
                    {getFilteredDailyForDay(day).map((activity) => {
                      const style = getActivityStyle(activity, false);
                      return (
                        <div key={`act-daily-${activity.id}`} className={`block p-2 rounded-lg text-sm cursor-pointer transition-colors ${style.bgLarge}`} onClick={() => openActivityDetail(activity)}>
                          <div className="flex items-center justify-between mb-0.5">
                            <p className="font-semibold">{style.icon} {format(new Date(activity.fecha_inicio), 'HH:mm')}</p>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${style.badgeClass}`}>{style.badge}</span>
                          </div>
                          <p className="truncate font-medium">{activity.titulo}</p>
                        </div>
                      );
                    })}
                    {dayVisits.map((visit) => (
                      <Link key={visit.id} href={`/calendario/${visit.id}`} className="block p-2 rounded-lg text-sm bg-gray-100 dark:bg-gray-700/40 text-gray-600 dark:text-gray-300 border-l-4 border-gray-400">
                        <p className="font-semibold">{formatTime(visit.scheduled_at)}</p>
                        <p className="truncate">{visit.customer?.nombre}</p>
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Móvil: Calendario con cuadros */}
          <div className="md:hidden">
            {/* Grid de encabezados */}
            <div className="grid grid-cols-7 bg-gray-50 dark:bg-dark-700 border-b dark:border-dark-500">
              {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((d) => (
                <div key={d} className="py-2 text-center text-xs font-semibold text-gray-500 dark:text-gray-300">
                  {d}
                </div>
              ))}
            </div>
            
            {/* Grid de días */}
            <div className="grid grid-cols-7 border-b dark:border-dark-500">
              {weekDays.map((day, index) => {
                const dayVisits = getFilteredVisitsForDay(day);
                const dayStrategic = getFilteredStrategicForDay(day);
                const dayDaily = getFilteredDailyForDay(day);
                const dayEventActs = getEventActivitiesForDay(day);
                const today = isToday(day);
                const isSelected = selectedDayMobile && isSameDay(day, selectedDayMobile);
                const totalItems = dayStrategic.length + dayDaily.length + dayVisits.length + dayEventActs.length;

                return (
                  <div
                    key={index}
                    onClick={() => setSelectedDayMobile(isSelected ? null : day)}
                    className={cn(
                      'min-h-[70px] p-1 border-r dark:border-dark-500 cursor-pointer transition-all',
                      index === 6 && 'border-r-0',
                      today && 'bg-indigo-50 dark:bg-indigo-900/30',
                      isSelected && 'ring-2 ring-indigo-500 ring-inset bg-indigo-100 dark:bg-indigo-900/50'
                    )}
                  >
                    <div className="flex flex-col items-center">
                      <span className={cn(
                        'w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold mb-1',
                        today ? 'bg-indigo-600 text-white' : 'text-gray-700 dark:text-white'
                      )}>
                        {format(day, 'd')}
                      </span>
                      {totalItems > 0 && (
                        <span className="text-[9px] font-medium text-gray-500 dark:text-gray-300 bg-gray-100 dark:bg-dark-500 px-1.5 rounded-full">
                          {totalItems}
                        </span>
                      )}
                      <div className="flex gap-0.5 mt-1 flex-wrap justify-center">
                        {dayEventActs.length > 0 && <span className="w-2 h-2 rounded-full bg-rose-500"></span>}
                        {dayStrategic.length > 0 && <span className="w-2 h-2 rounded-full bg-purple-500"></span>}
                        {dayDaily.length > 0 && <span className="w-2 h-2 rounded-full bg-blue-500"></span>}
                        {dayVisits.length > 0 && <span className="w-2 h-2 rounded-full bg-gray-400"></span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            
            {/* Panel de día seleccionado */}
            {selectedDayMobile && (
              <div className="bg-white dark:bg-dark-700 border-t dark:border-dark-500 animate-in slide-in-from-top-2 duration-200">
                <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
                  <div>
                    <p className="font-bold">{format(selectedDayMobile, "EEEE d 'de' MMMM", { locale: es })}</p>
                    <p className="text-indigo-100 text-sm">
                      {(() => {
                        const dv = getFilteredVisitsForDay(selectedDayMobile);
                        const ds = getFilteredStrategicForDay(selectedDayMobile);
                        const dd = getFilteredDailyForDay(selectedDayMobile);
                        const de = getEventActivitiesForDay(selectedDayMobile);
                        const total = ds.length + dd.length + dv.length + de.length;
                        return `${total} elemento${total !== 1 ? 's' : ''}`;
                      })()}
                    </p>
                  </div>
                  <button 
                    onClick={(e) => { e.stopPropagation(); setSelectedDayMobile(null); }}
                    className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                
                <div className="p-3 max-h-[300px] overflow-y-auto">
                  {(() => {
                    const dayVisits = getFilteredVisitsForDay(selectedDayMobile);
                    const dayStrategic = getFilteredStrategicForDay(selectedDayMobile);
                    const dayDaily = getFilteredDailyForDay(selectedDayMobile);
                    const dayEventActs = getEventActivitiesForDay(selectedDayMobile);
                    const hasItems = (dayStrategic.length + dayDaily.length + dayVisits.length + dayEventActs.length) > 0;

                    if (!hasItems) {
                      return (
                        <div className="text-center py-6">
                          <CalendarIcon className="h-10 w-10 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                          <p className="text-gray-500 dark:text-gray-400 text-sm">Sin actividades para este día</p>
                        </div>
                      );
                    }

                    return (
                      <div className="space-y-2">
                        {dayEventActs.map((ea) => (
                          <Link key={`wme-${ea.id}`} href={`/eventos/${ea.event_id}`} className="block p-3 rounded-lg bg-rose-100 dark:bg-rose-900/40 text-rose-800 dark:text-rose-200 border-l-4 border-rose-500 hover:bg-rose-200 dark:hover:bg-rose-900/60 active:opacity-80">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-bold">🎯 {format(new Date(ea.fecha_inicio), 'HH:mm')}</span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-rose-200 dark:bg-rose-900/60 text-rose-800 dark:text-rose-200">Evento</span>
                            </div>
                            <p className="font-medium">{ea.nombre}</p>
                            {ea.events && <p className="text-xs opacity-70 mt-0.5">{ea.events.nombre}</p>}
                          </Link>
                        ))}
                        {dayStrategic.map((activity) => {
                          const style = getActivityStyle(activity, true);
                          return (
                            <div key={`wms-${activity.id}`} onClick={() => openActivityDetail(activity)} className={`p-3 rounded-lg cursor-pointer active:opacity-80 ${style.bgLarge}`}>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-bold">{style.icon} {format(new Date(activity.fecha_inicio), 'HH:mm')}</span>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${style.badgeClass}`}>{style.badge}</span>
                              </div>
                              <p className="font-medium">{activity.titulo}</p>
                            </div>
                          );
                        })}
                        {dayDaily.map((activity) => {
                          const style = getActivityStyle(activity, false);
                          return (
                            <div key={`wmd-${activity.id}`} onClick={() => openActivityDetail(activity)} className={`p-3 rounded-lg cursor-pointer active:opacity-80 ${style.bgLarge}`}>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-bold">{style.icon} {format(new Date(activity.fecha_inicio), 'HH:mm')}</span>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${style.badgeClass}`}>{style.badge}</span>
                              </div>
                              <p className="font-medium">{activity.titulo}</p>
                            </div>
                          );
                        })}
                        {dayVisits.map((visit) => (
                          <Link key={visit.id} href={`/calendario/${visit.id}`} className="block p-3 rounded-lg bg-gray-50 dark:bg-dark-600 border-l-4 border-gray-400">
                            <span className="text-xs font-bold text-gray-600 dark:text-gray-300">{formatTime(visit.scheduled_at)}</span>
                            <p className="font-medium text-gray-900 dark:text-white">{visit.customer?.nombre}</p>
                          </Link>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}
          </div>
        </Card>
      )}

      {view === 'list' && (
        <Card className="!p-2 sm:!p-6">
          {(() => {
            const filteredActivities = calendarFilter === 'todos' ? activities
              : calendarFilter === 'diarias' ? activities.filter(a => !isActivityStrategic(a))
              : calendarFilter === 'estrategicas' ? activities.filter(a => isActivityStrategic(a))
              : calendarFilter === 'visitas' ? [] : calendarFilter === 'eventos' ? [] : activities;
            const filteredVisitsList = (calendarFilter === 'todos' || calendarFilter === 'visitas') ? visits : [];
            const filteredEventActsList = (calendarFilter === 'todos' || calendarFilter === 'eventos') ? eventActivities : [];
            const hasAnything = filteredActivities.length > 0 || filteredVisitsList.length > 0 || filteredEventActsList.length > 0;

            if (!hasAnything) {
              return (
                <EmptyState
                  icon={CalendarIcon}
                  title="No hay elementos para mostrar"
                  description={calendarFilter !== 'todos' ? `No hay ${calendarFilter === 'visitas' ? 'visitas' : calendarFilter === 'diarias' ? 'actividades diarias' : calendarFilter === 'estrategicas' ? 'objetivos estratégicos' : 'actividades de eventos'} programadas` : 'Crea tu primera actividad'}
                  action={{
                    label: 'Nueva Actividad Diaria',
                    onClick: () => (window.location.href = '/calendario/nueva-actividad'),
                  }}
                />
              );
            }

            return (
              <div className="space-y-2 sm:space-y-3">
                {/* Actividades de Eventos */}
                {filteredEventActsList.length > 0 && (
                  <>
                    <h3 className="text-sm font-semibold text-rose-700 dark:text-rose-300 flex items-center gap-2 mb-2">
                      <Target className="h-4 w-4" />
                      Actividades de Eventos ({filteredEventActsList.length})
                    </h3>
                    {filteredEventActsList.map((ea) => (
                      <Link
                        key={`list-evt-${ea.id}`}
                        href={`/eventos/${ea.event_id}`}
                        className="flex items-center justify-between p-3 sm:p-4 rounded-lg bg-rose-50 dark:bg-rose-900/30 hover:bg-rose-100 dark:hover:bg-rose-900/50 border-l-4 border-rose-500 transition-colors"
                      >
                        <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
                          <div className="text-center min-w-[40px] sm:min-w-[60px]">
                            <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">
                              {format(new Date(ea.fecha_inicio), 'EEE', { locale: es })}
                            </p>
                            <p className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">
                              {format(new Date(ea.fecha_inicio), 'd')}
                            </p>
                            <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">
                              {format(new Date(ea.fecha_inicio), 'MMM', { locale: es })}
                            </p>
                          </div>
                          <div className="border-l border-gray-200 dark:border-dark-500 pl-2 sm:pl-4 flex-1 min-w-0">
                            <p className="text-xs sm:text-sm font-semibold text-rose-600 dark:text-rose-300">
                              {format(new Date(ea.fecha_inicio), 'HH:mm')}
                            </p>
                            <p className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-1 truncate">
                              <Target className="h-3 w-3 text-rose-500 flex-shrink-0" />
                              {ea.nombre}
                            </p>
                            {ea.events && (
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{ea.events.nombre}</p>
                            )}
                          </div>
                        </div>
                        <Badge variant={ea.estado === 'completada' ? 'green' : ea.estado === 'en_progreso' ? 'blue' : ea.estado === 'bloqueada' ? 'red' : 'yellow'}>
                          {ea.estado.replace('_', ' ')}
                        </Badge>
                      </Link>
                    ))}
                  </>
                )}
                {activities.map((activity) => {
                  const isStrategic = isActivityStrategic(activity);
                  const isTecAct = isActivityFromTecnico(activity);
                  return (
                    <div
                      key={activity.id}
                      onClick={() => openActivityDetail(activity)}
                      className={cn(
                        'flex items-center justify-between p-3 sm:p-4 rounded-lg transition-colors cursor-pointer',
                        isTecAct
                          ? 'bg-amber-50 dark:bg-amber-900/40 hover:bg-amber-100 dark:hover:bg-amber-900/60 border-l-4 border-amber-500'
                          : isStrategic 
                            ? 'bg-purple-50 dark:bg-purple-900/40 hover:bg-purple-100 dark:hover:bg-purple-900/60 border-l-4 border-purple-500' 
                            : 'bg-blue-50 dark:bg-blue-900/40 hover:bg-blue-100 dark:hover:bg-blue-900/60 border-l-4 border-blue-500'
                      )}
                    >
                      <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
                        <div className="text-center min-w-[40px] sm:min-w-[60px]">
                          <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">
                            {format(new Date(activity.fecha_inicio), 'EEE', { locale: es })}
                          </p>
                          <p className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">
                            {format(new Date(activity.fecha_inicio), 'd')}
                          </p>
                          <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">
                            {format(new Date(activity.fecha_inicio), 'MMM', { locale: es })}
                          </p>
                        </div>
                        <div className="border-l border-gray-200 dark:border-dark-500 pl-2 sm:pl-4 flex-1 min-w-0">
                          <p className={cn(
                            'text-xs sm:text-sm font-semibold',
                            isTecAct ? 'text-amber-600 dark:text-amber-300' :
                            isStrategic ? 'text-purple-600 dark:text-purple-300' : 'text-blue-600 dark:text-blue-300'
                          )}>
                            {format(new Date(activity.fecha_inicio), 'HH:mm', { locale: es })}
                          </p>
                          <p className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-1 truncate">
                            {isStrategic && !isTecAct && <Star className="h-3 w-3 text-purple-500 fill-purple-500 flex-shrink-0" />}
                            {isTecAct && <span className="text-amber-500 flex-shrink-0">🔧</span>}
                            {activity.titulo}
                          </p>
                          <div className="hidden sm:flex items-center gap-3 mt-2 text-xs text-gray-500 dark:text-gray-400">
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

                {/* Visitas */}
                {filteredVisitsList.length > 0 && (
                  <>
                    <h3 className="text-sm font-semibold text-indigo-700 dark:text-indigo-300 flex items-center gap-2 mt-4 mb-2">
                      <CalendarIcon className="h-4 w-4" />
                      Visitas ({filteredVisitsList.length})
                    </h3>
                    {filteredVisitsList.map((visit) => (
                      <Link
                        key={visit.id}
                        href={`/calendario/${visit.id}`}
                        className="flex items-center justify-between p-3 sm:p-4 rounded-lg bg-gray-50 dark:bg-dark-600 hover:bg-gray-100 dark:hover:bg-dark-500 transition-colors"
                      >
                        <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
                          <div className="text-center min-w-[40px] sm:min-w-[60px]">
                            <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">
                              {format(new Date(visit.scheduled_at), 'EEE', { locale: es })}
                            </p>
                            <p className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">
                              {format(new Date(visit.scheduled_at), 'd')}
                            </p>
                            <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">
                              {format(new Date(visit.scheduled_at), 'MMM', { locale: es })}
                            </p>
                          </div>
                          <div className="border-l border-gray-200 dark:border-dark-500 pl-2 sm:pl-4 flex-1 min-w-0">
                            <p className="font-semibold text-indigo-600 dark:text-indigo-400">
                              {formatTime(visit.scheduled_at)}
                            </p>
                            <p className="font-medium text-gray-900 dark:text-white truncate">
                              {visit.customer?.nombre}
                            </p>
                            {visit.objetivo && (
                              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 hidden sm:block">
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
            );
          })()}
        </Card>
      )}

      {/* Selected Day Detail */}
      {selectedDate && view === 'month' && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900 dark:text-white">
              {format(selectedDate, "EEEE d 'de' MMMM", { locale: es })}
            </h3>
            {isDayBlocked(selectedDate) ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-amber-700 dark:text-amber-400 flex items-center gap-1">
                  <CalendarOff className="h-4 w-4" /> Día no laborable
                </span>
                {(userProfile?.rol === 'admin' || userProfile?.rol === 'supervisor' || userProfile?.rol === 'supervisor_nivel1' || userProfile?.rol === 'supervisor_vendedor') && (
                  <Link href="/calendario/dias-no-laborables">
                    <Button variant="ghost" size="sm">Gestionar</Button>
                  </Link>
                )}
              </div>
            ) : canManageDailyActivities ? (
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
          {isDayBlocked(selectedDate) && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              En este día no se puede programar visitas ni actividades.
            </p>
          )}
          {canManageDailyActivities ? (
            <>
              {/* Objetivos Estratégicos */}
              {getStrategicActivitiesForDay(selectedDate).length > 0 && (
                <div className="mb-4">
                  <h4 className="text-sm font-semibold text-purple-700 dark:text-purple-300 mb-3 flex items-center gap-1">
                    <Star className="h-4 w-4 fill-purple-500" />
                    Objetivos Estratégicos ({getStrategicActivitiesForDay(selectedDate).length})
                  </h4>
                  <div className="space-y-3">
                    {getStrategicActivitiesForDay(selectedDate).map((activity) => {
                      const isTec = isActivityFromTecnico(activity);
                      return (
                      <div
                        key={activity.id}
                        onClick={() => openActivityDetail(activity)}
                        className={`block p-4 rounded-lg cursor-pointer transition-colors ${
                          isTec
                            ? 'bg-amber-50 dark:bg-amber-900/40 border-l-4 border-amber-500 hover:bg-amber-100 dark:hover:bg-amber-900/60'
                            : 'bg-purple-50 dark:bg-purple-900/40 border-l-4 border-purple-500 hover:bg-purple-100 dark:hover:bg-purple-900/60'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <p className={`font-semibold ${isTec ? 'text-amber-700 dark:text-amber-300' : 'text-purple-700 dark:text-purple-300'}`}>
                                {format(new Date(activity.fecha_inicio), 'HH:mm')}
                              </p>
                              {activity.fecha_fin && (
                                <span className={`text-xs ${isTec ? 'text-amber-600 dark:text-amber-400' : 'text-purple-600 dark:text-purple-400'}`}>
                                  - {format(new Date(activity.fecha_fin), 'HH:mm')}
                                </span>
                              )}
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                                isTec
                                  ? 'bg-amber-200 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200'
                                  : 'bg-purple-200 dark:bg-purple-900/60 text-purple-800 dark:text-purple-200'
                              }`}>{isTec ? 'Técnico' : 'Estratégica'}</span>
                            </div>
                            <p className="font-medium text-gray-900 dark:text-white mb-1">{activity.titulo}</p>
                            {activity.descripcion && (
                              <p className="text-sm text-gray-600 dark:text-gray-300 mb-2 line-clamp-2">{activity.descripcion}</p>
                            )}
                            <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mt-2">
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
                                    <span className="text-gray-400 dark:text-gray-500">
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
                                <span className="flex items-center gap-1 text-purple-600 dark:text-purple-400">
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
                              activity.prioridad === 'urgente' ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300' :
                              activity.prioridad === 'alta' ? 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300' :
                              activity.prioridad === 'media' ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300' :
                              'bg-gray-100 dark:bg-gray-700/40 text-gray-700 dark:text-gray-300'
                            }`}>
                              {activity.prioridad}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                    })}
                  </div>
                </div>
              )}
              {/* Actividades Diarias */}
              {getDailyActivitiesForDay(selectedDate).length > 0 && (
                <div className="mb-4">
                  <h4 className="text-sm font-semibold text-blue-700 dark:text-blue-300 mb-3 flex items-center gap-1">
                    📋 Actividades Diarias ({getDailyActivitiesForDay(selectedDate).length})
                  </h4>
                  <div className="space-y-3">
                    {getDailyActivitiesForDay(selectedDate).map((activity) => {
                      const isTec = isActivityFromTecnico(activity);
                      return (
                      <div
                        key={activity.id}
                        onClick={() => openActivityDetail(activity)}
                        className={`block p-4 rounded-lg cursor-pointer transition-colors ${
                          isTec
                            ? 'bg-amber-50 dark:bg-amber-900/40 border-l-4 border-amber-500 hover:bg-amber-100 dark:hover:bg-amber-900/60'
                            : 'bg-blue-50 dark:bg-blue-900/40 border-l-4 border-blue-500 hover:bg-blue-100 dark:hover:bg-blue-900/60'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <p className={`font-semibold ${isTec ? 'text-amber-700 dark:text-amber-300' : 'text-blue-700 dark:text-blue-300'}`}>
                                {format(new Date(activity.fecha_inicio), 'HH:mm')}
                              </p>
                              {activity.fecha_fin && (
                                <span className={`text-xs ${isTec ? 'text-amber-600 dark:text-amber-400' : 'text-blue-600 dark:text-blue-400'}`}>
                                  - {format(new Date(activity.fecha_fin), 'HH:mm')}
                                </span>
                              )}
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                                isTec
                                  ? 'bg-amber-200 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200'
                                  : 'bg-blue-200 dark:bg-blue-900/60 text-blue-800 dark:text-blue-200'
                              }`}>{isTec ? 'Técnico' : 'Diaria'}</span>
                            </div>
                            <p className="font-medium text-gray-900 dark:text-white mb-1">{activity.titulo}</p>
                            {activity.descripcion && (
                              <p className="text-sm text-gray-600 dark:text-gray-300 mb-2 line-clamp-2">{activity.descripcion}</p>
                            )}
                            <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mt-2">
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
                                    <span className="text-gray-400 dark:text-gray-500">
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
                                <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
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
                              activity.prioridad === 'urgente' ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300' :
                              activity.prioridad === 'alta' ? 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300' :
                              activity.prioridad === 'media' ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300' :
                              'bg-gray-100 dark:bg-gray-700/40 text-gray-700 dark:text-gray-300'
                            }`}>
                              {activity.prioridad}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                    })}
                  </div>
                </div>
              )}
              {/* Visitas (secundario) */}
              {getVisitsForDay(selectedDate).length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-600 dark:text-gray-300 mb-2">Visitas</h4>
                  <div className="space-y-2">
                    {getVisitsForDay(selectedDate).map((visit) => (
                      <Link
                        key={visit.id}
                        href={`/calendario/${visit.id}`}
                        className="flex items-center justify-between p-3 rounded-lg bg-gray-100 dark:bg-dark-600 text-gray-600 dark:text-gray-300"
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
                <p className="text-center text-gray-500 dark:text-gray-400 py-4">
                  No hay actividades para este día
                </p>
              )}
            </>
          ) : (
            <>
              {/* Objetivos Estratégicos para vendedores */}
              {getActivitiesForDay(selectedDate).length > 0 && (
                <div className="mb-4">
                  <h4 className="text-sm font-semibold text-purple-700 dark:text-purple-300 mb-3 flex items-center gap-1">
                    <Star className="h-4 w-4 fill-purple-500" />
                    Mis Objetivos Estratégicos ({getActivitiesForDay(selectedDate).length})
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div className="bg-blue-50 rounded-lg p-3 sm:p-4">
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
                <div className="bg-green-50 rounded-lg p-3 sm:p-4">
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
                      Ver en Objetivos
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

            {/* Vincular a Objetivo Estratégico - solo para actividades diarias (tarea/otro) */}
            {(editFormData.tipo === 'tarea' || editFormData.tipo === 'otro') && strategicObjectives.length > 0 && (
              <div className="bg-indigo-50 rounded-xl p-4 space-y-3">
                <h4 className="text-xs font-semibold text-indigo-600 uppercase tracking-wide">
                  Vincular a Objetivo Estratégico (opcional)
                </h4>
                <select
                  value={editFormData.objetivo_estrategico_id}
                  onChange={e => setEditFormData({ ...editFormData, objetivo_estrategico_id: e.target.value })}
                  className="w-full px-4 py-2.5 border border-indigo-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors bg-white"
                >
                  <option value="">Sin vincular</option>
                  {strategicObjectives.map(obj => (
                    <option key={obj.id} value={obj.id}>
                      {obj.titulo} ({obj.tipo === 'reunion' ? 'Reunión' : obj.tipo === 'capacitacion' ? 'Capacitación' : 'Seguimiento'})
                    </option>
                  ))}
                </select>
                <p className="text-xs text-indigo-600">
                  Si vinculas esta actividad, el supervisor podrá verla al consultar el objetivo estratégico.
                </p>
              </div>
            )}

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

            {/* Notificar */}
            {editFormData.participantes.length > 0 && (
              <div className="flex items-center justify-between p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-200 dark:border-indigo-800">
                <div className="flex items-center gap-2">
                  <Bell className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">Notificar cambios</p>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400">Avisar a los involucrados</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEditFormData({ ...editFormData, notificar: !editFormData.notificar })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    editFormData.notificar ? 'bg-indigo-600' : 'bg-gray-300 dark:bg-dark-500'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform shadow-sm ${
                    editFormData.notificar ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>
            )}

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

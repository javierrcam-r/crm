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
} from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import EmptyState from '@/components/ui/EmptyState';
import Modal from '@/components/ui/Modal';
import { getVisits, getPendingVisits, type Visit } from '@/lib/services/visits';
import { getActivities } from '@/lib/services/activities';
import type { Activity } from '@/types/database';
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
} from 'date-fns';
import { es } from 'date-fns/locale';
import {
  formatTime,
  visitStatusLabels,
  cn,
} from '@/lib/utils';

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

  useEffect(() => {
    loadData();
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
      const myActivities = activitiesData.filter(activity => {
        // Admin y supervisor_nivel1 ven TODAS las actividades (estratégicas y diarias)
        if (userProfile?.rol === 'admin' || userProfile?.rol === 'supervisor_nivel1') {
          return true;
        }
        // Los vendedores solo ven las suyas o donde están involucrados
        return activity.created_by_user_id === userProfile?.id ||
               activity.participants?.some(p => p.user_profile_id === userProfile?.id);
      });
      setActivities(myActivities);
    } catch (error) {
      console.error('Error cargando datos:', error);
    } finally {
      setLoading(false);
    }
  };

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

  const getActivitiesForDay = (date: Date) => {
    return activities.filter((activity) =>
      isSameDay(new Date(activity.fecha_inicio), date)
    );
  };

  // Separar actividades estratégicas de actividades diarias
  const getStrategicActivitiesForDay = (date: Date) => {
    return getActivitiesForDay(date).filter(activity => 
      activity.tipo === 'reunion' || activity.tipo === 'capacitacion' || activity.tipo === 'seguimiento'
    );
  };

  const getDailyActivitiesForDay = (date: Date) => {
    return getActivitiesForDay(date).filter(activity => 
      activity.tipo === 'tarea' || activity.tipo === 'otro'
    );
  };

  // Determinar si es supervisor_nivel1
  const isSupervisorN1 = userProfile?.rol === 'supervisor_nivel1';

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
            {isSupervisorN1 ? 'Gestiona tus actividades diarias y estratégicas' : 'Gestiona tu agenda de visitas'}
          </p>
        </div>
        <div className="flex gap-2">
          {isSupervisorN1 ? (
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
              const totalItems = isSupervisorN1 
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
                    {isSupervisorN1 ? (
                      <>
                        {/* Actividades Estratégicas (color púrpura) - Prioridad alta */}
                        {strategicActivities.slice(0, 2).map((activity) => (
                          <div
                            key={`act-strategic-${activity.id}`}
                            onClick={(e) => { e.stopPropagation(); setSelectedActivity(activity); }}
                            className="calendar-event block bg-purple-100 text-purple-700 border-l-2 border-purple-500 cursor-pointer hover:bg-purple-200 transition-colors"
                          >
                            <span className="font-medium">{format(new Date(activity.fecha_inicio), 'HH:mm')}</span>
                            <span className="ml-1 truncate">⭐ {activity.titulo}</span>
                          </div>
                        ))}
                        {/* Actividades Diarias (color azul) */}
                        {dailyActivities.slice(0, strategicActivities.length > 0 ? 1 : 2).map((activity) => (
                          <div
                            key={`act-daily-${activity.id}`}
                            onClick={(e) => { e.stopPropagation(); setSelectedActivity(activity); }}
                            className="calendar-event block bg-blue-100 text-blue-700 border-l-2 border-blue-500 cursor-pointer hover:bg-blue-200 transition-colors"
                          >
                            <span className="font-medium">{format(new Date(activity.fecha_inicio), 'HH:mm')}</span>
                            <span className="ml-1 truncate">{activity.titulo}</span>
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
                            onClick={(e) => { e.stopPropagation(); setSelectedActivity(activity); }}
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
                    {isSupervisorN1 ? (
                      <>
                        {/* Actividades Estratégicas (color púrpura) */}
                        {getStrategicActivitiesForDay(day).map((activity) => (
                          <div
                            key={`act-strategic-${activity.id}`}
                            className="block p-2 rounded-lg text-sm bg-purple-100 text-purple-700 border-l-4 border-purple-500 cursor-pointer hover:bg-purple-200 transition-colors"
                            onClick={() => setSelectedActivity(activity)}
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
                        {/* Actividades Diarias (color azul) */}
                        {getDailyActivitiesForDay(day).map((activity) => (
                          <div
                            key={`act-daily-${activity.id}`}
                            className="block p-2 rounded-lg text-sm bg-blue-100 text-blue-700 border-l-4 border-blue-500 cursor-pointer hover:bg-blue-200 transition-colors"
                            onClick={() => setSelectedActivity(activity)}
                          >
                            <p className="font-semibold">
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
                            onClick={() => setSelectedActivity(activity)}
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
          {isSupervisorN1 ? (
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
                  const isStrategic = activity.tipo === 'reunion' || activity.tipo === 'capacitacion' || activity.tipo === 'seguimiento';
                  return (
                    <div
                      key={activity.id}
                      onClick={() => setSelectedActivity(activity)}
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
                      const isStrategic = activity.tipo === 'reunion' || activity.tipo === 'capacitacion' || activity.tipo === 'seguimiento';
                      return (
                        <div
                          key={activity.id}
                          onClick={() => setSelectedActivity(activity)}
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
            {isSupervisorN1 ? (
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
          {isSupervisorN1 ? (
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
                  <h4 className="text-sm font-semibold text-blue-700 mb-3">
                    Actividades Diarias ({getDailyActivitiesForDay(selectedDate).length})
                  </h4>
                  <div className="space-y-3">
                    {getDailyActivitiesForDay(selectedDate).map((activity) => (
                      <div
                        key={activity.id}
                        className="block p-4 rounded-lg bg-blue-50 border-l-4 border-blue-500"
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

      {/* Modal de detalle de actividad estratégica */}
      <Modal
        isOpen={!!selectedActivity}
        onClose={() => setSelectedActivity(null)}
        title={selectedActivity?.titulo || 'Detalle de Actividad'}
        size="lg"
      >
        {selectedActivity && (
          <div className="space-y-4">
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
                {selectedActivity.estado === 'planificacion' ? 'Planificación' :
                 selectedActivity.estado === 'haciendo' ? 'En Progreso' :
                 selectedActivity.estado === 'realizado' ? 'Realizado' : 'Cancelado'}
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

            {/* Acciones */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Link href="/actividades">
                <Button variant="secondary" size="sm">
                  Ver en Actividades
                </Button>
              </Link>
              <Button variant="secondary" onClick={() => setSelectedActivity(null)}>
                Cerrar
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Calendar,
  Users,
  Clock,
  AlertTriangle,
  Plus,
  ArrowRight,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  MessageSquare,
  MapPin,
  Star,
} from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { getVisitStats, getTodayVisits, getPendingVisits, getVisitsByDate } from '@/lib/services/visits';
import { getCustomerStats } from '@/lib/services/customers';
import { getActivities } from '@/lib/services/activities';
import { formatTime, visitStatusLabels } from '@/lib/utils';
import { format, addDays, subDays, isToday, startOfWeek, endOfWeek, isBefore, isAfter } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Visit } from '@/lib/services/visits';
import type { Activity } from '@/types/database';
import { useAuth } from '@/contexts/AuthContext';

interface Stats {
  visits: {
    today: number;
    todayCompleted: number;
    pending: number;
    weekTotal: number;
    weekCompleted: number;
  };
  customers: {
    total: number;
    clientes: number;
    prospectos: number;
  };
}

export default function DashboardPage() {
  const router = useRouter();
  const { isUserAdmin, userProfile } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [todayVisits, setTodayVisits] = useState<Visit[]>([]);
  const [pendingVisits, setPendingVisits] = useState<Visit[]>([]);
  const [weekActivities, setWeekActivities] = useState<Activity[]>([]);
  const [showActivities, setShowActivities] = useState(true);
  const [loading, setLoading] = useState(true);

  // Resumen del día
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [dayVisits, setDayVisits] = useState<Visit[]>([]);
  const [loadingDay, setLoadingDay] = useState(false);

  // Redirigir roles sin acceso al dashboard
  useEffect(() => {
    if (userProfile) {
      const rol = userProfile.rol;
      // VENDEDOR y SUPERVISOR_VENDEDOR tienen acceso al dashboard
      if (rol === 'admin' || rol === 'supervisor' || rol === 'supervisor_nivel1') {
        router.replace('/supervisores');
      } else if (rol === 'marketing' || rol === 'tecnico') {
        router.replace('/actividades');
      }
    }
  }, [userProfile, router]);

  useEffect(() => {
    // Cargar datos si es vendedor o supervisor_vendedor
    if (userProfile?.rol === 'vendedor' || userProfile?.rol === 'supervisor_vendedor') {
      loadData();
    }
  }, [userProfile]);

  useEffect(() => {
    if (userProfile?.rol === 'vendedor' || userProfile?.rol === 'supervisor_vendedor') {
      loadDayData(selectedDate);
    }
  }, [selectedDate, userProfile]);

  const loadData = async () => {
    try {
      const [visitStats, customerStats, visits, pending, activitiesData] = await Promise.all([
        getVisitStats(),
        getCustomerStats(),
        getTodayVisits(),
        getPendingVisits(),
        getActivities().catch(() => [] as Activity[]),
      ]);

      setStats({
        visits: visitStats,
        customers: customerStats,
      });
      setTodayVisits(visits);
      setPendingVisits(pending);
      
      // Filtrar actividades: propias o donde participa, de esta semana y no completadas
      const now = new Date();
      const weekStart = startOfWeek(now, { locale: es });
      const weekEnd = endOfWeek(now, { locale: es });
      
      const myWeekActivities = activitiesData.filter(activity => {
        // Solo las del usuario o donde participa
        const isMyActivity = activity.created_by_user_id === userProfile?.id ||
                            activity.participants?.some(p => p.user_profile_id === userProfile?.id);
        
        // Excluir actividades diarias personales (tarea/otro sin participantes)
        // Estas solo se ven en el calendario, no en el dashboard
        const isStrategicType = activity.tipo === 'reunion' || activity.tipo === 'capacitacion' || activity.tipo === 'seguimiento';
        const hasParticipants = Array.isArray(activity.participants) && activity.participants.length > 0;
        const isDailyPersonal = !isStrategicType && !hasParticipants;
        if (isDailyPersonal) return false;
        
        // Actividades que NO estén completadas
        const notCompleted = activity.estado !== 'realizado';
        
        // Actividades de esta semana o vencidas
        const activityDate = new Date(activity.fecha_inicio);
        const isThisWeek = !isBefore(activityDate, weekStart) && !isAfter(activityDate, weekEnd);
        const isOverdue = isBefore(activityDate, now) && activity.estado !== 'realizado';
        
        return isMyActivity && notCompleted && (isThisWeek || isOverdue);
      });
      
      // Ordenar por fecha más cercana primero
      myWeekActivities.sort((a, b) => 
        new Date(a.fecha_inicio).getTime() - new Date(b.fecha_inicio).getTime()
      );
      
      setWeekActivities(myWeekActivities);
    } catch (error) {
      console.error('Error cargando dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadDayData = async (date: Date) => {
    setLoadingDay(true);
    try {
      const dateStr = format(date, 'yyyy-MM-dd');
      const visits = await getVisitsByDate(dateStr);
      setDayVisits(visits);
    } catch (error) {
      console.error('Error cargando datos del día:', error);
    } finally {
      setLoadingDay(false);
    }
  };

  const goToPreviousDay = () => setSelectedDate(subDays(selectedDate, 1));
  const goToNextDay = () => setSelectedDate(addDays(selectedDate, 1));
  const goToToday = () => setSelectedDate(new Date());

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400 dark:text-gray-400">Cargando dashboard...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 md:space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
            {isUserAdmin && (
              <Badge variant="red">Vista Administrador</Badge>
            )}
          </div>
          <p className="text-gray-500 dark:text-gray-300 text-sm md:text-base mt-1">
            {isUserAdmin 
              ? 'Resumen general del sistema - Datos de todos los usuarios'
              : `Resumen de tu actividad${userProfile ? ` - ${userProfile.nombre_completo}` : ''}`
            }
          </p>
        </div>
        <div className="flex flex-wrap gap-2 md:gap-3">
          <Link href="/calendario/nueva" className="flex-1 md:flex-none">
            <Button icon={<Plus className="h-4 w-4" />} className="w-full md:w-auto">
              <span className="hidden sm:inline">Nueva</span> Visita
            </Button>
          </Link>
        </div>
      </div>

      {/* Recordatorio de Actividades Estratégicas */}
      {weekActivities.length > 0 && (
        <Card className="border-purple-200 dark:border-purple-800 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/30 dark:to-indigo-900/30 animate-fade-in">
          <div 
            className="flex items-center gap-2 cursor-pointer"
            onClick={() => setShowActivities(!showActivities)}
          >
            <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/50">
              <Star className="h-5 w-5 text-purple-600 dark:text-purple-400 fill-purple-600 dark:fill-purple-400" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-purple-900 dark:text-purple-100">Actividades Estratégicas</h3>
              <p className="text-xs text-purple-600 dark:text-purple-400">Esta semana y pendientes</p>
            </div>
            <Badge variant="purple">{weekActivities.length}</Badge>
            <button className="p-1 hover:bg-purple-100 dark:hover:bg-purple-900/50 rounded-lg transition-colors">
              {showActivities ? (
                <ChevronUp className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              ) : (
                <ChevronDown className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              )}
            </button>
          </div>
          
          {showActivities && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 mt-3">
                {weekActivities.slice(0, 6).map((activity) => {
                  const activityDate = new Date(activity.fecha_inicio);
                  const isOverdue = isBefore(activityDate, new Date()) && activity.estado !== 'realizado';
                  const participants = activity.participants || [];
                  
                  return (
                    <Link
                      key={activity.id}
                      href="/actividades"
                      className={`flex flex-col gap-2 p-3 rounded-lg transition-colors ${
                        isOverdue 
                          ? 'bg-red-100/70 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/50 border border-red-200 dark:border-red-800' 
                          : 'bg-white/70 dark:bg-dark-800/70 hover:bg-white dark:hover:bg-dark-800 border border-purple-100 dark:border-purple-800'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <div className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${
                          activity.prioridad === 'alta' ? 'bg-red-500' :
                          activity.prioridad === 'media' ? 'bg-amber-500' : 'bg-green-500'
                        }`} />
                        <div className="flex-1 min-w-0">
                          <p className={`font-medium truncate text-sm ${isOverdue ? 'text-red-800 dark:text-red-300' : 'text-gray-900 dark:text-white'}`}>
                            {activity.titulo}
                          </p>
                          <p className={`text-xs ${isOverdue ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-300'}`}>
                            {isOverdue && '⚠️ '}
                            {format(activityDate, "EEE dd MMM 'a las' HH:mm", { locale: es })}
                          </p>
                        </div>
                        <Badge 
                          variant={activity.estado === 'planificacion' ? 'blue' : 'yellow'} 
                          className="text-[10px] shrink-0"
                        >
                          {activity.estado === 'planificacion' ? 'Plan' : 'En prog'}
                        </Badge>
                      </div>
                      {/* Participantes */}
                      {participants.length > 0 && (
                        <div className="flex items-center gap-1 ml-4">
                          <Users className="h-3 w-3 text-gray-400 dark:text-gray-300" />
                          <p className="text-[10px] text-gray-500 dark:text-gray-300 truncate">
                            {participants.slice(0, 3).map(p => p.user_profile?.nombre_completo?.split(' ')[0] || 'Usuario').join(', ')}
                            {participants.length > 3 && ` +${participants.length - 3}`}
                          </p>
                        </div>
                      )}
                    </Link>
                  );
                })}
              </div>
              {weekActivities.length > 6 && (
                <Link 
                  href="/actividades" 
                  className="mt-3 text-sm text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-300 flex items-center gap-1"
                >
                  Ver todas ({weekActivities.length}) <ArrowRight className="h-4 w-4" />
                </Link>
              )}
            </>
          )}
        </Card>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 md:gap-4">
        <Card className="animate-fade-in stagger-1" padding="sm">
          <div className="flex items-center gap-3 md:gap-4">
            <div className="p-2 md:p-3 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 shrink-0">
              <Calendar className="h-5 w-5 md:h-6 md:w-6 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div className="min-w-0">
              <p className="text-xs md:text-sm text-gray-500 dark:text-gray-300 truncate">
                {isUserAdmin ? 'Visitas Hoy (Todos)' : 'Visitas Hoy'}
              </p>
              <p className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">{stats?.visits.today || 0}</p>
              <p className="text-[10px] md:text-xs text-emerald-600 dark:text-emerald-400">
                {stats?.visits.todayCompleted || 0} completadas
              </p>
            </div>
          </div>
        </Card>

        <Card className="animate-fade-in stagger-2" padding="sm">
          <div className="flex items-center gap-3 md:gap-4">
            <div className="p-2 md:p-3 rounded-xl bg-amber-50 dark:bg-amber-900/30 shrink-0">
              <AlertTriangle className="h-5 w-5 md:h-6 md:w-6 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="min-w-0">
              <p className="text-xs md:text-sm text-gray-500 dark:text-gray-300 truncate">
                {isUserAdmin ? 'Pendientes (Todos)' : 'Pendientes'}
              </p>
              <p className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">{stats?.visits.pending || 0}</p>
              <p className="text-[10px] md:text-xs text-amber-600 dark:text-amber-400">Requieren atención</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Resumen del Día con Selector */}
      <Card className="animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Calendar className="h-5 w-5 text-indigo-500 dark:text-indigo-400" />
            Resumen del Día
          </h2>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={goToPreviousDay}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <button
              onClick={goToToday}
              className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-dark-700 rounded-lg hover:bg-gray-200 dark:hover:bg-dark-600 transition-colors min-w-[140px] text-center"
            >
              {isToday(selectedDate) ? 'Hoy' : format(selectedDate, "EEE d 'de' MMM", { locale: es })}
            </button>
            <Button variant="ghost" size="sm" onClick={goToNextDay}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {loadingDay ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-gray-400 dark:text-gray-400">Cargando...</div>
          </div>
        ) : (
          <div>
            {/* Visitas del día */}
            <div>
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-300 mb-3 flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Visitas ({dayVisits.length})
              </h3>
              {dayVisits.length === 0 ? (
                <div className="text-center py-8 bg-gray-50 dark:bg-dark-700/50 rounded-xl">
                  <Calendar className="h-10 w-10 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                  <p className="text-sm text-gray-500 dark:text-gray-300">Sin visitas programadas</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                  {dayVisits.map((visit) => (
                    <Link
                      key={visit.id}
                      href={`/calendario/${visit.id}`}
                      className="block p-3 rounded-xl bg-gray-50 dark:bg-dark-700/50 hover:bg-gray-100 dark:hover:bg-dark-700 transition-colors border border-transparent hover:border-gray-200 dark:hover:border-dark-500"
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 min-w-0 mb-1">
                            <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400 shrink-0">
                              {formatTime(visit.scheduled_at)}
                            </span>
                            <span className="font-medium text-gray-900 dark:text-white truncate">
                              {visit.customer?.nombre || 'Cliente'}
                            </span>
                          </div>
                          {isUserAdmin && visit.user_id && (
                            <p className="text-xs text-gray-500 dark:text-gray-300">
                              Usuario ID: {visit.user_id.substring(0, 8)}...
                            </p>
                          )}
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
                      </div>
                      
                      {visit.objetivo && (
                        <p className="text-sm text-gray-600 dark:text-gray-300 mb-2 line-clamp-2">
                          {visit.objetivo}
                        </p>
                      )}

                      {/* Comentarios/Resultado si está completada */}
                      {visit.status === 'completada' && visit.resultado && (
                        <div className="mt-2 p-2 bg-emerald-50 dark:bg-emerald-900/30 rounded-lg">
                          <div className="flex items-start gap-2">
                            <MessageSquare className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                            <p className="text-sm text-emerald-700 dark:text-emerald-300 line-clamp-2">
                              {visit.resultado}
                            </p>
                          </div>
                        </div>
                      )}

                      {visit.observaciones && (
                        <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                          <div className="flex items-start gap-2">
                            <MessageSquare className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                            <p className="text-sm text-blue-700 dark:text-blue-300 line-clamp-2">
                              {visit.observaciones}
                            </p>
                          </div>
                        </div>
                      )}

                      {visit.customer?.direccion && (
                        <div className="flex items-center gap-1.5 mt-2 text-xs text-gray-500 dark:text-gray-300">
                          <MapPin className="h-3 w-3" />
                          <span className="truncate">{visit.customer.direccion}</span>
                        </div>
                      )}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Card>

      {/* Visitas Pendientes (Vencidas) */}
      {pendingVisits.length > 0 && (
        <Card className="animate-fade-in border-amber-200 dark:border-amber-800 bg-amber-50/30 dark:bg-amber-900/20">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              <h2 className="text-base md:text-lg font-semibold text-gray-900 dark:text-white">
                Visitas Vencidas
              </h2>
              <Badge variant="yellow">{pendingVisits.length}</Badge>
            </div>
          </div>
          <div className="space-y-2 md:space-y-3">
            {pendingVisits.slice(0, 3).map((visit) => (
              <Link
                key={visit.id}
                href={`/calendario/${visit.id}`}
                className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-dark-800 border border-amber-100 dark:border-amber-800 hover:border-amber-200 dark:hover:border-amber-700 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Clock className="h-4 w-4 text-amber-500 dark:text-amber-400 shrink-0" />
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 dark:text-white truncate">
                      {visit.customer?.nombre || 'Cliente'}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-300 truncate">{visit.objetivo}</p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-gray-400 dark:text-gray-300 shrink-0" />
              </Link>
            ))}
          </div>
        </Card>
      )}

      {/* Grid de Visitas y Pedidos de HOY */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        {/* Visitas de Hoy */}
        <Card className="animate-fade-in">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base md:text-lg font-semibold text-gray-900 dark:text-white">Agenda de Hoy</h2>
            <Link href="/calendario" className="text-xs md:text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium">
              Ver calendario →
            </Link>
          </div>
          {todayVisits.length === 0 ? (
            <div className="text-center py-6 md:py-8">
              <Calendar className="h-10 w-10 md:h-12 md:w-12 text-gray-200 dark:text-gray-700 mx-auto mb-3" />
              <p className="text-sm text-gray-500 dark:text-gray-300">No hay visitas programadas para hoy</p>
              <Link href="/calendario/nueva">
                <Button variant="ghost" size="sm" className="mt-3">
                  Programar visita
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-2 md:space-y-3">
              {todayVisits.slice(0, 5).map((visit) => (
                <Link
                  key={visit.id}
                  href={`/calendario/${visit.id}`}
                  className="flex items-center justify-between p-2.5 md:p-3 rounded-xl bg-gray-50 dark:bg-dark-700/50 hover:bg-gray-100 dark:hover:bg-dark-700 transition-colors"
                >
                  <div className="flex items-center gap-2 md:gap-3 min-w-0">
                    <div className="text-center min-w-[45px] md:min-w-[50px]">
                      <p className="text-sm md:text-lg font-bold text-indigo-600 dark:text-indigo-400">
                        {formatTime(visit.scheduled_at)}
                      </p>
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 dark:text-white text-sm md:text-base truncate">
                        {visit.customer?.nombre || 'Cliente'}
                      </p>
                      <p className="text-xs md:text-sm text-gray-500 dark:text-gray-300 truncate max-w-[150px] md:max-w-[200px]">
                        {visit.objetivo}
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant={
                      visit.status === 'completada' ? 'green' :
                      visit.status === 'programada' ? 'blue' :
                      visit.status === 'cancelada' ? 'gray' : 'yellow'
                    }
                  >
                    <span className="hidden sm:inline">{visitStatusLabels[visit.status]}</span>
                    <span className="sm:hidden">
                      {visit.status === 'completada' ? '✓' : visit.status === 'programada' ? '○' : '!'}
                    </span>
                  </Badge>
                </Link>
              ))}
            </div>
          )}
        </Card>

      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
        <Card className="animate-fade-in" padding="sm">
          <div className="flex items-center gap-3 md:gap-4">
            <Users className="h-7 w-7 md:h-8 md:w-8 text-indigo-500 dark:text-indigo-400 shrink-0" />
            <div className="min-w-0">
              <p className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">{stats?.customers.total || 0}</p>
              <p className="text-xs md:text-sm text-gray-500 dark:text-gray-300 truncate">
                {stats?.customers.clientes || 0} clientes · {stats?.customers.prospectos || 0} prospectos
              </p>
            </div>
          </div>
          <Link href="/clientes">
            <Button variant="ghost" size="sm" className="w-full mt-3 md:mt-4">
              Ver Clientes
            </Button>
          </Link>
        </Card>

        <Card className="animate-fade-in" padding="sm">
          <div className="flex items-center gap-3 md:gap-4">
            <CheckCircle className="h-7 w-7 md:h-8 md:w-8 text-emerald-500 dark:text-emerald-400 shrink-0" />
            <div className="min-w-0">
              <p className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">
                {stats?.visits.weekTotal || 0}
              </p>
              <p className="text-xs md:text-sm text-gray-500 dark:text-gray-300 truncate">
                Visitas semana ({stats?.visits.weekCompleted || 0} completadas)
              </p>
            </div>
          </div>
          <Link href="/calendario">
            <Button variant="ghost" size="sm" className="w-full mt-3 md:mt-4">
              Ver Calendario
            </Button>
          </Link>
        </Card>
      </div>
    </div>
  );
}

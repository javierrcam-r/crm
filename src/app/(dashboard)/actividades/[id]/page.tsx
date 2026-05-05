'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Calendar,
  Clock,
  MapPin,
  User,
  Users,
  CheckCircle,
  XCircle,
  Target,
  Video,
  MessageSquare,
  Edit,
  Trash2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import {
  getActivity,
  updateActivityStatus,
  deleteActivity,
  getLinkedDailyActivities,
} from '@/lib/services/activities';
import { getLinkedVisits, type Visit } from '@/lib/services/visits';
import type { Activity, ActivityStatus } from '@/types/database';
import { format, formatDistance } from 'date-fns';
import { es } from 'date-fns/locale';
import toast from 'react-hot-toast';
import { useAuth } from '@/contexts/AuthContext';
import { cn, visitStatusLabels } from '@/lib/utils';

const estadoLabels: Record<ActivityStatus, string> = {
  planificacion: 'Planificación',
  haciendo: 'En Progreso',
  realizado: 'Realizado',
  cancelado: 'Cancelado',
};

const estadoColors: Record<ActivityStatus, string> = {
  planificacion: 'bg-gray-100 text-gray-700 dark:bg-dark-600 dark:text-gray-200',
  haciendo: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  realizado: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  cancelado: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
};

const tipoLabels: Record<string, string> = {
  reunion: 'Reunión',
  capacitacion: 'Capacitación',
  seguimiento: 'Seguimiento',
  tarea: 'Tarea',
  tecnico: 'Técnico',
  otro: 'Otro',
};

export default function ActividadDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { userProfile } = useAuth();
  const activityId = params.id as string;

  const [activity, setActivity] = useState<Activity | null>(null);
  const [linkedActivities, setLinkedActivities] = useState<Activity[]>([]);
  const [linkedVisits, setLinkedVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const [showLinkedActivities, setShowLinkedActivities] = useState(true);
  const [showLinkedVisits, setShowLinkedVisits] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const isSupervisor = userProfile?.rol === 'admin' || 
    userProfile?.rol === 'supervisor' || 
    userProfile?.rol === 'supervisor_nivel1' || 
    userProfile?.rol === 'supervisor_vendedor';

  const isStrategic = activity?.tipo === 'reunion' || 
    activity?.tipo === 'capacitacion' || 
    activity?.tipo === 'seguimiento';

  useEffect(() => {
    loadData();
  }, [activityId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await getActivity(activityId);
      setActivity(data);

      if (!data) return;

      const isStrategicType = data.tipo === 'reunion' || 
        data.tipo === 'capacitacion' || 
        data.tipo === 'seguimiento';

      if (isStrategicType) {
        const [linkedActs, linkedVis] = await Promise.all([
          getLinkedDailyActivities(activityId),
          getLinkedVisits(activityId),
        ]);
        setLinkedActivities(linkedActs);
        setLinkedVisits(linkedVis);
      }
    } catch (error) {
      console.error('Error cargando actividad:', error);
      toast.error('Error al cargar la actividad');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (newStatus: ActivityStatus) => {
    if (!activity) return;
    try {
      setActionLoading(true);
      await updateActivityStatus(activity.id, newStatus);
      toast.success(`Estado actualizado a "${estadoLabels[newStatus]}"`);
      loadData();
    } catch (error) {
      console.error('Error actualizando estado:', error);
      toast.error('Error al actualizar el estado');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!activity) return;
    if (!confirm('¿Estás seguro de eliminar esta actividad?')) return;

    try {
      setActionLoading(true);
      await deleteActivity(activity.id);
      toast.success('Actividad eliminada');
      router.push('/actividades');
    } catch (error) {
      console.error('Error eliminando actividad:', error);
      toast.error('Error al eliminar la actividad');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 dark:border-indigo-400" />
      </div>
    );
  }

  if (!activity) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 dark:text-gray-400">No se encontró la actividad</p>
        <Link href="/actividades">
          <Button className="mt-4">Volver a Objetivos Estratégicos</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4">
        <div className="flex items-start gap-3 sm:gap-4 min-w-0 flex-1">
          <Link href={isStrategic ? '/actividades' : '/calendario'}>
            <Button variant="ghost" size="sm" icon={<ArrowLeft className="h-4 w-4" />}>
              <span className="hidden sm:inline">Volver</span>
            </Button>
          </Link>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h1 className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white break-words">{activity.titulo}</h1>
              <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap', estadoColors[activity.estado])}>
                {estadoLabels[activity.estado]}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-300">
              {tipoLabels[activity.tipo]} · Creada {formatDistance(new Date(activity.created_at), new Date(), { addSuffix: true, locale: es })}
            </p>
          </div>
        </div>

        {isSupervisor && (
          <div className="flex items-center gap-2 flex-shrink-0">
            <Link href={`/calendario`}>
              <Button variant="secondary" size="sm" icon={<Edit className="h-4 w-4" />}>
                Editar
              </Button>
            </Link>
            <Button
              variant="ghost"
              size="sm"
              icon={<Trash2 className="h-4 w-4 text-red-500" />}
              onClick={handleDelete}
              loading={actionLoading}
            />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Info Principal */}
        <div className="lg:col-span-2 space-y-4 sm:space-y-6">
          {/* Detalles */}
          <Card>
            <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-4">Detalles</h2>
            <div className="space-y-4">
              {activity.descripcion && (
                <div>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">Descripción</p>
                  <p className="text-gray-900 dark:text-gray-100">{activity.descripcion}</p>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex items-start gap-3">
                  <Calendar className="h-5 w-5 text-indigo-500 dark:text-indigo-400 mt-0.5 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs text-gray-400 dark:text-gray-500">Fecha de Inicio</p>
                    <p className="text-gray-900 dark:text-gray-100 font-medium">
                      {format(new Date(activity.fecha_inicio), "d MMM yyyy, HH:mm", { locale: es })}
                    </p>
                  </div>
                </div>

                {activity.fecha_fin && (
                  <div className="flex items-start gap-3">
                    <Clock className="h-5 w-5 text-indigo-500 dark:text-indigo-400 mt-0.5 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs text-gray-400 dark:text-gray-500">Fecha de Fin</p>
                      <p className="text-gray-900 dark:text-gray-100 font-medium">
                        {format(new Date(activity.fecha_fin), "d MMM yyyy, HH:mm", { locale: es })}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {(activity.ubicacion || activity.enlace_reunion) && (
                <div className="flex items-start gap-3">
                  {activity.es_virtual ? (
                    <Video className="h-5 w-5 text-indigo-500 dark:text-indigo-400 mt-0.5 flex-shrink-0" />
                  ) : (
                    <MapPin className="h-5 w-5 text-indigo-500 dark:text-indigo-400 mt-0.5 flex-shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      {activity.es_virtual ? 'Reunión Virtual' : 'Ubicación'}
                    </p>
                    {activity.es_virtual && activity.enlace_reunion ? (
                      <a
                        href={activity.enlace_reunion}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 break-all"
                      >
                        Unirse a la reunión
                      </a>
                    ) : (
                      <p className="text-gray-900 dark:text-gray-100">{activity.ubicacion}</p>
                    )}
                  </div>
                </div>
              )}

              {activity.notas && (
                <div className="pt-4 border-t border-gray-100 dark:border-dark-500">
                  <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">Notas</p>
                  <p className="text-gray-700 dark:text-gray-200 whitespace-pre-wrap">{activity.notas}</p>
                </div>
              )}

              {activity.resultado && (
                <div className="pt-4 border-t border-gray-100 dark:border-dark-500">
                  <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">Resultado</p>
                  <p className="text-gray-900 dark:text-gray-100">{activity.resultado}</p>
                </div>
              )}
            </div>
          </Card>

          {/* Actividades Diarias Vinculadas - Solo para objetivos estratégicos */}
          {isStrategic && (
            <Card>
              <button
                onClick={() => setShowLinkedActivities(!showLinkedActivities)}
                className="w-full flex items-center justify-between text-left"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Target className="h-5 w-5 text-indigo-500 dark:text-indigo-400 flex-shrink-0" />
                  <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white truncate">
                    Actividades Diarias Vinculadas ({linkedActivities.length})
                  </h2>
                </div>
                {showLinkedActivities ? (
                  <ChevronUp className="h-5 w-5 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                )}
              </button>

              {showLinkedActivities && (
                <div className="mt-4">
                  {linkedActivities.length === 0 ? (
                    <p className="text-gray-500 dark:text-gray-400 text-center py-4">
                      No hay actividades diarias vinculadas a este objetivo
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {linkedActivities.map((act) => (
                        <div
                          key={act.id}
                          className="p-3 bg-gray-50 dark:bg-dark-800 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-600 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-medium text-gray-900 dark:text-white">{act.titulo}</p>
                              <p className="text-sm text-gray-500 dark:text-gray-400">
                                {format(new Date(act.fecha_inicio), "d MMM yyyy, HH:mm", { locale: es })}
                              </p>
                            </div>
                            <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap flex-shrink-0', estadoColors[act.estado])}>
                              {estadoLabels[act.estado]}
                            </span>
                          </div>
                          {act.descripcion && (
                            <p className="text-sm text-gray-600 dark:text-gray-300 mt-2 line-clamp-2">{act.descripcion}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </Card>
          )}

          {/* Visitas Vinculadas - Solo para objetivos estratégicos */}
          {isStrategic && (
            <Card>
              <button
                onClick={() => setShowLinkedVisits(!showLinkedVisits)}
                className="w-full flex items-center justify-between text-left"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <MapPin className="h-5 w-5 text-green-500 dark:text-green-400 flex-shrink-0" />
                  <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white truncate">
                    Visitas Vinculadas ({linkedVisits.length})
                  </h2>
                </div>
                {showLinkedVisits ? (
                  <ChevronUp className="h-5 w-5 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                )}
              </button>

              {showLinkedVisits && (
                <div className="mt-4">
                  {linkedVisits.length === 0 ? (
                    <p className="text-gray-500 dark:text-gray-400 text-center py-4">
                      No hay visitas vinculadas a este objetivo
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {linkedVisits.map((visit) => (
                        <Link
                          key={visit.id}
                          href={`/calendario/${visit.id}`}
                          className="block p-3 bg-gray-50 dark:bg-dark-800 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-600 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-medium text-gray-900 dark:text-white truncate">
                                {visit.customer?.nombre || 'Cliente'}
                              </p>
                              <p className="text-sm text-gray-500 dark:text-gray-400">
                                {format(new Date(visit.scheduled_at), "d MMM yyyy, HH:mm", { locale: es })}
                              </p>
                            </div>
                            <Badge variant={
                              visit.status === 'completada' ? 'green' :
                              visit.status === 'cancelada' ? 'red' :
                              visit.status === 'no_atendio' ? 'yellow' :
                              'gray'
                            }>
                              {visitStatusLabels[visit.status] || visit.status}
                            </Badge>
                          </div>
                          {visit.objetivo && (
                            <p className="text-sm text-gray-600 dark:text-gray-300 mt-2 line-clamp-2">{visit.objetivo}</p>
                          )}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4 sm:space-y-6">
          {/* Cambiar Estado */}
          <Card>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Cambiar Estado</h3>
            <div className="space-y-2">
              {(['planificacion', 'haciendo', 'realizado', 'cancelado'] as ActivityStatus[]).map((status) => (
                <button
                  key={status}
                  onClick={() => handleStatusChange(status)}
                  disabled={activity.estado === status || actionLoading}
                  className={cn(
                    'w-full px-3 py-2 rounded-lg text-sm font-medium text-left transition-colors flex items-center gap-2',
                    activity.estado === status
                      ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 cursor-default'
                      : 'bg-gray-50 dark:bg-dark-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-dark-600'
                  )}
                >
                  {activity.estado === status && <CheckCircle className="h-4 w-4" />}
                  {estadoLabels[status]}
                </button>
              ))}
            </div>
          </Card>

          {/* Participantes */}
          {activity.participants && activity.participants.length > 0 && (
            <Card>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <Users className="h-4 w-4 text-indigo-500 dark:text-indigo-400" />
                Participantes ({activity.participants.length})
              </h3>
              <div className="space-y-2">
                {activity.participants.map((p) => (
                  <div key={p.id} className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center flex-shrink-0">
                      <span className="text-white font-semibold text-xs">
                        {p.user_profile?.nombre_completo?.charAt(0) || '?'}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {p.user_profile?.nombre_completo || 'Usuario'}
                      </p>
                      {p.estado_confirmacion && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">{p.estado_confirmacion}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Resumen para supervisores */}
          {isStrategic && isSupervisor && (
            <Card>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Resumen</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500 dark:text-gray-400">Actividades vinculadas</span>
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">{linkedActivities.length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500 dark:text-gray-400">Visitas vinculadas</span>
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">{linkedVisits.length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500 dark:text-gray-400">Actividades completadas</span>
                  <span className="text-sm font-semibold text-green-600 dark:text-green-400">
                    {linkedActivities.filter(a => a.estado === 'realizado').length}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500 dark:text-gray-400">Visitas completadas</span>
                  <span className="text-sm font-semibold text-green-600 dark:text-green-400">
                    {linkedVisits.filter(v => v.status === 'completada').length}
                  </span>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

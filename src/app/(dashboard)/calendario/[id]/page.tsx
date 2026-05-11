'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Calendar,
  Clock,
  MapPin,
  User,
  Phone,
  CheckCircle,
  XCircle,
  RefreshCw,
  Trash2,
  MessageSquare,
  Plus,
  Send,
  Target,
  Edit,
  Sparkles,
  Mic,
  MicOff,
  Loader2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import {
  getVisit,
  updateVisit,
  completeVisit,
  deleteVisit,
  createVisitFromReschedule,
  type Visit,
} from '@/lib/services/visits';
import { isDateBlocked } from '@/lib/services/blockedDays';
import { isUserOnVacation } from '@/lib/services/vacations';
import { getActivity, getStrategicObjectivesForSelection } from '@/lib/services/activities';
import type { Activity } from '@/types/database';
import {
  formatDateTime,
  formatDate,
  visitStatusLabels,
  isOverdue,
} from '@/lib/utils';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { useAuth } from '@/contexts/AuthContext';
import VoiceDictate from '@/components/ui/VoiceDictate';

const VISIT_OBJECTIVE_OPTIONS = [
  { key: 'VENTA', label: 'Venta', icon: '💰', activeBg: 'bg-emerald-50 dark:bg-emerald-900/30', activeText: 'text-emerald-700 dark:text-emerald-400', activeBorder: 'border-emerald-300 dark:border-emerald-500/50' },
  { key: 'COBRO', label: 'Cobro', icon: '🧾', activeBg: 'bg-blue-50 dark:bg-blue-900/30', activeText: 'text-blue-700 dark:text-blue-400', activeBorder: 'border-blue-300 dark:border-blue-500/50' },
  { key: 'SEGUIMIENTO', label: 'Seguimiento', icon: '🔄', activeBg: 'bg-amber-50 dark:bg-amber-900/30', activeText: 'text-amber-700 dark:text-amber-400', activeBorder: 'border-amber-300 dark:border-amber-500/50' },
  { key: 'PROSPECCION', label: 'Prospección', icon: '🔍', activeBg: 'bg-purple-50 dark:bg-purple-900/30', activeText: 'text-purple-700 dark:text-purple-400', activeBorder: 'border-purple-300 dark:border-purple-500/50' },
  { key: 'ENTREGA', label: 'Entrega', icon: '📦', activeBg: 'bg-indigo-50 dark:bg-indigo-900/30', activeText: 'text-indigo-700 dark:text-indigo-400', activeBorder: 'border-indigo-300 dark:border-indigo-500/50' },
  { key: 'RECLAMO', label: 'Reclamo', icon: '⚠️', activeBg: 'bg-red-50 dark:bg-red-900/30', activeText: 'text-red-700 dark:text-red-400', activeBorder: 'border-red-300 dark:border-red-500/50' },
];

function parseObjectiveTags(objetivo: string | null): string[] {
  if (!objetivo) return [];
  const matches = objetivo.match(/\[([A-Z]+)\]/g);
  return matches ? matches.map(m => m.replace(/[\[\]]/g, '')) : [];
}

export default function VisitaDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { userProfile } = useAuth();
  const [visit, setVisit] = useState<Visit | null>(null);
  const [linkedStrategicObj, setLinkedStrategicObj] = useState<Activity | null>(null);
  const [strategicObjectives, setStrategicObjectives] = useState<Pick<Activity, 'id' | 'titulo' | 'tipo' | 'fecha_inicio' | 'estado'>[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Edit form state
  const [editFormData, setEditFormData] = useState({
    scheduled_at: '',
    objetivo: '',
    location_text: '',
    objetivo_estrategico_id: '',
  });

  // Form states
  const [resultado, setResultado] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [nextAction, setNextAction] = useState('');
  const [nextVisitAt, setNextVisitAt] = useState('');
  const [newScheduledAt, setNewScheduledAt] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [newComment, setNewComment] = useState('');

  // AI completion states
  const [aiInput, setAiInput] = useState('');
  const [aiParsing, setAiParsing] = useState(false);
  const [aiFilled, setAiFilled] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [aiListening, setAiListening] = useState(false);

  // Objective result states (yes/no per objective tag)
  const [objResults, setObjResults] = useState<Record<string, boolean | null>>({});

  const parseWithAI = useCallback(async (text: string) => {
    if (!text.trim()) return;
    setAiParsing(true);
    try {
      const tags = parseObjectiveTags(visit?.objetivo || '');
      const res = await fetch('/api/parse-visit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          customerName: visit?.customer?.nombre || '',
          visitObjective: visit?.objetivo || '',
          objectiveTags: tags,
        }),
      });
      if (!res.ok) throw new Error('Error del servidor');
      const data = await res.json();
      if (data.resultado) setResultado(data.resultado);
      if (data.observaciones) setObservaciones(data.observaciones);
      if (data.nextAction) setNextAction(data.nextAction);
      if (data.nextVisitDate) setNextVisitAt(data.nextVisitDate);
      if (data.objectiveResults && typeof data.objectiveResults === 'object') {
        setObjResults(prev => {
          const updated = { ...prev };
          for (const [key, val] of Object.entries(data.objectiveResults)) {
            if (key in updated) updated[key] = val as boolean;
          }
          return updated;
        });
      }
      setAiFilled(true);
      setShowDetails(true);
      toast.success('Campos completados con IA');
    } catch {
      toast.error('Error al procesar con IA');
    } finally {
      setAiParsing(false);
    }
  }, [visit]);

  const visitId = params.id as string;

  useEffect(() => {
    loadVisit();
  }, [visitId]);

  const loadVisit = async () => {
    try {
      const [data, stratObjData] = await Promise.all([
        getVisit(visitId),
        getStrategicObjectivesForSelection().catch(() => []),
      ]);
      setVisit(data);
      setStrategicObjectives(stratObjData);

      if (data.objetivo_estrategico_id) {
        try {
          const obj = await getActivity(data.objetivo_estrategico_id);
          setLinkedStrategicObj(obj);
        } catch {
          setLinkedStrategicObj(null);
        }
      } else {
        setLinkedStrategicObj(null);
      }
      if (data.scheduled_at) {
        setNewScheduledAt(format(new Date(data.scheduled_at), "yyyy-MM-dd'T'HH:mm"));
      }
      // Pre-cargar datos para el formulario de edición
      setEditFormData({
        scheduled_at: data.scheduled_at ? format(new Date(data.scheduled_at), "yyyy-MM-dd'T'HH:mm") : '',
        objetivo: data.objetivo || '',
        location_text: data.location_text || '',
        objetivo_estrategico_id: data.objetivo_estrategico_id || '',
      });
      // Pre-cargar observaciones existentes para editarlas
      setNewComment(data.observaciones || '');
    } catch (error) {
      console.error('Error cargando visita:', error);
      toast.error('Error al cargar la visita');
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async () => {
    if (!resultado.trim()) {
      toast.error('El resultado es obligatorio');
      return;
    }

    setActionLoading(true);
    try {
      const nextVisitDate = nextVisitAt
        ? new Date(nextVisitAt).toISOString()
        : undefined;

      // Build full resultado including objective results
      let fullResultado = resultado;
      const objEntries = Object.entries(objResults).filter(([, v]) => v !== null);
      if (objEntries.length > 0) {
        const objSummary = objEntries.map(([tag, val]) => {
          const opt = VISIT_OBJECTIVE_OPTIONS.find(o => o.key === tag);
          return `${opt?.icon || ''} ${opt?.label || tag}: ${val ? 'Sí' : 'No'}`;
        }).join(' | ');
        fullResultado = `[${objSummary}] ${resultado}`;
      }

      await completeVisit(
        visitId,
        fullResultado,
        observaciones || undefined,
        nextAction || undefined,
        nextVisitDate
      );

      toast.success('Visita completada');
      if (nextVisitDate) {
        toast.success('Nueva visita programada automáticamente');
      }
      router.push('/calendario');
    } catch (error) {
      console.error('Error completando visita:', error);
      toast.error('Error al completar la visita');
    } finally {
      setActionLoading(false);
      setShowCompleteModal(false);
    }
  };

  const handleCancel = async () => {
    setActionLoading(true);
    try {
      await updateVisit(visitId, {
        status: 'cancelada',
        observaciones: cancelReason || 'Cancelada',
      });

      toast.success('Visita cancelada');
      router.push('/calendario');
    } catch (error) {
      console.error('Error cancelando visita:', error);
      toast.error('Error al cancelar la visita');
    } finally {
      setActionLoading(false);
      setShowCancelModal(false);
    }
  };

  const handleReschedule = async () => {
    if (!newScheduledAt) {
      toast.error('Selecciona una nueva fecha');
      return;
    }
    try {
      const blocked = await isDateBlocked(new Date(newScheduledAt));
      if (blocked) {
        toast.error('No se puede programar en un día no laborable. Elige otra fecha.');
        return;
      }
      const assigneeId = visit?.user_id || userProfile?.id;
      if (assigneeId) {
        const onVacation = await isUserOnVacation(assigneeId, new Date(newScheduledAt));
        if (onVacation) {
          toast.error('La persona asignada tiene vacaciones aprobadas ese día. No se puede programar.');
          return;
        }
      }
    } catch {
      // Si falla la consulta, permitir continuar
    }

    setActionLoading(true);
    try {
      if (!visit) throw new Error('Visita no encontrada');
      // Marcar primero como reprogramada para que no siga en Visitas Vencidas aunque falle el insert
      await updateVisit(visitId, { status: 'reprogramada' });
      const newVisit = await createVisitFromReschedule(visit, new Date(newScheduledAt).toISOString());

      toast.success('Visita reprogramada');
      router.push(`/calendario/${newVisit.id}`);
    } catch (error) {
      console.error('Error reprogramando:', error);
      toast.error('Error al reprogramar');
    } finally {
      setActionLoading(false);
      setShowRescheduleModal(false);
    }
  };

  const handleNoShow = async () => {
    setActionLoading(true);
    try {
      await updateVisit(visitId, {
        status: 'no_atendio',
        observaciones: 'Cliente no atendió',
      });

      toast.success('Estado actualizado');
      loadVisit();
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al actualizar');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    setActionLoading(true);
    try {
      await deleteVisit(visitId);
      toast.success('Visita eliminada');
      router.push('/calendario');
    } catch (error) {
      console.error('Error eliminando:', error);
      toast.error('Error al eliminar');
    } finally {
      setActionLoading(false);
      setShowDeleteModal(false);
    }
  };

  const handleSaveComment = async () => {
    setActionLoading(true);
    try {
      await updateVisit(visitId, {
        observaciones: newComment,
      });

      toast.success('Comentarios guardados');
      loadVisit();
      setShowCommentModal(false);
    } catch (error) {
      console.error('Error guardando comentario:', error);
      toast.error('Error al guardar comentarios');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editFormData.scheduled_at) {
      toast.error('La fecha y hora son obligatorias');
      return;
    }

    const scheduledDate = new Date(editFormData.scheduled_at);
    try {
      const blocked = await isDateBlocked(scheduledDate);
      if (blocked) {
        toast.error('No se puede programar en un día no laborable. Elige otra fecha.');
        return;
      }
      if (userProfile?.id) {
        const onVacation = await isUserOnVacation(userProfile.id, scheduledDate);
        if (onVacation) {
          toast.error('Tienes vacaciones aprobadas ese día. No se puede programar.');
          return;
        }
      }
    } catch {
      // Si falla la consulta, permitir continuar
    }

    setActionLoading(true);
    try {
      await updateVisit(visitId, {
        scheduled_at: new Date(editFormData.scheduled_at).toISOString(),
        objetivo: editFormData.objetivo || null,
        location_text: editFormData.location_text || null,
        objetivo_estrategico_id: editFormData.objetivo_estrategico_id || null,
      });

      toast.success('Visita actualizada');
      loadVisit();
      setShowEditModal(false);
    } catch (error) {
      console.error('Error actualizando visita:', error);
      toast.error('Error al actualizar la visita');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500 dark:text-gray-300">Cargando visita...</div>
      </div>
    );
  }

  if (!visit) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl text-gray-900 dark:text-white">Visita no encontrada</h2>
        <Link href="/calendario">
          <Button variant="secondary" className="mt-4">
            Volver al Calendario
          </Button>
        </Link>
      </div>
    );
  }

  const overdue = visit.status === 'programada' && isOverdue(visit.scheduled_at);

  return (
    <div className="max-w-3xl mx-auto space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <Link href="/calendario">
            <Button variant="ghost" size="sm" icon={<ArrowLeft className="h-4 w-4" />}>
              <span className="hidden sm:inline">Volver</span>
            </Button>
          </Link>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Detalle de Visita</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge
                variant={
                  visit.status === 'completada' ? 'green' :
                  visit.status === 'programada' ? 'blue' :
                  visit.status === 'cancelada' ? 'gray' : 'yellow'
                }
              >
                {visitStatusLabels[visit.status]}
              </Badge>
              {overdue && (
                <Badge variant="red">Vencida</Badge>
              )}
            </div>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          icon={<Trash2 className="h-4 w-4 text-red-500" />}
          onClick={() => setShowDeleteModal(true)}
        />
      </div>

      {/* Acciones Rápidas - Siempre visibles */}
      <Card className="bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800">
        <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Calendar className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          Acciones Rápidas
        </h2>
        <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 sm:gap-3">
          <Button 
            icon={<Edit className="h-4 w-4" />}
            onClick={() => setShowEditModal(true)}
            className="w-full sm:w-auto justify-center"
          >
            Editar Visita
          </Button>
          <Button 
            variant="secondary"
            icon={<MessageSquare className="h-4 w-4" />}
            onClick={() => setShowCommentModal(true)}
            className="w-full sm:w-auto justify-center"
          >
            {visit.observaciones ? 'Editar Comentarios' : 'Agregar Comentarios'}
          </Button>
          {visit.customer && (
            <Link href={`/clientes/${visit.customer.id}`} className="w-full sm:w-auto">
              <Button variant="secondary" icon={<User className="h-4 w-4" />} className="w-full justify-center">
                Ver Cliente
              </Button>
            </Link>
          )}
        </div>
      </Card>

      {/* Main Content */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        {/* Info */}
        <Card>
          <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-4">Información</h2>
          
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <Calendar className="h-5 w-5 text-indigo-500 dark:text-indigo-400 mt-0.5 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-gray-400 dark:text-gray-500">Fecha y Hora</p>
                <p className="text-gray-900 dark:text-white font-medium">
                  {formatDateTime(visit.scheduled_at)}
                </p>
              </div>
            </div>

            {visit.location_text && (
              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-indigo-500 dark:text-indigo-400 mt-0.5 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-gray-400 dark:text-gray-500">Ubicación</p>
                  <p className="text-gray-900 dark:text-white break-words">{visit.location_text}</p>
                </div>
              </div>
            )}

            {visit.objetivo && (
              <div className="pt-4 border-t border-gray-100 dark:border-dark-500">
                <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">Objetivo</p>
                {(() => {
                  const tags = parseObjectiveTags(visit.objetivo);
                  const freeText = visit.objetivo.replace(/\[[A-Z]+\]/g, '').trim();
                  return (
                    <div>
                      {tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-1.5">
                          {tags.map(tag => {
                            const opt = VISIT_OBJECTIVE_OPTIONS.find(o => o.key === tag);
                            return opt ? (
                              <span key={tag} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium ${opt.activeBg} ${opt.activeText} border ${opt.activeBorder}`}>
                                {opt.icon} {opt.label}
                              </span>
                            ) : null;
                          })}
                        </div>
                      )}
                      {freeText && <p className="text-gray-900 dark:text-white break-words">{freeText}</p>}
                    </div>
                  );
                })()}
              </div>
            )}

            {visit.resultado && (
              <div className="pt-4 border-t border-gray-100 dark:border-dark-500">
                <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">Resultado</p>
                <p className="text-gray-900 dark:text-white break-words">{visit.resultado}</p>
              </div>
            )}

            {visit.next_action && (
              <div className="pt-4 border-t border-gray-100 dark:border-dark-500">
                <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">Próxima Acción</p>
                <p className="text-gray-900 dark:text-white break-words">{visit.next_action}</p>
              </div>
            )}

            {linkedStrategicObj && (
              <div className="pt-4 border-t border-gray-100 dark:border-dark-500">
                <p className="text-xs text-gray-400 dark:text-gray-500 mb-1 flex items-center gap-1">
                  <Target className="h-3 w-3" />
                  Objetivo Estratégico Vinculado
                </p>
                <Link
                  href={`/actividades/${linkedStrategicObj.id}`}
                  className="text-indigo-600 dark:text-indigo-300 font-medium hover:text-indigo-700 dark:hover:text-indigo-200"
                >
                  {linkedStrategicObj.titulo}
                </Link>
                <p className="text-xs text-gray-500 dark:text-gray-300 mt-1">
                  {linkedStrategicObj.tipo === 'reunion' ? 'Reunión' : 
                   linkedStrategicObj.tipo === 'capacitacion' ? 'Capacitación' : 'Seguimiento'}
                </p>
              </div>
            )}
          </div>
        </Card>

        {/* Cliente */}
        <Card>
          <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-4">Cliente</h2>
          
          {visit.customer ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <User className="h-5 w-5 text-indigo-500 dark:text-indigo-400 mt-0.5 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-gray-400 dark:text-gray-500">Nombre</p>
                  <Link
                    href={`/clientes/${visit.customer.id}`}
                    className="text-gray-900 dark:text-white font-medium hover:text-indigo-600 dark:hover:text-indigo-300 break-words"
                  >
                    {visit.customer.nombre}
                  </Link>
                </div>
              </div>

              {visit.customer.telefono && (
                <div className="flex items-start gap-3">
                  <Phone className="h-5 w-5 text-indigo-500 dark:text-indigo-400 mt-0.5 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs text-gray-400 dark:text-gray-500">Teléfono</p>
                    <a
                      href={`tel:${visit.customer.telefono}`}
                      className="text-gray-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-300"
                    >
                      {visit.customer.telefono}
                    </a>
                  </div>
                </div>
              )}

              {visit.customer.direccion && (
                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-indigo-500 dark:text-indigo-400 mt-0.5 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs text-gray-400 dark:text-gray-500">Dirección</p>
                    <p className="text-gray-900 dark:text-white break-words">{visit.customer.direccion}</p>
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-gray-100 dark:border-dark-500">
                <Link href={`/clientes/${visit.customer.id}`}>
                  <Button variant="secondary" size="sm" className="w-full">
                    Ver Ficha del Cliente
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <p className="text-gray-500 dark:text-gray-300">Cliente no encontrado</p>
          )}
        </Card>
      </div>

      {/* Comentarios/Observaciones */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-gray-400 dark:text-gray-500" />
            Comentarios de la Visita
          </h2>
          <Button 
            variant="ghost" 
            size="sm" 
            icon={<Plus className="h-4 w-4" />}
            onClick={() => setShowCommentModal(true)}
          >
            {visit.observaciones ? 'Editar' : 'Agregar'}
          </Button>
        </div>
        {visit.observaciones ? (
          <div className="p-3 sm:p-4 rounded-lg bg-gray-50 dark:bg-dark-800">
            <p className="text-gray-700 dark:text-gray-200 whitespace-pre-wrap break-words">{visit.observaciones}</p>
          </div>
        ) : (
          <p className="text-gray-400 dark:text-gray-500 text-center py-4">
            No hay comentarios. Haz clic en "Agregar" para añadir notas sobre esta visita.
          </p>
        )}
      </Card>

      {/* Actions */}
      {visit.status === 'programada' && (
        <Card>
          <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-4">Cambiar Estado</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Button
              variant="success"
              onClick={() => {
                const tags = parseObjectiveTags(visit?.objetivo || '');
                const initial: Record<string, boolean | null> = {};
                tags.forEach(t => { initial[t] = null; });
                setObjResults(initial);
                setShowCompleteModal(true);
              }}
              icon={<CheckCircle className="h-4 w-4" />}
              className="w-full"
            >
              Completar
            </Button>
            <Button
              variant="secondary"
              onClick={() => setShowRescheduleModal(true)}
              icon={<RefreshCw className="h-4 w-4" />}
              className="w-full"
            >
              Reprogramar
            </Button>
            <Button
              variant="secondary"
              onClick={handleNoShow}
              icon={<Clock className="h-4 w-4" />}
              className="w-full"
              loading={actionLoading}
            >
              No Atendió
            </Button>
            <Button
              variant="danger"
              onClick={() => setShowCancelModal(true)}
              icon={<XCircle className="h-4 w-4" />}
              className="w-full"
            >
              Cancelar
            </Button>
          </div>
        </Card>
      )}

      {/* Modal para editar visita */}
      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Editar Visita"
        size="lg"
      >
        <div className="p-6 space-y-4">
          <Input
            label="Fecha y Hora *"
            type="datetime-local"
            value={editFormData.scheduled_at}
            onChange={(e) => setEditFormData({ ...editFormData, scheduled_at: e.target.value })}
            required
          />
          <div>
            <label className="block text-sm font-medium text-gray-600 dark:text-gray-200 mb-1.5">Objetivo de la Visita</label>
            <div className="flex flex-wrap gap-2 mb-3">
              {VISIT_OBJECTIVE_OPTIONS.map(opt => {
                const selected = editFormData.objetivo.includes(`[${opt.key}]`);
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => {
                      const tag = `[${opt.key}]`;
                      const current = editFormData.objetivo;
                      const newVal = selected
                        ? current.replace(tag, '').replace(/\s+/g, ' ').trim()
                        : (current ? current + ' ' + tag : tag);
                      setEditFormData({ ...editFormData, objetivo: newVal });
                    }}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                      selected
                        ? `${opt.activeBg} ${opt.activeText} ${opt.activeBorder} shadow-sm`
                        : 'bg-gray-50 dark:bg-dark-700 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-dark-500 hover:bg-gray-100 dark:hover:bg-dark-600'
                    }`}
                  >
                    <span>{opt.icon}</span>
                    {opt.label}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-gray-400 dark:text-gray-500">Detalles adicionales</span>
              <VoiceDictate size="sm" onTranscript={(t) => setEditFormData(prev => ({ ...prev, objetivo: (prev.objetivo ? prev.objetivo + ' ' : '') + t }))} />
            </div>
            <Textarea
              value={editFormData.objetivo}
              onChange={(e) => setEditFormData({ ...editFormData, objetivo: e.target.value })}
              placeholder="Selecciona los objetivos arriba y/o escribe detalles adicionales..."
              rows={2}
            />
          </div>
          <Input
            label="Ubicación / Dirección"
            value={editFormData.location_text}
            onChange={(e) => setEditFormData({ ...editFormData, location_text: e.target.value })}
            placeholder="Dirección o punto de referencia"
          />

          {/* Vincular a Objetivo Estratégico */}
          {strategicObjectives.length > 0 && (
            <div className="bg-indigo-50 dark:bg-indigo-900/30 border border-transparent dark:border-indigo-800 rounded-xl p-3 sm:p-4 space-y-3">
              <h4 className="text-sm font-semibold text-indigo-700 dark:text-indigo-200">
                Vincular a Objetivo Estratégico (opcional)
              </h4>
              <select
                value={editFormData.objetivo_estrategico_id}
                onChange={(e) => setEditFormData({ ...editFormData, objetivo_estrategico_id: e.target.value })}
                className="w-full px-4 py-2.5 border border-indigo-200 dark:border-indigo-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors bg-white dark:bg-dark-700 text-gray-900 dark:text-white"
              >
                <option value="" className="dark:bg-dark-700">Sin vincular</option>
                {strategicObjectives.map((obj) => (
                  <option key={obj.id} value={obj.id} className="dark:bg-dark-700">
                    {obj.titulo} ({obj.tipo === 'reunion' ? 'Reunión' : obj.tipo === 'capacitacion' ? 'Capacitación' : 'Seguimiento'})
                  </option>
                ))}
              </select>
              <p className="text-xs text-indigo-600 dark:text-indigo-300">
                Si vinculas esta visita a un objetivo estratégico, el supervisor podrá verla al consultar ese objetivo.
              </p>
            </div>
          )}

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-4 border-t border-gray-200 dark:border-dark-500">
            <Button variant="secondary" onClick={() => setShowEditModal(false)} className="w-full sm:w-auto">
              Cancelar
            </Button>
            <Button onClick={handleSaveEdit} loading={actionLoading} icon={<CheckCircle className="h-4 w-4" />} className="w-full sm:w-auto justify-center">
              Guardar Cambios
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal para agregar/editar comentarios */}
      <Modal
        isOpen={showCommentModal}
        onClose={() => setShowCommentModal(false)}
        title="Comentarios de la Visita"
        size="lg"
      >
        <div className="p-6 space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-200">Escribe tus comentarios u observaciones</label>
              <VoiceDictate size="sm" onTranscript={(t) => setNewComment(prev => prev ? prev + ' ' + t : t)} />
            </div>
            <Textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Anota lo que ocurrió en la visita, información importante del cliente, productos de interés, etc."
              rows={6}
            />
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500">
            Estos comentarios quedarán guardados en el historial de la visita.
          </p>
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-4 border-t border-gray-200 dark:border-dark-500">
            <Button variant="secondary" onClick={() => setShowCommentModal(false)} className="w-full sm:w-auto">
              Cancelar
            </Button>
            <Button onClick={handleSaveComment} loading={actionLoading} icon={<Send className="h-4 w-4" />} className="w-full sm:w-auto justify-center">
              Guardar Comentarios
            </Button>
          </div>
        </div>
      </Modal>

      {/* Completar Modal - AI Powered */}
      <Modal
        isOpen={showCompleteModal}
        onClose={() => { setShowCompleteModal(false); setAiFilled(false); setAiInput(''); setShowDetails(false); }}
        title="Completar Visita"
        size="lg"
      >
        <div className="p-6 space-y-4">
          {/* AI Input Zone */}
          <div className="rounded-xl border-2 border-dashed border-indigo-200 dark:border-indigo-500/30 bg-indigo-50/50 dark:bg-indigo-500/5 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-indigo-500" />
              <span className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">Describe qué pasó en la visita</span>
            </div>
            <p className="text-xs text-indigo-500/70 dark:text-indigo-400/60 mb-3">
              Dicta o escribe libremente. La IA llenará los campos automáticamente.
            </p>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <textarea
                  value={aiInput}
                  onChange={(e) => setAiInput(e.target.value)}
                  placeholder='Ej: "Hablé con el gerente, le interesó el catálogo nuevo, quedamos en reunirnos la próxima semana para cerrar el pedido..."'
                  rows={3}
                  className="w-full px-3 py-2.5 rounded-xl border border-indigo-200 dark:border-indigo-500/30 bg-white dark:bg-dark-600 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                  onKeyDown={(e) => { if (e.key === 'Enter' && e.ctrlKey && aiInput.trim()) parseWithAI(aiInput); }}
                />
              </div>
              <div className="flex flex-col gap-2">
                <AiVoiceButton
                  listening={aiListening}
                  onToggle={(listening, transcript) => {
                    setAiListening(listening);
                    if (transcript) setAiInput(prev => prev ? prev + ' ' + transcript : transcript);
                  }}
                />
                <button
                  type="button"
                  onClick={() => parseWithAI(aiInput)}
                  disabled={!aiInput.trim() || aiParsing}
                  className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  title="Procesar con IA (Ctrl+Enter)"
                >
                  {aiParsing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                </button>
              </div>
            </div>
          </div>

          {/* Objective Results - Yes/No per tag */}
          {Object.keys(objResults).length > 0 && (
            <div className="rounded-xl border border-gray-200 dark:border-dark-500 bg-gray-50 dark:bg-dark-700 p-4">
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">Resultado por objetivo</p>
              <div className="space-y-3">
                {Object.keys(objResults).map(tag => {
                  const opt = VISIT_OBJECTIVE_OPTIONS.find(o => o.key === tag);
                  if (!opt) return null;
                  const val = objResults[tag];
                  return (
                    <div key={tag} className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="text-base">{opt.icon}</span>
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                          {tag === 'VENTA' ? '¿Se vendió?' :
                           tag === 'COBRO' ? '¿Se cobró?' :
                           tag === 'SEGUIMIENTO' ? '¿Se dio seguimiento?' :
                           tag === 'PROSPECCION' ? '¿Se prospectó?' :
                           tag === 'ENTREGA' ? '¿Se entregó?' :
                           tag === 'RECLAMO' ? '¿Se resolvió el reclamo?' :
                           `¿Se completó ${opt.label}?`}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setObjResults(prev => ({ ...prev, [tag]: true }))}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                            val === true
                              ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-500/50 shadow-sm'
                              : 'bg-white dark:bg-dark-600 text-gray-400 dark:text-gray-500 border-gray-200 dark:border-dark-500 hover:border-emerald-300 dark:hover:border-emerald-500/40'
                          }`}
                        >
                          ✓ Sí
                        </button>
                        <button
                          type="button"
                          onClick={() => setObjResults(prev => ({ ...prev, [tag]: false }))}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                            val === false
                              ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 border-red-300 dark:border-red-500/50 shadow-sm'
                              : 'bg-white dark:bg-dark-600 text-gray-400 dark:text-gray-500 border-gray-200 dark:border-dark-500 hover:border-red-300 dark:hover:border-red-500/40'
                          }`}
                        >
                          ✗ No
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Divider */}
          {aiFilled && (
            <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400">
              <CheckCircle className="w-3.5 h-3.5" />
              <span className="font-medium">Campos completados por IA — revisa y ajusta si es necesario</span>
              <button type="button" onClick={() => setShowDetails(!showDetails)} className="ml-auto flex items-center gap-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                {showDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                <span>{showDetails ? 'Ocultar' : 'Ver'} campos</span>
              </button>
            </div>
          )}

          {/* Editable Fields - always visible if not AI filled, collapsible if AI filled */}
          {(!aiFilled || showDetails) && (
            <div className="space-y-3">
              <Textarea
                label="Resultado de la Visita *"
                value={resultado}
                onChange={(e) => setResultado(e.target.value)}
                placeholder="Describe el resultado de la visita..."
                rows={2}
              />
              <Textarea
                label="Observaciones adicionales"
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                placeholder="Observaciones adicionales..."
                rows={2}
              />
              <Input
                label="Próxima Acción"
                value={nextAction}
                onChange={(e) => setNextAction(e.target.value)}
                placeholder="¿Qué hacer después?"
              />
              <Input
                label="Programar Siguiente Visita"
                type="datetime-local"
                value={nextVisitAt}
                onChange={(e) => setNextVisitAt(e.target.value)}
              />
              <p className="text-xs text-gray-400 dark:text-gray-500">
                Si programas una siguiente visita, se creará automáticamente al completar.
              </p>
            </div>
          )}

          {/* Summary chips when collapsed */}
          {aiFilled && !showDetails && (
            <div className="space-y-2">
              {resultado && (
                <div className="px-3 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20">
                  <p className="text-[10px] uppercase font-semibold text-emerald-500 mb-0.5">Resultado</p>
                  <p className="text-sm text-gray-800 dark:text-gray-200">{resultado}</p>
                </div>
              )}
              {observaciones && (
                <div className="px-3 py-2 rounded-lg bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20">
                  <p className="text-[10px] uppercase font-semibold text-blue-500 mb-0.5">Observaciones</p>
                  <p className="text-sm text-gray-800 dark:text-gray-200">{observaciones}</p>
                </div>
              )}
              {nextAction && (
                <div className="px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20">
                  <p className="text-[10px] uppercase font-semibold text-amber-500 mb-0.5">Próxima acción</p>
                  <p className="text-sm text-gray-800 dark:text-gray-200">{nextAction}</p>
                </div>
              )}
              {nextVisitAt && (
                <div className="px-3 py-2 rounded-lg bg-purple-50 dark:bg-purple-500/10 border border-purple-200 dark:border-purple-500/20">
                  <p className="text-[10px] uppercase font-semibold text-purple-500 mb-0.5">Siguiente visita</p>
                  <p className="text-sm text-gray-800 dark:text-gray-200">{new Date(nextVisitAt).toLocaleString('es-EC', { dateStyle: 'long', timeStyle: 'short' })}</p>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-dark-500">
            <Button variant="secondary" onClick={() => { setShowCompleteModal(false); setAiFilled(false); setAiInput(''); setShowDetails(false); }}>
              Cancelar
            </Button>
            <Button variant="success" onClick={handleComplete} loading={actionLoading} disabled={!resultado.trim()}>
              Completar Visita
            </Button>
          </div>
        </div>
      </Modal>

      {/* Reprogramar Modal */}
      <Modal
        isOpen={showRescheduleModal}
        onClose={() => setShowRescheduleModal(false)}
        title="Reprogramar Visita"
        size="sm"
      >
        <div className="p-6 space-y-4">
          <Input
            label="Nueva Fecha y Hora"
            type="datetime-local"
            value={newScheduledAt}
            onChange={(e) => setNewScheduledAt(e.target.value)}
          />
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-4 border-t border-gray-200 dark:border-dark-500">
            <Button variant="secondary" onClick={() => setShowRescheduleModal(false)} className="w-full sm:w-auto">
              Cancelar
            </Button>
            <Button onClick={handleReschedule} loading={actionLoading} className="w-full sm:w-auto">
              Reprogramar
            </Button>
          </div>
        </div>
      </Modal>

      {/* Cancelar Modal */}
      <Modal
        isOpen={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        title="Cancelar Visita"
        size="sm"
      >
        <div className="p-6 space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-200">Motivo de Cancelación</label>
              <VoiceDictate size="sm" onTranscript={(t) => setCancelReason(prev => prev ? prev + ' ' + t : t)} />
            </div>
            <Textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="¿Por qué se cancela la visita?"
              rows={3}
            />
          </div>
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-4 border-t border-gray-200 dark:border-dark-500">
            <Button variant="secondary" onClick={() => setShowCancelModal(false)} className="w-full sm:w-auto">
              Volver
            </Button>
            <Button variant="danger" onClick={handleCancel} loading={actionLoading} className="w-full sm:w-auto">
              Confirmar Cancelación
            </Button>
          </div>
        </div>
      </Modal>

      {/* Eliminar Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Eliminar Visita"
        size="sm"
      >
        <div className="p-4 sm:p-6">
          <p className="text-gray-500 dark:text-gray-300 mb-6">
            ¿Estás segura de eliminar esta visita? Esta acción no se puede deshacer.
          </p>
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
            <Button variant="secondary" onClick={() => setShowDeleteModal(false)} className="w-full sm:w-auto">
              Cancelar
            </Button>
            <Button variant="danger" onClick={handleDelete} loading={actionLoading} className="w-full sm:w-auto">
              Eliminar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function AiVoiceButton({ listening, onToggle }: { listening: boolean; onToggle: (listening: boolean, transcript?: string) => void }) {
  const [supported, setSupported] = useState(false);
  const recRef = useRef<any>(null);

  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setSupported(!!SR);
    return () => { recRef.current?.abort(); };
  }, []);

  const toggle = () => {
    if (listening) {
      recRef.current?.stop();
      onToggle(false);
      return;
    }
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.lang = 'es-EC';
    rec.continuous = true;
    rec.interimResults = false;
    rec.onresult = (e: any) => {
      let t = '';
      for (let i = e.resultIndex; i < e.results.length; i++) t += e.results[i][0].transcript;
      if (t) onToggle(true, t);
    };
    rec.onend = () => onToggle(false);
    rec.onerror = () => onToggle(false);
    recRef.current = rec;
    rec.start();
    onToggle(true);
  };

  if (!supported) return null;

  return (
    <button type="button" onClick={toggle} title={listening ? 'Detener' : 'Dictar por voz'}
      className={`p-2.5 rounded-xl transition-all relative ${listening
        ? 'bg-red-500 text-white animate-pulse ring-2 ring-red-300 dark:ring-red-500/40'
        : 'bg-gray-100 dark:bg-dark-500 text-gray-500 dark:text-gray-400 hover:bg-indigo-100 dark:hover:bg-indigo-500/15 hover:text-indigo-600 dark:hover:text-indigo-400'
      }`}>
      {listening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
      {listening && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-red-400 animate-ping" />}
    </button>
  );
}

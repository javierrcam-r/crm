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

      await completeVisit(
        visitId,
        resultado,
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
        <div className="text-gray-500">Cargando visita...</div>
      </div>
    );
  }

  if (!visit) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl text-gray-900">Visita no encontrada</h2>
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
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/calendario">
            <Button variant="ghost" size="sm" icon={<ArrowLeft className="h-4 w-4" />}>
              Volver
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Detalle de Visita</h1>
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
      <Card className="bg-indigo-50 border-indigo-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Calendar className="h-5 w-5 text-indigo-600" />
          Acciones Rápidas
        </h2>
        <div className="flex flex-wrap gap-3">
          <Button 
            icon={<Edit className="h-4 w-4" />}
            onClick={() => setShowEditModal(true)}
          >
            Editar Visita
          </Button>
          <Button 
            variant="secondary"
            icon={<MessageSquare className="h-4 w-4" />}
            onClick={() => setShowCommentModal(true)}
          >
            {visit.observaciones ? 'Editar Comentarios' : 'Agregar Comentarios'}
          </Button>
          {visit.customer && (
            <Link href={`/clientes/${visit.customer.id}`}>
              <Button variant="secondary" icon={<User className="h-4 w-4" />}>
                Ver Cliente
              </Button>
            </Link>
          )}
        </div>
      </Card>

      {/* Main Content */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Info */}
        <Card>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Información</h2>
          
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <Calendar className="h-5 w-5 text-indigo-500 mt-0.5" />
              <div>
                <p className="text-xs text-gray-400">Fecha y Hora</p>
                <p className="text-gray-900 font-medium">
                  {formatDateTime(visit.scheduled_at)}
                </p>
              </div>
            </div>

            {visit.location_text && (
              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-indigo-500 mt-0.5" />
                <div>
                  <p className="text-xs text-gray-400">Ubicación</p>
                  <p className="text-gray-900">{visit.location_text}</p>
                </div>
              </div>
            )}

            {visit.objetivo && (
              <div className="pt-4 border-t border-gray-100">
                <p className="text-xs text-gray-400 mb-1">Objetivo</p>
                <p className="text-gray-900">{visit.objetivo}</p>
              </div>
            )}

            {visit.resultado && (
              <div className="pt-4 border-t border-gray-100">
                <p className="text-xs text-gray-400 mb-1">Resultado</p>
                <p className="text-gray-900">{visit.resultado}</p>
              </div>
            )}

            {visit.next_action && (
              <div className="pt-4 border-t border-gray-100">
                <p className="text-xs text-gray-400 mb-1">Próxima Acción</p>
                <p className="text-gray-900">{visit.next_action}</p>
              </div>
            )}

            {linkedStrategicObj && (
              <div className="pt-4 border-t border-gray-100">
                <p className="text-xs text-gray-400 mb-1 flex items-center gap-1">
                  <Target className="h-3 w-3" />
                  Objetivo Estratégico Vinculado
                </p>
                <Link
                  href={`/actividades/${linkedStrategicObj.id}`}
                  className="text-indigo-600 font-medium hover:text-indigo-700"
                >
                  {linkedStrategicObj.titulo}
                </Link>
                <p className="text-xs text-gray-500 mt-1">
                  {linkedStrategicObj.tipo === 'reunion' ? 'Reunión' : 
                   linkedStrategicObj.tipo === 'capacitacion' ? 'Capacitación' : 'Seguimiento'}
                </p>
              </div>
            )}
          </div>
        </Card>

        {/* Cliente */}
        <Card>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Cliente</h2>
          
          {visit.customer ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <User className="h-5 w-5 text-indigo-500 mt-0.5" />
                <div>
                  <p className="text-xs text-gray-400">Nombre</p>
                  <Link
                    href={`/clientes/${visit.customer.id}`}
                    className="text-gray-900 font-medium hover:text-indigo-600"
                  >
                    {visit.customer.nombre}
                  </Link>
                </div>
              </div>

              {visit.customer.telefono && (
                <div className="flex items-start gap-3">
                  <Phone className="h-5 w-5 text-indigo-500 mt-0.5" />
                  <div>
                    <p className="text-xs text-gray-400">Teléfono</p>
                    <a
                      href={`tel:${visit.customer.telefono}`}
                      className="text-gray-900 hover:text-indigo-600"
                    >
                      {visit.customer.telefono}
                    </a>
                  </div>
                </div>
              )}

              {visit.customer.direccion && (
                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-indigo-500 mt-0.5" />
                  <div>
                    <p className="text-xs text-gray-400">Dirección</p>
                    <p className="text-gray-900">{visit.customer.direccion}</p>
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-gray-100">
                <Link href={`/clientes/${visit.customer.id}`}>
                  <Button variant="secondary" size="sm" className="w-full">
                    Ver Ficha del Cliente
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <p className="text-gray-500">Cliente no encontrado</p>
          )}
        </Card>
      </div>

      {/* Comentarios/Observaciones */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-gray-400" />
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
          <div className="p-4 rounded-lg bg-gray-50">
            <p className="text-gray-700 whitespace-pre-wrap">{visit.observaciones}</p>
          </div>
        ) : (
          <p className="text-gray-400 text-center py-4">
            No hay comentarios. Haz clic en "Agregar" para añadir notas sobre esta visita.
          </p>
        )}
      </Card>

      {/* Actions */}
      {visit.status === 'programada' && (
        <Card>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Cambiar Estado</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Button
              variant="success"
              onClick={() => setShowCompleteModal(true)}
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
          <Textarea
            label="Objetivo de la Visita"
            value={editFormData.objetivo}
            onChange={(e) => setEditFormData({ ...editFormData, objetivo: e.target.value })}
            placeholder="¿Cuál es el propósito de esta visita?"
            rows={3}
          />
          <Input
            label="Ubicación / Dirección"
            value={editFormData.location_text}
            onChange={(e) => setEditFormData({ ...editFormData, location_text: e.target.value })}
            placeholder="Dirección o punto de referencia"
          />

          {/* Vincular a Objetivo Estratégico */}
          {strategicObjectives.length > 0 && (
            <div className="bg-indigo-50 rounded-xl p-4 space-y-3">
              <h4 className="text-sm font-semibold text-indigo-700">
                Vincular a Objetivo Estratégico (opcional)
              </h4>
              <select
                value={editFormData.objetivo_estrategico_id}
                onChange={(e) => setEditFormData({ ...editFormData, objetivo_estrategico_id: e.target.value })}
                className="w-full px-4 py-2.5 border border-indigo-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors bg-white"
              >
                <option value="">Sin vincular</option>
                {strategicObjectives.map((obj) => (
                  <option key={obj.id} value={obj.id}>
                    {obj.titulo} ({obj.tipo === 'reunion' ? 'Reunión' : obj.tipo === 'capacitacion' ? 'Capacitación' : 'Seguimiento'})
                  </option>
                ))}
              </select>
              <p className="text-xs text-indigo-600">
                Si vinculas esta visita a un objetivo estratégico, el supervisor podrá verla al consultar ese objetivo.
              </p>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <Button variant="secondary" onClick={() => setShowEditModal(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveEdit} loading={actionLoading} icon={<CheckCircle className="h-4 w-4" />}>
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
          <Textarea
            label="Escribe tus comentarios u observaciones"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Anota lo que ocurrió en la visita, información importante del cliente, productos de interés, etc."
            rows={6}
          />
          <p className="text-xs text-gray-400">
            Estos comentarios quedarán guardados en el historial de la visita.
          </p>
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <Button variant="secondary" onClick={() => setShowCommentModal(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveComment} loading={actionLoading} icon={<Send className="h-4 w-4" />}>
              Guardar Comentarios
            </Button>
          </div>
        </div>
      </Modal>

      {/* Completar Modal */}
      <Modal
        isOpen={showCompleteModal}
        onClose={() => setShowCompleteModal(false)}
        title="Completar Visita"
        size="lg"
      >
        <div className="p-6 space-y-4">
          <Textarea
            label="Resultado de la Visita *"
            value={resultado}
            onChange={(e) => setResultado(e.target.value)}
            placeholder="Describe el resultado de la visita..."
            rows={3}
          />
          <Textarea
            label="Observaciones adicionales"
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            placeholder="Observaciones adicionales..."
            rows={3}
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
          <p className="text-xs text-gray-400">
            Si programas una siguiente visita, se creará automáticamente al completar.
          </p>
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <Button variant="secondary" onClick={() => setShowCompleteModal(false)}>
              Cancelar
            </Button>
            <Button variant="success" onClick={handleComplete} loading={actionLoading}>
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
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <Button variant="secondary" onClick={() => setShowRescheduleModal(false)}>
              Cancelar
            </Button>
            <Button onClick={handleReschedule} loading={actionLoading}>
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
          <Textarea
            label="Motivo de Cancelación"
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="¿Por qué se cancela la visita?"
            rows={3}
          />
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <Button variant="secondary" onClick={() => setShowCancelModal(false)}>
              Volver
            </Button>
            <Button variant="danger" onClick={handleCancel} loading={actionLoading}>
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
        <div className="p-6">
          <p className="text-gray-500 mb-6">
            ¿Estás segura de eliminar esta visita? Esta acción no se puede deshacer.
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={handleDelete} loading={actionLoading}>
              Eliminar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Palmtree,
  Plus,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  Calendar,
  Edit,
  Trash2,
} from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import Badge from '@/components/ui/Badge';
import { useAuth } from '@/contexts/AuthContext';
import {
  getMyVacationRequests,
  getPendingVacationRequests,
  getTeamVacationRequests,
  createVacationRequest,
  updateVacationRequest,
  approveVacationRequest,
  rejectVacationRequest,
  deleteVacationRequest,
} from '@/lib/services/vacations';
import { getAllUsersForSelection } from '@/lib/services/activities';
import type { VacationRequest } from '@/types/database';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import toast from 'react-hot-toast';

const estadoLabels: Record<string, string> = {
  pendiente: 'Pendiente',
  aprobado: 'Aprobado',
  rechazado: 'Rechazado',
};

const estadoColors: Record<string, 'yellow' | 'green' | 'gray'> = {
  pendiente: 'yellow',
  aprobado: 'green',
  rechazado: 'gray',
};

export default function VacacionesPage() {
  const { userProfile } = useAuth();
  const [myRequests, setMyRequests] = useState<VacationRequest[]>([]);
  const [pendingRequests, setPendingRequests] = useState<VacationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState<VacationRequest | null>(null);
  const [rejectMotivo, setRejectMotivo] = useState('');
  const [saving, setSaving] = useState(false);
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [motivo, setMotivo] = useState('');
  const [usersMap, setUsersMap] = useState<Record<string, string>>({});
  const [teamRequests, setTeamRequests] = useState<VacationRequest[]>([]);
  const [showEditModal, setShowEditModal] = useState<VacationRequest | null>(null);
  const [editFechaInicio, setEditFechaInicio] = useState('');
  const [editFechaFin, setEditFechaFin] = useState('');
  const [editMotivo, setEditMotivo] = useState('');

  const isSupervisor =
    userProfile?.rol === 'admin' ||
    userProfile?.rol === 'supervisor' ||
    userProfile?.rol === 'supervisor_nivel1' ||
    userProfile?.rol === 'supervisor_vendedor';

  useEffect(() => {
    loadData();
  }, [isSupervisor]);

  const loadData = async () => {
    try {
      const [mine, pending, usersList, team] = await Promise.all([
        getMyVacationRequests(),
        isSupervisor ? getPendingVacationRequests() : Promise.resolve([]),
        isSupervisor ? getAllUsersForSelection() : Promise.resolve([]),
        isSupervisor ? getTeamVacationRequests() : Promise.resolve([]),
      ]);
      setMyRequests(mine);
      setPendingRequests(pending);
      setTeamRequests(team);
      const map: Record<string, string> = {};
      usersList.forEach((u: { id: string; nombre_completo?: string }) => { map[u.id] = u.nombre_completo || ''; });
      setUsersMap(map);
    } catch (e: unknown) {
      console.error(e);
      const msg = e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : 'Error al cargar vacaciones';
      if (msg.includes('relation') || msg.includes('does not exist') || msg.includes('42P01')) {
        toast.error('Falta aplicar la migración de vacaciones (031). Ejecuta: supabase db push');
      } else {
        toast.error(msg || 'Error al cargar vacaciones');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile?.id || !fechaInicio || !fechaFin) {
      toast.error('Completa las fechas');
      return;
    }
    if (new Date(fechaFin) < new Date(fechaInicio)) {
      toast.error('La fecha fin debe ser igual o posterior a la fecha inicio');
      return;
    }
    setSaving(true);
    try {
      await createVacationRequest({
        user_profile_id: userProfile.id,
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin,
        motivo: motivo.trim() || null,
      });
      toast.success('Solicitud enviada. Espera la aprobación del supervisor.');
      setFechaInicio('');
      setFechaFin('');
      setMotivo('');
      setShowModal(false);
      loadData();
    } catch (err: unknown) {
      console.error(err);
      const msg = err && typeof err === 'object' && 'message' in err ? String((err as { message: string }).message) : 'Error al solicitar vacaciones';
      if (msg.includes('relation') || msg.includes('does not exist') || msg.includes('42P01')) {
        toast.error('Falta aplicar la migración de vacaciones. Ejecuta: supabase db push');
      } else {
        toast.error(msg || 'Error al solicitar vacaciones');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async (req: VacationRequest) => {
    if (!userProfile?.id) return;
    setSaving(true);
    try {
      await approveVacationRequest(req.id, userProfile.id);
      toast.success('Vacaciones aprobadas');
      loadData();
    } catch (err) {
      console.error(err);
      toast.error('Error al aprobar');
    } finally {
      setSaving(false);
    }
  };

  const handleReject = async () => {
    if (!showRejectModal || !userProfile?.id) return;
    setSaving(true);
    try {
      await rejectVacationRequest(showRejectModal.id, userProfile.id, rejectMotivo.trim() || undefined);
      toast.success('Solicitud rechazada');
      setShowRejectModal(null);
      setRejectMotivo('');
      loadData();
    } catch (err) {
      console.error(err);
      toast.error('Error al rechazar');
    } finally {
      setSaving(false);
    }
  };

  const canEditOrDelete = (req: VacationRequest) =>
    req.user_profile_id === userProfile?.id || isSupervisor;

  const openEditModal = (req: VacationRequest) => {
    setShowEditModal(req);
    setEditFechaInicio(req.fecha_inicio);
    setEditFechaFin(req.fecha_fin);
    setEditMotivo(req.motivo || '');
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showEditModal || !editFechaInicio || !editFechaFin) {
      toast.error('Completa las fechas');
      return;
    }
    if (new Date(editFechaFin) < new Date(editFechaInicio)) {
      toast.error('La fecha fin debe ser igual o posterior a la fecha inicio');
      return;
    }
    setSaving(true);
    try {
      await updateVacationRequest(showEditModal.id, {
        fecha_inicio: editFechaInicio,
        fecha_fin: editFechaFin,
        motivo: editMotivo.trim() || null,
      });
      toast.success('Solicitud actualizada. Vuelve a estado pendiente para revisión.');
      setShowEditModal(null);
      loadData();
    } catch (err) {
      console.error(err);
      toast.error('Error al actualizar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (req: VacationRequest) => {
    if (!canEditOrDelete(req)) return;
    if (!confirm('¿Eliminar esta solicitud de vacaciones?')) return;
    setSaving(true);
    try {
      await deleteVacationRequest(req.id);
      toast.success('Solicitud eliminada');
      loadData();
    } catch (err) {
      console.error(err);
      toast.error('Error al eliminar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="sm" icon={<ArrowLeft className="h-4 w-4" />}>
              Volver
            </Button>
          </Link>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Palmtree className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
              Vacaciones
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              Solicita tus vacaciones y consulta su estado
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {isSupervisor && (
            <>
              <Link href="/vacaciones/historial">
                <Button variant="secondary" size="sm" icon={<Clock className="h-4 w-4" />}>
                  Historial
                </Button>
              </Link>
              <Link href="/vacaciones/calendario">
                <Button variant="secondary" size="sm" icon={<Calendar className="h-4 w-4" />}>
                  Calendario
                </Button>
              </Link>
            </>
          )}
          <Button
            variant="primary"
            size="sm"
            icon={<Plus className="h-4 w-4" />}
            onClick={() => setShowModal(true)}
          >
            Solicitar vacaciones
          </Button>
        </div>
      </div>

      {/* Pendientes de aprobar - Solo supervisores */}
      {isSupervisor && pendingRequests.length > 0 && (
        <Card>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Clock className="h-5 w-5 text-amber-500" />
            Solicitudes pendientes de aprobar
          </h2>
          <div className="space-y-3">
            {pendingRequests.map((req) => (
              <div
                key={req.id}
                className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800"
              >
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {usersMap[req.user_profile_id] || 'Usuario'}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {format(new Date(req.fecha_inicio + 'T12:00:00'), "d MMM", { locale: es })} –{' '}
                    {format(new Date(req.fecha_fin + 'T12:00:00'), "d MMM yyyy", { locale: es })}
                    {req.motivo && ` · ${req.motivo}`}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="primary"
                    icon={<CheckCircle className="h-4 w-4" />}
                    onClick={() => handleApprove(req)}
                    disabled={saving}
                  >
                    Aprobar
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={<XCircle className="h-4 w-4" />}
                    onClick={() => setShowRejectModal(req)}
                    disabled={saving}
                  >
                    Rechazar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Mis solicitudes */}
      <Card>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Mis solicitudes</h2>
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
          </div>
        ) : myRequests.length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <Palmtree className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No tienes solicitudes de vacaciones.</p>
            <p className="text-sm mt-1">Usa &quot;Solicitar vacaciones&quot; para agregar una.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {myRequests.map((req) => (
              <div
                key={req.id}
                className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-lg bg-gray-50 dark:bg-dark-600 border border-gray-200 dark:border-dark-500"
              >
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-gray-900 dark:text-white">
                      {format(new Date(req.fecha_inicio + 'T12:00:00'), "d MMM", { locale: es })} –{' '}
                      {format(new Date(req.fecha_fin + 'T12:00:00'), "d MMM yyyy", { locale: es })}
                    </span>
                    <Badge variant={estadoColors[req.estado] as 'yellow' | 'green' | 'gray'}>
                      {estadoLabels[req.estado]}
                    </Badge>
                    {req.estado === 'rechazado' && req.rechazo_motivo && (
                      <span className="text-sm text-red-600 dark:text-red-400">· {req.rechazo_motivo}</span>
                    )}
                  </div>
                  {req.motivo && (
                    <p className="text-sm text-gray-500 dark:text-gray-400">{req.motivo}</p>
                  )}
                  {req.estado !== 'pendiente' && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                      {req.estado === 'aprobado' ? 'Aprobado' : 'Rechazado'}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  {canEditOrDelete(req) && (
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={<Edit className="h-4 w-4" />}
                        onClick={() => openEditModal(req)}
                        disabled={saving}
                        title="Editar (vuelve a pendiente)"
                      >
                        Editar
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={<Trash2 className="h-4 w-4" />}
                        className="text-red-600 hover:text-red-700"
                        onClick={() => handleDelete(req)}
                        disabled={saving}
                      >
                        Eliminar
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Solicitudes del equipo - Solo supervisores */}
      {isSupervisor && (
        <Card>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Solicitudes del equipo</h2>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
            </div>
          ) : teamRequests.length === 0 ? (
            <p className="text-center py-8 text-gray-500 dark:text-gray-400 text-sm">No hay solicitudes.</p>
          ) : (
            <div className="space-y-3">
              {teamRequests.map((req) => (
                <div
                  key={req.id}
                  className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-lg bg-gray-50 dark:bg-dark-600 border border-gray-200 dark:border-dark-500"
                >
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-gray-900 dark:text-white">
                        {usersMap[req.user_profile_id] || 'Usuario'}
                      </span>
                      <Badge variant={estadoColors[req.estado] as 'yellow' | 'green' | 'gray'}>
                        {estadoLabels[req.estado]}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {format(new Date(req.fecha_inicio + 'T12:00:00'), "d MMM", { locale: es })} –{' '}
                      {format(new Date(req.fecha_fin + 'T12:00:00'), "d MMM yyyy", { locale: es })}
                      {req.motivo && ` · ${req.motivo}`}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={<Edit className="h-4 w-4" />}
                      onClick={() => openEditModal(req)}
                      disabled={saving}
                    >
                      Editar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={<Trash2 className="h-4 w-4" />}
                      className="text-red-600 hover:text-red-700"
                      onClick={() => handleDelete(req)}
                      disabled={saving}
                    >
                      Eliminar
                    </Button>
                    {req.estado === 'pendiente' && (
                      <>
                        <Button
                          size="sm"
                          variant="primary"
                          icon={<CheckCircle className="h-4 w-4" />}
                          onClick={() => handleApprove(req)}
                          disabled={saving}
                        >
                          Aprobar
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          icon={<XCircle className="h-4 w-4" />}
                          onClick={() => setShowRejectModal(req)}
                          disabled={saving}
                        >
                          Rechazar
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Modal solicitar */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Solicitar vacaciones">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Fecha inicio"
            type="date"
            value={fechaInicio}
            onChange={(e) => setFechaInicio(e.target.value)}
            required
          />
          <Input
            label="Fecha fin"
            type="date"
            value={fechaFin}
            onChange={(e) => setFechaFin(e.target.value)}
            required
          />
          <Input
            label="Motivo (opcional)"
            placeholder="Ej. Vacaciones familiares"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setShowModal(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Enviar solicitud'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal rechazar */}
      <Modal
        isOpen={!!showRejectModal}
        onClose={() => { setShowRejectModal(null); setRejectMotivo(''); }}
        title="Rechazar solicitud"
      >
        <div className="space-y-4">
          {showRejectModal && (
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {usersMap[showRejectModal.user_profile_id] || 'Usuario'} –{' '}
              {format(new Date(showRejectModal.fecha_inicio + 'T12:00:00'), "d MMM", { locale: es })} -{' '}
              {format(new Date(showRejectModal.fecha_fin + 'T12:00:00'), "d MMM yyyy", { locale: es })}
            </p>
          )}
          <Input
            label="Motivo del rechazo (opcional)"
            placeholder="Indica el motivo al colaborador"
            value={rejectMotivo}
            onChange={(e) => setRejectMotivo(e.target.value)}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => { setShowRejectModal(null); setRejectMotivo(''); }}>
              Cancelar
            </Button>
            <Button variant="primary" className="bg-red-600 hover:bg-red-700" onClick={handleReject} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Rechazar'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal editar */}
      <Modal
        isOpen={!!showEditModal}
        onClose={() => setShowEditModal(null)}
        title="Editar solicitud"
      >
        <form onSubmit={handleEditSubmit} className="space-y-4">
          <p className="text-sm text-amber-600 dark:text-amber-400">
            Al guardar, la solicitud vuelve a estado pendiente para nueva revisión.
          </p>
          <Input
            label="Fecha inicio"
            type="date"
            value={editFechaInicio}
            onChange={(e) => setEditFechaInicio(e.target.value)}
            required
          />
          <Input
            label="Fecha fin"
            type="date"
            value={editFechaFin}
            onChange={(e) => setEditFechaFin(e.target.value)}
            required
          />
          <Input
            label="Motivo (opcional)"
            placeholder="Ej. Vacaciones familiares"
            value={editMotivo}
            onChange={(e) => setEditMotivo(e.target.value)}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setShowEditModal(null)}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Guardar'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Calendar, DollarSign, Users, Target, CheckCircle, Clock,
  Plus, Trash2, Edit, AlertTriangle, TrendingUp, BarChart3, X,
  FileText, Award, MapPin, Video, Save, ChevronRight, Eye
} from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import { useAuth } from '@/contexts/AuthContext';
import {
  getEvent, updateEvent, getEventExpenses, createExpense, updateExpense, deleteExpense,
  getEventActivities, createEventActivity, updateEventActivity, deleteEventActivity,
  getEventParticipants, createParticipant, updateParticipant, deleteParticipant,
  getActiveUsers, computeEventKPIs, getEventVendors, setEventVendors,
  type Event, type EventExpense, type EventActivity, type EventParticipant,
  type EventStatus, type ExpenseStatus, type EventActivityStatus, type EventActivityType,
} from '@/lib/services/events';
import { format, differenceInDays, isAfter, isBefore } from 'date-fns';
import { es } from 'date-fns/locale';
import toast from 'react-hot-toast';

type Tab = 'general' | 'presupuesto' | 'actividades' | 'participantes' | 'kpis';

const statusColors: Record<EventStatus, string> = {
  planeado: 'bg-blue-100 text-blue-700', en_ejecucion: 'bg-amber-100 text-amber-700',
  finalizado: 'bg-green-100 text-green-700', cancelado: 'bg-red-100 text-red-700',
};

export default function EventDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { userProfile } = useAuth();
  const eventId = params.id as string;

  const [event, setEvent] = useState<Event | null>(null);
  const [expenses, setExpenses] = useState<EventExpense[]>([]);
  const [activities, setActivities] = useState<EventActivity[]>([]);
  const [participants, setParticipants] = useState<EventParticipant[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('general');
  const [eventVendorIds, setEventVendorIds] = useState<string[]>([]);
  const [savingVendors, setSavingVendors] = useState(false);
  const [showEditEvent, setShowEditEvent] = useState(false);
  const [editEventForm, setEditEventForm] = useState<any>({});
  const [savingEvent, setSavingEvent] = useState(false);

  // Modal states
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showExpenseDetail, setShowExpenseDetail] = useState<EventExpense | null>(null);
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [showParticipantModal, setShowParticipantModal] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [expandedActivityId, setExpandedActivityId] = useState<string | null>(null);

  // Forms
  const [expenseForm, setExpenseForm] = useState({ categoria: '', descripcion: '', proveedor: '', monto: '', fecha: '', estado: 'cotizado' as ExpenseStatus, comprobante: '', num_comprobante: '', num_factura: '', notas: '' });
  const [activityForm, setActivityForm] = useState({ nombre: '', descripcion: '', tipo: 'operativa' as EventActivityType, responsable_id: '', fecha_inicio: '', fecha_fin: '', prioridad: 'media', estado: 'pendiente' as EventActivityStatus, porcentaje_avance: 0, es_hito: false, notas: '' });
  const [participantForm, setParticipantForm] = useState({ nombre: '', email: '', telefono: '', empresa: '', estado_inscripcion: 'pre_inscrito' as any, estado_pago: 'pendiente' as any, monto_pagado: '', categoria: '', notas: '' });

  useEffect(() => {
    if (userProfile) {
      const isSup = userProfile.rol === 'admin' || userProfile.rol === 'supervisor' || userProfile.rol === 'supervisor_nivel1' || userProfile.rol === 'supervisor_vendedor';
      if (!isSup) {
        router.replace(`/eventos/${eventId}/vendedor`);
        return;
      }
    }
    loadAll();
  }, [eventId, userProfile]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [ev, exp, act, part, usr, vids] = await Promise.all([
        getEvent(eventId), getEventExpenses(eventId), getEventActivities(eventId),
        getEventParticipants(eventId), getActiveUsers(), getEventVendors(eventId)
      ]);
      setEvent(ev); setExpenses(exp); setActivities(act); setParticipants(part); setUsers(usr); setEventVendorIds(vids);
    } catch (e) { console.error(e); toast.error('Error cargando evento'); }
    finally { setLoading(false); }
  };

  const getUserName = (id: string) => users.find(u => u.id === id)?.nombre_completo || 'Sin asignar';
  const isSupervisorOrAdmin = userProfile?.rol === 'admin' || userProfile?.rol === 'supervisor' || userProfile?.rol === 'supervisor_nivel1' || userProfile?.rol === 'supervisor_vendedor';
  const canEditParticipant = (p: EventParticipant) => isSupervisorOrAdmin || p.registered_by === userProfile?.id;
  const getCatColor = (catName: string | null) => {
    if (!catName || !event) return null;
    const cat = (event.categorias_participantes || []).find((c: any) => c.nombre === catName);
    return cat?.color || null;
  };

  const handleStatusChange = async (newStatus: EventStatus) => {
    if (!event) return;
    try {
      await updateEvent(event.id, { estado: newStatus });
      setEvent({ ...event, estado: newStatus });
      toast.success('Estado actualizado');
    } catch { toast.error('Error actualizando estado'); }
  };

  const openEditEvent = () => {
    if (!event) return;
    setEditEventForm({
      nombre: event.nombre,
      descripcion: event.descripcion || '',
      tipo: event.tipo,
      modalidad: event.modalidad,
      fecha_inicio: event.fecha_inicio ? format(new Date(event.fecha_inicio), "yyyy-MM-dd'T'HH:mm") : '',
      fecha_fin: event.fecha_fin ? format(new Date(event.fecha_fin), "yyyy-MM-dd'T'HH:mm") : '',
      ubicacion: event.ubicacion || '',
      plataforma: event.plataforma || '',
      objetivo: event.objetivo || '',
      responsable_id: event.responsable_id,
      presupuesto_total: String(event.presupuesto_total || 0),
      margen_objetivo: String(event.margen_objetivo || 0),
      costo_fijo_total: String(event.costo_fijo_total || 0),
      costo_variable_por_persona: String(event.costo_variable_por_persona || 0),
      cupo_minimo: String(event.cupo_minimo || 0),
      cupo_maximo: String(event.cupo_maximo || 0),
      precio_por_persona: String(event.precio_por_persona || 0),
      informe_final: event.informe_final || '',
      lecciones_aprendidas: event.lecciones_aprendidas || '',
      recomendaciones: event.recomendaciones || '',
      satisfaccion_promedio: String(event.satisfaccion_promedio || ''),
      marcas: event.marcas || [],
      categorias_participantes: event.categorias_participantes || [],
    });
    setShowEditEvent(true);
  };

  const saveEditEvent = async () => {
    if (!editEventForm.nombre || !editEventForm.fecha_inicio) { toast.error('Nombre y fecha de inicio requeridos'); return; }
    setSavingEvent(true);
    try {
      await updateEvent(eventId, {
        nombre: editEventForm.nombre,
        descripcion: editEventForm.descripcion || null,
        tipo: editEventForm.tipo,
        modalidad: editEventForm.modalidad,
        fecha_inicio: new Date(editEventForm.fecha_inicio).toISOString(),
        fecha_fin: editEventForm.fecha_fin ? new Date(editEventForm.fecha_fin).toISOString() : null,
        ubicacion: editEventForm.ubicacion || null,
        plataforma: editEventForm.plataforma || null,
        objetivo: editEventForm.objetivo || null,
        responsable_id: editEventForm.responsable_id,
        marcas: editEventForm.marcas || [],
        presupuesto_total: Number(editEventForm.presupuesto_total) || 0,
        margen_objetivo: Number(editEventForm.margen_objetivo) || 0,
        costo_fijo_total: Number(editEventForm.costo_fijo_total) || 0,
        costo_variable_por_persona: Number(editEventForm.costo_variable_por_persona) || 0,
        cupo_minimo: Number(editEventForm.cupo_minimo) || 0,
        cupo_maximo: Number(editEventForm.cupo_maximo) || 0,
        precio_por_persona: Number(editEventForm.precio_por_persona) || 0,
        informe_final: editEventForm.informe_final || null,
        lecciones_aprendidas: editEventForm.lecciones_aprendidas || null,
        recomendaciones: editEventForm.recomendaciones || null,
        satisfaccion_promedio: editEventForm.satisfaccion_promedio ? Number(editEventForm.satisfaccion_promedio) : null,
        categorias_participantes: editEventForm.categorias_participantes || [],
      });
      toast.success('Evento actualizado');
      setShowEditEvent(false);
      loadAll();
    } catch (e: any) { toast.error(e?.message || 'Error al guardar'); }
    finally { setSavingEvent(false); }
  };

  // ============= EXPENSE HANDLERS =============
  const openExpenseModal = (item?: EventExpense) => {
    if (item) {
      setEditingItem(item);
      setExpenseForm({ categoria: item.categoria, descripcion: item.descripcion || '', proveedor: item.proveedor || '', monto: String(item.monto), fecha: item.fecha || '', estado: item.estado, comprobante: (item as any).comprobante || '', num_comprobante: (item as any).num_comprobante || '', num_factura: (item as any).num_factura || '', notas: item.notas || '' });
    } else {
      setEditingItem(null);
      setExpenseForm({ categoria: '', descripcion: '', proveedor: '', monto: '', fecha: format(new Date(), 'yyyy-MM-dd'), estado: 'cotizado', comprobante: '', num_comprobante: '', num_factura: '', notas: '' });
    }
    setShowExpenseModal(true);
  };

  const saveExpense = async () => {
    if (!expenseForm.categoria || !expenseForm.monto) { toast.error('Categoría y monto requeridos'); return; }
    try {
      const data = { event_id: eventId, categoria: expenseForm.categoria, descripcion: expenseForm.descripcion || null, proveedor: expenseForm.proveedor || null, monto: Number(expenseForm.monto), fecha: expenseForm.fecha || null, estado: expenseForm.estado, comprobante: expenseForm.comprobante || null, num_comprobante: expenseForm.num_comprobante || null, num_factura: expenseForm.num_factura || null, notas: expenseForm.notas || null };
      if (editingItem) { await updateExpense(editingItem.id, data); } else { await createExpense(data); }
      toast.success(editingItem ? 'Gasto actualizado' : 'Gasto agregado');
      setShowExpenseModal(false);
      const exp = await getEventExpenses(eventId); setExpenses(exp);
    } catch { toast.error('Error guardando gasto'); }
  };

  const removeExpense = async (id: string) => {
    if (!confirm('¿Eliminar este gasto?')) return;
    try { await deleteExpense(id); setExpenses(expenses.filter(e => e.id !== id)); toast.success('Gasto eliminado'); } catch { toast.error('Error'); }
  };

  // ============= ACTIVITY HANDLERS =============
  const openActivityModal = (item?: EventActivity) => {
    if (item) {
      setEditingItem(item);
      setActivityForm({ nombre: item.nombre, descripcion: item.descripcion || '', tipo: item.tipo, responsable_id: item.responsable_id, fecha_inicio: item.fecha_inicio ? format(new Date(item.fecha_inicio), "yyyy-MM-dd'T'HH:mm") : '', fecha_fin: item.fecha_fin ? format(new Date(item.fecha_fin), "yyyy-MM-dd'T'HH:mm") : '', prioridad: item.prioridad, estado: item.estado, porcentaje_avance: item.porcentaje_avance, es_hito: item.es_hito, notas: item.notas || '' });
    } else {
      setEditingItem(null);
      setActivityForm({ nombre: '', descripcion: '', tipo: 'operativa', responsable_id: '', fecha_inicio: '', fecha_fin: '', prioridad: 'media', estado: 'pendiente', porcentaje_avance: 0, es_hito: false, notas: '' });
    }
    setShowActivityModal(true);
  };

  const saveActivity = async () => {
    if (!activityForm.nombre || !activityForm.responsable_id || !activityForm.fecha_inicio) { toast.error('Nombre, responsable y fecha son requeridos'); return; }
    try {
      // Si está completada, forzar 100% de avance
      const avance = activityForm.estado === 'completada' ? 100 : activityForm.porcentaje_avance;
      const data = { event_id: eventId, nombre: activityForm.nombre, descripcion: activityForm.descripcion || null, tipo: activityForm.tipo, responsable_id: activityForm.responsable_id, fecha_inicio: new Date(activityForm.fecha_inicio).toISOString(), fecha_fin: activityForm.fecha_fin ? new Date(activityForm.fecha_fin).toISOString() : null, prioridad: activityForm.prioridad, estado: activityForm.estado, porcentaje_avance: avance, es_hito: activityForm.es_hito, notas: activityForm.notas || null };
      if (editingItem) { await updateEventActivity(editingItem.id, data); } else { await createEventActivity(data); }
      toast.success(editingItem ? 'Actividad actualizada' : 'Actividad creada');
      setShowActivityModal(false);
      const act = await getEventActivities(eventId); setActivities(act);
    } catch { toast.error('Error guardando actividad'); }
  };

  const removeActivity = async (id: string) => {
    if (!confirm('¿Eliminar esta actividad?')) return;
    try { await deleteEventActivity(id); setActivities(activities.filter(a => a.id !== id)); toast.success('Eliminada'); } catch { toast.error('Error'); }
  };

  // ============= PARTICIPANT HANDLERS =============
  const openParticipantModal = (item?: EventParticipant) => {
    if (item) {
      setEditingItem(item);
      setParticipantForm({ nombre: item.nombre, email: item.email || '', telefono: item.telefono || '', empresa: item.empresa || '', estado_inscripcion: item.estado_inscripcion, estado_pago: item.estado_pago, monto_pagado: String(item.monto_pagado || 0), categoria: item.categoria || '', notas: item.notas || '' });
    } else {
      setEditingItem(null);
      setParticipantForm({ nombre: '', email: '', telefono: '', empresa: '', estado_inscripcion: 'pre_inscrito', estado_pago: 'pendiente', monto_pagado: '0', categoria: '', notas: '' });
    }
    setShowParticipantModal(true);
  };

  const saveParticipant = async () => {
    if (!participantForm.nombre) { toast.error('Nombre requerido'); return; }
    try {
      const data: any = { event_id: eventId, nombre: participantForm.nombre, email: participantForm.email || null, telefono: participantForm.telefono || null, empresa: participantForm.empresa || null, estado_inscripcion: participantForm.estado_inscripcion, estado_pago: participantForm.estado_pago, monto_pagado: Number(participantForm.monto_pagado) || 0, categoria: participantForm.categoria || null, notas: participantForm.notas || null };
      if (editingItem) { await updateParticipant(editingItem.id, data); } else { data.registered_by = userProfile?.id || null; await createParticipant(data); }
      toast.success(editingItem ? 'Participante actualizado' : 'Participante agregado');
      setShowParticipantModal(false);
      const part = await getEventParticipants(eventId); setParticipants(part);
    } catch { toast.error('Error guardando participante'); }
  };

  const removeParticipant = async (id: string) => {
    if (!confirm('¿Eliminar participante?')) return;
    try { await deleteParticipant(id); setParticipants(participants.filter(p => p.id !== id)); toast.success('Eliminado'); } catch { toast.error('Error'); }
  };

  const toggleAttendance = async (p: EventParticipant) => {
    try { await updateParticipant(p.id, { asistencia: !p.asistencia }); setParticipants(participants.map(x => x.id === p.id ? { ...x, asistencia: !x.asistencia } : x)); } catch { toast.error('Error'); }
  };

  const toggleCertificate = async (p: EventParticipant) => {
    try { await updateParticipant(p.id, { certificado_emitido: !p.certificado_emitido }); setParticipants(participants.map(x => x.id === p.id ? { ...x, certificado_emitido: !x.certificado_emitido } : x)); } catch { toast.error('Error'); }
  };

  if (loading || !event) return <div className="flex items-center justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" /></div>;

  const kpis = computeEventKPIs(event, expenses, activities, participants);
  const tabs: { id: Tab; label: string; icon: any; count?: number }[] = [
    { id: 'general', label: 'General', icon: FileText },
    { id: 'presupuesto', label: 'Presupuesto', icon: DollarSign, count: expenses.length },
    { id: 'actividades', label: 'Actividades', icon: Target, count: activities.length },
    { id: 'participantes', label: 'Participantes', icon: Users, count: participants.length },
    { id: 'kpis', label: 'KPIs', icon: BarChart3 },
  ];

  // ============= GANTT HELPERS =============
  const ganttStart = activities.length > 0 ? new Date(Math.min(...activities.map(a => new Date(a.fecha_inicio).getTime()))) : new Date();
  const ganttEnd = activities.length > 0 ? new Date(Math.max(...activities.map(a => new Date(a.fecha_fin || a.fecha_inicio).getTime()))) : new Date();
  const ganttDays = Math.max(differenceInDays(ganttEnd, ganttStart) + 1, 1);

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <Link href="/eventos"><Button variant="ghost" size="sm" icon={<ArrowLeft className="h-4 w-4" />}>Eventos</Button></Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{event.nombre}</h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusColors[event.estado]}`}>{event.estado === 'en_ejecucion' ? 'En Ejecución' : event.estado.charAt(0).toUpperCase() + event.estado.slice(1)}</span>
              <span className="text-xs text-gray-500">{format(new Date(event.fecha_inicio), "d MMM yyyy", { locale: es })}{event.fecha_fin ? ` → ${format(new Date(event.fecha_fin), "d MMM yyyy", { locale: es })}` : ''}</span>
              <span className="text-xs text-gray-500">• Responsable: <strong>{getUserName(event.responsable_id)}</strong></span>
            </div>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" variant="secondary" onClick={openEditEvent}><Edit className="h-4 w-4 mr-1" />Editar</Button>
          {event.estado === 'planeado' && <Button size="sm" onClick={() => handleStatusChange('en_ejecucion')}>▶ Iniciar</Button>}
          {event.estado === 'en_ejecucion' && <Button size="sm" onClick={() => handleStatusChange('finalizado')}>✅ Finalizar</Button>}
          {event.estado !== 'cancelado' && event.estado !== 'finalizado' && <Button size="sm" variant="danger" onClick={() => handleStatusChange('cancelado')}>Cancelar</Button>}
        </div>
      </div>

      {/* Quick KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-blue-50 rounded-xl p-3 border border-blue-200">
          <p className="text-[10px] text-blue-600 font-semibold uppercase">Presupuesto</p>
          <p className="text-lg font-bold">${kpis.presupuestoTotal.toLocaleString()}</p>
          <p className="text-xs text-blue-600">{kpis.presupuestoEjecutado.toFixed(0)}% ejecutado</p>
        </div>
        <div className="bg-green-50 rounded-xl p-3 border border-green-200">
          <p className="text-[10px] text-green-600 font-semibold uppercase">Actividades</p>
          <p className="text-lg font-bold">{kpis.completedActivities}/{kpis.totalActivities}</p>
          <p className="text-xs text-green-600">{kpis.cumplimientoActividades.toFixed(0)}% completadas</p>
        </div>
        <div className="bg-purple-50 rounded-xl p-3 border border-purple-200">
          <p className="text-[10px] text-purple-600 font-semibold uppercase">Inscritos</p>
          <p className="text-lg font-bold">{kpis.confirmed}/{event.cupo_maximo || '∞'}</p>
          <p className="text-xs text-purple-600">{kpis.ocupacion.toFixed(0)}% ocupación</p>
        </div>
        <div className={`rounded-xl p-3 border ${kpis.utilidadReal >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
          <p className={`text-[10px] font-semibold uppercase ${kpis.utilidadReal >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>Rentabilidad</p>
          <p className="text-lg font-bold">${kpis.utilidadReal.toLocaleString()}</p>
          <p className={`text-xs ${kpis.utilidadReal >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{kpis.rentabilidad.toFixed(1)}%</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 overflow-x-auto">
        {tabs.map(t => {
          const Icon = t.icon;
          return (
            <button key={t.id} onClick={() => setTab(t.id)} className={`flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${tab === t.id ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>
              <Icon className="h-4 w-4" /> {t.label}
              {t.count !== undefined && <span className={`text-xs px-1.5 py-0.5 rounded-full ${tab === t.id ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-200 text-gray-600'}`}>{t.count}</span>}
            </button>
          );
        })}
      </div>

      {/* ============= TAB: GENERAL ============= */}
      {tab === 'general' && (
        <div className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <h3 className="font-semibold text-gray-900 mb-4">Información del Evento</h3>
            <div className="space-y-3 text-sm">
              {event.objetivo && <div><span className="text-gray-500">Objetivo:</span><p className="text-gray-900 mt-1">{event.objetivo}</p></div>}
              {event.descripcion && <div><span className="text-gray-500">Descripción:</span><p className="text-gray-900 mt-1">{event.descripcion}</p></div>}
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div><span className="text-gray-500">Tipo:</span><p className="font-medium">{event.tipo}</p></div>
                <div><span className="text-gray-500">Modalidad:</span><p className="font-medium">{event.modalidad}</p></div>
                {event.ubicacion && <div><span className="text-gray-500">Ubicación:</span><p className="font-medium">{event.ubicacion}</p></div>}
                {event.plataforma && <div><span className="text-gray-500">Plataforma:</span><p className="font-medium">{event.plataforma}</p></div>}
              </div>
              {event.marcas && event.marcas.length > 0 && (
                <div className="pt-3 border-t">
                  <span className="text-gray-500">Marcas:</span>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {event.marcas.map((m: string) => (
                      <span key={m} className="text-xs px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 font-medium">{m}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Card>
          <Card>
            <h3 className="font-semibold text-gray-900 mb-4">Costeo por Persona</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Costo fijo total</span><span className="font-medium">${Number(event.costo_fijo_total).toLocaleString()}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Costo variable/persona</span><span className="font-medium">${Number(event.costo_variable_por_persona).toLocaleString()}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Precio por persona</span><span className="font-medium text-green-700">${Number(event.precio_por_persona).toLocaleString()}</span></div>
              <div className="flex justify-between border-t pt-2"><span className="text-gray-500">Punto de equilibrio</span><span className="font-bold text-indigo-700">{kpis.puntoEquilibrio} personas</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Costo real/persona</span><span className="font-medium">${kpis.costoRealPorPersona.toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Cupo</span><span className="font-medium">{event.cupo_minimo} - {event.cupo_maximo}</span></div>
            </div>
          </Card>
        </div>

          {/* Vendor Assignment */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <Users className="h-5 w-5 text-indigo-600" />
                Vendedores Asignados al Evento
              </h3>
              {savingVendors && <span className="text-xs text-indigo-600 animate-pulse">Guardando...</span>}
            </div>
            <p className="text-xs text-gray-500 mb-3">Selecciona qué vendedores pueden ver e interactuar con este evento.</p>
            <div className="flex flex-wrap gap-2">
              {users.filter(u => u.rol !== 'admin').map(u => {
                const isAssigned = eventVendorIds.includes(u.id);
                return (
                  <button
                    key={u.id}
                    onClick={async () => {
                      const newIds = isAssigned ? eventVendorIds.filter(id => id !== u.id) : [...eventVendorIds, u.id];
                      setEventVendorIds(newIds);
                      setSavingVendors(true);
                      try { await setEventVendors(eventId, newIds); } catch { toast.error('Error guardando'); }
                      finally { setSavingVendors(false); }
                    }}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                      isAssigned
                        ? 'bg-indigo-100 text-indigo-700 border-indigo-300 font-semibold'
                        : 'bg-white text-gray-500 border-gray-200 hover:border-indigo-300 hover:text-indigo-600'
                    }`}
                  >
                    {isAssigned && <CheckCircle className="h-3 w-3 inline mr-1" />}
                    {u.nombre_completo}
                    <span className="ml-1 text-[10px] opacity-60">({u.rol === 'vendedor' ? 'Vend.' : u.rol === 'supervisor_vendedor' ? 'Sup+V' : u.rol})</span>
                  </button>
                );
              })}
            </div>
            {eventVendorIds.length > 0 && (
              <p className="text-xs text-indigo-600 mt-3 font-medium">{eventVendorIds.length} vendedor(es) asignado(s)</p>
            )}
          </Card>
        </div>
        )}

      {/* ============= TAB: PRESUPUESTO ============= */}
      {tab === 'presupuesto' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold text-gray-900">Gastos del Evento</h3>
            <Button size="sm" onClick={() => openExpenseModal()}><Plus className="h-4 w-4 mr-1" />Agregar Gasto</Button>
          </div>
          {/* Budget bar */}
          <Card className={kpis.sobreEjecucion ? 'border-red-300 bg-red-50/50' : ''}>
            <div className="flex justify-between text-sm mb-2">
              <span>Presupuesto: <strong>${kpis.presupuestoTotal.toLocaleString()}</strong></span>
              <span>Gastado: <strong className={kpis.sobreEjecucion ? 'text-red-600' : ''}>${kpis.totalGastos.toLocaleString()}</strong></span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div className={`h-3 rounded-full transition-all ${kpis.sobreEjecucion ? 'bg-red-500' : kpis.presupuestoEjecutado > 80 ? 'bg-amber-500' : 'bg-green-500'}`} style={{ width: `${Math.min(kpis.presupuestoEjecutado, 100)}%` }} />
            </div>
            {kpis.sobreEjecucion && <p className="text-xs text-red-600 mt-2 flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5" />Sobre-ejecución: ${Math.abs(kpis.desvio).toLocaleString()}</p>}
          </Card>
          {/* Expenses table */}
          <Card padding="none">
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="bg-gray-50 border-b"><th className="text-left px-4 py-3">Categoría</th><th className="text-left px-4 py-3 hidden md:table-cell">Proveedor</th><th className="text-right px-4 py-3">Monto</th><th className="text-center px-4 py-3 hidden lg:table-cell">Comprobante</th><th className="text-center px-4 py-3">Estado</th><th className="text-center px-4 py-3 w-20">Acción</th></tr></thead>
              <tbody className="divide-y">
                {expenses.length === 0 ? <tr><td colSpan={6} className="text-center py-8 text-gray-500">Sin gastos registrados</td></tr> : expenses.map(e => {
                  const comp = (e as any).comprobante;
                  const compLabel = comp === 'transferencia' ? 'Transferencia' : comp === 'tarjeta_credito' ? 'Tarjeta de crédito' : comp === 'efectivo' ? 'Efectivo' : '—';
                  return (
                  <tr key={e.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3"><p className="font-medium">{e.categoria}</p>{e.descripcion && <p className="text-xs text-gray-500">{e.descripcion}</p>}</td>
                    <td className="px-4 py-3 hidden md:table-cell text-gray-600">{e.proveedor || '—'}</td>
                    <td className="px-4 py-3 text-right font-semibold">${Number(e.monto).toLocaleString()}</td>
                    <td className="px-4 py-3 text-center hidden lg:table-cell"><span className={`text-xs px-2 py-0.5 rounded-full ${comp ? 'bg-indigo-100 text-indigo-700' : 'text-gray-400'}`}>{compLabel}</span></td>
                    <td className="px-4 py-3 text-center"><span className={`text-xs px-2 py-0.5 rounded-full ${e.estado === 'pagado' ? 'bg-green-100 text-green-700' : e.estado === 'aprobado' ? 'bg-blue-100 text-blue-700' : e.estado === 'cancelado' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'}`}>{e.estado}</span></td>
                    <td className="px-4 py-3 text-center"><div className="flex gap-1 justify-center"><button onClick={() => setShowExpenseDetail(e)} className="p-1 hover:bg-blue-50 rounded" title="Ver detalle"><Eye className="h-3.5 w-3.5 text-blue-500" /></button><button onClick={() => openExpenseModal(e)} className="p-1 hover:bg-gray-100 rounded" title="Editar"><Edit className="h-3.5 w-3.5 text-gray-500" /></button><button onClick={() => removeExpense(e.id)} className="p-1 hover:bg-red-50 rounded" title="Eliminar"><Trash2 className="h-3.5 w-3.5 text-red-500" /></button></div></td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          </Card>
        </div>
      )}

      {/* ============= TAB: ACTIVIDADES + GANTT ============= */}
      {tab === 'actividades' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold text-gray-900">Actividades del Evento</h3>
            <Button size="sm" onClick={() => openActivityModal()}><Plus className="h-4 w-4 mr-1" />Nueva Actividad</Button>
          </div>

          {/* Gantt Chart */}
          {activities.length > 0 && (
            <Card>
              <h4 className="text-sm font-semibold text-gray-600 mb-3">📊 Timeline / Gantt</h4>
              <div className="overflow-x-auto">
                <div className="min-w-[600px]">
                  {activities.map(a => {
                    const start = new Date(a.fecha_inicio);
                    const end = a.fecha_fin ? new Date(a.fecha_fin) : start;
                    const left = Math.max(0, (differenceInDays(start, ganttStart) / ganttDays) * 100);
                    const width = Math.max(2, ((differenceInDays(end, start) + 1) / ganttDays) * 100);
                    const isOverdue = a.estado !== 'completada' && a.estado !== 'cancelada' && a.fecha_fin && new Date(a.fecha_fin) < new Date();
                    const barColor = a.estado === 'completada' ? 'bg-green-400' : a.estado === 'bloqueada' ? 'bg-red-400' : isOverdue ? 'bg-orange-400' : a.tipo === 'estrategica' ? 'bg-purple-400' : 'bg-blue-400';
                    return (
                      <div key={a.id} className="flex items-center gap-3 py-1.5 group">
                        <div className="w-36 flex-shrink-0 text-xs truncate text-gray-700 font-medium">{a.es_hito ? '🔹 ' : ''}{a.nombre}</div>
                        <div className="flex-1 relative h-6 bg-gray-100 rounded">
                          <div className={`absolute h-6 rounded ${barColor} transition-all opacity-80 group-hover:opacity-100`} style={{ left: `${left}%`, width: `${width}%` }}>
                            <span className="text-[10px] text-white font-medium px-1 leading-6 truncate block">{a.porcentaje_avance}%</span>
                          </div>
                        </div>
                        <div className="w-20 flex-shrink-0 text-xs text-gray-500">{getUserName(a.responsable_id).split(' ')[0]}</div>
                      </div>
                    );
                  })}
                  <div className="flex justify-between text-[10px] text-gray-400 mt-2 px-1">
                    <span>{format(ganttStart, 'd MMM', { locale: es })}</span>
                    <span>{format(ganttEnd, 'd MMM', { locale: es })}</span>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Activities list */}
          <Card padding="none">
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="bg-gray-50 dark:bg-dark-700 border-b dark:border-dark-600"><th className="text-left px-4 py-3">Actividad</th><th className="text-left px-4 py-3 hidden md:table-cell">Responsable</th><th className="text-center px-4 py-3">Avance</th><th className="text-center px-4 py-3">Estado</th><th className="text-center px-4 py-3 w-24">Acción</th></tr></thead>
              <tbody className="divide-y dark:divide-dark-600">
                {activities.length === 0 ? <tr><td colSpan={5} className="text-center py-8 text-gray-500 dark:text-gray-400">Sin actividades</td></tr> : activities.map(a => {
                  const isOverdue = a.estado !== 'completada' && a.estado !== 'cancelada' && a.fecha_fin && new Date(a.fecha_fin) < new Date();
                  const isExpanded = expandedActivityId === a.id;
                  return (
                    <>
                      <tr key={a.id} className={`hover:bg-gray-50 dark:hover:bg-dark-700 ${isOverdue ? 'bg-red-50/50 dark:bg-red-900/20' : ''} ${isExpanded ? 'bg-indigo-50/50 dark:bg-indigo-900/20' : ''}`}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {a.es_hito && <span title="Hito">🔹</span>}
                            <div>
                              <p className="font-medium dark:text-white">{a.nombre}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">{a.tipo === 'estrategica' ? '⭐ Estratégica' : 'Operativa'} • {a.prioridad} {isOverdue && <span className="text-red-600 dark:text-red-400 font-medium">• RETRASADA</span>}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell text-gray-600 dark:text-gray-300 text-xs">{getUserName(a.responsable_id)}</td>
                        <td className="px-4 py-3 text-center">
                          <div className="w-16 mx-auto bg-gray-200 dark:bg-dark-600 rounded-full h-2"><div className="h-2 rounded-full bg-indigo-500" style={{ width: `${a.porcentaje_avance}%` }} /></div>
                          <span className="text-xs text-gray-500 dark:text-gray-400">{a.porcentaje_avance}%</span>
                        </td>
                        <td className="px-4 py-3 text-center"><span className={`text-xs px-2 py-0.5 rounded-full ${a.estado === 'completada' ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' : a.estado === 'en_progreso' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' : a.estado === 'bloqueada' ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' : 'bg-gray-100 text-gray-700 dark:bg-dark-600 dark:text-gray-300'}`}>{a.estado.replace('_', ' ')}</span></td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex gap-1 justify-center">
                            <button onClick={() => setExpandedActivityId(isExpanded ? null : a.id)} className={`p-1 rounded transition-colors ${isExpanded ? 'bg-indigo-100 dark:bg-indigo-900/40' : 'hover:bg-blue-50 dark:hover:bg-blue-900/30'}`} title="Ver detalle">
                              <Eye className={`h-3.5 w-3.5 ${isExpanded ? 'text-indigo-600 dark:text-indigo-400' : 'text-blue-500'}`} />
                            </button>
                            <button onClick={() => openActivityModal(a)} className="p-1 hover:bg-gray-100 dark:hover:bg-dark-600 rounded" title="Editar"><Edit className="h-3.5 w-3.5 text-gray-500 dark:text-gray-400" /></button>
                            <button onClick={() => removeActivity(a.id)} className="p-1 hover:bg-red-50 dark:hover:bg-red-900/30 rounded" title="Eliminar"><Trash2 className="h-3.5 w-3.5 text-red-500" /></button>
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr key={`${a.id}-detail`} className="bg-indigo-50/30 dark:bg-indigo-900/10">
                          <td colSpan={5} className="px-4 py-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                              <div>
                                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">Descripción</p>
                                <p className="text-gray-700 dark:text-gray-200">{a.descripcion || 'Sin descripción'}</p>
                              </div>
                              <div>
                                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">Fechas</p>
                                <p className="text-gray-700 dark:text-gray-200">
                                  <span className="font-medium">Inicio:</span> {format(new Date(a.fecha_inicio), "d MMM yyyy, HH:mm", { locale: es })}
                                  {a.fecha_fin && (
                                    <>
                                      <br />
                                      <span className="font-medium">Fin:</span> {format(new Date(a.fecha_fin), "d MMM yyyy, HH:mm", { locale: es })}
                                    </>
                                  )}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">Detalles</p>
                                <p className="text-gray-700 dark:text-gray-200">
                                  <span className="font-medium">Tipo:</span> {a.tipo === 'estrategica' ? 'Estratégica' : 'Operativa'}<br />
                                  <span className="font-medium">Prioridad:</span> {a.prioridad}<br />
                                  <span className="font-medium">Hito:</span> {a.es_hito ? 'Sí' : 'No'}
                                </p>
                              </div>
                              {a.notas && (
                                <div className="md:col-span-2 lg:col-span-3">
                                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">Notas</p>
                                  <p className="text-gray-700 dark:text-gray-200 bg-white dark:bg-dark-700 p-2 rounded border border-gray-200 dark:border-dark-600">{a.notas}</p>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
            </div>
          </Card>
        </div>
      )}

      {/* ============= TAB: PARTICIPANTES ============= */}
      {tab === 'participantes' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold text-gray-900">Participantes ({participants.length})</h3>
            <Button size="sm" onClick={() => openParticipantModal()}><Plus className="h-4 w-4 mr-1" />Agregar</Button>
          </div>

          {/* Resumen por categorías */}
          {(event.categorias_participantes || []).length > 0 && (
            <Card className="bg-teal-50/50 border-teal-200">
              <h4 className="text-xs font-semibold text-teal-700 uppercase mb-3">🏅 Resumen por Categoría</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {(event.categorias_participantes || []).map((cat: any) => {
                  const catParticipants = participants.filter(p => p.categoria === cat.nombre);
                  const preInscritos = catParticipants.filter(p => p.estado_inscripcion === 'pre_inscrito').length;
                  const confirmados = catParticipants.filter(p => p.estado_inscripcion === 'confirmado').length;
                  const cancelados = catParticipants.filter(p => p.estado_inscripcion === 'cancelado').length;
                  const listaEspera = catParticipants.filter(p => p.estado_inscripcion === 'lista_espera').length;
                  const total = catParticipants.length;
                  const activos = preInscritos + confirmados + listaEspera;
                  return (
                    <div key={cat.nombre} className="bg-white rounded-xl p-3 border border-teal-200 overflow-hidden relative">
                      {cat.color && <div className="absolute top-0 left-0 w-full h-1" style={{ backgroundColor: cat.color }} />}
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-sm text-gray-900 flex items-center gap-1.5">{cat.color && <span className="w-3 h-3 rounded-full inline-block flex-shrink-0" style={{ backgroundColor: cat.color }} />}{cat.nombre}</span>
                        {cat.cupo ? (
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${activos >= cat.cupo ? 'bg-red-100 text-red-700' : activos >= cat.cupo * 0.8 ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                            {activos}/{cat.cupo}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">{total} inscritos</span>
                        )}
                      </div>
                      {cat.cupo && (
                        <div className="w-full bg-gray-200 rounded-full h-1.5 mb-2">
                          <div className={`h-1.5 rounded-full transition-all ${activos >= cat.cupo ? 'bg-red-500' : activos >= cat.cupo * 0.8 ? 'bg-amber-500' : 'bg-teal-500'}`} style={{ width: `${Math.min((activos / cat.cupo) * 100, 100)}%` }} />
                        </div>
                      )}
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px]">
                        <span className="text-gray-500">Pre-inscr: <strong>{preInscritos}</strong></span>
                        <span className="text-green-600">Confirm: <strong>{confirmados}</strong></span>
                        <span className="text-amber-600">Espera: <strong>{listaEspera}</strong></span>
                        <span className="text-red-500">Cancel: <strong>{cancelados}</strong></span>
                      </div>
                    </div>
                  );
                })}
                {/* Sin categoría */}
                {(() => {
                  const sinCat = participants.filter(p => !p.categoria);
                  if (sinCat.length === 0) return null;
                  return (
                    <div className="bg-gray-50 rounded-xl p-3 border border-gray-200">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-sm text-gray-500">Sin categoría</span>
                        <span className="text-xs text-gray-400">{sinCat.length} inscritos</span>
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px]">
                        <span className="text-gray-500">Pre-inscr: <strong>{sinCat.filter(p => p.estado_inscripcion === 'pre_inscrito').length}</strong></span>
                        <span className="text-green-600">Confirm: <strong>{sinCat.filter(p => p.estado_inscripcion === 'confirmado').length}</strong></span>
                        <span className="text-amber-600">Espera: <strong>{sinCat.filter(p => p.estado_inscripcion === 'lista_espera').length}</strong></span>
                        <span className="text-red-500">Cancel: <strong>{sinCat.filter(p => p.estado_inscripcion === 'cancelado').length}</strong></span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </Card>
          )}

          {/* Mobile card layout */}
          <div className="md:hidden space-y-2">
            {participants.length === 0 ? (
              <Card><p className="text-center py-4 text-gray-500 text-sm">Sin participantes</p></Card>
            ) : participants.map(p => (
              <Card key={p.id} padding="none">
                <div className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">{p.nombre}</p>
                      <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                        {p.categoria && <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium text-white" style={{ backgroundColor: getCatColor(p.categoria) || '#0d9488' }}>{p.categoria}</span>}
                        {p.empresa && <span className="text-[10px] text-gray-400">{p.empresa}</span>}
                      </div>
                    </div>
                    <div className="flex gap-1 flex-shrink-0 items-center">
                      <button onClick={() => toggleAttendance(p)} className={`p-1 rounded ${p.asistencia ? 'text-green-600' : 'text-gray-300'}`}><CheckCircle className="h-4 w-4" /></button>
                      <button onClick={() => toggleCertificate(p)} className={`p-1 rounded ${p.certificado_emitido ? 'text-purple-600' : 'text-gray-300'}`}><Award className="h-4 w-4" /></button>
                      {canEditParticipant(p) && (
                        <>
                          <button onClick={() => openParticipantModal(p)} className="p-1 hover:bg-gray-100 rounded"><Edit className="h-3.5 w-3.5 text-gray-500" /></button>
                          <button onClick={() => removeParticipant(p.id)} className="p-1 hover:bg-red-50 rounded"><Trash2 className="h-3.5 w-3.5 text-red-500" /></button>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${p.estado_inscripcion === 'confirmado' ? 'bg-green-100 text-green-700' : p.estado_inscripcion === 'cancelado' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'}`}>{p.estado_inscripcion.replace('_', ' ')}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${p.estado_pago === 'pagado' ? 'bg-green-100 text-green-700' : p.estado_pago === 'parcial' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-700'}`}>{p.estado_pago}</span>
                    {p.registered_by && <span className="text-[10px] text-gray-400">Por: {getUserName(p.registered_by)}</span>}
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Desktop table */}
          <Card padding="none" className="hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="bg-gray-50 border-b"><th className="text-left px-4 py-3">Nombre</th><th className="text-left px-4 py-3">Contacto</th><th className="text-center px-4 py-3">Inscripción</th><th className="text-center px-4 py-3">Pago</th><th className="text-center px-4 py-3">Asist.</th><th className="text-center px-4 py-3">Cert.</th><th className="text-left px-4 py-3 hidden lg:table-cell">Registrado por</th><th className="text-center px-4 py-3 w-20">Acción</th></tr></thead>
                <tbody className="divide-y">
                  {participants.length === 0 ? <tr><td colSpan={8} className="text-center py-8 text-gray-500">Sin participantes</td></tr> : participants.map(p => (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3"><p className="font-medium">{p.nombre}</p><div className="flex items-center gap-1.5">{p.empresa && <span className="text-xs text-gray-500">{p.empresa}</span>}{p.categoria && <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium text-white" style={{ backgroundColor: getCatColor(p.categoria) || '#0d9488' }}>{p.categoria}</span>}</div></td>
                      <td className="px-4 py-3 text-xs text-gray-600">{p.email || p.telefono || '—'}</td>
                      <td className="px-4 py-3 text-center"><span className={`text-xs px-2 py-0.5 rounded-full ${p.estado_inscripcion === 'confirmado' ? 'bg-green-100 text-green-700' : p.estado_inscripcion === 'cancelado' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'}`}>{p.estado_inscripcion.replace('_', ' ')}</span></td>
                      <td className="px-4 py-3 text-center"><span className={`text-xs px-2 py-0.5 rounded-full ${p.estado_pago === 'pagado' ? 'bg-green-100 text-green-700' : p.estado_pago === 'parcial' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-700'}`}>{p.estado_pago}</span></td>
                      <td className="px-4 py-3 text-center"><button onClick={() => toggleAttendance(p)} className={`p-1 rounded ${p.asistencia ? 'text-green-600' : 'text-gray-300'}`}><CheckCircle className="h-5 w-5" /></button></td>
                      <td className="px-4 py-3 text-center"><button onClick={() => toggleCertificate(p)} className={`p-1 rounded ${p.certificado_emitido ? 'text-purple-600' : 'text-gray-300'}`}><Award className="h-5 w-5" /></button></td>
                      <td className="px-4 py-3 hidden lg:table-cell text-xs text-gray-500">{p.registered_by ? getUserName(p.registered_by) : <span className="text-gray-300">—</span>}</td>
                      <td className="px-4 py-3 text-center">
                        {canEditParticipant(p) ? (
                          <div className="flex gap-1 justify-center"><button onClick={() => openParticipantModal(p)} className="p-1 hover:bg-gray-100 rounded"><Edit className="h-3.5 w-3.5 text-gray-500" /></button><button onClick={() => removeParticipant(p.id)} className="p-1 hover:bg-red-50 rounded"><Trash2 className="h-3.5 w-3.5 text-red-500" /></button></div>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ============= TAB: KPIs ============= */}
      {tab === 'kpis' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Financial KPIs */}
            <Card className="bg-blue-50 border border-blue-200">
              <h4 className="text-xs font-semibold text-blue-600 uppercase mb-3">💰 Financiero</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span>Presupuesto</span><span className="font-bold">${kpis.presupuestoTotal.toLocaleString()}</span></div>
                <div className="flex justify-between"><span>Total gastos</span><span className="font-bold">${kpis.totalGastos.toLocaleString()}</span></div>
                <div className="flex justify-between"><span>% ejecutado</span><span className={`font-bold ${kpis.sobreEjecucion ? 'text-red-600' : ''}`}>{kpis.presupuestoEjecutado.toFixed(1)}%</span></div>
                <div className="flex justify-between border-t pt-2"><span>Ingresos reales</span><span className="font-bold text-green-700">${kpis.ingresosReales.toLocaleString()}</span></div>
                <div className="flex justify-between"><span>Utilidad real</span><span className={`font-bold ${kpis.utilidadReal >= 0 ? 'text-green-700' : 'text-red-600'}`}>${kpis.utilidadReal.toLocaleString()}</span></div>
                <div className="flex justify-between"><span>Rentabilidad</span><span className={`font-bold ${kpis.rentabilidad >= 0 ? 'text-green-700' : 'text-red-600'}`}>{kpis.rentabilidad.toFixed(1)}%</span></div>
              </div>
            </Card>
            {/* Activity KPIs */}
            <Card className="bg-green-50 border border-green-200">
              <h4 className="text-xs font-semibold text-green-600 uppercase mb-3">🎯 Actividades</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span>Total</span><span className="font-bold">{kpis.totalActivities}</span></div>
                <div className="flex justify-between"><span>Completadas</span><span className="font-bold text-green-700">{kpis.completedActivities}</span></div>
                <div className="flex justify-between"><span>Bloqueadas</span><span className="font-bold text-red-600">{kpis.blockedActivities}</span></div>
                <div className="flex justify-between"><span>Retrasadas</span><span className="font-bold text-orange-600">{kpis.overdueActivities}</span></div>
                <div className="flex justify-between border-t pt-2"><span>% cumplimiento</span><span className="font-bold">{kpis.cumplimientoActividades.toFixed(1)}%</span></div>
                <div className="flex justify-between"><span>Avance promedio</span><span className="font-bold">{kpis.avancePromedio.toFixed(1)}%</span></div>
              </div>
            </Card>
            {/* Participant KPIs */}
            <Card className="bg-purple-50 border border-purple-200">
              <h4 className="text-xs font-semibold text-purple-600 uppercase mb-3">👥 Participantes</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span>Total inscritos</span><span className="font-bold">{kpis.totalParticipants}</span></div>
                <div className="flex justify-between"><span>Confirmados</span><span className="font-bold text-green-700">{kpis.confirmed}</span></div>
                <div className="flex justify-between"><span>Asistieron</span><span className="font-bold">{kpis.attended}</span></div>
                <div className="flex justify-between"><span>% asistencia</span><span className="font-bold">{kpis.asistencia.toFixed(1)}%</span></div>
                <div className="flex justify-between border-t pt-2"><span>% ocupación</span><span className="font-bold">{kpis.ocupacion.toFixed(1)}%</span></div>
                <div className="flex justify-between"><span>Certificados</span><span className="font-bold text-purple-700">{kpis.certificatesIssued}</span></div>
              </div>
            </Card>
          </div>

          {/* Cierre del evento */}
          {event.estado === 'finalizado' && (
            <Card>
              <h3 className="font-semibold text-gray-900 mb-4">📋 Cierre del Evento</h3>
              <div className="space-y-4">
                {event.informe_final && <div><span className="text-xs font-semibold text-gray-500 uppercase">Informe Final</span><p className="text-sm mt-1">{event.informe_final}</p></div>}
                {event.lecciones_aprendidas && <div><span className="text-xs font-semibold text-gray-500 uppercase">Lecciones Aprendidas</span><p className="text-sm mt-1">{event.lecciones_aprendidas}</p></div>}
                {event.recomendaciones && <div><span className="text-xs font-semibold text-gray-500 uppercase">Recomendaciones</span><p className="text-sm mt-1">{event.recomendaciones}</p></div>}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ============= MODALS ============= */}
      {/* Expense Detail Modal */}
      <Modal isOpen={!!showExpenseDetail} onClose={() => setShowExpenseDetail(null)} title="Detalle del Gasto" size="lg">
        {showExpenseDetail && (() => {
          const d = showExpenseDetail as any;
          const compLabel = d.comprobante === 'transferencia' ? 'Transferencia' : d.comprobante === 'tarjeta_credito' ? 'Tarjeta de crédito' : d.comprobante === 'efectivo' ? 'Efectivo' : null;
          return (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Categoría</p>
                  <p className="text-gray-900 font-medium">{d.categoria}</p>
                </div>
                <div className="bg-green-50 rounded-xl p-4">
                  <p className="text-xs font-semibold text-green-600 uppercase mb-1">Monto</p>
                  <p className="text-gray-900 font-bold text-lg">${Number(d.monto).toLocaleString()}</p>
                </div>
              </div>

              {d.descripcion && (
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Descripción</p>
                  <p className="text-gray-700">{d.descripcion}</p>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Proveedor</p>
                  <p className="text-gray-900 font-medium">{d.proveedor || '—'}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Fecha</p>
                  <p className="text-gray-900 font-medium">{d.fecha || '—'}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className={`rounded-xl p-4 ${d.estado === 'pagado' ? 'bg-green-50' : d.estado === 'aprobado' ? 'bg-blue-50' : d.estado === 'cancelado' ? 'bg-red-50' : 'bg-gray-50'}`}>
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Estado</p>
                  <span className={`text-sm px-3 py-1 rounded-full font-medium ${d.estado === 'pagado' ? 'bg-green-100 text-green-700' : d.estado === 'aprobado' ? 'bg-blue-100 text-blue-700' : d.estado === 'cancelado' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'}`}>{d.estado.charAt(0).toUpperCase() + d.estado.slice(1)}</span>
                </div>
                <div className="bg-indigo-50 rounded-xl p-4">
                  <p className="text-xs font-semibold text-indigo-600 uppercase mb-1">Comprobante de pago</p>
                  <p className="text-gray-900 font-medium">{compLabel || 'Sin comprobante'}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-1">N° de comprobante</p>
                  <p className="text-gray-900 font-medium">{d.num_comprobante || '—'}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-1">N° de factura</p>
                  <p className="text-gray-900 font-medium">{d.num_factura || '—'}</p>
                </div>
              </div>

              {d.notas && (
                <div className="bg-amber-50 rounded-xl p-4">
                  <p className="text-xs font-semibold text-amber-600 uppercase mb-1">Notas</p>
                  <p className="text-gray-700">{d.notas}</p>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button variant="secondary" onClick={() => { setShowExpenseDetail(null); openExpenseModal(showExpenseDetail); }}>
                  <Edit className="h-4 w-4 mr-1" /> Editar
                </Button>
                <Button variant="secondary" onClick={() => setShowExpenseDetail(null)}>Cerrar</Button>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* Expense Modal */}
      <Modal isOpen={showExpenseModal} onClose={() => setShowExpenseModal(false)} title={editingItem ? 'Editar Gasto' : 'Nuevo Gasto'}>
        <div className="space-y-4">
          <Input label="Categoría *" value={expenseForm.categoria} onChange={e => setExpenseForm(p => ({ ...p, categoria: e.target.value }))} placeholder="Ej: Salón, Catering, Material" />
          <Input label="Descripción" value={expenseForm.descripcion} onChange={e => setExpenseForm(p => ({ ...p, descripcion: e.target.value }))} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Monto ($) *" type="number" step="0.01" value={expenseForm.monto} onChange={e => setExpenseForm(p => ({ ...p, monto: e.target.value }))} />
            <Input label="Fecha" type="date" value={expenseForm.fecha} onChange={e => setExpenseForm(p => ({ ...p, fecha: e.target.value }))} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Proveedor" value={expenseForm.proveedor} onChange={e => setExpenseForm(p => ({ ...p, proveedor: e.target.value }))} />
            <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Estado</label><select value={expenseForm.estado} onChange={e => setExpenseForm(p => ({ ...p, estado: e.target.value as ExpenseStatus }))} className="w-full px-4 py-2.5 border rounded-xl bg-white"><option value="cotizado">Cotizado</option><option value="aprobado">Aprobado</option><option value="pagado">Pagado</option><option value="cancelado">Cancelado</option></select></div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Comprobante de pago</label>
            <select value={expenseForm.comprobante} onChange={e => setExpenseForm(p => ({ ...p, comprobante: e.target.value }))} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl bg-white focus:ring-2 focus:ring-indigo-500">
              <option value="">Sin comprobante</option>
              <option value="transferencia">Transferencia</option>
              <option value="tarjeta_credito">Tarjeta de crédito</option>
              <option value="efectivo">Efectivo</option>
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="N° de comprobante" value={expenseForm.num_comprobante} onChange={e => setExpenseForm(p => ({ ...p, num_comprobante: e.target.value }))} placeholder="Ej: 001-0012345" />
            <Input label="N° de factura" value={expenseForm.num_factura} onChange={e => setExpenseForm(p => ({ ...p, num_factura: e.target.value }))} placeholder="Ej: FAC-0001" />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t"><Button variant="secondary" onClick={() => setShowExpenseModal(false)}>Cancelar</Button><Button onClick={saveExpense}>Guardar</Button></div>
        </div>
      </Modal>

      {/* Activity Modal */}
      <Modal isOpen={showActivityModal} onClose={() => setShowActivityModal(false)} title={editingItem ? 'Editar Actividad' : 'Nueva Actividad'} size="lg">
        <div className="space-y-4">
          <Input label="Nombre *" value={activityForm.nombre} onChange={e => setActivityForm(p => ({ ...p, nombre: e.target.value }))} placeholder="Nombre de la actividad" />
          <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Descripción</label><textarea value={activityForm.descripcion} onChange={e => setActivityForm(p => ({ ...p, descripcion: e.target.value }))} rows={2} className="w-full px-4 py-2.5 border rounded-xl resize-none" /></div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Tipo</label><select value={activityForm.tipo} onChange={e => setActivityForm(p => ({ ...p, tipo: e.target.value as EventActivityType }))} className="w-full px-4 py-2.5 border rounded-xl bg-white"><option value="operativa">Operativa</option><option value="estrategica">Estratégica</option></select></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Prioridad</label><select value={activityForm.prioridad} onChange={e => setActivityForm(p => ({ ...p, prioridad: e.target.value }))} className="w-full px-4 py-2.5 border rounded-xl bg-white"><option value="alta">Alta</option><option value="media">Media</option><option value="baja">Baja</option></select></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Responsable *</label><select value={activityForm.responsable_id} onChange={e => setActivityForm(p => ({ ...p, responsable_id: e.target.value }))} className="w-full px-4 py-2.5 border rounded-xl bg-white"><option value="">Seleccionar...</option>{users.map(u => <option key={u.id} value={u.id}>{u.nombre_completo}</option>)}</select></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Fecha inicio *" type="datetime-local" value={activityForm.fecha_inicio} onChange={e => setActivityForm(p => ({ ...p, fecha_inicio: e.target.value }))} />
            <Input label="Fecha fin" type="datetime-local" value={activityForm.fecha_fin} onChange={e => setActivityForm(p => ({ ...p, fecha_fin: e.target.value }))} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Estado</label><select value={activityForm.estado} onChange={e => { const newEstado = e.target.value as EventActivityStatus; setActivityForm(p => ({ ...p, estado: newEstado, porcentaje_avance: newEstado === 'completada' ? 100 : p.porcentaje_avance })); }} className="w-full px-4 py-2.5 border rounded-xl bg-white"><option value="pendiente">Pendiente</option><option value="en_progreso">En Progreso</option><option value="bloqueada">Bloqueada</option><option value="completada">Completada</option><option value="cancelada">Cancelada</option></select></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Avance (%): {activityForm.porcentaje_avance}%</label><input type="range" min="0" max="100" step="5" value={activityForm.porcentaje_avance} onChange={e => setActivityForm(p => ({ ...p, porcentaje_avance: Number(e.target.value) }))} className="w-full mt-2" /></div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={activityForm.es_hito} onChange={e => setActivityForm(p => ({ ...p, es_hito: e.target.checked }))} className="rounded" /><span className="text-sm">Marcar como hito clave</span></label>
          <div className="flex justify-end gap-3 pt-4 border-t"><Button variant="secondary" onClick={() => setShowActivityModal(false)}>Cancelar</Button><Button onClick={saveActivity}>Guardar</Button></div>
        </div>
      </Modal>

      {/* Participant Modal */}
      <Modal isOpen={showParticipantModal} onClose={() => setShowParticipantModal(false)} title={editingItem ? 'Editar Participante' : 'Nuevo Participante'}>
        <div className="space-y-4">
          <Input label="Nombre *" value={participantForm.nombre} onChange={e => setParticipantForm(p => ({ ...p, nombre: e.target.value }))} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Email" type="email" value={participantForm.email} onChange={e => setParticipantForm(p => ({ ...p, email: e.target.value }))} />
            <Input label="Teléfono" value={participantForm.telefono} onChange={e => setParticipantForm(p => ({ ...p, telefono: e.target.value }))} />
          </div>
          <Input label="Empresa" value={participantForm.empresa} onChange={e => setParticipantForm(p => ({ ...p, empresa: e.target.value }))} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Inscripción</label><select value={participantForm.estado_inscripcion} onChange={e => setParticipantForm(p => ({ ...p, estado_inscripcion: e.target.value }))} className="w-full px-4 py-2.5 border rounded-xl bg-white"><option value="pre_inscrito">Pre-inscrito</option><option value="confirmado">Confirmado</option><option value="cancelado">Cancelado</option><option value="lista_espera">Lista de espera</option></select></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Pago</label><select value={participantForm.estado_pago} onChange={e => setParticipantForm(p => ({ ...p, estado_pago: e.target.value }))} className="w-full px-4 py-2.5 border rounded-xl bg-white"><option value="pendiente">Pendiente</option><option value="parcial">Parcial</option><option value="pagado">Pagado</option><option value="reembolsado">Reembolsado</option><option value="exento">Exento</option></select></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Monto pagado ($)" type="number" step="0.01" value={participantForm.monto_pagado} onChange={e => setParticipantForm(p => ({ ...p, monto_pagado: e.target.value }))} />
            {(event?.categorias_participantes || []).length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Categoría</label>
                <select value={participantForm.categoria} onChange={e => setParticipantForm(p => ({ ...p, categoria: e.target.value }))} className="w-full px-4 py-2.5 border rounded-xl bg-white">
                  <option value="">Sin categoría</option>
                  {(event?.categorias_participantes || []).map((cat: any) => (
                    <option key={cat.nombre} value={cat.nombre}>{cat.nombre}{cat.cupo ? ` (cupo: ${cat.cupo})` : ''}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t"><Button variant="secondary" onClick={() => setShowParticipantModal(false)}>Cancelar</Button><Button onClick={saveParticipant}>Guardar</Button></div>
        </div>
      </Modal>

      {/* Edit Event Modal */}
      <Modal isOpen={showEditEvent} onClose={() => setShowEditEvent(false)} title="Editar Evento" size="lg">
        <div className="space-y-5 max-h-[70vh] overflow-y-auto pr-1">
          {/* Info básica */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-gray-600 border-b pb-2">Información General</h4>
            <Input label="Nombre *" value={editEventForm.nombre || ''} onChange={e => setEditEventForm((p: any) => ({ ...p, nombre: e.target.value }))} />
            <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Descripción</label><textarea value={editEventForm.descripcion || ''} onChange={e => setEditEventForm((p: any) => ({ ...p, descripcion: e.target.value }))} rows={2} className="w-full px-4 py-2.5 border rounded-xl resize-none" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Objetivo</label><textarea value={editEventForm.objetivo || ''} onChange={e => setEditEventForm((p: any) => ({ ...p, objetivo: e.target.value }))} rows={2} className="w-full px-4 py-2.5 border rounded-xl resize-none" /></div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Tipo</label><select value={editEventForm.tipo || 'curso'} onChange={e => setEditEventForm((p: any) => ({ ...p, tipo: e.target.value }))} className="w-full px-4 py-2.5 border rounded-xl bg-white"><option value="curso">Curso</option><option value="taller">Taller</option><option value="conferencia">Conferencia</option><option value="evento_corporativo">Evento Corp.</option><option value="seminario">Seminario</option><option value="otro">Otro</option></select></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Modalidad</label><select value={editEventForm.modalidad || 'presencial'} onChange={e => setEditEventForm((p: any) => ({ ...p, modalidad: e.target.value }))} className="w-full px-4 py-2.5 border rounded-xl bg-white"><option value="presencial">Presencial</option><option value="virtual">Virtual</option><option value="hibrido">Híbrido</option></select></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Responsable</label><select value={editEventForm.responsable_id || ''} onChange={e => setEditEventForm((p: any) => ({ ...p, responsable_id: e.target.value }))} className="w-full px-4 py-2.5 border rounded-xl bg-white">{users.map(u => <option key={u.id} value={u.id}>{u.nombre_completo}</option>)}</select></div>
            </div>
          </div>

          {/* Marcas */}
          <div className="bg-amber-50 rounded-xl p-4 space-y-3">
            <h4 className="text-xs font-semibold text-amber-600 uppercase">🏷️ Marcas del Evento</h4>
            <div className="flex flex-wrap gap-2">
              {['Schwarzkopf', 'Hipertín', 'Keyra', 'Sutra', 'Myrialis', 'Sin Marca'].map(brand => {
                const selected = (editEventForm.marcas || []).includes(brand);
                return (
                  <button key={brand} type="button" onClick={() => setEditEventForm((p: any) => ({ ...p, marcas: selected ? (p.marcas || []).filter((b: string) => b !== brand) : [...(p.marcas || []), brand] }))} className={`text-sm px-3 py-1.5 rounded-full border transition-all ${selected ? 'bg-amber-200 text-amber-800 border-amber-400 font-semibold' : 'bg-white text-gray-500 border-gray-200 hover:border-amber-300'}`}>
                    {selected && <CheckCircle className="h-3.5 w-3.5 inline mr-1" />}{brand}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Fechas */}
          <div className="bg-blue-50 rounded-xl p-4 space-y-4">
            <h4 className="text-xs font-semibold text-blue-600 uppercase">Fechas y Ubicación</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="Fecha inicio *" type="datetime-local" value={editEventForm.fecha_inicio || ''} onChange={e => setEditEventForm((p: any) => ({ ...p, fecha_inicio: e.target.value }))} />
              <Input label="Fecha fin" type="datetime-local" value={editEventForm.fecha_fin || ''} onChange={e => setEditEventForm((p: any) => ({ ...p, fecha_fin: e.target.value }))} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="Ubicación" value={editEventForm.ubicacion || ''} onChange={e => setEditEventForm((p: any) => ({ ...p, ubicacion: e.target.value }))} />
              <Input label="Plataforma" value={editEventForm.plataforma || ''} onChange={e => setEditEventForm((p: any) => ({ ...p, plataforma: e.target.value }))} />
            </div>
          </div>

          {/* Presupuesto */}
          <div className="bg-green-50 rounded-xl p-4 space-y-4">
            <h4 className="text-xs font-semibold text-green-600 uppercase">Presupuesto y Costeo</h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <Input label="Presupuesto total ($)" type="number" step="0.01" value={editEventForm.presupuesto_total || ''} onChange={e => setEditEventForm((p: any) => ({ ...p, presupuesto_total: e.target.value }))} />
              <Input label="Margen objetivo (%)" type="number" step="0.01" value={editEventForm.margen_objetivo || ''} onChange={e => setEditEventForm((p: any) => ({ ...p, margen_objetivo: e.target.value }))} />
              <Input label="Costo fijo total ($)" type="number" step="0.01" value={editEventForm.costo_fijo_total || ''} onChange={e => setEditEventForm((p: any) => ({ ...p, costo_fijo_total: e.target.value }))} />
              <Input label="Costo var./persona ($)" type="number" step="0.01" value={editEventForm.costo_variable_por_persona || ''} onChange={e => setEditEventForm((p: any) => ({ ...p, costo_variable_por_persona: e.target.value }))} />
              <Input label="Precio por persona ($)" type="number" step="0.01" value={editEventForm.precio_por_persona || ''} onChange={e => setEditEventForm((p: any) => ({ ...p, precio_por_persona: e.target.value }))} />
            </div>
          </div>

          {/* Cupos */}
          <div className="bg-purple-50 rounded-xl p-4 space-y-4">
            <h4 className="text-xs font-semibold text-purple-600 uppercase">Cupos</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="Cupo mínimo" type="number" value={editEventForm.cupo_minimo || ''} onChange={e => setEditEventForm((p: any) => ({ ...p, cupo_minimo: e.target.value }))} />
              <Input label="Cupo máximo" type="number" value={editEventForm.cupo_maximo || ''} onChange={e => setEditEventForm((p: any) => ({ ...p, cupo_maximo: e.target.value }))} />
            </div>
          </div>

          {/* Categorías de Participantes */}
          <div className="bg-teal-50 rounded-xl p-4 space-y-4">
            <h4 className="text-xs font-semibold text-teal-600 uppercase">🏅 Categorías de Participantes</h4>
            <p className="text-xs text-teal-700">Define categorías (ej: Diamante, Gold, Silver) con cupo opcional y color.</p>
            <div className="space-y-3">
              {(editEventForm.categorias_participantes || []).map((cat: any, idx: number) => (
                <div key={idx} className="bg-white rounded-lg p-2 border border-teal-200 space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={cat.nombre}
                      onChange={e => {
                        const cats = [...editEventForm.categorias_participantes];
                        cats[idx] = { ...cats[idx], nombre: e.target.value };
                        setEditEventForm((p: any) => ({ ...p, categorias_participantes: cats }));
                      }}
                      placeholder="Nombre categoría"
                      className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-teal-500 min-w-0"
                    />
                    <input
                      type="number"
                      value={cat.cupo ?? ''}
                      onChange={e => {
                        const cats = [...editEventForm.categorias_participantes];
                        cats[idx] = { ...cats[idx], cupo: e.target.value ? Number(e.target.value) : null };
                        setEditEventForm((p: any) => ({ ...p, categorias_participantes: cats }));
                      }}
                      placeholder="Cupo"
                      className="w-20 px-3 py-1.5 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-teal-500"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const cats = editEventForm.categorias_participantes.filter((_: any, i: number) => i !== idx);
                        setEditEventForm((p: any) => ({ ...p, categorias_participantes: cats }));
                      }}
                      className="p-1.5 hover:bg-red-100 rounded-lg text-red-500 transition-colors flex-shrink-0"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="flex gap-1.5 flex-wrap">
                    {['#ef4444','#f97316','#eab308','#22c55e','#06b6d4','#3b82f6','#8b5cf6','#ec4899','#6b7280'].map(c => (
                      <button key={c} type="button" onClick={() => { const cats = [...editEventForm.categorias_participantes]; cats[idx] = { ...cats[idx], color: c }; setEditEventForm((p: any) => ({ ...p, categorias_participantes: cats })); }} className={`w-6 h-6 rounded-full border-2 transition-all ${cat.color === c ? 'border-gray-900 scale-110 ring-2 ring-offset-1 ring-gray-400' : 'border-transparent hover:border-gray-300'}`} style={{ backgroundColor: c }} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setEditEventForm((p: any) => ({ ...p, categorias_participantes: [...(p.categorias_participantes || []), { nombre: '', cupo: null, color: '#3b82f6' }] }))}
              className="text-sm text-teal-700 hover:text-teal-900 font-medium flex items-center gap-1"
            >
              <Plus className="h-4 w-4" /> Agregar categoría
            </button>
          </div>

          {/* Cierre (si finalizado) */}
          {event?.estado === 'finalizado' && (
            <div className="bg-amber-50 rounded-xl p-4 space-y-4">
              <h4 className="text-xs font-semibold text-amber-600 uppercase">Cierre del Evento</h4>
              <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Informe final</label><textarea value={editEventForm.informe_final || ''} onChange={e => setEditEventForm((p: any) => ({ ...p, informe_final: e.target.value }))} rows={3} className="w-full px-4 py-2.5 border rounded-xl resize-none" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Lecciones aprendidas</label><textarea value={editEventForm.lecciones_aprendidas || ''} onChange={e => setEditEventForm((p: any) => ({ ...p, lecciones_aprendidas: e.target.value }))} rows={2} className="w-full px-4 py-2.5 border rounded-xl resize-none" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Recomendaciones</label><textarea value={editEventForm.recomendaciones || ''} onChange={e => setEditEventForm((p: any) => ({ ...p, recomendaciones: e.target.value }))} rows={2} className="w-full px-4 py-2.5 border rounded-xl resize-none" /></div>
              <Input label="Satisfacción promedio (0-5)" type="number" step="0.1" min="0" max="5" value={editEventForm.satisfaccion_promedio || ''} onChange={e => setEditEventForm((p: any) => ({ ...p, satisfaccion_promedio: e.target.value }))} />
            </div>
          )}
        </div>
        <div className="flex justify-end gap-3 pt-5 border-t mt-4">
          <Button variant="secondary" onClick={() => setShowEditEvent(false)}>Cancelar</Button>
          <Button onClick={saveEditEvent} loading={savingEvent}><Save className="h-4 w-4 mr-1" />Guardar Cambios</Button>
        </div>
      </Modal>
    </div>
  );
}

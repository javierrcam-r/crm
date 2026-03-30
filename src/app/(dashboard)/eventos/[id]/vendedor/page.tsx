'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Calendar, Users, Target, CheckCircle, Clock,
  Plus, Trash2, Edit, AlertTriangle, DollarSign, X, Eye, QrCode, Download, FileText, Filter, Search
} from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { InvitationDownloadButton } from '@/components/events/InvitationPDF';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import { useAuth } from '@/contexts/AuthContext';
import { searchCustomers } from '@/lib/search';
import {
  getEvent, getEventActivities, getEventParticipants,
  createParticipant, updateParticipant, deleteParticipant,
  computeEventKPIs, getEventExpenses, getActiveUsers,
  type Event, type EventActivity, type EventParticipant,
} from '@/lib/services/events';
import { getCustomers, type Customer } from '@/lib/services/customers';
import { format, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';
import toast from 'react-hot-toast';

export default function VendorEventPage() {
  const params = useParams();
  const router = useRouter();
  const { userProfile } = useAuth();
  const eventId = params.id as string;

  const [event, setEvent] = useState<Event | null>(null);
  const [myActivities, setMyActivities] = useState<EventActivity[]>([]);
  const [allActivities, setAllActivities] = useState<EventActivity[]>([]);
  const [participants, setParticipants] = useState<EventParticipant[]>([]);
  const [myCustomers, setMyCustomers] = useState<Customer[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'resumen' | 'participantes' | 'actividades'>('resumen');

  // Participant form
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingParticipant, setEditingParticipant] = useState<EventParticipant | null>(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [partForm, setPartForm] = useState({ nombre: '', email: '', telefono: '', empresa: '', monto_pagado: '0', cupos_adicionales: '0', categoria: '', notas: '', estado_inscripcion: 'pre_inscrito', estado_pago: 'pendiente', numero_asiento: '' });
  const [qrParticipant, setQrParticipant] = useState<EventParticipant | null>(null);

  // Participant filters
  const [partSearch, setPartSearch] = useState('');
  const [filterCategoria, setFilterCategoria] = useState('');
  const [filterPago, setFilterPago] = useState('');
  const [filterInscripcion, setFilterInscripcion] = useState('');
  const [filterRegistradoPor, setFilterRegistradoPor] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    if (!userProfile) return;
    if (userProfile.rol === 'event_assistant') {
      setRedirecting(true);
      router.replace(`/eventos/${eventId}/asistencia`);
      return;
    }
    loadData();
  }, [eventId, userProfile]);

  const loadData = async () => {
    if (!userProfile) return;
    setLoading(true);
    try {
      const [ev, acts, parts, customers, usrs] = await Promise.all([
        getEvent(eventId),
        getEventActivities(eventId),
        getEventParticipants(eventId),
        getCustomers().catch(() => []),
        getActiveUsers().catch(() => []),
      ]);
      setEvent(ev);
      setAllActivities(acts);
      setMyActivities(acts.filter(a => a.responsable_id === userProfile.id));
      setParticipants(parts);
      setMyCustomers(customers);
      setAllUsers(usrs);
    } catch (e) { console.error(e); toast.error('Error cargando evento'); }
    finally { setLoading(false); }
  };

  const getUserName = (id: string) => allUsers.find((u: any) => u.id === id)?.nombre_completo || 'Desconocido';
  const isMyParticipant = (p: EventParticipant) => p.registered_by === userProfile?.id;
  const getCatColor = (catName: string | null) => {
    if (!catName || !event) return null;
    const cat = (event.categorias_participantes || []).find((c: any) => c.nombre === catName);
    return cat?.color || null;
  };
  const myParticipants = participants.filter(p => isMyParticipant(p));
  const othersParticipants = participants.filter(p => !isMyParticipant(p));

  const uniqueCategories = useMemo(() => [...new Set(participants.map(p => p.categoria).filter(Boolean))] as string[], [participants]);
  const uniqueRegistrants = useMemo(() => {
    const ids = [...new Set(participants.map(p => p.registered_by).filter(Boolean))] as string[];
    return ids.map(id => ({ id, name: getUserName(id) }));
  }, [participants, allUsers]);

  const filteredParticipants = useMemo(() => {
    return participants.filter(p => {
      if (partSearch) {
        const q = partSearch.toLowerCase();
        const match = (p.nombre || '').toLowerCase().includes(q)
          || (p.email || '').toLowerCase().includes(q)
          || (p.telefono || '').toLowerCase().includes(q)
          || (p.empresa || '').toLowerCase().includes(q);
        if (!match) return false;
      }
      if (filterCategoria && p.categoria !== filterCategoria) return false;
      if (filterPago && p.estado_pago !== filterPago) return false;
      if (filterInscripcion && p.estado_inscripcion !== filterInscripcion) return false;
      if (filterRegistradoPor && p.registered_by !== filterRegistradoPor) return false;
      return true;
    });
  }, [participants, partSearch, filterCategoria, filterPago, filterInscripcion, filterRegistradoPor]);

  const hasActiveFilters = !!(partSearch || filterCategoria || filterPago || filterInscripcion || filterRegistradoPor);
  const clearAllFilters = () => { setPartSearch(''); setFilterCategoria(''); setFilterPago(''); setFilterInscripcion(''); setFilterRegistradoPor(''); };

  const filteredCustomers = customerSearch.trim()
    ? searchCustomers(myCustomers, customerSearch)
    : myCustomers.slice(0, 10);

  const selectCustomerForRegistration = (customer: Customer) => {
    setSelectedCustomer(customer);
    setPartForm({
      nombre: customer.nombre,
      email: customer.email || '',
      telefono: customer.telefono || '',
      empresa: '',
      monto_pagado: event?.precio_por_persona ? String(event.precio_por_persona) : '0',
      cupos_adicionales: '0',
      categoria: '',
      notas: '',
      estado_inscripcion: 'pre_inscrito',
      estado_pago: event?.precio_por_persona ? 'pagado' : 'pendiente',
      numero_asiento: '',
    });
    setCustomerSearch('');
  };

  const handleAddParticipant = async () => {
    if (!partForm.nombre) { toast.error('Nombre requerido'); return; }
    const seat = partForm.numero_asiento.trim();
    if (seat) {
      const dup = participants.find(p => p.numero_asiento === seat);
      if (dup) { toast.error(`El asiento "${seat}" ya está asignado a ${dup.nombre}`); return; }
    }
    try {
      await createParticipant({
        event_id: eventId,
        nombre: partForm.nombre,
        email: partForm.email || null,
        telefono: partForm.telefono || null,
        empresa: partForm.empresa || null,
        estado_inscripcion: partForm.estado_inscripcion,
        estado_pago: partForm.estado_pago,
        monto_pagado: Number(partForm.monto_pagado) || 0,
        cupos_adicionales: Number(partForm.cupos_adicionales) || 0,
        categoria: partForm.categoria || null,
        registered_by: userProfile?.id,
        notas: partForm.notas || null,
        numero_asiento: seat || null,
      } as any);
      toast.success('Participante registrado');
      setShowAddModal(false);
      setSelectedCustomer(null);
      setPartForm({ nombre: '', email: '', telefono: '', empresa: '', monto_pagado: '0', cupos_adicionales: '0', categoria: '', notas: '', estado_inscripcion: 'pre_inscrito', estado_pago: 'pendiente', numero_asiento: '' });
      const parts = await getEventParticipants(eventId);
      setParticipants(parts);
    } catch (err: any) { toast.error(err?.message || 'Error al registrar'); }
  };

  const openEditParticipant = (p: EventParticipant) => {
    setEditingParticipant(p);
    setPartForm({
      nombre: p.nombre,
      email: p.email || '',
      telefono: p.telefono || '',
      empresa: p.empresa || '',
      monto_pagado: String(p.monto_pagado || 0),
      cupos_adicionales: String((p as any).cupos_adicionales || 0),
      categoria: p.categoria || '',
      notas: p.notas || '',
      estado_inscripcion: p.estado_inscripcion || 'pre_inscrito',
      estado_pago: p.estado_pago || 'pendiente',
      numero_asiento: p.numero_asiento || '',
    });
    setShowEditModal(true);
  };

  const handleEditParticipant = async () => {
    if (!editingParticipant) return;
    const seat = partForm.numero_asiento.trim();
    if (seat) {
      const dup = participants.find(p => p.numero_asiento === seat && p.id !== editingParticipant.id);
      if (dup) { toast.error(`El asiento "${seat}" ya está asignado a ${dup.nombre}`); return; }
    }
    try {
      await updateParticipant(editingParticipant.id, {
        nombre: partForm.nombre,
        email: partForm.email || null,
        telefono: partForm.telefono || null,
        empresa: partForm.empresa || null,
        monto_pagado: Number(partForm.monto_pagado) || 0,
        estado_inscripcion: partForm.estado_inscripcion,
        estado_pago: partForm.estado_pago,
        cupos_adicionales: Number(partForm.cupos_adicionales) || 0,
        categoria: partForm.categoria || null,
        notas: partForm.notas || null,
        numero_asiento: seat || null,
      } as any);
      toast.success('Participante actualizado');
      setShowEditModal(false);
      setEditingParticipant(null);
      const parts = await getEventParticipants(eventId);
      setParticipants(parts);
    } catch { toast.error('Error al actualizar'); }
  };

  const handleRemoveParticipant = async (id: string) => {
    if (!confirm('¿Eliminar este participante?')) return;
    try { await deleteParticipant(id); setParticipants(participants.filter(p => p.id !== id)); toast.success('Eliminado'); }
    catch { toast.error('Error'); }
  };

  const downloadQR = (participantName: string) => {
    const canvas = document.querySelector('#qr-canvas canvas') as HTMLCanvasElement | null;
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `QR-${participantName.replace(/\s+/g, '_')}.png`;
    a.click();
  };

  if (redirecting || loading || !event) return <div className="flex items-center justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" /></div>;

  // Gantt for my activities
  const ganttStart = myActivities.length > 0 ? new Date(Math.min(...myActivities.map(a => new Date(a.fecha_inicio).getTime()))) : new Date();
  const ganttEnd = myActivities.length > 0 ? new Date(Math.max(...myActivities.map(a => new Date(a.fecha_fin || a.fecha_inicio).getTime()))) : new Date();
  const ganttDays = Math.max(differenceInDays(ganttEnd, ganttStart) + 1, 1);

  const totalCuposAdicionales = myParticipants.reduce((s, p) => s + ((p as any).cupos_adicionales || 0), 0);
  const totalRecaudado = myParticipants.reduce((s, p) => s + Number(p.monto_pagado), 0);

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Link href="/eventos"><Button variant="ghost" size="sm" icon={<ArrowLeft className="h-4 w-4" />}>Eventos</Button></Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{event.nombre}</h1>
          <div className="flex items-center gap-2 mt-1 flex-wrap text-sm text-gray-500">
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${event.estado === 'en_ejecucion' ? 'bg-amber-100 text-amber-700' : event.estado === 'finalizado' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
              {event.estado === 'en_ejecucion' ? 'En Ejecución' : event.estado.charAt(0).toUpperCase() + event.estado.slice(1)}
            </span>
            <span>{format(new Date(event.fecha_inicio), "d MMM yyyy", { locale: es })}{event.fecha_fin ? ` → ${format(new Date(event.fecha_fin), "d MMM yyyy", { locale: es })}` : ''}</span>
            {event.ubicacion && <span>📍 {event.ubicacion}</span>}
          </div>
          {event.objetivo && <p className="text-sm text-gray-600 mt-2">{event.objetivo}</p>}
        </div>
      </div>

      {/* My Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="bg-blue-50 border border-blue-200"><div className="p-3">
          <p className="text-[10px] text-blue-600 font-semibold uppercase">Mis Inscritos</p>
          <p className="text-xl font-bold">{myParticipants.length}</p>
        </div></Card>
        <Card className="bg-green-50 border border-green-200"><div className="p-3">
          <p className="text-[10px] text-green-600 font-semibold uppercase">Recaudado</p>
          <p className="text-xl font-bold">${totalRecaudado.toLocaleString()}</p>
        </div></Card>
        <Card className="bg-purple-50 border border-purple-200"><div className="p-3">
          <p className="text-[10px] text-purple-600 font-semibold uppercase">Cupos Adicionales</p>
          <p className="text-xl font-bold">{totalCuposAdicionales}</p>
        </div></Card>
        <Card className="bg-amber-50 border border-amber-200"><div className="p-3">
          <p className="text-[10px] text-amber-600 font-semibold uppercase">Mis Actividades</p>
          <p className="text-xl font-bold">{myActivities.filter(a => a.estado === 'completada').length}/{myActivities.length}</p>
        </div></Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 overflow-x-auto">
        {[
          { id: 'resumen' as const, label: 'Resumen', icon: Eye },
          { id: 'participantes' as const, label: 'Participantes', icon: Users, count: participants.length },
          { id: 'actividades' as const, label: 'Mis Actividades', icon: Target, count: myActivities.length },
        ].map(t => {
          const Icon = t.icon;
          return (
            <button key={t.id} onClick={() => setTab(t.id)} className={`flex items-center gap-1.5 px-3 sm:px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap flex-1 justify-center ${tab === t.id ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>
              <Icon className="h-4 w-4 flex-shrink-0" /> <span className="hidden sm:inline">{t.label}</span><span className="sm:hidden">{t.label === 'Mis Actividades' ? 'Actividades' : t.label}</span>
              {t.count !== undefined && <span className={`text-xs px-1.5 py-0.5 rounded-full ${tab === t.id ? 'bg-indigo-100' : 'bg-gray-200'}`}>{t.count}</span>}
            </button>
          );
        })}
      </div>

      {/* TAB: RESUMEN */}
      {tab === 'resumen' && (
        <div className="space-y-4">
          <Card>
            <h3 className="font-semibold text-gray-900 mb-3">Información del Evento</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-gray-500">Tipo:</span> <span className="font-medium">{event.tipo}</span></div>
              <div><span className="text-gray-500">Modalidad:</span> <span className="font-medium">{event.modalidad}</span></div>
              <div><span className="text-gray-500">Precio por persona:</span> <span className="font-bold text-green-700">${Number(event.precio_por_persona).toLocaleString()}</span></div>
              <div><span className="text-gray-500">Cupo máximo:</span> <span className="font-medium">{event.cupo_maximo || '∞'}</span></div>
              {event.plataforma && <div><span className="text-gray-500">Plataforma:</span> <span className="font-medium">{event.plataforma}</span></div>}
            </div>
          </Card>

          {event.descripcion && (
            <Card>
              <h3 className="font-semibold text-gray-900 mb-2">Descripción</h3>
              <p className="text-sm text-gray-700">{event.descripcion}</p>
            </Card>
          )}
        </div>
      )}

      {/* TAB: PARTICIPANTES */}
      {tab === 'participantes' && (
        <div className="space-y-4">
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
                          <span className="text-xs text-gray-400">{catParticipants.length} inscritos</span>
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
              </div>
            </Card>
          )}

          <div className="flex flex-col gap-3">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-gray-900 dark:text-white">
                Todos los Participantes ({hasActiveFilters ? `${filteredParticipants.length}/${participants.length}` : participants.length})
              </h3>
              <div className="flex gap-2">
                <Button size="sm" variant={showFilters ? 'primary' : 'secondary'} onClick={() => setShowFilters(!showFilters)}>
                  <Filter className="h-3.5 w-3.5 mr-1" />{showFilters ? 'Ocultar' : 'Filtros'}
                  {hasActiveFilters && <span className="ml-1 w-4 h-4 rounded-full bg-indigo-500 text-white text-[10px] flex items-center justify-center">!</span>}
                </Button>
                <Button size="sm" onClick={() => { setShowAddModal(true); setSelectedCustomer(null); setPartForm({ nombre: '', email: '', telefono: '', empresa: '', monto_pagado: event?.precio_por_persona ? String(event.precio_por_persona) : '0', cupos_adicionales: '0', categoria: '', notas: '', estado_inscripcion: 'pre_inscrito', estado_pago: 'pendiente', numero_asiento: '' }); }}>
                  <Plus className="h-4 w-4 mr-1" />Inscribir
                </Button>
              </div>
            </div>

            {showFilters && (
              <Card className="!p-3">
                <div className="flex flex-col gap-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                    <input type="text" value={partSearch} onChange={e => setPartSearch(e.target.value)} placeholder="Buscar por nombre, email, teléfono, empresa..."
                      className="w-full pl-9 pr-3 py-2 border border-gray-200 dark:border-dark-500 rounded-lg text-sm bg-white dark:bg-dark-600 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <select value={filterCategoria} onChange={e => setFilterCategoria(e.target.value)} className="px-2.5 py-1.5 border border-gray-200 dark:border-dark-500 rounded-lg text-xs bg-white dark:bg-dark-600 text-gray-700 dark:text-gray-200">
                      <option value="">Categoría: Todas</option>
                      {uniqueCategories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <select value={filterPago} onChange={e => setFilterPago(e.target.value)} className="px-2.5 py-1.5 border border-gray-200 dark:border-dark-500 rounded-lg text-xs bg-white dark:bg-dark-600 text-gray-700 dark:text-gray-200">
                      <option value="">Pago: Todos</option>
                      <option value="pendiente">Pendiente</option>
                      <option value="parcial">Parcial</option>
                      <option value="pagado">Pagado</option>
                      <option value="reembolsado">Reembolsado</option>
                      <option value="exento">Exento</option>
                    </select>
                    <select value={filterInscripcion} onChange={e => setFilterInscripcion(e.target.value)} className="px-2.5 py-1.5 border border-gray-200 dark:border-dark-500 rounded-lg text-xs bg-white dark:bg-dark-600 text-gray-700 dark:text-gray-200">
                      <option value="">Inscripción: Todas</option>
                      <option value="pre_inscrito">Pre-inscrito</option>
                      <option value="confirmado">Confirmado</option>
                      <option value="lista_espera">Lista espera</option>
                      <option value="cancelado">Cancelado</option>
                    </select>
                    <select value={filterRegistradoPor} onChange={e => setFilterRegistradoPor(e.target.value)} className="px-2.5 py-1.5 border border-gray-200 dark:border-dark-500 rounded-lg text-xs bg-white dark:bg-dark-600 text-gray-700 dark:text-gray-200">
                      <option value="">Registrado por: Todos</option>
                      {uniqueRegistrants.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                  </div>
                  {hasActiveFilters && (
                    <div className="flex justify-end">
                      <button onClick={clearAllFilters} className="text-xs text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 font-medium flex items-center gap-1">
                        <X className="h-3 w-3" /> Limpiar filtros
                      </button>
                    </div>
                  )}
                </div>
              </Card>
            )}
          </div>

          {/* Mobile card layout */}
          <div className="md:hidden space-y-2">
            {filteredParticipants.length === 0 ? (
              <Card><p className="text-center py-4 text-gray-500 text-sm">{hasActiveFilters ? 'Sin resultados para estos filtros' : 'Sin participantes aún'}</p></Card>
            ) : filteredParticipants.map(p => {
              const isMine = isMyParticipant(p);
              return (
                <Card key={p.id} className={isMine ? 'border-indigo-200 bg-indigo-50/20' : ''} padding="none">
                  <div className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate">{p.nombre}</p>
                        <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                          {p.numero_asiento && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-semibold">Asiento {p.numero_asiento}</span>}
                          {p.categoria && <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium text-white" style={{ backgroundColor: getCatColor(p.categoria) || '#0d9488' }}>{p.categoria}</span>}
                          {isMine && <span className="text-[10px] text-indigo-600 font-medium">Mi inscrito</span>}
                          {p.empresa && <span className="text-[10px] text-gray-400">{p.empresa}</span>}
                        </div>
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        <button onClick={() => setQrParticipant(p)} className="p-1.5 hover:bg-indigo-50 rounded-lg" title="Ver QR"><QrCode className="h-3.5 w-3.5 text-indigo-500" /></button>
                        {event && (
                          <InvitationDownloadButton participant={p} event={event} getCatColor={getCatColor} baseUrl={typeof window !== 'undefined' ? window.location.origin : ''} className="p-1.5 hover:bg-purple-50 rounded-lg">
                            <FileText className="h-3.5 w-3.5 text-purple-500" />
                          </InvitationDownloadButton>
                        )}
                        {isMine && (
                          <>
                            <button onClick={() => openEditParticipant(p)} className="p-1.5 hover:bg-gray-100 rounded-lg"><Edit className="h-3.5 w-3.5 text-gray-500" /></button>
                            <button onClick={() => handleRemoveParticipant(p.id)} className="p-1.5 hover:bg-red-50 rounded-lg"><Trash2 className="h-3.5 w-3.5 text-red-500" /></button>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${p.estado_inscripcion === 'confirmado' ? 'bg-green-100 text-green-700' : p.estado_inscripcion === 'cancelado' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'}`}>{p.estado_inscripcion.replace('_', ' ')}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${p.estado_pago === 'pagado' ? 'bg-green-100 text-green-700' : p.estado_pago === 'parcial' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-700'}`}>{p.estado_pago}</span>
                      <span className="text-xs font-semibold ml-auto">${Number(p.monto_pagado).toLocaleString()}</span>
                    </div>
                    {p.registered_by && <p className="text-[10px] text-gray-400 mt-1">Por: {getUserName(p.registered_by)}</p>}
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Desktop table */}
          <Card padding="none" className="hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="bg-gray-50 border-b">
                  <th className="text-center px-4 py-3 w-16">Asiento</th>
                  <th className="text-left px-4 py-3">Nombre</th>
                  <th className="text-left px-4 py-3">Contacto</th>
                  <th className="text-center px-4 py-3">Inscripción</th>
                  <th className="text-center px-4 py-3">Pago</th>
                  <th className="text-right px-4 py-3">Pagado</th>
                  <th className="text-left px-4 py-3 hidden lg:table-cell">Registrado por</th>
                  <th className="text-center px-4 py-3 w-20">Acción</th>
                </tr></thead>
                <tbody className="divide-y">
                  {filteredParticipants.length === 0 ? (
                    <tr><td colSpan={8} className="text-center py-8 text-gray-500">{hasActiveFilters ? 'Sin resultados para estos filtros' : 'Sin participantes aún'}</td></tr>
                  ) : filteredParticipants.map(p => {
                    const isMine = isMyParticipant(p);
                    return (
                      <tr key={p.id} className={`hover:bg-gray-50 ${isMine ? 'bg-indigo-50/30' : ''}`}>
                        <td className="px-4 py-3 text-center">{p.numero_asiento ? <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-1 rounded-lg">{p.numero_asiento}</span> : <span className="text-gray-300">—</span>}</td>
                        <td className="px-4 py-3">
                          <p className="font-medium">{p.nombre}</p>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {p.empresa && <span className="text-xs text-gray-500">{p.empresa}</span>}
                            {p.categoria && <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium text-white" style={{ backgroundColor: getCatColor(p.categoria) || '#0d9488' }}>{p.categoria}</span>}
                            {isMine && <span className="text-[10px] text-indigo-600 font-medium">Mi inscrito</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-600">{p.email || p.telefono || '—'}</td>
                        <td className="px-4 py-3 text-center"><span className={`text-xs px-2 py-0.5 rounded-full ${p.estado_inscripcion === 'confirmado' ? 'bg-green-100 text-green-700' : p.estado_inscripcion === 'cancelado' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'}`}>{p.estado_inscripcion.replace('_', ' ')}</span></td>
                        <td className="px-4 py-3 text-center"><span className={`text-xs px-2 py-0.5 rounded-full ${p.estado_pago === 'pagado' ? 'bg-green-100 text-green-700' : p.estado_pago === 'parcial' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-700'}`}>{p.estado_pago}</span></td>
                        <td className="px-4 py-3 text-right font-semibold">${Number(p.monto_pagado).toLocaleString()}</td>
                        <td className="px-4 py-3 hidden lg:table-cell text-xs text-gray-500">{p.registered_by ? getUserName(p.registered_by) : <span className="text-gray-300">—</span>}</td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex gap-1 justify-center">
                            <button onClick={() => setQrParticipant(p)} className="p-1 hover:bg-indigo-50 rounded" title="Ver QR"><QrCode className="h-3.5 w-3.5 text-indigo-500" /></button>
                            {event && (
                              <InvitationDownloadButton participant={p} event={event} getCatColor={getCatColor} baseUrl={typeof window !== 'undefined' ? window.location.origin : ''} className="p-1 hover:bg-purple-50 rounded">
                                <FileText className="h-3.5 w-3.5 text-purple-500" />
                              </InvitationDownloadButton>
                            )}
                            {isMine && (
                              <>
                                <button onClick={() => openEditParticipant(p)} className="p-1 hover:bg-gray-100 rounded"><Edit className="h-3.5 w-3.5 text-gray-500" /></button>
                                <button onClick={() => handleRemoveParticipant(p.id)} className="p-1 hover:bg-red-50 rounded"><Trash2 className="h-3.5 w-3.5 text-red-500" /></button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* TAB: ACTIVIDADES + GANTT */}
      {tab === 'actividades' && (
        <div className="space-y-4">
          <h3 className="font-semibold text-gray-900">Mis Actividades ({myActivities.length})</h3>

          {myActivities.length > 0 && (
            <Card>
              <h4 className="text-sm font-semibold text-gray-600 mb-3">📊 Mi Timeline</h4>
              <div className="overflow-x-auto">
                <div className="min-w-[400px]">
                  {myActivities.map(a => {
                    const start = new Date(a.fecha_inicio);
                    const end = a.fecha_fin ? new Date(a.fecha_fin) : start;
                    const left = Math.max(0, (differenceInDays(start, ganttStart) / ganttDays) * 100);
                    const width = Math.max(3, ((differenceInDays(end, start) + 1) / ganttDays) * 100);
                    const isOverdue = a.estado !== 'completada' && a.estado !== 'cancelada' && a.fecha_fin && new Date(a.fecha_fin) < new Date();
                    const barColor = a.estado === 'completada' ? 'bg-green-400' : a.estado === 'bloqueada' ? 'bg-red-400' : isOverdue ? 'bg-orange-400' : a.tipo === 'estrategica' ? 'bg-purple-400' : 'bg-blue-400';
                    return (
                      <div key={a.id} className="flex items-center gap-3 py-2 group">
                        <div className="w-40 flex-shrink-0 text-xs truncate text-gray-700 font-medium">{a.es_hito ? '🔹 ' : ''}{a.nombre}</div>
                        <div className="flex-1 relative h-7 bg-gray-100 rounded">
                          <div className={`absolute h-7 rounded ${barColor} transition-all opacity-80 group-hover:opacity-100`} style={{ left: `${left}%`, width: `${width}%` }}>
                            <span className="text-[10px] text-white font-medium px-1.5 leading-7 truncate block">{a.estado === 'completada' ? '100' : a.porcentaje_avance}%</span>
                          </div>
                        </div>
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

          <Card padding="none">
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="bg-gray-50 border-b">
                <th className="text-left px-4 py-3">Actividad</th>
                <th className="text-left px-4 py-3 hidden md:table-cell">Fechas</th>
                <th className="text-center px-4 py-3">Avance</th>
                <th className="text-center px-4 py-3">Estado</th>
              </tr></thead>
              <tbody className="divide-y">
                {myActivities.length === 0 ? (
                  <tr><td colSpan={4} className="text-center py-8 text-gray-500">No tienes actividades asignadas en este evento</td></tr>
                ) : myActivities.map(a => {
                  const isOverdue = a.estado !== 'completada' && a.estado !== 'cancelada' && a.fecha_fin && new Date(a.fecha_fin) < new Date();
                  return (
                    <tr key={a.id} className={`hover:bg-gray-50 ${isOverdue ? 'bg-red-50/50' : ''}`}>
                      <td className="px-4 py-3">
                        <p className="font-medium">{a.es_hito ? '🔹 ' : ''}{a.nombre}</p>
                        <p className="text-xs text-gray-500">{a.tipo === 'estrategica' ? '⭐ Estratégica' : 'Operativa'} • {a.prioridad} {isOverdue && <span className="text-red-600 font-medium">• RETRASADA</span>}</p>
                        {a.descripcion && <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{a.descripcion}</p>}
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell text-xs text-gray-600">
                        {format(new Date(a.fecha_inicio), 'd MMM', { locale: es })}
                        {a.fecha_fin && ` → ${format(new Date(a.fecha_fin), 'd MMM', { locale: es })}`}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="w-16 mx-auto bg-gray-200 rounded-full h-2"><div className="h-2 rounded-full bg-indigo-500" style={{ width: `${a.estado === 'completada' ? 100 : a.porcentaje_avance}%` }} /></div>
                        <span className="text-xs text-gray-500">{a.estado === 'completada' ? 100 : a.porcentaje_avance}%</span>
                      </td>
                      <td className="px-4 py-3 text-center"><span className={`text-xs px-2 py-0.5 rounded-full ${a.estado === 'completada' ? 'bg-green-100 text-green-700' : a.estado === 'en_progreso' ? 'bg-blue-100 text-blue-700' : a.estado === 'bloqueada' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'}`}>{a.estado.replace('_', ' ')}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          </Card>
        </div>
      )}

      {/* ADD PARTICIPANT MODAL */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Inscribir Cliente al Evento" size="lg">
        <div className="space-y-4">
          {!selectedCustomer ? (
            <>
              <p className="text-sm text-gray-600">Busca un cliente de tu cartera para inscribirlo:</p>
              <div className="relative">
                <Input placeholder="Buscar cliente por nombre o teléfono..." value={customerSearch} onChange={e => setCustomerSearch(e.target.value)} />
              </div>
              <div className="max-h-48 overflow-y-auto space-y-1 border rounded-xl">
                {filteredCustomers.map(c => (
                  <button key={c.id} onClick={() => selectCustomerForRegistration(c)} className="w-full text-left p-3 hover:bg-indigo-50 transition-colors border-b last:border-b-0">
                    <p className="font-medium text-sm">{c.nombre}</p>
                    <p className="text-xs text-gray-500">{[c.telefono, c.ciudad].filter(Boolean).join(' • ')}</p>
                  </button>
                ))}
                {filteredCustomers.length === 0 && <p className="text-center py-4 text-gray-500 text-sm">No se encontraron clientes</p>}
              </div>
              <div className="border-t pt-3">
                <p className="text-xs text-gray-500 mb-2">¿No está en tu cartera? Ingresa manualmente:</p>
                <Button variant="secondary" size="sm" onClick={() => setSelectedCustomer({ id: 'manual', nombre: '' } as any)}>Registro Manual</Button>
              </div>
            </>
          ) : (
            <>
              {selectedCustomer.id !== 'manual' && (
                <div className="bg-indigo-50 rounded-xl p-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm text-indigo-800">{selectedCustomer.nombre}</p>
                    <p className="text-xs text-indigo-600">{selectedCustomer.telefono} {selectedCustomer.email && `• ${selectedCustomer.email}`}</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedCustomer(null)}>Cambiar</Button>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input label="Nombre *" value={partForm.nombre} onChange={e => setPartForm(p => ({ ...p, nombre: e.target.value }))} />
                <Input label="Email" value={partForm.email} onChange={e => setPartForm(p => ({ ...p, email: e.target.value }))} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input label="Teléfono" value={partForm.telefono} onChange={e => setPartForm(p => ({ ...p, telefono: e.target.value }))} />
                <Input label="Empresa" value={partForm.empresa} onChange={e => setPartForm(p => ({ ...p, empresa: e.target.value }))} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Input label="Monto pagado ($)" type="number" step="0.01" value={partForm.monto_pagado} onChange={e => setPartForm(p => ({ ...p, monto_pagado: e.target.value }))} />
                <Input label="Cupos adicionales" type="number" value={partForm.cupos_adicionales} onChange={e => setPartForm(p => ({ ...p, cupos_adicionales: e.target.value }))} />
                <Input label="N° Asiento" value={partForm.numero_asiento} onChange={e => setPartForm(p => ({ ...p, numero_asiento: e.target.value }))} placeholder="Ej: A1, 12" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Estado inscripción</label>
                  <select value={partForm.estado_inscripcion} onChange={e => setPartForm(p => ({ ...p, estado_inscripcion: e.target.value }))} className="w-full px-4 py-2.5 border rounded-xl bg-white">
                    <option value="pre_inscrito">Pre-inscrito</option>
                    <option value="confirmado">Confirmado</option>
                    <option value="lista_espera">Lista de espera</option>
                    <option value="cancelado">Cancelado</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Estado pago</label>
                  <select value={partForm.estado_pago} onChange={e => setPartForm(p => ({ ...p, estado_pago: e.target.value }))} className="w-full px-4 py-2.5 border rounded-xl bg-white">
                    <option value="pendiente">Pendiente</option>
                    <option value="parcial">Parcial</option>
                    <option value="pagado">Pagado</option>
                    <option value="reembolsado">Reembolsado</option>
                    <option value="exento">Exento</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Categoría</label>
                <select value={partForm.categoria} onChange={e => setPartForm(p => ({ ...p, categoria: e.target.value }))} className="w-full px-4 py-2.5 border rounded-xl bg-white">
                  <option value="">Sin categoría</option>
                  {(event?.categorias_participantes || []).map((cat: any) => (
                    <option key={cat.nombre} value={cat.nombre}>{cat.nombre}{cat.cupo ? ` (cupo: ${cat.cupo})` : ''}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Notas</label>
                <textarea value={partForm.notas} onChange={e => setPartForm(p => ({ ...p, notas: e.target.value }))} rows={2} className="w-full px-4 py-2.5 border rounded-xl resize-none text-sm" placeholder="Observaciones..." />
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button variant="secondary" onClick={() => setShowAddModal(false)}>Cancelar</Button>
                <Button onClick={handleAddParticipant}>Inscribir</Button>
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* EDIT PARTICIPANT MODAL */}
      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="Editar Participante">
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Nombre *" value={partForm.nombre} onChange={e => setPartForm(p => ({ ...p, nombre: e.target.value }))} />
            <Input label="Email" value={partForm.email} onChange={e => setPartForm(p => ({ ...p, email: e.target.value }))} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Teléfono" value={partForm.telefono} onChange={e => setPartForm(p => ({ ...p, telefono: e.target.value }))} />
            <Input label="Empresa" value={partForm.empresa} onChange={e => setPartForm(p => ({ ...p, empresa: e.target.value }))} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input label="Monto pagado ($)" type="number" step="0.01" value={partForm.monto_pagado} onChange={e => setPartForm(p => ({ ...p, monto_pagado: e.target.value }))} />
            <Input label="Cupos adicionales" type="number" value={partForm.cupos_adicionales} onChange={e => setPartForm(p => ({ ...p, cupos_adicionales: e.target.value }))} />
            <Input label="N° Asiento" value={partForm.numero_asiento} onChange={e => setPartForm(p => ({ ...p, numero_asiento: e.target.value }))} placeholder="Ej: A1, 12" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Estado inscripción</label>
              <select value={partForm.estado_inscripcion} onChange={e => setPartForm(p => ({ ...p, estado_inscripcion: e.target.value }))} className="w-full px-4 py-2.5 border rounded-xl bg-white">
                <option value="pre_inscrito">Pre-inscrito</option>
                <option value="confirmado">Confirmado</option>
                <option value="lista_espera">Lista de espera</option>
                <option value="cancelado">Cancelado</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Estado pago</label>
              <select value={partForm.estado_pago} onChange={e => setPartForm(p => ({ ...p, estado_pago: e.target.value }))} className="w-full px-4 py-2.5 border rounded-xl bg-white">
                <option value="pendiente">Pendiente</option>
                <option value="parcial">Parcial</option>
                <option value="pagado">Pagado</option>
                <option value="reembolsado">Reembolsado</option>
                <option value="exento">Exento</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Categoría</label>
            <select value={partForm.categoria} onChange={e => setPartForm(p => ({ ...p, categoria: e.target.value }))} className="w-full px-4 py-2.5 border rounded-xl bg-white">
              <option value="">Sin categoría</option>
              {(event?.categorias_participantes || []).map((cat: any) => (
                <option key={cat.nombre} value={cat.nombre}>{cat.nombre}{cat.cupo ? ` (cupo: ${cat.cupo})` : ''}</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="secondary" onClick={() => setShowEditModal(false)}>Cancelar</Button>
            <Button onClick={handleEditParticipant}>Guardar</Button>
          </div>
        </div>
      </Modal>

      {/* QR Modal */}
      <Modal isOpen={!!qrParticipant} onClose={() => setQrParticipant(null)} title="QR del Participante">
        {qrParticipant && (
          <div className="flex flex-col items-center space-y-4">
            <div className="text-center">
              <p className="font-semibold text-lg text-gray-900">{qrParticipant.nombre}</p>
              {qrParticipant.numero_asiento && <p className="text-sm font-bold text-indigo-600">Asiento {qrParticipant.numero_asiento}</p>}
              <div className="flex items-center justify-center gap-2 mt-1">
                {qrParticipant.categoria && (
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium text-white" style={{ backgroundColor: getCatColor(qrParticipant.categoria) || '#0d9488' }}>
                    {qrParticipant.categoria}
                  </span>
                )}
                <span className={`text-xs px-2 py-0.5 rounded-full ${qrParticipant.estado_inscripcion === 'confirmado' ? 'bg-green-100 text-green-700' : qrParticipant.estado_inscripcion === 'cancelado' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'}`}>
                  {qrParticipant.estado_inscripcion.replace('_', ' ')}
                </span>
              </div>
            </div>
            <div id="qr-canvas" className="bg-white p-4 rounded-2xl shadow-inner border">
              <QRCodeCanvas
                value={`${typeof window !== 'undefined' ? window.location.origin : ''}/eventos/${eventId}/checkin/${qrParticipant.id}`}
                size={240}
                level="H"
                imageSettings={{
                  src: '/logo-disfero.png',
                  x: undefined,
                  y: undefined,
                  height: 48,
                  width: 48,
                  excavate: true,
                }}
              />
            </div>
            <div className="flex gap-2 w-full">
              <Button onClick={() => downloadQR(qrParticipant.nombre)} variant="secondary" className="flex-1">
                <Download className="h-4 w-4 mr-1" /> QR
              </Button>
              {event && (
                <InvitationDownloadButton
                  participant={qrParticipant}
                  event={event}
                  getCatColor={getCatColor}
                  baseUrl={typeof window !== 'undefined' ? window.location.origin : ''}
                  className="flex-1 inline-flex items-center justify-center gap-1 px-4 py-2.5 bg-indigo-500 text-white rounded-xl font-medium text-sm hover:bg-indigo-600 transition-colors"
                >
                  <FileText className="h-4 w-4" /> Invitación PDF
                </InvitationDownloadButton>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

import { getSupabaseClient } from '@/lib/supabase/client';
import { getCurrentUserProfile } from '@/lib/auth/getCurrentUserId';

// =====================================================
// TYPES
// =====================================================
export type EventType = 'curso' | 'taller' | 'conferencia' | 'evento_corporativo' | 'seminario' | 'otro';
export type EventModality = 'presencial' | 'virtual' | 'hibrido';
export type EventStatus = 'planeado' | 'en_ejecucion' | 'finalizado' | 'cancelado';
export type ExpenseStatus = 'cotizado' | 'aprobado' | 'pagado' | 'cancelado';
export type EventActivityStatus = 'pendiente' | 'en_progreso' | 'bloqueada' | 'completada' | 'cancelada';
export type EventActivityType = 'operativa' | 'estrategica';
export type InscriptionStatus = 'pre_inscrito' | 'confirmado' | 'cancelado' | 'lista_espera';
export type PaymentStatus = 'pendiente' | 'parcial' | 'pagado' | 'reembolsado' | 'exento';

export interface Event {
  id: string;
  nombre: string;
  descripcion: string | null;
  tipo: EventType;
  modalidad: EventModality;
  estado: EventStatus;
  fecha_inicio: string;
  fecha_fin: string | null;
  ubicacion: string | null;
  plataforma: string | null;
  objetivo: string | null;
  marcas: string[];
  responsable_id: string;
  presupuesto_total: number;
  margen_objetivo: number;
  costo_fijo_total: number;
  costo_variable_por_persona: number;
  cupo_minimo: number;
  cupo_maximo: number;
  precio_por_persona: number;
  informe_final: string | null;
  lecciones_aprendidas: string | null;
  recomendaciones: string | null;
  satisfaccion_promedio: number | null;
  categorias_participantes: EventParticipantCategory[];
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface EventParticipantCategory {
  nombre: string;
  cupo: number | null;
  color: string | null;
}

export interface EventExpense {
  id: string;
  event_id: string;
  categoria: string;
  descripcion: string | null;
  proveedor: string | null;
  monto: number;
  fecha: string | null;
  estado: ExpenseStatus;
  comprobante_url: string | null;
  notas: string | null;
  created_at: string;
}

export interface EventActivity {
  id: string;
  event_id: string;
  nombre: string;
  descripcion: string | null;
  tipo: EventActivityType;
  responsable_id: string;
  fecha_inicio: string;
  fecha_fin: string | null;
  dependencia_id: string | null;
  prioridad: string;
  estado: EventActivityStatus;
  porcentaje_avance: number;
  es_hito: boolean;
  notas: string | null;
  created_at: string;
}

export interface EventParticipant {
  id: string;
  event_id: string;
  nombre: string;
  email: string | null;
  telefono: string | null;
  empresa: string | null;
  estado_inscripcion: InscriptionStatus;
  estado_pago: PaymentStatus;
  monto_pagado: number;
  asistencia: boolean;
  certificado_emitido: boolean;
  cupos_adicionales: number;
  categoria: string | null;
  registered_by: string | null;
  notas: string | null;
  numero_asiento: string | null;
  created_at: string;
}

export interface EventProvider {
  id: string;
  nombre: string;
  tipo_servicio: string | null;
  contacto_nombre: string | null;
  contacto_email: string | null;
  contacto_telefono: string | null;
  direccion: string | null;
  notas: string | null;
  activo: boolean;
  created_at: string;
}

// =====================================================
// EVENTS CRUD
// =====================================================
export async function getEvents() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .order('fecha_inicio', { ascending: false });
  if (error) throw error;
  return data as Event[];
}

export async function getEvent(id: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data as Event;
}

/** Fecha en la que el evento debe aparecer en el calendario (fin del evento, o inicio si no hay fin). */
export function getEventCalendarDate(event: Pick<Event, 'fecha_inicio' | 'fecha_fin'>): string {
  return event.fecha_fin || event.fecha_inicio;
}

export async function getEventsForCalendar(
  dateFrom: string,
  dateTo: string,
  options?: { userProfileId?: string; isSupervisor?: boolean },
): Promise<Event[]> {
  const supabase = getSupabaseClient();
  const fromMs = new Date(dateFrom).getTime();
  const toMs = new Date(dateTo).getTime();

  const inRange = (event: Event) => {
    const ms = new Date(getEventCalendarDate(event)).getTime();
    return ms >= fromMs && ms <= toMs;
  };

  // La fecha que se muestra en el calendario es `fecha_fin` o, si es nula, `fecha_inicio`.
  // Acotamos la consulta en la BD a ese rango para no descargar todo el histórico.
  const calendarDateFilter =
    `and(fecha_fin.gte.${dateFrom},fecha_fin.lte.${dateTo}),` +
    `and(fecha_fin.is.null,fecha_inicio.gte.${dateFrom},fecha_inicio.lte.${dateTo})`;

  if (options?.isSupervisor) {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .neq('estado', 'cancelado')
      .or(calendarDateFilter)
      .order('fecha_inicio');
    if (error) throw error;
    return (data as Event[]).filter(inRange);
  }

  const userProfileId = options?.userProfileId;
  if (!userProfileId) return [];

  const [vendorEvents, editorEvents, responsableRes] = await Promise.all([
    getVendorEvents(userProfileId).catch(() => [] as Event[]),
    getEditorEvents(userProfileId).catch(() => [] as Event[]),
    supabase
      .from('events')
      .select('*')
      .eq('responsable_id', userProfileId)
      .neq('estado', 'cancelado')
      .or(calendarDateFilter),
  ]);

  if (responsableRes.error) throw responsableRes.error;

  const byId = new Map<string, Event>();
  for (const e of [...vendorEvents, ...editorEvents, ...((responsableRes.data || []) as Event[])]) {
    byId.set(e.id, e);
  }
  return Array.from(byId.values()).filter(inRange);
}

export async function createEvent(event: Partial<Event>) {
  const supabase = getSupabaseClient();
  const profile = getCurrentUserProfile();
  const { data, error } = await supabase
    .from('events')
    .insert({ ...event, created_by: profile?.id })
    .select()
    .single();
  if (error) throw error;
  return data as Event;
}

export async function updateEvent(id: string, event: Partial<Event>) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('events')
    .update({ ...event, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as Event;
}

export async function deleteEvent(id: string) {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('events').delete().eq('id', id);
  if (error) throw error;
}

// =====================================================
// EXPENSES CRUD
// =====================================================
export async function getEventExpenses(eventId: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('event_expenses')
    .select('*')
    .eq('event_id', eventId)
    .order('fecha', { ascending: false });
  if (error) throw error;
  return data as EventExpense[];
}

export async function createExpense(expense: Partial<EventExpense>) {
  const supabase = getSupabaseClient();
  const profile = getCurrentUserProfile();
  const { data, error } = await supabase
    .from('event_expenses')
    .insert({ ...expense, created_by: profile?.id })
    .select()
    .single();
  if (error) throw error;
  return data as EventExpense;
}

export async function updateExpense(id: string, expense: Partial<EventExpense>) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('event_expenses')
    .update(expense)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as EventExpense;
}

export async function deleteExpense(id: string) {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('event_expenses').delete().eq('id', id);
  if (error) throw error;
}

// =====================================================
// ACTIVITIES CRUD
// =====================================================
export async function getEventActivities(eventId: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('event_activities')
    .select('*')
    .eq('event_id', eventId)
    .order('fecha_inicio');
  if (error) throw error;
  return data as EventActivity[];
}

export async function getUserEventActivities(userId: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('event_activities')
    .select('*, events:event_id(nombre, fecha_inicio, fecha_fin, estado)')
    .eq('responsable_id', userId)
    .neq('estado', 'completada')
    .neq('estado', 'cancelada')
    .order('fecha_inicio');
  if (error) throw error;
  return data || [];
}

export async function getAllEventActivitiesForCalendar(
  userId?: string,
  assignedEventIds?: string[],
  range?: { dateFrom: string; dateTo: string },
) {
  const supabase = getSupabaseClient();

  // Acota la consulta al rango visible del calendario (por fecha de inicio o fin de la actividad).
  const rangeOr = range
    ? `and(fecha_inicio.gte.${range.dateFrom},fecha_inicio.lte.${range.dateTo}),` +
        `and(fecha_fin.gte.${range.dateFrom},fecha_fin.lte.${range.dateTo})`
    : null;

  if (!userId) {
    let q = supabase
      .from('event_activities')
      .select('*, events:event_id(id, nombre, estado)');
    if (rangeOr) q = q.or(rangeOr);
    const { data, error } = await q.order('fecha_inicio');
    if (error) throw error;
    return (data || []) as (EventActivity & { events: { id: string; nombre: string; estado: string } | null })[];
  }

  const results: (EventActivity & { events: { id: string; nombre: string; estado: string } | null })[] = [];
  const seen = new Set<string>();

  let ownQuery = supabase
    .from('event_activities')
    .select('*, events:event_id(id, nombre, estado)')
    .eq('responsable_id', userId);
  if (rangeOr) ownQuery = ownQuery.or(rangeOr);
  const { data: ownData, error: ownErr } = await ownQuery.order('fecha_inicio');
  if (ownErr) throw ownErr;
  for (const item of (ownData || [])) {
    if (!seen.has(item.id)) { seen.add(item.id); results.push(item); }
  }

  if (assignedEventIds && assignedEventIds.length > 0) {
    let assignedQuery = supabase
      .from('event_activities')
      .select('*, events:event_id(id, nombre, estado)')
      .in('event_id', assignedEventIds);
    if (rangeOr) assignedQuery = assignedQuery.or(rangeOr);
    const { data: assignedData, error: assignedErr } = await assignedQuery.order('fecha_inicio');
    if (assignedErr) throw assignedErr;
    for (const item of (assignedData || [])) {
      if (!seen.has(item.id)) { seen.add(item.id); results.push(item); }
    }
  }

  results.sort((a, b) => new Date(a.fecha_inicio).getTime() - new Date(b.fecha_inicio).getTime());
  return results;
}

export async function createEventActivity(activity: Partial<EventActivity>) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('event_activities')
    .insert(activity)
    .select()
    .single();
  if (error) throw error;
  return data as EventActivity;
}

export async function updateEventActivity(id: string, activity: Partial<EventActivity>) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('event_activities')
    .update({ ...activity, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as EventActivity;
}

export async function deleteEventActivity(id: string) {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('event_activities').delete().eq('id', id);
  if (error) throw error;
}

// =====================================================
// PARTICIPANTS CRUD
// =====================================================
export async function getEventParticipants(eventId: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('event_participants')
    .select('*')
    .eq('event_id', eventId)
    .order('nombre');
  if (error) throw error;
  return data as EventParticipant[];
}

export async function createParticipant(participant: Partial<EventParticipant>) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('event_participants')
    .insert(participant)
    .select()
    .single();
  if (error) throw error;
  return data as EventParticipant;
}

export async function updateParticipant(id: string, participant: Partial<EventParticipant>) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('event_participants')
    .update(participant)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as EventParticipant;
}

export async function deleteParticipant(id: string) {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('event_participants').delete().eq('id', id);
  if (error) throw error;
}

export async function bulkCreateParticipants(participants: Partial<EventParticipant>[]) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('event_participants')
    .insert(participants)
    .select();
  if (error) throw error;
  return data as EventParticipant[];
}

// =====================================================
// PROVIDERS CRUD
// =====================================================
export async function getProviders() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('event_providers')
    .select('*')
    .eq('activo', true)
    .order('nombre');
  if (error) throw error;
  return data as EventProvider[];
}

export async function createProvider(provider: Partial<EventProvider>) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('event_providers')
    .insert(provider)
    .select()
    .single();
  if (error) throw error;
  return data as EventProvider;
}

export async function updateProvider(id: string, provider: Partial<EventProvider>) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('event_providers')
    .update(provider)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as EventProvider;
}

// =====================================================
// BULK DATA FOR DASHBOARD
// =====================================================
export async function getAllEventExpenses() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('event_expenses')
    .select('*')
    .order('fecha');
  if (error) throw error;
  return data as EventExpense[];
}

export async function getAllEventParticipants() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('event_participants')
    .select('*')
    .order('created_at');
  if (error) throw error;
  return data as EventParticipant[];
}

// =====================================================
// KPIs - Computed from data
// =====================================================
export function computeEventKPIs(event: Event, expenses: EventExpense[], activities: EventActivity[], participants: EventParticipant[]) {
  const totalGastos = expenses.reduce((sum, e) => sum + (e.estado !== 'cancelado' ? Number(e.monto) : 0), 0);
  const gastosPagados = expenses.filter(e => e.estado === 'pagado').reduce((sum, e) => sum + Number(e.monto), 0);
  const gastosAprobados = expenses.filter(e => e.estado === 'aprobado' || e.estado === 'pagado').reduce((sum, e) => sum + Number(e.monto), 0);

  const totalActivities = activities.length;
  const completedActivities = activities.filter(a => a.estado === 'completada').length;
  const blockedActivities = activities.filter(a => a.estado === 'bloqueada').length;
  const overdueActivities = activities.filter(a => {
    if (a.estado === 'completada' || a.estado === 'cancelada') return false;
    return a.fecha_fin && new Date(a.fecha_fin) < new Date();
  }).length;

  const totalParticipants = participants.length;
  const confirmed = participants.filter(p => p.estado_inscripcion === 'confirmado').length;
  const attended = participants.filter(p => p.asistencia).length;
  const totalPaid = participants.reduce((sum, p) => sum + Number(p.monto_pagado), 0);
  const certificatesIssued = participants.filter(p => p.certificado_emitido).length;

  const ingresosEstimados = confirmed * Number(event.precio_por_persona);
  const ingresosReales = totalPaid;
  const costoTotalEstimado = Number(event.costo_fijo_total) + (confirmed * Number(event.costo_variable_por_persona));
  const costoRealPorPersona = confirmed > 0 ? totalGastos / confirmed : 0;
  const utilidadEstimada = ingresosEstimados - costoTotalEstimado;
  const utilidadReal = ingresosReales - totalGastos;
  const puntoEquilibrio = Number(event.precio_por_persona) > Number(event.costo_variable_por_persona)
    ? Math.ceil(Number(event.costo_fijo_total) / (Number(event.precio_por_persona) - Number(event.costo_variable_por_persona)))
    : 0;

  return {
    // Budget
    presupuestoTotal: Number(event.presupuesto_total),
    totalGastos,
    gastosPagados,
    gastosAprobados,
    presupuestoEjecutado: Number(event.presupuesto_total) > 0 ? (totalGastos / Number(event.presupuesto_total)) * 100 : 0,
    desvio: totalGastos - Number(event.presupuesto_total),
    sobreEjecucion: totalGastos > Number(event.presupuesto_total),

    // Activities
    totalActivities,
    completedActivities,
    blockedActivities,
    overdueActivities,
    cumplimientoActividades: totalActivities > 0 ? (completedActivities / totalActivities) * 100 : 0,
    avancePromedio: totalActivities > 0 ? activities.reduce((sum, a) => sum + (a.estado === 'completada' ? 100 : a.porcentaje_avance), 0) / totalActivities : 0,

    // Participants
    totalParticipants,
    confirmed,
    attended,
    certificatesIssued,
    asistencia: confirmed > 0 ? (attended / confirmed) * 100 : 0,
    ocupacion: Number(event.cupo_maximo) > 0 ? (confirmed / Number(event.cupo_maximo)) * 100 : 0,

    // Financial
    ingresosEstimados,
    ingresosReales,
    costoTotalEstimado,
    costoRealPorPersona,
    utilidadEstimada,
    utilidadReal,
    puntoEquilibrio,
    rentabilidad: ingresosReales > 0 ? ((utilidadReal / ingresosReales) * 100) : 0,

    satisfaccion: Number(event.satisfaccion_promedio) || 0,
  };
}

// =====================================================
// VENDOR-EVENT ASSIGNMENTS
// =====================================================
export async function getEventVendors(eventId: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('event_vendor_assignments')
    .select('vendor_id')
    .eq('event_id', eventId);
  if (error) throw error;
  return (data || []).map((d: any) => d.vendor_id as string);
}

export async function setEventVendors(eventId: string, vendorIds: string[]) {
  const supabase = getSupabaseClient();
  await supabase.from('event_vendor_assignments').delete().eq('event_id', eventId);
  if (vendorIds.length > 0) {
    const rows = vendorIds.map(vid => ({ event_id: eventId, vendor_id: vid }));
    const { error } = await supabase.from('event_vendor_assignments').insert(rows);
    if (error) throw error;
  }
}

export async function getVendorEvents(vendorId: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('event_vendor_assignments')
    .select('event_id')
    .eq('vendor_id', vendorId);
  if (error) throw error;
  const eventIds = (data || []).map((d: any) => d.event_id);
  if (eventIds.length === 0) return [];
  const { data: events, error: evErr } = await supabase
    .from('events')
    .select('*')
    .in('id', eventIds)
    .neq('estado', 'cancelado')
    .order('fecha_inicio', { ascending: false });
  if (evErr) throw evErr;
  return events as Event[];
}

// =====================================================
// EVENT EDITORS (edición completa, cualquier rol)
// =====================================================
export async function getEventEditors(eventId: string): Promise<string[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('event_editors')
    .select('user_profile_id')
    .eq('event_id', eventId);
  if (error) throw error;
  return (data || []).map((d: { user_profile_id: string }) => d.user_profile_id);
}

export async function setEventEditors(
  eventId: string,
  userIds: string[],
  assignedBy?: string,
) {
  const supabase = getSupabaseClient();
  await supabase.from('event_editors').delete().eq('event_id', eventId);
  if (userIds.length > 0) {
    const rows = userIds.map(user_profile_id => ({
      event_id: eventId,
      user_profile_id,
      assigned_by: assignedBy || null,
    }));
    const { error } = await supabase.from('event_editors').insert(rows);
    if (error) throw error;
  }
}

export async function isUserEventEditor(
  eventId: string,
  userProfileId: string,
): Promise<boolean> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('event_editors')
    .select('id')
    .eq('event_id', eventId)
    .eq('user_profile_id', userProfileId)
    .maybeSingle();
  if (error) throw error;
  return !!data;
}

export async function getEditorEvents(userProfileId: string): Promise<Event[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('event_editors')
    .select('event_id')
    .eq('user_profile_id', userProfileId);
  if (error) throw error;
  const eventIds = (data || []).map((d: { event_id: string }) => d.event_id);
  if (eventIds.length === 0) return [];
  const { data: events, error: evErr } = await supabase
    .from('events')
    .select('*')
    .in('id', eventIds)
    .neq('estado', 'cancelado')
    .order('fecha_inicio', { ascending: false });
  if (evErr) throw evErr;
  return events as Event[];
}

// =====================================================
// VENUE LAYOUTS
// =====================================================
export type VenueElementType =
  | 'stage'
  | 'round_table'
  | 'rect_table'
  | 'seat_block'
  | 'booth'
  | 'area'
  | 'label';

export interface VenueElement {
  id: string;
  type: VenueElementType;
  label: string;
  x: number;          // meters from origin
  y: number;          // meters from origin
  w: number;          // width in meters
  h: number;          // height in meters
  rotation: number;   // degrees
  color: string;
  seats?: number;     // round_table: count around perimeter; rect_table: per long side
  rows?: number;      // seat_block rows
  cols?: number;      // seat_block columns per row
  seatPrefix?: string;
  groupId?: string;
  locked?: boolean;
}

export interface VenueLayout {
  elements: VenueElement[];
}

export interface EventVenueLayout {
  id: string;
  event_id: string;
  nombre: string;
  layout: VenueLayout;
  created_at: string;
  updated_at: string;
}

export interface SeatAssignment {
  seatId: string;
  participantId: string;
}

export async function getEventVenueLayout(eventId: string): Promise<EventVenueLayout | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('event_venue_layouts')
    .select('*')
    .eq('event_id', eventId)
    .maybeSingle();
  if (error) throw error;
  return data as EventVenueLayout | null;
}

export async function upsertEventVenueLayout(
  eventId: string,
  layout: VenueLayout,
  nombre: string = 'Principal',
): Promise<EventVenueLayout> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('event_venue_layouts')
    .upsert({ event_id: eventId, layout, nombre }, { onConflict: 'event_id' })
    .select()
    .single();
  if (error) throw error;
  return data as EventVenueLayout;
}

export async function assignSeatToParticipant(
  participantId: string,
  seatNumber: string | null,
): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('event_participants')
    .update({ numero_asiento: seatNumber })
    .eq('id', participantId);
  if (error) throw error;
}

export async function bulkAssignSeats(
  assignments: { participantId: string; seatNumber: string | null }[],
): Promise<void> {
  const supabase = getSupabaseClient();
  for (const a of assignments) {
    const { error } = await supabase
      .from('event_participants')
      .update({ numero_asiento: a.seatNumber })
      .eq('id', a.participantId);
    if (error) throw error;
  }
}

// =====================================================
// USERS for selection
// =====================================================
export async function getActiveUsers() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('users_profile')
    .select('id, user_id, nombre_completo, email, rol')
    .eq('activo', true)
    .order('nombre_completo');
  if (error) throw error;
  return data || [];
}

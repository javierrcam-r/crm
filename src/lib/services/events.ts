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
  created_by: string | null;
  created_at: string;
  updated_at: string;
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
  registered_by: string | null;
  notas: string | null;
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

export async function getAllEventActivitiesForCalendar(userId?: string) {
  const supabase = getSupabaseClient();
  const query = supabase
    .from('event_activities')
    .select('*, events:event_id(id, nombre, estado)')
    .order('fecha_inicio');
  
  if (userId) {
    query.eq('responsable_id', userId);
  }
  
  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as (EventActivity & { events: { id: string; nombre: string; estado: string } | null })[];
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

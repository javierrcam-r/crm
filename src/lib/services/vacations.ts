import { getSupabaseClient } from '@/lib/supabase/client';
import { getCurrentUserProfile } from '@/lib/auth/getCurrentUserId';
import type { VacationRequest, VacationRequestInsert, VacationRequestStatus } from '@/types/database';

/**
 * Obtiene las solicitudes de vacaciones del usuario actual.
 */
export async function getMyVacationRequests(): Promise<VacationRequest[]> {
  const profile = getCurrentUserProfile();
  if (!profile?.id) return [];
  return getVacationRequestsByUser(profile.id);
}

/**
 * Obtiene las solicitudes de un usuario específico.
 */
export async function getVacationRequestsByUser(userProfileId: string): Promise<VacationRequest[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('vacation_requests')
    .select('*')
    .eq('user_profile_id', userProfileId)
    .order('fecha_inicio', { ascending: false });

  if (error) throw error;
  return (data ?? []) as VacationRequest[];
}

/**
 * Obtiene todas las solicitudes pendientes (para supervisores).
 */
export async function getPendingVacationRequests(): Promise<VacationRequest[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('vacation_requests')
    .select('*')
    .eq('estado', 'pendiente')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as VacationRequest[];
}

/**
 * Obtiene todas las vacaciones (para calendario de supervisores).
 * Opcionalmente filtrar por estado y rango de fechas.
 */
export async function getAllVacationRequests(filters?: {
  estado?: VacationRequestStatus;
  dateFrom?: string;
  dateTo?: string;
  userProfileId?: string;
}): Promise<VacationRequest[]> {
  const supabase = getSupabaseClient();
  let query = supabase
    .from('vacation_requests')
    .select('*')
    .order('fecha_inicio', { ascending: true });

  if (filters?.estado) query = query.eq('estado', filters.estado);
  if (filters?.userProfileId) query = query.eq('user_profile_id', filters.userProfileId);
  if (filters?.dateFrom) query = query.gte('fecha_fin', filters.dateFrom);
  if (filters?.dateTo) query = query.lte('fecha_inicio', filters.dateTo);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as VacationRequest[];
}

/**
 * Solicitar vacaciones.
 */
export async function createVacationRequest(input: VacationRequestInsert): Promise<VacationRequest> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('vacation_requests')
    .insert({
      user_profile_id: input.user_profile_id,
      fecha_inicio: input.fecha_inicio,
      fecha_fin: input.fecha_fin,
      motivo: input.motivo ?? null,
      estado: 'pendiente',
    })
    .select('*')
    .single();

  if (error) throw error;
  return data as VacationRequest;
}

/**
 * Aprobar una solicitud de vacaciones. Solo supervisores.
 */
export async function approveVacationRequest(id: string, aprobadoPorId: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('vacation_requests')
    .update({
      estado: 'aprobado',
      aprobado_por: aprobadoPorId,
      aprobado_at: new Date().toISOString(),
      rechazo_motivo: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) throw error;
}

/**
 * Rechazar una solicitud de vacaciones. Solo supervisores.
 */
export async function rejectVacationRequest(id: string, aprobadoPorId: string, motivo?: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('vacation_requests')
    .update({
      estado: 'rechazado',
      aprobado_por: aprobadoPorId,
      aprobado_at: new Date().toISOString(),
      rechazo_motivo: motivo ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) throw error;
}

/**
 * Cancelar/eliminar una solicitud pendiente (solo el propio usuario).
 */
export async function cancelVacationRequest(id: string, userProfileId: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('vacation_requests')
    .delete()
    .eq('id', id)
    .eq('user_profile_id', userProfileId)
    .eq('estado', 'pendiente');

  if (error) throw error;
}

/**
 * Obtiene todas las solicitudes del equipo (para supervisores).
 */
export async function getTeamVacationRequests(): Promise<VacationRequest[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('vacation_requests')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as VacationRequest[];
}

export interface VacationRequestUpdate {
  fecha_inicio: string;
  fecha_fin: string;
  motivo?: string | null;
}

/**
 * Actualizar una solicitud. Al editar, vuelve a estado pendiente (por revisar).
 * Puede editar: el solicitante (su propia) o supervisores (cualquiera).
 */
export async function updateVacationRequest(id: string, input: VacationRequestUpdate): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('vacation_requests')
    .update({
      fecha_inicio: input.fecha_inicio,
      fecha_fin: input.fecha_fin,
      motivo: input.motivo ?? null,
      estado: 'pendiente',
      aprobado_por: null,
      aprobado_at: null,
      rechazo_motivo: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) throw error;
}

/**
 * Eliminar una solicitud. El solicitante puede eliminar la suya; supervisores pueden eliminar cualquiera.
 */
export async function deleteVacationRequest(id: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('vacation_requests').delete().eq('id', id);
  if (error) throw error;
}

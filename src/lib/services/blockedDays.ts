import { getSupabaseClient } from '@/lib/supabase/client';
import { getCurrentUserId } from '@/lib/auth/getCurrentUserId';
import type { CalendarBlockedDay, CalendarBlockedDayInsert } from '@/types/database';

/**
 * Obtiene los días bloqueados en un rango de fechas (para calendario y validaciones).
 */
export async function getBlockedDays(dateFrom: string, dateTo: string): Promise<CalendarBlockedDay[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('calendar_blocked_days')
    .select('*')
    .gte('fecha', dateFrom)
    .lte('fecha', dateTo)
    .order('fecha', { ascending: true });

  if (error) throw error;
  return (data ?? []) as CalendarBlockedDay[];
}

/**
 * Verifica si una fecha (Date o string YYYY-MM-DD) está bloqueada.
 */
export async function isDateBlocked(date: Date | string): Promise<boolean> {
  const d = typeof date === 'string' ? date : date.toISOString().slice(0, 10);
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('calendar_blocked_days')
    .select('id')
    .eq('fecha', d)
    .maybeSingle();

  if (error) throw error;
  return data != null;
}

/**
 * Crea un día bloqueado. Solo supervisores/admin.
 */
export async function createBlockedDay(input: CalendarBlockedDayInsert): Promise<CalendarBlockedDay> {
  const supabase = getSupabaseClient();
  const userId = getCurrentUserId();
  const { data, error } = await supabase
    .from('calendar_blocked_days')
    .insert({
      fecha: input.fecha,
      motivo: input.motivo ?? null,
      created_by_user_id: input.created_by_user_id ?? userId ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return data as CalendarBlockedDay;
}

/**
 * Elimina un día bloqueado. Solo supervisores/admin.
 */
export async function deleteBlockedDay(id: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('calendar_blocked_days').delete().eq('id', id);
  if (error) throw error;
}

/**
 * Lista todos los días bloqueados (p. ej. para la página de gestión).
 * Opcionalmente con filtro de rango.
 */
export async function getAllBlockedDays(dateFrom?: string, dateTo?: string): Promise<CalendarBlockedDay[]> {
  const supabase = getSupabaseClient();
  let query = supabase.from('calendar_blocked_days').select('*').order('fecha', { ascending: false });
  if (dateFrom) query = query.gte('fecha', dateFrom);
  if (dateTo) query = query.lte('fecha', dateTo);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as CalendarBlockedDay[];
}

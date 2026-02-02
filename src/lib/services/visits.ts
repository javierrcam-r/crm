import { getSupabaseClient } from '@/lib/supabase/client';
import type { Visit, VisitInsert, VisitUpdate, VisitFilters } from '@/types/database';
import { getCurrentUserId, isCurrentUserAdmin } from '@/lib/auth/getCurrentUserId';

export async function getVisits(filters?: VisitFilters) {
  const supabase = getSupabaseClient();
  const userId = getCurrentUserId();
  const isAdmin = isCurrentUserAdmin();
  
  let query = supabase
    .from('visits')
    .select(`
      *,
      customer:customers(id, nombre, telefono, direccion, zona, ciudad, latitud, longitud)
    `)
    .is('deleted_at', null)
    .order('scheduled_at', { ascending: true });

  // Filtrar por usuario (excepto admin que ve todo)
  if (!isAdmin && userId) {
    query = query.eq('user_id', userId);
  }

  if (filters?.status) {
    query = query.eq('status', filters.status);
  }
  if (filters?.customer_id) {
    query = query.eq('customer_id', filters.customer_id);
  }
  if (filters?.date_from) {
    query = query.gte('scheduled_at', filters.date_from);
  }
  if (filters?.date_to) {
    query = query.lte('scheduled_at', filters.date_to);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as Visit[];
}

export async function getVisit(id: string) {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('visits')
    .select(`
      *,
      customer:customers(*)
    `)
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (error) throw error;
  return data as Visit;
}

export async function getTodayVisits() {
  const supabase = getSupabaseClient();
  const userId = getCurrentUserId();
  const isAdmin = isCurrentUserAdmin();
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  let query = supabase
    .from('visits')
    .select(`
      *,
      customer:customers(id, nombre, telefono, direccion, zona, ciudad, latitud, longitud)
    `)
    .is('deleted_at', null)
    .gte('scheduled_at', today.toISOString())
    .lt('scheduled_at', tomorrow.toISOString())
    .order('scheduled_at');

  if (!isAdmin && userId) {
    query = query.eq('user_id', userId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as Visit[];
}

export async function getPendingVisits() {
  const supabase = getSupabaseClient();
  const userId = getCurrentUserId();
  const isAdmin = isCurrentUserAdmin();
  const now = new Date().toISOString();

  let query = supabase
    .from('visits')
    .select(`
      *,
      customer:customers(id, nombre, telefono, direccion, zona, ciudad, latitud, longitud)
    `)
    .is('deleted_at', null)
    .eq('status', 'programada')
    .lt('scheduled_at', now)
    .order('scheduled_at');

  if (!isAdmin && userId) {
    query = query.eq('user_id', userId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as Visit[];
}

export async function getUpcomingVisits(days: number = 7) {
  const supabase = getSupabaseClient();
  
  const now = new Date();
  const future = new Date();
  future.setDate(future.getDate() + days);

  const { data, error } = await supabase
    .from('visits')
    .select(`
      *,
      customer:customers(id, nombre, telefono, direccion, zona, ciudad, latitud, longitud)
    `)
    .is('deleted_at', null)
    .eq('status', 'programada')
    .gte('scheduled_at', now.toISOString())
    .lte('scheduled_at', future.toISOString())
    .order('scheduled_at');

  if (error) throw error;
  return data as Visit[];
}

export async function createVisit(visit: VisitInsert) {
  const supabase = getSupabaseClient();
  const userId = getCurrentUserId();

  if (!userId) {
    throw new Error('No se encontró el usuario actual');
  }

  const { data, error } = await supabase
    .from('visits')
    .insert({
      ...visit,
      user_id: userId
    })
    .select(`
      *,
      customer:customers(id, nombre, telefono, direccion)
    `)
    .single();

  if (error) throw error;
  return data as Visit;
}

export async function updateVisit(id: string, visit: VisitUpdate) {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('visits')
    .update(visit)
    .eq('id', id)
    .select(`
      *,
      customer:customers(id, nombre, telefono, direccion)
    `)
    .single();

  if (error) throw error;
  return data as Visit;
}

export async function completeVisit(
  id: string,
  resultado: string,
  observaciones?: string,
  nextAction?: string,
  nextVisitAt?: string
) {
  const supabase = getSupabaseClient();

  // Actualizar la visita actual
  const { data: visit, error } = await supabase
    .from('visits')
    .update({
      status: 'completada',
      resultado,
      observaciones,
      next_action: nextAction,
      next_visit_at: nextVisitAt,
    })
    .eq('id', id)
    .select(`
      *,
      customer:customers(id, nombre, telefono, direccion)
    `)
    .single();

  if (error) throw error;

  // Si hay siguiente visita programada, crearla automáticamente
  if (nextVisitAt && visit) {
    await supabase
      .from('visits')
      .insert({
        customer_id: visit.customer_id,
        scheduled_at: nextVisitAt,
        status: 'programada',
        objetivo: nextAction || 'Seguimiento de visita anterior',
        location_text: visit.location_text,
      });
  }

  return visit as Visit;
}

export async function deleteVisit(id: string) {
  const supabase = getSupabaseClient();
  
  const { error } = await supabase
    .from('visits')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw error;
}

export async function getVisitStats() {
  const supabase = getSupabaseClient();
  const userId = getCurrentUserId();
  const isAdmin = isCurrentUserAdmin();
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);

  let todayQuery = supabase
    .from('visits')
    .select('status')
    .is('deleted_at', null)
    .gte('scheduled_at', today.toISOString())
    .lt('scheduled_at', tomorrow.toISOString());
  
  let pendingQuery = supabase
    .from('visits')
    .select('id')
    .is('deleted_at', null)
    .eq('status', 'programada')
    .lt('scheduled_at', new Date().toISOString());

  let weekQuery = supabase
    .from('visits')
    .select('status')
    .is('deleted_at', null)
    .gte('scheduled_at', weekAgo.toISOString())
    .lt('scheduled_at', tomorrow.toISOString());

  if (!isAdmin && userId) {
    todayQuery = todayQuery.eq('user_id', userId);
    pendingQuery = pendingQuery.eq('user_id', userId);
    weekQuery = weekQuery.eq('user_id', userId);
  }

  const { data: todayData } = await todayQuery;
  const { data: pendingData } = await pendingQuery;
  const { data: weekData } = await weekQuery;

  return {
    today: todayData?.length || 0,
    todayCompleted: todayData?.filter(v => v.status === 'completada').length || 0,
    pending: pendingData?.length || 0,
    weekTotal: weekData?.length || 0,
    weekCompleted: weekData?.filter(v => v.status === 'completada').length || 0,
  };
}

export async function getVisitsByDate(date: string) {
  const supabase = getSupabaseClient();
  const userId = getCurrentUserId();
  const isAdmin = isCurrentUserAdmin();
  
  // Usar directamente el string de fecha para evitar problemas de zona horaria
  const startOfDay = `${date}T00:00:00`;
  const endOfDay = `${date}T23:59:59`;

  let query = supabase
    .from('visits')
    .select(`
      *,
      customer:customers(id, nombre, telefono, direccion, zona, ciudad, latitud, longitud)
    `)
    .is('deleted_at', null)
    .gte('scheduled_at', startOfDay)
    .lte('scheduled_at', endOfDay)
    .order('scheduled_at');

  if (!isAdmin && userId) {
    query = query.eq('user_id', userId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as Visit[];
}

export type { Visit };

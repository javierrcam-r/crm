import { getSupabaseClient } from '@/lib/supabase/client';
import type { Visit, VisitInsert, VisitUpdate, VisitFilters } from '@/types/database';

export async function getVisits(filters?: VisitFilters) {
  const supabase = getSupabaseClient();
  
  let query = supabase
    .from('visits')
    .select(`
      *,
      customer:customers(id, nombre, telefono, direccion, zona, ciudad)
    `)
    .is('deleted_at', null)
    .order('scheduled_at', { ascending: true });

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
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const { data, error } = await supabase
    .from('visits')
    .select(`
      *,
      customer:customers(id, nombre, telefono, direccion, zona, ciudad)
    `)
    .is('deleted_at', null)
    .gte('scheduled_at', today.toISOString())
    .lt('scheduled_at', tomorrow.toISOString())
    .order('scheduled_at');

  if (error) throw error;
  return data as Visit[];
}

export async function getPendingVisits() {
  const supabase = getSupabaseClient();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('visits')
    .select(`
      *,
      customer:customers(id, nombre, telefono, direccion, zona, ciudad)
    `)
    .is('deleted_at', null)
    .eq('status', 'programada')
    .lt('scheduled_at', now)
    .order('scheduled_at');

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
      customer:customers(id, nombre, telefono, direccion, zona, ciudad)
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

  const { data, error } = await supabase
    .from('visits')
    .insert(visit)
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
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);

  const { data: todayData } = await supabase
    .from('visits')
    .select('status')
    .is('deleted_at', null)
    .gte('scheduled_at', today.toISOString())
    .lt('scheduled_at', tomorrow.toISOString());

  const { data: pendingData } = await supabase
    .from('visits')
    .select('id')
    .is('deleted_at', null)
    .eq('status', 'programada')
    .lt('scheduled_at', new Date().toISOString());

  const { data: weekData } = await supabase
    .from('visits')
    .select('status')
    .is('deleted_at', null)
    .gte('scheduled_at', weekAgo.toISOString())
    .lt('scheduled_at', tomorrow.toISOString());

  return {
    today: todayData?.length || 0,
    todayCompleted: todayData?.filter(v => v.status === 'completada').length || 0,
    pending: pendingData?.length || 0,
    weekTotal: weekData?.length || 0,
    weekCompleted: weekData?.filter(v => v.status === 'completada').length || 0,
  };
}

export type { Visit };

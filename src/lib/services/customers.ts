import { getSupabaseClient } from '@/lib/supabase/client';
import type { Customer, CustomerInsert, CustomerUpdate, CustomerFilters } from '@/types/database';

export async function getCustomers(filters?: CustomerFilters) {
  const supabase = getSupabaseClient();
  
  let query = supabase
    .from('customers')
    .select('*')
    .is('deleted_at', null)
    .order('nombre');

  if (filters?.tipo) {
    query = query.eq('tipo', filters.tipo);
  }
  if (filters?.etapa_embudo) {
    query = query.eq('etapa_embudo', filters.etapa_embudo);
  }
  if (filters?.ciudad) {
    query = query.eq('ciudad', filters.ciudad);
  }
  if (filters?.zona) {
    query = query.eq('zona', filters.zona);
  }
  if (filters?.search) {
    query = query.or(`nombre.ilike.%${filters.search}%,telefono.ilike.%${filters.search}%,email.ilike.%${filters.search}%`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as Customer[];
}

export async function getCustomer(id: string) {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (error) throw error;
  return data as Customer;
}

export async function createCustomer(customer: CustomerInsert) {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('customers')
    .insert(customer)
    .select()
    .single();

  if (error) throw error;
  return data as Customer;
}

export async function updateCustomer(id: string, customer: CustomerUpdate) {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('customers')
    .update(customer)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as Customer;
}

export async function deleteCustomer(id: string) {
  const supabase = getSupabaseClient();
  
  const { error } = await supabase
    .from('customers')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw error;
}

export async function getCustomerStats() {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('customers')
    .select('tipo, etapa_embudo')
    .is('deleted_at', null);

  if (error) throw error;

  const stats = {
    total: data.length,
    clientes: data.filter(c => c.tipo === 'cliente').length,
    prospectos: data.filter(c => c.tipo === 'prospecto').length,
    byFunnel: {} as Record<string, number>,
  };

  data.forEach(c => {
    stats.byFunnel[c.etapa_embudo] = (stats.byFunnel[c.etapa_embudo] || 0) + 1;
  });

  return stats;
}

export async function getCities() {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('customers')
    .select('ciudad')
    .is('deleted_at', null)
    .not('ciudad', 'is', null);

  if (error) throw error;
  
  const cities = Array.from(new Set(data.map(c => c.ciudad).filter(Boolean)));
  return cities as string[];
}

export async function getZones() {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('customers')
    .select('zona')
    .is('deleted_at', null)
    .not('zona', 'is', null);

  if (error) throw error;
  
  const zones = Array.from(new Set(data.map(c => c.zona).filter(Boolean)));
  return zones as string[];
}

export type { Customer };

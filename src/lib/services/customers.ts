import { getSupabaseClient } from '@/lib/supabase/client';
import type { Customer, CustomerInsert, CustomerUpdate, CustomerFilters } from '@/types/database';
import { getCurrentUserId, isCurrentUserAdmin, getCurrentUserProfile } from '@/lib/auth/getCurrentUserId';

export async function getCustomers(filters?: CustomerFilters) {
  const supabase = getSupabaseClient();
  const userId = getCurrentUserId();
  const profile = getCurrentUserProfile();
  const isAdmin = isCurrentUserAdmin();
  const isSupervisor = profile?.rol === 'supervisor' || profile?.rol === 'supervisor_nivel1' || profile?.rol === 'supervisor_vendedor';
  
  if (!isAdmin && !isSupervisor && userId) {
    // Vendedores: ver clientes propios + clientes asignados
    const { data: assignments } = await supabase
      .from('customer_vendor_assignments')
      .select('customer_id')
      .eq('vendor_user_id', profile?.id || '');
    
    const assignedIds = (assignments || []).map(a => a.customer_id);
    
    let query = supabase
      .from('customers')
      .select('*')
      .is('deleted_at', null)
      .order('nombre');
    
    if (assignedIds.length > 0) {
      query = query.or(`user_id.eq.${userId},id.in.(${assignedIds.join(',')})`);
    } else {
      query = query.eq('user_id', userId);
    }

    if (filters?.tipo) query = query.eq('tipo', filters.tipo);
    if (filters?.etapa_embudo) query = query.eq('etapa_embudo', filters.etapa_embudo);
    if (filters?.ciudad) query = query.eq('ciudad', filters.ciudad);
    if (filters?.zona) query = query.eq('zona', filters.zona);
    if (filters?.search) {
      query = query.or(`nombre.ilike.%${filters.search}%,telefono.ilike.%${filters.search}%,email.ilike.%${filters.search}%`);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data as Customer[];
  }

  // Admin y supervisores ven TODOS los clientes
  let query = supabase
    .from('customers')
    .select('*')
    .is('deleted_at', null)
    .order('nombre');

  if (filters?.tipo) query = query.eq('tipo', filters.tipo);
  if (filters?.etapa_embudo) query = query.eq('etapa_embudo', filters.etapa_embudo);
  if (filters?.ciudad) query = query.eq('ciudad', filters.ciudad);
  if (filters?.zona) query = query.eq('zona', filters.zona);
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
  const userId = getCurrentUserId();

  if (!userId) {
    throw new Error('No se encontró el usuario actual');
  }

  const { data, error } = await supabase
    .from('customers')
    .insert({
      ...customer,
      user_id: userId
    })
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
  const userId = getCurrentUserId();
  const isAdmin = isCurrentUserAdmin();
  
  let query = supabase
    .from('customers')
    .select('tipo, etapa_embudo')
    .is('deleted_at', null);

  if (!isAdmin && userId) {
    query = query.eq('user_id', userId);
  }

  const { data, error } = await query;
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

// =====================================================
// Gestión de asignaciones cliente-vendedor (Supervisores)
// =====================================================

export async function getAllCustomersForSupervisor() {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .is('deleted_at', null)
    .order('nombre');

  if (error) throw error;
  return data as Customer[];
}

export async function getCustomerVendorAssignments() {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('customer_vendor_assignments')
    .select('customer_id, vendor_user_id');

  if (error) throw error;
  return data || [];
}

export async function assignVendorsToCustomer(customerId: string, vendorIds: string[]) {
  const supabase = getSupabaseClient();
  const profile = getCurrentUserProfile();
  
  // Eliminar asignaciones existentes
  await supabase
    .from('customer_vendor_assignments')
    .delete()
    .eq('customer_id', customerId);
  
  // Insertar nuevas asignaciones
  if (vendorIds.length > 0) {
    const rows = vendorIds.map(vendorId => ({
      customer_id: customerId,
      vendor_user_id: vendorId,
      assigned_by: profile?.id || null
    }));
    
    const { error } = await supabase
      .from('customer_vendor_assignments')
      .insert(rows);
    
    if (error) throw error;
  }
}

export async function bulkAssignVendorToCustomers(customerIds: string[], vendorId: string) {
  const supabase = getSupabaseClient();
  const profile = getCurrentUserProfile();
  
  const rows = customerIds.map(customerId => ({
    customer_id: customerId,
    vendor_user_id: vendorId,
    assigned_by: profile?.id || null
  }));
  
  // Insert in batches of 200
  for (let i = 0; i < rows.length; i += 200) {
    const batch = rows.slice(i, i + 200);
    const { error } = await supabase
      .from('customer_vendor_assignments')
      .upsert(batch, { onConflict: 'customer_id,vendor_user_id' });
    if (error) throw error;
  }
}

export async function bulkCreateAssignments(assignments: { customer_id: string; vendor_user_id: string }[]) {
  const supabase = getSupabaseClient();
  const profile = getCurrentUserProfile();
  
  const rows = assignments.map(a => ({
    ...a,
    assigned_by: profile?.id || null
  }));
  
  // Insert in batches of 200
  for (let i = 0; i < rows.length; i += 200) {
    const batch = rows.slice(i, i + 200);
    const { error } = await supabase
      .from('customer_vendor_assignments')
      .upsert(batch, { onConflict: 'customer_id,vendor_user_id' });
    if (error) throw error;
  }
}

export async function reassignCustomerOwner(customerId: string, newOwnerUserId: string) {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('customers')
    .update({ user_id: newOwnerUserId })
    .eq('id', customerId)
    .select()
    .single();
  
  if (error) throw error;
  return data as Customer;
}

export async function getAdminUserId() {
  const supabase = getSupabaseClient();
  
  const { data } = await supabase
    .from('users_profile')
    .select('user_id')
    .eq('rol', 'admin')
    .eq('activo', true)
    .limit(1)
    .single();
  
  return data?.user_id || null;
}

export async function bulkCreateCustomers(customers: CustomerInsert[], ownerUserId?: string) {
  const supabase = getSupabaseClient();
  const userId = ownerUserId || getCurrentUserId();
  
  if (!userId) throw new Error('No se encontró el usuario actual');
  
  const rows = customers.map(c => ({
    ...c,
    user_id: userId
  }));
  
  const { data, error } = await supabase
    .from('customers')
    .insert(rows)
    .select();
  
  if (error) throw error;
  return data as Customer[];
}

export async function getVendors() {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('users_profile')
    .select('id, user_id, nombre_completo, email, rol')
    .in('rol', ['vendedor', 'supervisor_vendedor'])
    .eq('activo', true)
    .order('nombre_completo');
  
  if (error) throw error;
  return data || [];
}

export type { Customer };

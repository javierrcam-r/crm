import { getSupabaseClient } from '@/lib/supabase/client';
import type { UserProfile, UserProfileInsert, UserProfileUpdate, UserFilters } from '@/types/database';

export async function getUsers(filters?: UserFilters) {
  const supabase = getSupabaseClient();
  
  let query = supabase
    .from('users_profile')
    .select('*')
    .order('nombre_completo');

  if (filters?.rol) {
    query = query.eq('rol', filters.rol);
  }
  if (filters?.activo !== undefined) {
    query = query.eq('activo', filters.activo);
  }
  if (filters?.search) {
    query = query.or(`nombre_completo.ilike.%${filters.search}%,email.ilike.%${filters.search}%`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as UserProfile[];
}

export async function getUser(id: string) {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('users_profile')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data as UserProfile;
}

export async function getUserByUserId(userId: string) {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('users_profile')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error) throw error;
  return data as UserProfile;
}

export async function getCurrentUser() {
  const supabase = getSupabaseClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('users_profile')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (error) return null;
  return data as UserProfile;
}

export async function createUser(user: UserProfileInsert) {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('users_profile')
    .insert(user)
    .select()
    .single();

  if (error) throw error;
  return data as UserProfile;
}

export async function updateUser(id: string, user: UserProfileUpdate) {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('users_profile')
    .update(user)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as UserProfile;
}

export async function deleteUser(id: string) {
  const supabase = getSupabaseClient();
  
  const { error } = await supabase
    .from('users_profile')
    .update({ activo: false })
    .eq('id', id);

  if (error) throw error;
}

export async function activateUser(id: string) {
  const supabase = getSupabaseClient();
  
  const { error } = await supabase
    .from('users_profile')
    .update({ activo: true })
    .eq('id', id);

  if (error) throw error;
}

export async function isAdmin(userId?: string): Promise<boolean> {
  const supabase = getSupabaseClient();
  
  let targetUserId = userId;
  if (!targetUserId) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;
    targetUserId = user.id;
  }

  const { data, error } = await supabase
    .from('users_profile')
    .select('rol')
    .eq('user_id', targetUserId)
    .eq('activo', true)
    .single();

  if (error || !data) return false;
  return data.rol === 'admin';
}

export type { UserProfile };

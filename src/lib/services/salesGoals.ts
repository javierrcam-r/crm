import { getSupabaseClient } from '@/lib/supabase/client';
import { getCurrentUserProfile } from '@/lib/auth/getCurrentUserId';
import type { Brand, BrandInsert, SalesGoal, SalesGoalInsert, SalesGoalUpdate } from '@/types/database';

const GOALS_SELECT = `
  *,
  user_profile:users_profile!user_profile_id(id, nombre_completo, email, rol),
  brand:brands(id, nombre, logo_url, orden)
`;

// =====================================================
// BRANDS CRUD
// =====================================================

export async function getBrands(): Promise<Brand[]> {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('brands')
    .select('*')
    .eq('activo', true)
    .order('orden')
    .order('nombre');

  if (error) {
    console.error('Error fetching brands:', error);
    return [];
  }

  return data || [];
}

export async function getAllBrands(): Promise<Brand[]> {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('brands')
    .select('*')
    .order('orden')
    .order('nombre');

  if (error) {
    console.error('Error fetching all brands:', error);
    return [];
  }

  return data || [];
}

export async function createBrand(brand: BrandInsert): Promise<Brand | null> {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('brands')
    .insert(brand)
    .select()
    .single();

  if (error) {
    console.error('Error creating brand:', error);
    throw error;
  }

  return data;
}

export async function updateBrand(id: string, updates: Partial<BrandInsert>): Promise<Brand | null> {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('brands')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating brand:', error);
    throw error;
  }

  return data;
}

export async function deleteBrand(id: string): Promise<void> {
  const supabase = getSupabaseClient();
  
  const { error } = await supabase
    .from('brands')
    .update({ activo: false })
    .eq('id', id);

  if (error) {
    console.error('Error deleting brand:', error);
    throw error;
  }
}

// =====================================================
// SALES GOALS CRUD
// =====================================================

export async function getSalesGoals(anio: number, mes: number, userId?: string): Promise<SalesGoal[]> {
  const supabase = getSupabaseClient();
  
  let query = supabase
    .from('sales_goals')
    .select(GOALS_SELECT)
    .eq('anio', anio)
    .eq('mes', mes);

  if (userId) {
    query = query.eq('user_profile_id', userId);
  }

  const { data, error } = await query.order('created_at');

  if (error) {
    console.error('Error fetching sales goals:', error);
    return [];
  }

  return data || [];
}

export async function getMySalesGoals(anio: number, mes: number): Promise<SalesGoal[]> {
  const profile = getCurrentUserProfile();
  if (!profile?.id) return [];

  return getSalesGoals(anio, mes, profile.id);
}

export async function upsertSalesGoal(goal: SalesGoalInsert): Promise<SalesGoal | null> {
  const supabase = getSupabaseClient();
  const profile = getCurrentUserProfile();
  
  const { data, error } = await supabase
    .from('sales_goals')
    .upsert({
      ...goal,
      created_by: profile?.id || null,
    }, {
      onConflict: 'user_profile_id,brand_id,anio,mes'
    })
    .select(GOALS_SELECT)
    .single();

  if (error) {
    console.error('Error upserting sales goal:', error);
    throw error;
  }

  return data;
}

export async function updateSalesGoal(id: string, updates: SalesGoalUpdate): Promise<SalesGoal | null> {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('sales_goals')
    .update(updates)
    .eq('id', id)
    .select(GOALS_SELECT)
    .single();

  if (error) {
    console.error('Error updating sales goal:', error);
    throw error;
  }

  return data;
}

export async function deleteSalesGoal(id: string): Promise<void> {
  const supabase = getSupabaseClient();
  
  const { error } = await supabase
    .from('sales_goals')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting sales goal:', error);
    throw error;
  }
}

export async function bulkUpsertSalesGoals(goals: SalesGoalInsert[]): Promise<void> {
  const supabase = getSupabaseClient();
  const profile = getCurrentUserProfile();
  
  const goalsWithCreator = goals.map(g => ({
    ...g,
    created_by: profile?.id || null,
  }));

  const { error } = await supabase
    .from('sales_goals')
    .upsert(goalsWithCreator, {
      onConflict: 'user_profile_id,brand_id,anio,mes'
    });

  if (error) {
    console.error('Error bulk upserting sales goals:', error);
    throw error;
  }
}

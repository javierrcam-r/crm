import { getSupabaseClient } from '@/lib/supabase/client';
import type { Product, ProductInsert, ProductUpdate, ProductFilters } from '@/types/database';
import { getCurrentUserId, isCurrentUserAdmin } from '@/lib/auth/getCurrentUserId';

export async function getProducts(filters?: ProductFilters) {
  const supabase = getSupabaseClient();
  const userId = getCurrentUserId();
  const isAdmin = isCurrentUserAdmin();
  
  let query = supabase
    .from('products')
    .select('*')
    .is('deleted_at', null)
    .order('nombre');

  // Filtrar por usuario (excepto admin que ve todo)
  if (!isAdmin && userId) {
    query = query.eq('user_id', userId);
  }

  if (filters?.categoria) {
    query = query.eq('categoria', filters.categoria);
  }
  if (filters?.activo !== undefined) {
    query = query.eq('activo', filters.activo);
  }
  if (filters?.search) {
    query = query.or(`nombre.ilike.%${filters.search}%,sku.ilike.%${filters.search}%`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as Product[];
}

export async function getActiveProducts(search?: string) {
  const supabase = getSupabaseClient();
  const userId = getCurrentUserId();
  const isAdmin = isCurrentUserAdmin();
  
  let query = supabase
    .from('products')
    .select('*')
    .is('deleted_at', null)
    .eq('activo', true)
    .order('nombre');

  // Filtrar por usuario (excepto admin que ve todo)
  if (!isAdmin && userId) {
    query = query.eq('user_id', userId);
  }

  if (search) {
    query = query.or(`nombre.ilike.%${search}%,sku.ilike.%${search}%`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as Product[];
}

export async function getProduct(id: string) {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (error) throw error;
  return data as Product;
}

export async function createProduct(product: ProductInsert) {
  const supabase = getSupabaseClient();
  const userId = getCurrentUserId();

  if (!userId) {
    throw new Error('No se encontró el usuario actual');
  }

  const { data, error } = await supabase
    .from('products')
    .insert({
      ...product,
      user_id: userId
    })
    .select()
    .single();

  if (error) throw error;
  return data as Product;
}

export async function updateProduct(id: string, product: ProductUpdate) {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('products')
    .update(product)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as Product;
}

export async function deleteProduct(id: string) {
  const supabase = getSupabaseClient();
  
  const { error } = await supabase
    .from('products')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw error;
}

export async function getCategories() {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('products')
    .select('categoria')
    .is('deleted_at', null)
    .not('categoria', 'is', null);

  if (error) throw error;
  
  const categories = Array.from(new Set(data.map(p => p.categoria).filter(Boolean)));
  return categories as string[];
}

export async function getProductStats() {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('products')
    .select('activo, categoria')
    .is('deleted_at', null);

  if (error) throw error;

  return {
    total: data.length,
    activos: data.filter(p => p.activo).length,
    inactivos: data.filter(p => !p.activo).length,
    byCategory: data.reduce((acc, p) => {
      const cat = p.categoria || 'Sin categoría';
      acc[cat] = (acc[cat] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
  };
}

export type { Product };

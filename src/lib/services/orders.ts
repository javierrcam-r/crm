import { getSupabaseClient } from '@/lib/supabase/client';
import type { Order, OrderInsert, OrderUpdate, OrderFilters, OrderItem, OrderItemInsert, OrderItemUpdate } from '@/types/database';
import { getCurrentUserId, isCurrentUserAdmin } from '@/lib/auth/getCurrentUserId';

export async function getOrders(filters?: OrderFilters) {
  const supabase = getSupabaseClient();
  const userId = getCurrentUserId();
  const isAdmin = isCurrentUserAdmin();
  
  let query = supabase
    .from('orders')
    .select(`
      *,
      customer:customers(id, nombre, telefono, direccion)
    `)
    .is('deleted_at', null)
    .order('order_date', { ascending: false });

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
    query = query.gte('order_date', filters.date_from);
  }
  if (filters?.date_to) {
    query = query.lte('order_date', filters.date_to);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as Order[];
}

export async function getOrder(id: string) {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('orders')
    .select(`
      *,
      customer:customers(*),
      items:order_items(
        *,
        product:products(id, sku, nombre, categoria)
      )
    `)
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (error) throw error;
  return data as Order;
}

export async function getTodayOrders() {
  const supabase = getSupabaseClient();
  const userId = getCurrentUserId();
  const isAdmin = isCurrentUserAdmin();
  const today = new Date().toISOString().split('T')[0];

  let query = supabase
    .from('orders')
    .select(`
      *,
      customer:customers(id, nombre, telefono)
    `)
    .is('deleted_at', null)
    .eq('order_date', today)
    .order('created_at', { ascending: false });

  if (!isAdmin && userId) {
    query = query.eq('user_id', userId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as Order[];
}

export async function getWeekOrders() {
  const supabase = getSupabaseClient();
  
  const today = new Date();
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);

  const { data, error } = await supabase
    .from('orders')
    .select(`
      *,
      customer:customers(id, nombre, telefono)
    `)
    .is('deleted_at', null)
    .gte('order_date', weekAgo.toISOString().split('T')[0])
    .order('order_date', { ascending: false });

  if (error) throw error;
  return data as Order[];
}

export async function createOrder(order: OrderInsert) {
  const supabase = getSupabaseClient();
  const userId = getCurrentUserId();

  if (!userId) {
    throw new Error('No se encontró el usuario actual');
  }

  const { data, error } = await supabase
    .from('orders')
    .insert({
      ...order,
      user_id: userId
    })
    .select(`
      *,
      customer:customers(id, nombre, telefono, direccion)
    `)
    .single();

  if (error) throw error;
  return data as Order;
}

export async function updateOrder(id: string, order: OrderUpdate) {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('orders')
    .update(order)
    .eq('id', id)
    .select(`
      *,
      customer:customers(id, nombre, telefono, direccion)
    `)
    .single();

  if (error) throw error;
  return data as Order;
}

export async function deleteOrder(id: string) {
  const supabase = getSupabaseClient();
  
  const { error } = await supabase
    .from('orders')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw error;
}

// =====================================================
// ORDER ITEMS
// =====================================================

export async function getOrderItems(orderId: string) {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('order_items')
    .select(`
      *,
      product:products(id, sku, nombre, categoria, precio)
    `)
    .eq('order_id', orderId)
    .order('created_at');

  if (error) throw error;
  return data as OrderItem[];
}

export async function addOrderItem(item: OrderItemInsert) {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('order_items')
    .insert(item)
    .select(`
      *,
      product:products(id, sku, nombre, categoria)
    `)
    .single();

  if (error) throw error;
  return data as OrderItem;
}

export async function updateOrderItem(id: string, item: OrderItemUpdate) {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('order_items')
    .update(item)
    .eq('id', id)
    .select(`
      *,
      product:products(id, sku, nombre, categoria)
    `)
    .single();

  if (error) throw error;
  return data as OrderItem;
}

export async function deleteOrderItem(id: string) {
  const supabase = getSupabaseClient();
  
  const { error } = await supabase
    .from('order_items')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// =====================================================
// STATS & REPORTS
// =====================================================

export async function getOrderStats() {
  const supabase = getSupabaseClient();
  const userId = getCurrentUserId();
  const isAdmin = isCurrentUserAdmin();
  
  const today = new Date().toISOString().split('T')[0];
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  let todayQuery = supabase
    .from('orders')
    .select('status, total')
    .is('deleted_at', null)
    .eq('order_date', today);

  let weekQuery = supabase
    .from('orders')
    .select('status, total')
    .is('deleted_at', null)
    .gte('order_date', weekAgo.toISOString().split('T')[0]);

  if (!isAdmin && userId) {
    todayQuery = todayQuery.eq('user_id', userId);
    weekQuery = weekQuery.eq('user_id', userId);
  }

  const { data: todayData } = await todayQuery;
  const { data: weekData } = await weekQuery;

  return {
    todayCount: todayData?.length || 0,
    todayTotal: todayData?.reduce((sum, o) => sum + (o.total || 0), 0) || 0,
    weekCount: weekData?.length || 0,
    weekTotal: weekData?.reduce((sum, o) => sum + (o.total || 0), 0) || 0,
  };
}

export async function getDailySummary(date: string) {
  const supabase = getSupabaseClient();
  
  const { data: orders, error } = await supabase
    .from('orders')
    .select(`
      *,
      customer:customers(id, nombre),
      items:order_items(
        *,
        product:products(id, sku, nombre)
      )
    `)
    .is('deleted_at', null)
    .eq('order_date', date)
    .order('created_at');

  if (error) throw error;
  return orders as Order[];
}

export async function getCustomerOrderSummary(customerId: string) {
  const supabase = getSupabaseClient();
  
  const { data: orders, error } = await supabase
    .from('orders')
    .select(`
      *,
      items:order_items(
        *,
        product:products(id, sku, nombre)
      )
    `)
    .is('deleted_at', null)
    .eq('customer_id', customerId)
    .order('order_date', { ascending: false })
    .limit(20);

  if (error) throw error;

  // Calcular productos frecuentes
  const productCounts: Record<string, { name: string; count: number; total: number }> = {};
  
  orders?.forEach(order => {
    order.items?.forEach((item: OrderItem) => {
      const product = item.product as { id: string; nombre: string } | undefined;
      if (product) {
        if (!productCounts[product.id]) {
          productCounts[product.id] = { name: product.nombre, count: 0, total: 0 };
        }
        productCounts[product.id].count += item.qty;
        productCounts[product.id].total += item.line_total;
      }
    });
  });

  const frequentProducts = Object.entries(productCounts)
    .map(([id, data]) => ({ id, ...data }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    orders: orders as Order[],
    totalOrders: orders?.length || 0,
    totalAmount: orders?.reduce((sum, o) => sum + (o.total || 0), 0) || 0,
    frequentProducts,
  };
}

export async function getTopProducts(days: number = 30) {
  const supabase = getSupabaseClient();
  
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const { data, error } = await supabase
    .from('order_items')
    .select(`
      product_id,
      qty,
      line_total,
      product:products(id, sku, nombre, categoria),
      order:orders!inner(order_date, deleted_at)
    `)
    .gte('order.order_date', startDate.toISOString().split('T')[0])
    .is('order.deleted_at', null);

  if (error) throw error;

  const productStats: Record<string, { 
    id: string; 
    name: string; 
    sku: string;
    category: string;
    totalQty: number; 
    totalAmount: number 
  }> = {};

  data?.forEach(item => {
    const product = item.product as { id: string; nombre: string; sku: string; categoria: string } | null;
    if (product) {
      if (!productStats[product.id]) {
        productStats[product.id] = {
          id: product.id,
          name: product.nombre,
          sku: product.sku,
          category: product.categoria || 'Sin categoría',
          totalQty: 0,
          totalAmount: 0,
        };
      }
      productStats[product.id].totalQty += item.qty;
      productStats[product.id].totalAmount += item.line_total;
    }
  });

  return Object.values(productStats).sort((a, b) => b.totalQty - a.totalQty);
}

export async function getOrdersByDate(date: string) {
  const supabase = getSupabaseClient();
  const userId = getCurrentUserId();
  const isAdmin = isCurrentUserAdmin();

  let query = supabase
    .from('orders')
    .select(`
      *,
      customer:customers(id, nombre, telefono, direccion)
    `)
    .is('deleted_at', null)
    .eq('order_date', date)
    .order('created_at', { ascending: false });

  if (!isAdmin && userId) {
    query = query.eq('user_id', userId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as Order[];
}

export type { Order, OrderItem };

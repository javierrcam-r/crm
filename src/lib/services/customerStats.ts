import { getSupabaseClient } from '@/lib/supabase/client';
import { SALES_VENDOR_ROLES } from '@/lib/auth/roles';
import type { Customer } from '@/types/database';

export interface VendorCustomerStats {
  vendedor_id: string;
  vendedor_nombre: string;
  totalClientes: number;
  clientes: number;
  prospectos: number;
  perdidos: number;
  conIdentificacion: number;
  conCodigoVentas: number;
}

export interface CustomerStatsResult {
  global: {
    totalClientes: number;
    clientes: number;
    prospectos: number;
    perdidos: number;
    conIdentificacion: number;
    conCodigoVentas: number;
  };
  porVendedor: VendorCustomerStats[];
  customers: Pick<Customer, 'id' | 'nombre' | 'tipo' | 'etapa_embudo' | 'num_identificacion' | 'tipo_identificacion' | 'codigo_cliente_ventas' | 'fecha_nacimiento' | 'ciudad'>[];
}

const CUSTOMER_COLS = 'id,nombre,tipo,etapa_embudo,num_identificacion,tipo_identificacion,codigo_cliente_ventas,fecha_nacimiento,ciudad,user_id' as const;

async function fetchAllCustomers(): Promise<any[]> {
  const supabase = getSupabaseClient();
  const all: any[] = [];
  const pageSize = 1000;
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from('customers')
      .select(CUSTOMER_COLS)
      .is('deleted_at', null)
      .order('nombre')
      .range(from, from + pageSize - 1);

    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

async function fetchAssignments(): Promise<{ customer_id: string; vendor_user_id: string }[]> {
  const supabase = getSupabaseClient();
  const all: any[] = [];
  const pageSize = 1000;
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from('customer_vendor_assignments')
      .select('customer_id, vendor_user_id')
      .range(from, from + pageSize - 1);

    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

async function fetchVendors(): Promise<{ id: string; user_id: string; nombre_completo: string }[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('users_profile')
    .select('id, user_id, nombre_completo, rol')
    .in('rol', SALES_VENDOR_ROLES)
    .eq('activo', true)
    .order('nombre_completo');

  if (error) throw error;
  return data || [];
}

function computeStats(customers: any[]): Omit<VendorCustomerStats, 'vendedor_id' | 'vendedor_nombre'> {
  return {
    totalClientes: customers.length,
    clientes: customers.filter(c => c.tipo === 'cliente' || c.etapa_embudo === 'ganado').length,
    prospectos: customers.filter(c => c.tipo === 'prospecto' && c.etapa_embudo !== 'perdido' && c.etapa_embudo !== 'ganado').length,
    perdidos: customers.filter(c => c.etapa_embudo === 'perdido').length,
    conIdentificacion: customers.filter(c => c.num_identificacion).length,
    conCodigoVentas: customers.filter(c => c.codigo_cliente_ventas != null).length,
  };
}

export async function getCustomerStatsForVendor(profileId: string, userId: string): Promise<CustomerStatsResult> {
  const [allCustomers, assignments] = await Promise.all([
    fetchAllCustomers(),
    fetchAssignments(),
  ]);

  const assignedIds = new Set(
    assignments
      .filter(a => a.vendor_user_id === profileId || a.vendor_user_id === userId)
      .map(a => a.customer_id)
  );

  const ownCustomers = allCustomers.filter(c => c.user_id === userId);
  const ownIds = new Set(ownCustomers.map((c: any) => c.id));

  const assignedCustomers = allCustomers.filter(c => assignedIds.has(c.id) && !ownIds.has(c.id));
  const myCustomers = [...ownCustomers, ...assignedCustomers];

  const globalStats = computeStats(myCustomers);

  return {
    global: globalStats,
    porVendedor: [{
      vendedor_id: profileId,
      vendedor_nombre: 'Mis clientes',
      ...globalStats,
    }],
    customers: myCustomers.map(c => ({
      id: c.id,
      nombre: c.nombre,
      tipo: c.tipo,
      etapa_embudo: c.etapa_embudo,
      num_identificacion: c.num_identificacion,
      tipo_identificacion: c.tipo_identificacion,
      codigo_cliente_ventas: c.codigo_cliente_ventas,
      fecha_nacimiento: c.fecha_nacimiento,
      ciudad: c.ciudad,
    })),
  };
}

export async function getCustomerStatsAllVendors(): Promise<CustomerStatsResult> {
  const [allCustomers, assignments, vendors] = await Promise.all([
    fetchAllCustomers(),
    fetchAssignments(),
    fetchVendors(),
  ]);

  const vendorAssignments = new Map<string, Set<string>>();
  for (const a of assignments) {
    if (!vendorAssignments.has(a.vendor_user_id)) {
      vendorAssignments.set(a.vendor_user_id, new Set());
    }
    vendorAssignments.get(a.vendor_user_id)!.add(a.customer_id);
  }

  const customerMap = new Map<string, any>();
  for (const c of allCustomers) {
    customerMap.set(c.id, c);
  }

  const porVendedor: VendorCustomerStats[] = [];

  for (const vendor of vendors) {
    const vendorIds = [vendor.id, vendor.user_id];
    const customerIds = new Set<string>();

    for (const vid of vendorIds) {
      const assigned = vendorAssignments.get(vid);
      if (assigned) {
        for (const cid of assigned) customerIds.add(cid);
      }
    }

    for (const c of allCustomers) {
      if (c.user_id === vendor.user_id) customerIds.add(c.id);
    }

    const vendorCustomers = Array.from(customerIds)
      .map(id => customerMap.get(id))
      .filter(Boolean);

    const stats = computeStats(vendorCustomers);
    porVendedor.push({
      vendedor_id: vendor.id,
      vendedor_nombre: vendor.nombre_completo,
      ...stats,
    });
  }

  porVendedor.sort((a, b) => b.totalClientes - a.totalClientes);

  const globalStats = computeStats(allCustomers);

  return {
    global: globalStats,
    porVendedor,
    customers: allCustomers.map(c => ({
      id: c.id,
      nombre: c.nombre,
      tipo: c.tipo,
      etapa_embudo: c.etapa_embudo,
      num_identificacion: c.num_identificacion,
      tipo_identificacion: c.tipo_identificacion,
      codigo_cliente_ventas: c.codigo_cliente_ventas,
      fecha_nacimiento: c.fecha_nacimiento,
      ciudad: c.ciudad,
    })),
  };
}

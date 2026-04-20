import { getSupabaseClient } from '@/lib/supabase/client';
import type { VentasClienteMensual, VentasClienteConNombre, Customer } from '@/types/database';

interface ClienteMap {
  [codigoCliente: number]: { nombre: string; id?: string };
}

async function buildClienteMap(): Promise<ClienteMap> {
  const supabase = getSupabaseClient();
  const map: ClienteMap = {};
  const pageSize = 1000;
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from('customers')
      .select('id, nombre, codigo_cliente_ventas')
      .not('codigo_cliente_ventas', 'is', null)
      .is('deleted_at', null)
      .range(from, from + pageSize - 1);

    if (error || !data || data.length === 0) break;
    for (const c of data) {
      if (c.codigo_cliente_ventas != null) {
        map[c.codigo_cliente_ventas] = { nombre: c.nombre, id: c.id };
      }
    }
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return map;
}

async function getVendedorNames(): Promise<Record<number, string>> {
  const supabase = getSupabaseClient();
  const { data } = await supabase
    .from('users_profile')
    .select('nombre_completo, codigo_ventas')
    .not('codigo_ventas', 'is', null);

  const map: Record<number, string> = {};
  if (data) {
    for (const u of data) {
      if (u.codigo_ventas != null) {
        map[u.codigo_ventas] = u.nombre_completo;
      }
    }
  }
  return map;
}

function enrichRows(
  rows: VentasClienteMensual[],
  clienteMap: ClienteMap,
  vendedorNames: Record<number, string>
): VentasClienteConNombre[] {
  return rows.map(row => ({
    ...row,
    cliente_nombre: clienteMap[row.codigo_cliente]?.nombre || `Cliente #${row.codigo_cliente}`,
    vendedor_nombre: vendedorNames[row.codigo_vendedor] || `Vendedor #${row.codigo_vendedor}`,
  }));
}

export async function getVentasCliente(anio?: number): Promise<VentasClienteConNombre[]> {
  const supabase = getSupabaseClient();
  let query = supabase.from('ventas_cliente_mensual').select('*');
  if (anio) query = query.eq('anio', anio);

  const all: VentasClienteMensual[] = [];
  const pageSize = 1000;
  let from = 0;

  while (true) {
    const { data, error } = await query.order('anio').order('mes').order('codigo_cliente').range(from, from + pageSize - 1);
    if (error) { console.error('Error fetching ventas_cliente_mensual:', error); break; }
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
    query = supabase.from('ventas_cliente_mensual').select('*');
    if (anio) query = query.eq('anio', anio);
  }

  const [clienteMap, vendedorNames] = await Promise.all([buildClienteMap(), getVendedorNames()]);
  return enrichRows(all, clienteMap, vendedorNames);
}

export async function getVentasClientePorVendedor(codigoVendedor: number, anio?: number): Promise<VentasClienteConNombre[]> {
  const supabase = getSupabaseClient();
  const all: VentasClienteMensual[] = [];
  const pageSize = 1000;
  let from = 0;

  while (true) {
    let query = supabase
      .from('ventas_cliente_mensual')
      .select('*')
      .eq('codigo_vendedor', codigoVendedor);
    if (anio) query = query.eq('anio', anio);

    const { data, error } = await query.order('anio').order('mes').range(from, from + pageSize - 1);
    if (error) { console.error('Error:', error); break; }
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }

  const [clienteMap, vendedorNames] = await Promise.all([buildClienteMap(), getVendedorNames()]);
  return enrichRows(all, clienteMap, vendedorNames);
}

export interface ClienteRanking {
  codigo_cliente: number;
  cliente_nombre: string;
  cliente_id?: string;
  total_ventas: number;
  total_sin_iva: number;
  num_ventas: number;
  meses_activo: number;
}

export function buildClienteRanking(data: VentasClienteConNombre[]): ClienteRanking[] {
  const map = new Map<number, { nombre: string; id?: string; totalConIva: number; totalSinIva: number; ventas: number; meses: Set<string> }>();

  for (const row of data) {
    const prev = map.get(row.codigo_cliente) || {
      nombre: row.cliente_nombre || `Cliente #${row.codigo_cliente}`,
      id: undefined,
      totalConIva: 0,
      totalSinIva: 0,
      ventas: 0,
      meses: new Set<string>(),
    };
    prev.totalConIva += row.total_ventas;
    prev.totalSinIva += (row.total_sin_iva || 0);
    prev.ventas += row.num_ventas;
    prev.meses.add(`${row.anio}-${row.mes}`);
    map.set(row.codigo_cliente, prev);
  }

  return Array.from(map.entries())
    .map(([cod, v]) => ({
      codigo_cliente: cod,
      cliente_nombre: v.nombre,
      cliente_id: v.id,
      total_ventas: v.totalConIva,
      total_sin_iva: v.totalSinIva,
      num_ventas: v.ventas,
      meses_activo: v.meses.size,
    }))
    .sort((a, b) => b.total_ventas - a.total_ventas);
}

export interface ClienteTimeline {
  mes: string;
  total: number;
  sinIva: number;
  ventas: number;
}

export function buildClienteTimeline(data: VentasClienteConNombre[], codigoCliente: number): ClienteTimeline[] {
  const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const months: { [key: number]: ClienteTimeline } = {};
  for (let m = 1; m <= 12; m++) {
    months[m] = { mes: MESES[m - 1], total: 0, sinIva: 0, ventas: 0 };
  }

  for (const row of data) {
    if (row.codigo_cliente !== codigoCliente) continue;
    if (months[row.mes]) {
      months[row.mes].total += row.total_ventas;
      months[row.mes].sinIva += (row.total_sin_iva || 0);
      months[row.mes].ventas += row.num_ventas;
    }
  }

  return Object.values(months);
}

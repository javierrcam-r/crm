import { getSupabaseClient } from '@/lib/supabase/client';
import type { VentasResumenMensual, VentasResumenConVendedor } from '@/types/database';

interface VendedorInfo {
  id?: string;
  nombre_completo: string;
  esCrmUser: boolean;
}

interface VendedorMap {
  [codigoVendedor: number]: VendedorInfo;
}

const VENDEDORES_BASE: Record<number, string> = {
  5: 'Judith',
  8: 'Mónica Morales',
  12: 'Glenda Belduma',
  13: 'Willian',
  14: 'Glenda (Morona)',
  16: 'Oficina',
  18: 'Santo Domingo',
  19: 'Redes',
  20: 'Paulina Fernández',
  21: 'Quito',
  22: 'Cinthya',
  23: 'Xavier Naranjo',
  24: 'Fernando',
  25: 'Maribel',
  26: 'Sebastián Aguilar',
  27: 'Camila Fernandez',
  28: 'Oscar',
  29: 'Carla',
};

export const COMPROBANTES: Record<number, string> = {
  0: 'Otro',
  1: 'Factura',
  3: 'Liquidación de Compras',
  4: 'Nota de Crédito',
  5: 'Nota de Débito',
};

export function getNombreComprobante(cod: number): string {
  return COMPROBANTES[cod] || `Comprobante #${cod}`;
}

async function getVendedorMap(): Promise<VendedorMap> {
  const supabase = getSupabaseClient();
  const { data } = await supabase
    .from('users_profile')
    .select('id, nombre_completo, codigo_ventas')
    .not('codigo_ventas', 'is', null);

  const map: VendedorMap = {};

  for (const [codStr, nombre] of Object.entries(VENDEDORES_BASE)) {
    const cod = Number(codStr);
    map[cod] = { nombre_completo: nombre, esCrmUser: false };
  }

  if (data) {
    for (const u of data) {
      if (u.codigo_ventas != null) {
        map[u.codigo_ventas] = {
          id: u.id,
          nombre_completo: u.nombre_completo,
          esCrmUser: true,
        };
      }
    }
  }
  return map;
}

function enrichWithVendedor(data: VentasResumenMensual[], vendedorMap: VendedorMap): VentasResumenConVendedor[] {
  return data.map((row) => ({
    ...row,
    total_sin_iva: row.total_sin_iva || 0,
    total_iva: row.total_iva || 0,
    codcomprobante: row.codcomprobante || 1,
    vendedor_nombre: vendedorMap[row.codigo_vendedor]?.nombre_completo || `Vendedor #${row.codigo_vendedor}`,
    vendedor_id: vendedorMap[row.codigo_vendedor]?.id,
  }));
}

export async function getVentasResumen(anio?: number): Promise<VentasResumenConVendedor[]> {
  const supabase = getSupabaseClient();

  let query = supabase.from('ventas_resumen_mensual').select('*');

  if (anio) {
    query = query.eq('anio', anio);
  }

  const { data, error } = await query.order('anio').order('mes').order('codigo_vendedor');

  if (error) {
    console.error('Error fetching ventas resumen:', error);
    return [];
  }

  const vendedorMap = await getVendedorMap();
  return enrichWithVendedor(data || [], vendedorMap);
}

export async function getVentasResumenPorVendedor(
  codigoVendedor: number,
  anio?: number
): Promise<VentasResumenConVendedor[]> {
  const supabase = getSupabaseClient();

  let query = supabase
    .from('ventas_resumen_mensual')
    .select('*')
    .eq('codigo_vendedor', codigoVendedor);

  if (anio) {
    query = query.eq('anio', anio);
  }

  const { data, error } = await query.order('anio').order('mes');

  if (error) {
    console.error('Error fetching ventas resumen por vendedor:', error);
    return [];
  }

  const vendedorMap = await getVendedorMap();
  return enrichWithVendedor(data || [], vendedorMap);
}

export async function getAniosDisponibles(): Promise<number[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('ventas_resumen_mensual')
    .select('anio')
    .order('anio');

  if (error || !data) return [];

  return [...new Set(data.map((r: { anio: number }) => r.anio))];
}

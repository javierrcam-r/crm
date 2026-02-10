import { getSupabaseClient } from '@/lib/supabase/client';

export interface SidebarConfigItem {
  menu_key: string;
  menu_label: string;
  rol: string;
  visible: boolean;
}

// All possible menu items that can be configured
export const ALL_MENU_ITEMS = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'clientes', label: 'Clientes' },
  { key: 'calendario', label: 'Calendario' },
  { key: 'mapa', label: 'Mapa Visitas' },
  { key: 'productos', label: 'Productos' },
  { key: 'pedidos', label: 'Pedidos' },
  { key: 'eventos', label: 'Eventos' },
  { key: 'reportes', label: 'Reportes' },
  { key: 'actividades', label: 'Actividades Estratégicas' },
  { key: 'supervisores', label: 'Panel Supervisor' },
  { key: 'vendedores', label: 'Ver Vendedores' },
  { key: 'gestion_clientes', label: 'Gestión Clientes' },
  { key: 'usuarios', label: 'Usuarios' },
  { key: 'configuracion', label: 'Configuración' },
];

export const ALL_ROLES = [
  { key: 'vendedor', label: 'Vendedor' },
  { key: 'supervisor', label: 'Supervisor' },
  { key: 'supervisor_nivel1', label: 'Supervisor N1' },
  { key: 'supervisor_vendedor', label: 'Sup. + Vendedor' },
  { key: 'marketing', label: 'Marketing' },
  { key: 'tecnico', label: 'Técnico' },
];

export async function getSidebarConfig(): Promise<SidebarConfigItem[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('sidebar_config')
    .select('menu_key, menu_label, rol, visible');
  if (error) throw error;
  return data || [];
}

export async function setSidebarVisibility(menuKey: string, menuLabel: string, rol: string, visible: boolean) {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('sidebar_config')
    .upsert(
      { menu_key: menuKey, menu_label: menuLabel, rol, visible, updated_at: new Date().toISOString() },
      { onConflict: 'menu_key,rol' }
    );
  if (error) throw error;
}

export async function bulkSetSidebarVisibility(items: { menu_key: string; menu_label: string; rol: string; visible: boolean }[]) {
  const supabase = getSupabaseClient();
  const rows = items.map(i => ({ ...i, updated_at: new Date().toISOString() }));
  // Batch in groups of 100
  for (let i = 0; i < rows.length; i += 100) {
    const batch = rows.slice(i, i + 100);
    const { error } = await supabase
      .from('sidebar_config')
      .upsert(batch, { onConflict: 'menu_key,rol' });
    if (error) throw error;
  }
}

// Helper: check if a menu item is visible for a role
export function isMenuVisible(config: SidebarConfigItem[], menuKey: string, rol: string): boolean {
  const entry = config.find(c => c.menu_key === menuKey && c.rol === rol);
  // If no config exists, default to visible
  return entry ? entry.visible : true;
}

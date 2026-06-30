import type { UserRole } from '@/types/database';

/** Roles que participan en ventas: metas, cartera, listados de vendedores, etc. */
export const SALES_VENDOR_ROLES: UserRole[] = ['vendedor', 'supervisor_vendedor', 'vendedor_tecnico'];

export function isSalesVendorRole(rol: string | null | undefined): rol is UserRole {
  return !!rol && SALES_VENDOR_ROLES.includes(rol as UserRole);
}

/** Roles que ven eventos con la vista de vendedor (no supervisor). */
export function isEventVendorRole(rol: string | null | undefined): boolean {
  return rol === 'vendedor' || rol === 'vendedor_tecnico';
}

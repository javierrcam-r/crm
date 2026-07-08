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

/** Roles con acceso supervisor al módulo de eventos (ver todos, asignar editores). */
export const EVENT_SUPERVISOR_ROLES: UserRole[] = [
  'admin',
  'supervisor',
  'supervisor_nivel1',
  'supervisor_vendedor',
];

export function isEventSupervisorRole(rol: string | null | undefined): boolean {
  return !!rol && EVENT_SUPERVISOR_ROLES.includes(rol as UserRole);
}

/** Puede editar por completo un evento (supervisor o colaborador asignado). */
export function canFullyEditEvent(
  profile: { id: string; rol: string } | null | undefined,
  editorIds: string[],
): boolean {
  if (!profile) return false;
  if (isEventSupervisorRole(profile.rol)) return true;
  return editorIds.includes(profile.id);
}

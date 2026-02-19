import type { UserProfile } from '@/types/database';

const USER_STORAGE_KEY = 'crm_user_profile';

export function getCurrentUserProfile(): UserProfile | null {
  if (typeof window === 'undefined') return null;
  
  try {
    const stored = localStorage.getItem(USER_STORAGE_KEY);
    if (!stored) return null;
    return JSON.parse(stored) as UserProfile;
  } catch {
    return null;
  }
}

export function getCurrentUserId(): string | null {
  const profile = getCurrentUserProfile();
  return profile?.user_id || profile?.id || null;
}

export function isCurrentUserAdmin(): boolean {
  const profile = getCurrentUserProfile();
  return profile?.rol === 'admin';
}

export function isCurrentUserSupervisor(): boolean {
  const profile = getCurrentUserProfile();
  if (!profile) return false;
  return profile.rol === 'admin' || profile.rol === 'supervisor' || profile.rol === 'supervisor_nivel1' || profile.rol === 'supervisor_vendedor';
}

import { getSupabaseClient } from '@/lib/supabase/client';
import { getCurrentUserProfile } from '@/lib/auth/getCurrentUserId';

export interface AppNotification {
  id: string;
  user_id: string;
  title: string;
  body: string;
  type: 'actividad' | 'evento' | 'sistema';
  reference_id: string | null;
  reference_url: string | null;
  read: boolean;
  created_by: string | null;
  created_by_name: string | null;
  created_at: string;
}

export async function getMyNotifications(limit = 30): Promise<AppNotification[]> {
  const supabase = getSupabaseClient();
  const profile = getCurrentUserProfile();
  if (!profile) return [];

  const { data, error } = await supabase
    .from('app_notifications')
    .select('*')
    .eq('user_id', profile.id)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching notifications:', error);
    return [];
  }
  return (data || []) as AppNotification[];
}

export async function getUnreadCount(): Promise<number> {
  const supabase = getSupabaseClient();
  const profile = getCurrentUserProfile();
  if (!profile) return 0;

  const { count, error } = await supabase
    .from('app_notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', profile.id)
    .eq('read', false);

  if (error) return 0;
  return count || 0;
}

export async function markAsRead(notificationId: string): Promise<void> {
  const supabase = getSupabaseClient();
  await supabase
    .from('app_notifications')
    .update({ read: true })
    .eq('id', notificationId);
}

export async function markAllAsRead(): Promise<void> {
  const supabase = getSupabaseClient();
  const profile = getCurrentUserProfile();
  if (!profile) return;

  await supabase
    .from('app_notifications')
    .update({ read: true })
    .eq('user_id', profile.id)
    .eq('read', false);
}

export async function createNotificationsForUsers(
  userIds: string[],
  notification: {
    title: string;
    body: string;
    type: 'actividad' | 'evento' | 'sistema';
    reference_id?: string;
    reference_url?: string;
  }
): Promise<void> {
  const supabase = getSupabaseClient();
  const profile = getCurrentUserProfile();
  if (!profile || userIds.length === 0) return;

  const rows = userIds
    .filter(id => id !== profile.id)
    .map(userId => ({
      user_id: userId,
      title: notification.title,
      body: notification.body,
      type: notification.type,
      reference_id: notification.reference_id || null,
      reference_url: notification.reference_url || null,
      created_by: profile.id,
      created_by_name: profile.nombre_completo,
      read: false,
    }));

  if (rows.length === 0) return;

  const { error } = await supabase.from('app_notifications').insert(rows);
  if (error) {
    console.error('Error creating notifications:', error);
  }
}

// =====================================================
// SERVICIO: Actividades y Reuniones - Supervisor Nivel 1
// =====================================================

import { getSupabaseClient } from '@/lib/supabase/client';
import type { 
  Activity, 
  ActivityInsert, 
  ActivityUpdate, 
  ActivityFilters,
  ActivityParticipant,
  ActivityParticipantInsert,
  ActivityComment,
  ActivityCommentInsert,
  ActivityStatus
} from '@/types/database';
import { getCurrentUserProfile, getCurrentUserId, isCurrentUserAdmin } from '@/lib/auth/getCurrentUserId';

// =====================================================
// ACTIVITIES CRUD
// =====================================================

export async function getActivities(filters?: ActivityFilters): Promise<Activity[]> {
  const supabase = getSupabaseClient();
  
  // Primero obtener actividades
  let query = supabase
    .from('activities')
    .select('*')
    .order('fecha_inicio', { ascending: true });
  
  if (filters?.tipo) {
    query = query.eq('tipo', filters.tipo);
  }
  
  if (filters?.estado) {
    query = query.eq('estado', filters.estado);
  }
  
  if (filters?.prioridad) {
    query = query.eq('prioridad', filters.prioridad);
  }
  
  if (filters?.date_from) {
    query = query.gte('fecha_inicio', filters.date_from);
  }
  
  if (filters?.date_to) {
    query = query.lte('fecha_inicio', filters.date_to);
  }
  
  const { data: activities, error } = await query;
  
  if (error) {
    console.error('Error fetching activities:', error);
    throw error;
  }
  
  if (!activities || activities.length === 0) {
    return [];
  }
  
  // Obtener participantes para todas las actividades
  const activityIds = activities.map(a => a.id);
  const { data: participants, error: partError } = await supabase
    .from('activity_participants')
    .select(`
      *,
      user_profile:users_profile(id, nombre_completo, email, rol)
    `)
    .in('activity_id', activityIds);
  
  if (partError) {
    console.error('Error fetching participants:', partError);
    // No lanzar error, solo continuar sin participantes
  }
  
  // Combinar actividades con sus participantes
  const activitiesWithParticipants = activities.map(activity => ({
    ...activity,
    participants: (participants || []).filter(p => p.activity_id === activity.id)
  }));
  
  return activitiesWithParticipants as Activity[];
}

export async function getActivityById(id: string): Promise<Activity | null> {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('activities')
    .select(`
      *,
      participants:activity_participants(
        *,
        user_profile:users_profile(id, nombre_completo, email, rol)
      ),
      comments:activity_comments(
        *,
        user_profile:users_profile(id, nombre_completo)
      ),
      creator:users_profile!activities_created_by_user_id_fkey(id, nombre_completo, email)
    `)
    .eq('id', id)
    .single();
  
  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  
  return data as Activity;
}

export async function createActivity(activity: ActivityInsert): Promise<Activity> {
  const supabase = getSupabaseClient();
  const currentUserProfile = getCurrentUserProfile();
  const currentUserProfileId = currentUserProfile?.id;
  
  if (!currentUserProfileId) {
    throw new Error('No user profile found');
  }
  
  const { data, error } = await supabase
    .from('activities')
    .insert({
      ...activity,
      created_by_user_id: currentUserProfileId
    })
    .select()
    .single();
  
  if (error) {
    console.error('Error creating activity:', error);
    throw error;
  }
  
  return data as Activity;
}

export async function updateActivity(id: string, updates: ActivityUpdate): Promise<Activity> {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('activities')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  
  if (error) {
    console.error('Error updating activity:', error);
    throw error;
  }
  
  return data as Activity;
}

export async function updateActivityStatus(id: string, estado: ActivityStatus): Promise<Activity> {
  return updateActivity(id, { estado });
}

export async function deleteActivity(id: string): Promise<void> {
  const supabase = getSupabaseClient();
  
  const { error } = await supabase
    .from('activities')
    .delete()
    .eq('id', id);
  
  if (error) {
    console.error('Error deleting activity:', error);
    throw error;
  }
}

// =====================================================
// PARTICIPANTS
// =====================================================

export async function addParticipant(participant: ActivityParticipantInsert): Promise<ActivityParticipant> {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('activity_participants')
    .insert(participant)
    .select(`
      *,
      user_profile:users_profile(id, nombre_completo, email, rol)
    `)
    .single();
  
  if (error) {
    console.error('Error adding participant:', error);
    throw error;
  }
  
  return data as ActivityParticipant;
}

export async function addMultipleParticipants(activityId: string, userProfileIds: string[]): Promise<ActivityParticipant[]> {
  const supabase = getSupabaseClient();
  
  const participants = userProfileIds.map(userProfileId => ({
    activity_id: activityId,
    user_profile_id: userProfileId
  }));
  
  const { data, error } = await supabase
    .from('activity_participants')
    .insert(participants)
    .select(`
      *,
      user_profile:users_profile(id, nombre_completo, email, rol)
    `);
  
  if (error) {
    console.error('Error adding participants:', error);
    throw error;
  }
  
  return (data || []) as ActivityParticipant[];
}

export async function removeParticipant(activityId: string, userProfileId: string): Promise<void> {
  const supabase = getSupabaseClient();
  
  const { error } = await supabase
    .from('activity_participants')
    .delete()
    .eq('activity_id', activityId)
    .eq('user_profile_id', userProfileId);
  
  if (error) {
    console.error('Error removing participant:', error);
    throw error;
  }
}

export async function updateParticipantConfirmation(
  activityId: string, 
  userProfileId: string, 
  estado_confirmacion: 'pendiente' | 'confirmado' | 'rechazado' | 'tentativo'
): Promise<ActivityParticipant> {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('activity_participants')
    .update({ estado_confirmacion })
    .eq('activity_id', activityId)
    .eq('user_profile_id', userProfileId)
    .select()
    .single();
  
  if (error) {
    console.error('Error updating participant confirmation:', error);
    throw error;
  }
  
  return data as ActivityParticipant;
}

export async function markAttendance(activityId: string, userProfileId: string, asistio: boolean): Promise<void> {
  const supabase = getSupabaseClient();
  
  const { error } = await supabase
    .from('activity_participants')
    .update({ asistio })
    .eq('activity_id', activityId)
    .eq('user_profile_id', userProfileId);
  
  if (error) {
    console.error('Error marking attendance:', error);
    throw error;
  }
}

// =====================================================
// COMMENTS
// =====================================================

export async function addComment(comment: ActivityCommentInsert): Promise<ActivityComment> {
  const supabase = getSupabaseClient();
  const currentUserProfile = getCurrentUserProfile();
  const currentUserProfileId = currentUserProfile?.id;
  
  if (!currentUserProfileId) {
    throw new Error('No user profile found');
  }
  
  const { data, error } = await supabase
    .from('activity_comments')
    .insert({
      ...comment,
      user_profile_id: currentUserProfileId
    })
    .select(`
      *,
      user_profile:users_profile(id, nombre_completo)
    `)
    .single();
  
  if (error) {
    console.error('Error adding comment:', error);
    throw error;
  }
  
  return data as ActivityComment;
}

export async function getActivityComments(activityId: string): Promise<ActivityComment[]> {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('activity_comments')
    .select(`
      *,
      user_profile:users_profile(id, nombre_completo)
    `)
    .eq('activity_id', activityId)
    .order('created_at', { ascending: true });
  
  if (error) {
    console.error('Error fetching comments:', error);
    throw error;
  }
  
  return (data || []) as ActivityComment[];
}

export async function deleteComment(commentId: string): Promise<void> {
  const supabase = getSupabaseClient();
  
  const { error } = await supabase
    .from('activity_comments')
    .delete()
    .eq('id', commentId);
  
  if (error) {
    console.error('Error deleting comment:', error);
    throw error;
  }
}

// =====================================================
// STATISTICS
// =====================================================

export async function getActivityStats() {
  const supabase = getSupabaseClient();
  const currentUserProfile = getCurrentUserProfile();
  const currentUserProfileId = currentUserProfile?.id;
  
  const { data: activities, error } = await supabase
    .from('activities')
    .select('estado, tipo')
    .eq('created_by_user_id', currentUserProfileId || '');
  
  if (error) {
    console.error('Error fetching activity stats:', error);
    return {
      total: 0,
      planificacion: 0,
      haciendo: 0,
      realizado: 0,
      cancelado: 0,
      porTipo: {}
    };
  }
  
  const stats = {
    total: activities?.length || 0,
    planificacion: activities?.filter(a => a.estado === 'planificacion').length || 0,
    haciendo: activities?.filter(a => a.estado === 'haciendo').length || 0,
    realizado: activities?.filter(a => a.estado === 'realizado').length || 0,
    cancelado: activities?.filter(a => a.estado === 'cancelado').length || 0,
    porTipo: {} as Record<string, number>
  };
  
  activities?.forEach(a => {
    stats.porTipo[a.tipo] = (stats.porTipo[a.tipo] || 0) + 1;
  });
  
  return stats;
}

// =====================================================
// CALENDAR HELPERS
// =====================================================

export async function getActivitiesForCalendar(startDate: string, endDate: string): Promise<Activity[]> {
  return getActivities({
    date_from: startDate,
    date_to: endDate
  });
}

export async function getTodayActivities(): Promise<Activity[]> {
  const today = new Date();
  const startOfDay = new Date(today.setHours(0, 0, 0, 0)).toISOString();
  const endOfDay = new Date(today.setHours(23, 59, 59, 999)).toISOString();
  
  return getActivities({
    date_from: startOfDay,
    date_to: endOfDay
  });
}

export async function getUpcomingActivities(limit: number = 5): Promise<Activity[]> {
  const supabase = getSupabaseClient();
  const currentUserProfile = getCurrentUserProfile();
  const currentUserProfileId = currentUserProfile?.id;
  const now = new Date().toISOString();
  
  const { data, error } = await supabase
    .from('activities')
    .select(`
      *,
      participants:activity_participants(
        *,
        user_profile:users_profile(id, nombre_completo, email)
      )
    `)
    .gte('fecha_inicio', now)
    .neq('estado', 'cancelado')
    .neq('estado', 'realizado')
    .or(`created_by_user_id.eq.${currentUserProfileId}`)
    .order('fecha_inicio', { ascending: true })
    .limit(limit);
  
  if (error) {
    console.error('Error fetching upcoming activities:', error);
    return [];
  }
  
  return (data || []) as Activity[];
}

// =====================================================
// GET ALL USERS FOR PARTICIPANT SELECTION
// =====================================================

export async function getAllUsersForSelection() {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('users_profile')
    .select('id, nombre_completo, email, rol')
    .eq('activo', true)
    .order('nombre_completo');
  
  if (error) {
    console.error('Error fetching users:', error);
    return [];
  }
  
  return data || [];
}

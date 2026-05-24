import { getSupabaseClient } from '@/lib/supabase/client';

export interface EventPrize {
  id: string;
  event_id: string;
  nombre: string;
  descripcion: string | null;
  cantidad: number;
  imagen_url: string | null;
  orden: number;
  created_at: string;
}

export interface EventPrizeWinner {
  id: string;
  event_id: string;
  prize_id: string;
  participant_id: string;
  participant_name: string;
  won_at: string;
}

export async function getEventPrizes(eventId: string): Promise<EventPrize[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('event_prizes')
    .select('*')
    .eq('event_id', eventId)
    .order('orden', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function createEventPrize(
  eventId: string,
  prize: { nombre: string; descripcion?: string; cantidad?: number },
): Promise<EventPrize> {
  const supabase = getSupabaseClient();
  const { data: existing } = await supabase
    .from('event_prizes')
    .select('orden')
    .eq('event_id', eventId)
    .order('orden', { ascending: false })
    .limit(1);

  const nextOrder = existing && existing.length > 0 ? existing[0].orden + 1 : 0;

  const { data, error } = await supabase
    .from('event_prizes')
    .insert({
      event_id: eventId,
      nombre: prize.nombre,
      descripcion: prize.descripcion || null,
      cantidad: prize.cantidad || 1,
      orden: nextOrder,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteEventPrize(prizeId: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('event_prizes')
    .delete()
    .eq('id', prizeId);
  if (error) throw error;
}

export async function getEventPrizeWinners(eventId: string): Promise<(EventPrizeWinner & { prize_name?: string })[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('event_prize_winners')
    .select('*, event_prizes(nombre)')
    .eq('event_id', eventId)
    .order('won_at', { ascending: false });
  if (error) throw error;
  return (data || []).map((w: any) => ({
    ...w,
    prize_name: w.event_prizes?.nombre || 'Premio',
  }));
}

export async function deletePrizeWinner(winnerId: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('event_prize_winners')
    .delete()
    .eq('id', winnerId);
  if (error) throw error;
}

export async function savePrizeWinner(
  eventId: string,
  prizeId: string,
  participantId: string,
  participantName: string,
): Promise<EventPrizeWinner> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('event_prize_winners')
    .insert({
      event_id: eventId,
      prize_id: prizeId,
      participant_id: participantId,
      participant_name: participantName,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

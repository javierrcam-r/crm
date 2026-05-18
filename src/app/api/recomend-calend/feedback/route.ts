import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const allowedStatuses = new Set([
  'generated',
  'accepted',
  'rejected',
  'created',
  'completed',
  'cancelled',
  'no_show',
  'reprogrammed',
]);

export async function POST(req: NextRequest) {
  try {
    const { recommendationId, status, visitId, feedbackReason } = await req.json();

    if (!recommendationId) {
      return NextResponse.json({ error: 'recommendationId requerido' }, { status: 400 });
    }

    if (!allowedStatuses.has(status)) {
      return NextResponse.json({ error: 'status invalido' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const update: Record<string, unknown> = {
      status,
    };

    if (status === 'accepted' || status === 'rejected' || status === 'created') {
      update.responded_at = now;
    }

    if (status === 'completed' || status === 'cancelled' || status === 'no_show' || status === 'reprogrammed') {
      update.outcome_at = now;
    }

    if (visitId) update.created_visit_id = visitId;
    if (feedbackReason) update.feedback_reason = feedbackReason;

    const { data, error } = await supabase
      .from('agenda_recommendations')
      .update(update)
      .eq('id', recommendationId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ recommendation: data });
  } catch (err: any) {
    console.error('Recommendation feedback error:', err);
    return NextResponse.json({ error: err.message || 'Error interno' }, { status: 500 });
  }
}

import { NextRequest } from 'next/server';
import { streamChat, type ChatMessage } from '@/lib/chat/agent';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const maxDuration = 120;

async function verifyAdmin(userProfileId: string): Promise<boolean> {
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
  const { data } = await db
    .from('users_profile')
    .select('rol')
    .eq('id', userProfileId)
    .eq('activo', true)
    .single();
  return data?.rol === 'admin';
}

export async function POST(request: NextRequest) {
  try {
    const { messages, userProfileId } = (await request.json()) as {
      messages: ChatMessage[];
      userProfileId: string;
    };

    if (!userProfileId) {
      return new Response(JSON.stringify({ error: 'No autenticado' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }

    const isAdmin = await verifyAdmin(userProfileId);
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
    }

    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY.startsWith('sk-REPLACE')) {
      return new Response(JSON.stringify({ error: 'OPENAI_API_KEY no configurada en el servidor' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of streamChat(messages)) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: chunk })}\n\n`));
          }
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (err: any) {
          console.error('Chat stream error:', err);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: err.message || 'Error interno' })}\n\n`));
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (err: any) {
    console.error('Chat API error:', err);
    return new Response(JSON.stringify({ error: err.message || 'Error interno' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

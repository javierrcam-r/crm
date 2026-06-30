import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ChatOpenAI } from '@langchain/openai';

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function POST(req: NextRequest) {
  try {
    const { customerId, userId } = await req.json();
    if (!customerId || !userId) return NextResponse.json({ error: 'Missing params' }, { status: 400 });

    const { data: profile } = await db.from('users_profile').select('rol').eq('id', userId).single();
    if (!profile || !['admin', 'supervisor', 'supervisor_nivel1', 'supervisor_vendedor', 'vendedor', 'vendedor_tecnico'].includes(profile.rol)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const [customerRes, visitsRes] = await Promise.all([
      db.from('customers').select('nombre, ciudad, etapa_embudo, calidad_pago, categoria_compra, tipo').eq('id', customerId).single(),
      db.from('visits').select('scheduled_at, status, objetivo, resultado, observaciones').is('deleted_at', null).eq('customer_id', customerId).order('scheduled_at', { ascending: false }).limit(30),
    ]);

    const customer = customerRes.data;
    const visits = visitsRes.data || [];
    if (!customer) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });
    if (visits.length === 0) return NextResponse.json({ summary: 'No hay visitas registradas para este cliente.', recommendation: 'Programa una primera visita para iniciar la relación comercial.' });

    const byStatus: Record<string, number> = {};
    visits.forEach(v => { byStatus[v.status] = (byStatus[v.status] || 0) + 1; });

    const visitLines = visits.slice(0, 20).map(v => {
      const d = new Date(v.scheduled_at).toISOString().split('T')[0];
      return `- ${d} [${v.status}] Objetivo: ${v.objetivo || 'N/A'} | Resultado: ${v.resultado || 'Pendiente'} | Obs: ${v.observaciones || '-'}`;
    }).join('\n');

    const prompt = `Eres un analista de CRM. Genera un resumen ejecutivo y una recomendación estratégica para el siguiente cliente y su historial de visitas.

CLIENTE: ${customer.nombre}
Ciudad: ${customer.ciudad || 'N/A'}
Etapa embudo: ${customer.etapa_embudo}
Calidad de pago: ${customer.calidad_pago || 'N/A'}
Tipo: ${customer.tipo}

ESTADÍSTICAS DE VISITAS (total: ${visits.length}):
${Object.entries(byStatus).map(([k, v]) => `- ${k}: ${v}`).join('\n')}

ÚLTIMAS VISITAS:
${visitLines}

Responde en español con EXACTAMENTE este formato JSON (sin markdown, sin backticks):
{"summary": "Resumen ejecutivo de 2-3 oraciones sobre la trayectoria con este cliente", "recommendation": "Recomendación estratégica específica de 1-2 oraciones"}`;

    const llm = new ChatOpenAI({
      modelName: 'gpt-4.1-mini',
      temperature: 0.3,
      openAIApiKey: process.env.OPENAI_API_KEY,
      maxTokens: 300,
    });

    const result = await llm.invoke(prompt);
    const text = typeof result.content === 'string' ? result.content : '';

    try {
      const parsed = JSON.parse(text);
      return NextResponse.json(parsed);
    } catch {
      return NextResponse.json({ summary: text, recommendation: '' });
    }
  } catch (err: any) {
    console.error('Visit summary error:', err);
    return NextResponse.json({ error: err.message || 'Error interno' }, { status: 500 });
  }
}

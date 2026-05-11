import { NextRequest, NextResponse } from 'next/server';
import { ChatOpenAI } from '@langchain/openai';

export async function POST(req: NextRequest) {
  try {
    const { text, customerName, visitObjective, objectiveTags } = await req.json();
    if (!text) return NextResponse.json({ error: 'Texto requerido' }, { status: 400 });

    const now = new Date().toLocaleString('es-EC', { timeZone: 'America/Guayaquil' });

    const tags: string[] = Array.isArray(objectiveTags) ? objectiveTags : [];
    const tagLabels: Record<string, string> = {
      VENTA: 'Venta',
      COBRO: 'Cobro',
      SEGUIMIENTO: 'Seguimiento',
      PROSPECCION: 'Prospección',
      ENTREGA: 'Entrega',
      RECLAMO: 'Reclamo',
    };

    let objectiveResultsSection = '';
    if (tags.length > 0) {
      const tagList = tags.map(t => `"${t}": true/false (¿se logró ${tagLabels[t] || t}?)`).join(',\n    ');
      objectiveResultsSection = `
  "objectiveResults": {
    ${tagList}
  },`;
    }

    const prompt = `Eres un asistente de CRM. El vendedor acaba de describir lo que pasó en una visita a un cliente. Extrae la información estructurada.

FECHA/HORA ACTUAL: ${now}
${customerName ? `CLIENTE: ${customerName}` : ''}
${visitObjective ? `OBJETIVO ORIGINAL DE LA VISITA: ${visitObjective}` : ''}
${tags.length > 0 ? `OBJETIVOS ESPECÍFICOS DE LA VISITA: ${tags.map(t => tagLabels[t] || t).join(', ')}` : ''}

DESCRIPCIÓN DEL VENDEDOR:
"${text}"

Extrae y devuelve EXACTAMENTE este JSON (sin markdown, sin backticks):
{
  "resultado": "Resumen claro y profesional del resultado de la visita (máx 2-3 oraciones)",
  "observaciones": "Observaciones adicionales relevantes, detalles del cliente, productos de interés, etc. (vacío si no hay)",
  "nextAction": "Próxima acción a realizar (vacío si no se mencionó)",
  "nextVisitDate": "Fecha/hora ISO para la próxima visita si se mencionó reprogramación (null si no). Calcula a partir de la fecha actual: ${now}. Si dice 'mañana' suma 1 día, 'la próxima semana' suma 7 días, 'en 15 días' suma 15, etc. Usa horario laboral (9:00-17:00). Formato: YYYY-MM-DDTHH:mm",
  "shouldScheduleNext": true/false si se debe programar una siguiente visita${objectiveResultsSection ? ',' + objectiveResultsSection : ''}
}

REGLAS:
- Sé profesional y conciso en el resultado
- Separa resultado de observaciones (resultado = qué pasó, observaciones = detalles extra)
- Si mencionan que hay que volver, reprogramar, hacer seguimiento, o cualquier indicación de próxima visita, pon shouldScheduleNext en true
- Si dan fecha específica, calcúlala desde la fecha actual
- Si no mencionan nada sobre próxima visita, shouldScheduleNext es false y nextVisitDate es null${tags.length > 0 ? '\n- Para objectiveResults: analiza la descripción del vendedor y determina si cada objetivo se cumplió (true) o no (false). Si dice que vendió, cobró, entregó, etc., pon true. Si dice que no vendió, no cobró, o no lo menciona, pon false.' : ''}
- Responde SOLO el JSON, nada más`;

    const llm = new ChatOpenAI({
      modelName: 'gpt-4.1-mini',
      temperature: 0.2,
      openAIApiKey: process.env.OPENAI_API_KEY,
      maxTokens: 500,
    });

    const result = await llm.invoke(prompt);
    const raw = typeof result.content === 'string' ? result.content : '';

    try {
      const parsed = JSON.parse(raw);
      return NextResponse.json(parsed);
    } catch {
      return NextResponse.json({
        resultado: raw,
        observaciones: '',
        nextAction: '',
        nextVisitDate: null,
        shouldScheduleNext: false,
        objectiveResults: {},
      });
    }
  } catch (err: any) {
    console.error('Parse visit error:', err);
    return NextResponse.json({ error: err.message || 'Error interno' }, { status: 500 });
  }
}

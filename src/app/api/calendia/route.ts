import { NextRequest, NextResponse } from 'next/server';
import { ChatOpenAI } from '@langchain/openai';

export async function POST(req: NextRequest) {
  try {
    const { text, customerList } = await req.json();
    if (!text) return NextResponse.json({ error: 'Texto requerido' }, { status: 400 });

    const now = new Date().toLocaleString('es-EC', { timeZone: 'America/Guayaquil' });
    const dayOfWeek = new Date().toLocaleDateString('es-EC', { weekday: 'long', timeZone: 'America/Guayaquil' });

    const customerContext = customerList?.length
      ? `\nLISTA DE CLIENTES DISPONIBLES (usa EXACTAMENTE el nombre de esta lista para el match):\n${customerList.map((c: string) => `- ${c}`).join('\n')}\n`
      : '';

    const prompt = `Eres CalendIA, el asistente de agenda del CRM. El vendedor te da una instrucción en lenguaje natural para programar una o más entradas en su calendario. Pueden ser de DOS TIPOS:

1. **VISITA** (type: "visita"): Una visita a un CLIENTE específico. Siempre tiene un cliente asociado.
2. **ACTIVIDAD DIARIA** (type: "actividad"): Una tarea, reunión interna, recordatorio o bloqueo de tiempo que NO involucra a un cliente externo. Ej: "reunión de equipo", "capacitación", "enviar reportes", "revisar cartera", "planificación semanal", "almuerzo con jefe".

FECHA/HORA ACTUAL: ${dayOfWeek}, ${now}
${customerContext}
INSTRUCCIÓN DEL VENDEDOR:
"${text}"

Extrae y devuelve EXACTAMENTE este JSON (sin markdown, sin backticks):
{
  "items": [
    {
      "type": "visita" | "actividad",
      "customerName": "Nombre exacto del cliente (SOLO si type='visita'; vacío si es actividad)",
      "title": "Título breve (SOLO si type='actividad'; vacío si es visita)",
      "date": "YYYY-MM-DD",
      "time": "HH:mm",
      "objetivo": "Objetivo/descripción",
      "location": "Lugar o enlace si se mencionó (vacío si no)"
    }
  ],
  "message": "Confirmación breve en español",
  "ambiguous": false,
  "ambiguousMessage": ""
}

REGLAS DE CLASIFICACIÓN (CRÍTICAS):
- Si el usuario menciona un NOMBRE DE PERSONA/EMPRESA que coincide con la lista de clientes → type="visita".
- Si el usuario menciona explícitamente "visita", "visitar a", "reunión con [cliente]", "ver a [cliente]" y hay un cliente identificable → type="visita".
- Si dice "actividad diaria", "tarea", "reunión interna", "capacitación", "recordatorio", "bloqueo", "planificación", "reporte", "llamada interna", o no hay un cliente identificable → type="actividad".
- En "actividad", NO pongas customerName. En "visita", NO pongas title (el cliente ES el título).
- Si hay ambigüedad sobre si es visita o actividad, prefiere "actividad" y pon ambiguous=true explicando.

REGLAS DE DATOS:
- FECHA: Desde la fecha actual (${now}). "mañana"=+1, "lunes"=próx. lunes, "pasado mañana"=+2, "la próxima semana"=+7, "el 20"=día 20 (actual o siguiente mes si ya pasó). Respeta el día de la semana correcto.
- HORA: "a las 10"=10:00, "en la mañana"=09:00, "en la tarde"=14:00, "al mediodía"=12:00, "a las 3 de la tarde"=15:00. Si no dicen hora, pon 09:00.
- CLIENTE (solo para type=visita): Match fuzzy en la lista. "gordillo"→cliente con "gordillo". Si hay varios posibles, ambiguous=true.
- TITLE (solo para type=actividad): Resume la actividad en 3-6 palabras. Ej: "Reunión de equipo", "Revisar reportes", "Capacitación ventas".
- OBJETIVO: Si no es explícito, infiere uno profesional ("Seguimiento comercial", "Cobro de cartera", "Planificación semanal", etc.).
- MÚLTIPLES: Si pide varias cosas en un mensaje, devuelve múltiples items (pueden mezclar tipos).
- message amigable confirmando todo.
- Responde SOLO el JSON.`;

    const llm = new ChatOpenAI({
      modelName: 'gpt-4.1-mini',
      temperature: 0.1,
      openAIApiKey: process.env.OPENAI_API_KEY,
      maxTokens: 900,
    });

    const result = await llm.invoke(prompt);
    const raw = typeof result.content === 'string' ? result.content : '';

    try {
      const parsed = JSON.parse(raw);
      // Back-compat: if legacy "visits" is returned, map to items
      if (!parsed.items && Array.isArray(parsed.visits)) {
        parsed.items = parsed.visits.map((v: any) => ({ ...v, type: 'visita', title: '' }));
      }
      return NextResponse.json(parsed);
    } catch {
      return NextResponse.json({
        items: [],
        message: raw,
        ambiguous: true,
        ambiguousMessage: 'No pude interpretar la instrucción. Intenta de nuevo con más detalle.',
      });
    }
  } catch (err: any) {
    console.error('CalendIA error:', err);
    return NextResponse.json({ error: err.message || 'Error interno' }, { status: 500 });
  }
}

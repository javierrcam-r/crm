import { NextRequest, NextResponse } from 'next/server';
import { ChatOpenAI } from '@langchain/openai';

export async function POST(req: NextRequest) {
  try {
    const { originalInstruction, currentItems, refinementInstruction, customerList } = await req.json();
    if (!refinementInstruction) return NextResponse.json({ error: 'Instrucción de refinamiento requerida' }, { status: 400 });

    const now = new Date().toLocaleString('es-EC', { timeZone: 'America/Guayaquil' });
    const dayOfWeek = new Date().toLocaleDateString('es-EC', { weekday: 'long', timeZone: 'America/Guayaquil' });

    const customerContext = customerList?.length
      ? `\nLISTA DE CLIENTES DISPONIBLES (usa EXACTAMENTE el nombre de esta lista para el match):\n${customerList.slice(0, 500).map((c: string) => `- ${c}`).join('\n')}\n`
      : '';

    const currentStateJson = JSON.stringify(currentItems || [], null, 2);

    const prompt = `Eres CalendIA, el asistente de agenda del CRM. El vendedor ya pidió programar entradas en el calendario y ahora quiere ajustarlas con una nueva instrucción.

Las entradas pueden ser de DOS TIPOS:
1. **VISITA** (type: "visita"): A un cliente específico (customerName lleno, title vacío).
2. **ACTIVIDAD DIARIA** (type: "actividad"): Tarea/reunión interna sin cliente (title lleno, customerName vacío).

FECHA/HORA ACTUAL: ${dayOfWeek}, ${now}
${customerContext}
${originalInstruction ? `INSTRUCCIÓN ORIGINAL:\n"${originalInstruction}"\n` : ''}
ESTADO ACTUAL DE LAS ENTRADAS PROPUESTAS:
${currentStateJson}

NUEVA INSTRUCCIÓN DE REFINAMIENTO:
"${refinementInstruction}"

Aplica la nueva instrucción al estado actual. Puedes:
- Modificar una entrada existente (cambiar hora, fecha, cliente, título, objetivo, ubicación)
- Cambiar el TIPO de una entrada ("conviértela en actividad", "en realidad es una visita con Juan")
- Agregar nuevas entradas
- Eliminar entradas
- Reemplazar todas

Devuelve EXACTAMENTE este JSON (sin markdown, sin backticks):
{
  "items": [
    {
      "type": "visita" | "actividad",
      "customerName": "Nombre del cliente (solo si type='visita')",
      "title": "Título breve (solo si type='actividad')",
      "date": "YYYY-MM-DD",
      "time": "HH:mm",
      "objetivo": "Objetivo/descripción",
      "location": "Ubicación o enlace"
    }
  ],
  "message": "Confirmación breve del ajuste",
  "ambiguous": false,
  "ambiguousMessage": ""
}

REGLAS CRÍTICAS:
- CONSERVA las entradas que no se mencionen (a menos que pida "reemplaza todo" o "empieza de nuevo").
- "cambia la hora de Ana a las 3" → solo modifica la entrada de Ana, deja el resto igual.
- "conviértela en actividad diaria" → cambia type a "actividad", mueve customerName a title si aplica.
- "es una visita con Pedro" → cambia type a "visita", busca Pedro en la lista.
- "agrega una tarea de revisar reportes mañana" → nueva entrada type="actividad".
- "todas a las 3pm" → aplica a TODAS las entradas actuales.
- FECHA: ${dayOfWeek}, ${now}. "mañana"=+1, "lunes"=próx. lunes. Respeta días de la semana.
- HORA: "a las 10"=10:00, "en la tarde"=14:00, etc.
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
      if (!parsed.items && Array.isArray(parsed.visits)) {
        parsed.items = parsed.visits.map((v: any) => ({ ...v, type: 'visita', title: '' }));
      }
      return NextResponse.json(parsed);
    } catch {
      return NextResponse.json({
        items: currentItems || [],
        message: 'No pude aplicar el ajuste. Intenta con otras palabras.',
        ambiguous: true,
        ambiguousMessage: raw.slice(0, 200),
      });
    }
  } catch (err: any) {
    console.error('CalendIA refine error:', err);
    return NextResponse.json({ error: err.message || 'Error interno' }, { status: 500 });
  }
}

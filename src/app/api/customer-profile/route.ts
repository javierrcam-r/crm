import { NextRequest, NextResponse } from 'next/server';
import { ChatOpenAI } from '@langchain/openai';

export async function POST(req: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OPENAI_API_KEY no configurada' }, { status: 500 });
    }

    const { customer, visits, kpis } = await req.json();
    if (!customer?.nombre) {
      return NextResponse.json({ error: 'Datos del cliente requeridos' }, { status: 400 });
    }

    const visitList: any[] = Array.isArray(visits) ? visits : [];
    if (visitList.length === 0) {
      return NextResponse.json({
        resumen: 'Aún no hay visitas registradas para este cliente, por lo que no es posible generar un perfil basado en su actividad.',
        insights: [],
        recomendaciones: ['Programa una primera visita para comenzar a construir el historial del cliente.'],
      });
    }

    // Limitamos a las últimas 40 visitas para acotar el prompt.
    const recent = visitList.slice(0, 40);
    const visitsText = recent
      .map((v, i) => {
        const partes = [
          `#${i + 1}`,
          v.fecha ? `Fecha: ${v.fecha}` : '',
          v.estado ? `Estado: ${v.estado}` : '',
          v.objetivo ? `Objetivo: ${v.objetivo}` : '',
          v.resultado ? `Resultado: ${v.resultado}` : '',
          v.observaciones ? `Notas: ${v.observaciones}` : '',
        ].filter(Boolean);
        return partes.join(' | ');
      })
      .join('\n');

    const perfilComercial = [
      customer.tipo ? `Tipo: ${customer.tipo}` : '',
      customer.etapa_embudo ? `Etapa embudo: ${customer.etapa_embudo}` : '',
      customer.forma_pago ? `Forma de pago: ${customer.forma_pago}` : '',
      customer.calidad_pago ? `Calidad de pago: ${customer.calidad_pago}` : '',
      customer.categoria_compra ? `Categoría de compra: ${customer.categoria_compra}` : '',
      customer.notas ? `Notas: ${customer.notas}` : '',
    ].filter(Boolean).join(' | ');

    const kpisText = kpis
      ? `Total visitas: ${kpis.total ?? '-'} | Completadas: ${kpis.completadas ?? '-'} | Tasa cumplimiento: ${kpis.tasaCumplimiento ?? '-'}% | No atendió/Canceladas: ${kpis.fallidas ?? '-'} | Días desde última visita: ${kpis.diasDesdeUltima ?? '-'} | Promedio días entre visitas: ${kpis.promedioDias ?? '-'}`
      : '';

    const prompt = `Eres un analista comercial de un CRM. Con base en el historial de visitas de un cliente, genera un PERFIL COMERCIAL breve, útil y accionable en español para el vendedor.

CLIENTE: ${customer.nombre}
${perfilComercial ? `PERFIL: ${perfilComercial}\n` : ''}${kpisText ? `MÉTRICAS: ${kpisText}\n` : ''}
HISTORIAL DE VISITAS (más recientes primero):
${visitsText}

Analiza patrones: frecuencia y regularidad de visitas, tasa de éxito (completadas vs canceladas/no atendió), objetivos recurrentes (venta, cobro, seguimiento, prospección), evolución/tendencia, riesgos (inactividad, cancelaciones repetidas) y oportunidades.

Devuelve EXACTAMENTE este JSON (sin markdown, sin backticks):
{
  "resumen": "Párrafo de 2-4 frases describiendo al cliente y su comportamiento comercial según sus visitas.",
  "insights": ["3 a 5 hallazgos concretos y específicos basados en los datos"],
  "recomendaciones": ["2 a 4 acciones concretas recomendadas para el vendedor"]
}

Sé concreto y apóyate en los datos reales (menciona cifras/fechas cuando aporten). No inventes información que no esté en el historial. Responde SOLO el JSON.`;

    const llm = new ChatOpenAI({
      modelName: 'gpt-4.1-mini',
      temperature: 0.3,
      openAIApiKey: process.env.OPENAI_API_KEY,
      maxTokens: 700,
    });

    const result = await llm.invoke(prompt);
    let raw = typeof result.content === 'string' ? result.content : '';
    raw = raw.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();

    try {
      const parsed = JSON.parse(raw);
      return NextResponse.json({
        resumen: parsed.resumen || '',
        insights: Array.isArray(parsed.insights) ? parsed.insights : [],
        recomendaciones: Array.isArray(parsed.recomendaciones) ? parsed.recomendaciones : [],
      });
    } catch {
      return NextResponse.json({ resumen: raw, insights: [], recomendaciones: [] });
    }
  } catch (err: any) {
    console.error('customer-profile error:', err);
    return NextResponse.json({ error: err.message || 'Error interno' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function normalizeStr(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

interface MatchedCustomer {
  id: string;
  nombre: string;
  telefono: string | null;
  email: string | null;
  ciudad: string | null;
  zona: string | null;
  etiquetas: string[];
  categoria_compra: string | null;
  notas: string | null;
  reasons: string[];
  score: number;
}

export async function POST(req: NextRequest) {
  try {
    const { userId, query } = await req.json();
    if (!userId || !query) {
      return NextResponse.json({ error: 'userId y query son requeridos' }, { status: 400 });
    }

    const normalizedQuery = normalizeStr(query);
    const keywords = normalizedQuery.split(/\s+/).filter(w => w.length > 1);
    if (keywords.length === 0) {
      return NextResponse.json({ results: [], query });
    }

    const { data: customers, error: custError } = await supabase
      .from('customers')
      .select('id, nombre, telefono, email, ciudad, zona, etiquetas, categoria_compra, notas')
      .eq('user_id', userId)
      .is('deleted_at', null);

    if (custError) {
      return NextResponse.json({ error: 'Error consultando clientes' }, { status: 500 });
    }

    const { data: assignedCustomers } = await supabase
      .from('customer_vendor_assignments')
      .select('customer_id')
      .eq('vendor_user_id', userId);

    const assignedIds = new Set((assignedCustomers || []).map((a: any) => a.customer_id));

    const allCustomerIds = new Set([
      ...(customers || []).map((c: any) => c.id),
      ...assignedIds,
    ]);

    let assignedCustomerData: any[] = [];
    if (assignedIds.size > 0) {
      const missingIds = [...assignedIds].filter(id => !(customers || []).some((c: any) => c.id === id));
      if (missingIds.length > 0) {
        const { data } = await supabase
          .from('customers')
          .select('id, nombre, telefono, email, ciudad, zona, etiquetas, categoria_compra, notas')
          .in('id', missingIds)
          .is('deleted_at', null);
        assignedCustomerData = data || [];
      }
    }

    const allCustomers = [...(customers || []), ...assignedCustomerData];

    const customerIds = allCustomers.map((c: any) => c.id);

    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 6);

    const { data: visits } = await supabase
      .from('visits')
      .select('id, customer_id, resultado, observaciones, objetivo, status')
      .in('customer_id', customerIds)
      .eq('user_id', userId)
      .is('deleted_at', null)
      .gte('scheduled_at', threeMonthsAgo.toISOString());

    const visitsByCustomer = new Map<string, any[]>();
    for (const v of (visits || [])) {
      if (!visitsByCustomer.has(v.customer_id)) {
        visitsByCustomer.set(v.customer_id, []);
      }
      visitsByCustomer.get(v.customer_id)!.push(v);
    }

    const results: MatchedCustomer[] = [];

    for (const customer of allCustomers) {
      const reasons: string[] = [];
      let score = 0;

      const custVisits = visitsByCustomer.get(customer.id) || [];

      const etiquetas: string[] = Array.isArray(customer.etiquetas) ? customer.etiquetas : [];
      const etiquetasNorm = etiquetas.map(normalizeStr);
      const notasNorm = normalizeStr(customer.notas || '');
      const categoriaNorm = normalizeStr(customer.categoria_compra || '');
      const nombreNorm = normalizeStr(customer.nombre || '');
      const ciudadNorm = normalizeStr(customer.ciudad || '');
      const zonaNorm = normalizeStr(customer.zona || '');

      for (const kw of keywords) {
        for (const [i, et] of etiquetasNorm.entries()) {
          if (et.includes(kw)) {
            score += 10;
            const tag = etiquetas[i];
            if (!reasons.some(r => r.includes(`Etiqueta "${tag}"`))) {
              reasons.push(`🏷️ Etiqueta "${tag}" coincide con "${kw}"`);
            }
          }
        }

        if (categoriaNorm.includes(kw)) {
          score += 8;
          if (!reasons.some(r => r.includes('Categoría'))) {
            reasons.push(`📦 Categoría de compra: "${customer.categoria_compra}"`);
          }
        }

        if (notasNorm.includes(kw)) {
          score += 6;
          const snippet = extractSnippet(customer.notas || '', kw);
          if (!reasons.some(r => r.includes('Notas'))) {
            reasons.push(`📝 Notas del cliente: "...${snippet}..."`);
          }
        }

        for (const v of custVisits) {
          const resultadoNorm = normalizeStr(v.resultado || '');
          const obsNorm = normalizeStr(v.observaciones || '');
          const objNorm = normalizeStr(v.objetivo || '');

          if (resultadoNorm.includes(kw)) {
            score += 7;
            const snippet = extractSnippet(v.resultado || '', kw);
            if (!reasons.some(r => r.includes('Resultado de visita'))) {
              reasons.push(`✅ Resultado de visita: "...${snippet}..."`);
            }
          }
          if (obsNorm.includes(kw)) {
            score += 5;
            const snippet = extractSnippet(v.observaciones || '', kw);
            if (!reasons.some(r => r.includes('Observación'))) {
              reasons.push(`👁️ Observación de visita: "...${snippet}..."`);
            }
          }
          if (objNorm.includes(kw)) {
            score += 4;
            const snippet = extractSnippet(v.objetivo || '', kw);
            if (!reasons.some(r => r.includes('Objetivo'))) {
              reasons.push(`🎯 Objetivo de visita: "...${snippet}..."`);
            }
          }
        }

        if (nombreNorm.includes(kw)) score += 3;
        if (ciudadNorm.includes(kw)) score += 2;
        if (zonaNorm.includes(kw)) score += 2;
      }

      if (score > 0 && reasons.length > 0) {
        results.push({
          id: customer.id,
          nombre: customer.nombre,
          telefono: customer.telefono,
          email: customer.email,
          ciudad: customer.ciudad,
          zona: customer.zona,
          etiquetas,
          categoria_compra: customer.categoria_compra,
          notas: customer.notas,
          reasons,
          score,
        });
      }
    }

    results.sort((a, b) => b.score - a.score);

    return NextResponse.json({
      results: results.slice(0, 50),
      total: results.length,
      query,
    });
  } catch (err: any) {
    console.error('Smart filter error:', err);
    return NextResponse.json({ error: err.message || 'Error interno' }, { status: 500 });
  }
}

function extractSnippet(text: string, keyword: string, windowSize: number = 40): string {
  const norm = normalizeStr(text);
  const idx = norm.indexOf(normalizeStr(keyword));
  if (idx === -1) return text.slice(0, windowSize * 2);
  const start = Math.max(0, idx - windowSize);
  const end = Math.min(text.length, idx + keyword.length + windowSize);
  return text.slice(start, end).trim();
}

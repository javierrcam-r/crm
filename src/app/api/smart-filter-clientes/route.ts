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
  matchType: 'etiqueta' | 'gestion' | 'mixto';
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

    const { data: visits } = await supabase
      .from('visits')
      .select('id, customer_id, resultado, observaciones, objetivo, status, scheduled_at')
      .in('customer_id', customerIds)
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('scheduled_at', { ascending: false });

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
      let hasTagMatch = false;
      let hasVisitMatch = false;

      const custVisits = visitsByCustomer.get(customer.id) || [];
      const etiquetas: string[] = Array.isArray(customer.etiquetas) ? customer.etiquetas : [];
      const etiquetasNorm = etiquetas.map(normalizeStr);
      const notasNorm = normalizeStr(customer.notas || '');
      const categoriaNorm = normalizeStr(customer.categoria_compra || '');

      // --- ETIQUETAS (highest priority: 30 pts per match) ---
      for (const kw of keywords) {
        for (const [i, et] of etiquetasNorm.entries()) {
          if (et.includes(kw)) {
            score += 30;
            hasTagMatch = true;
            const tag = etiquetas[i];
            if (!reasons.some(r => r.includes(`Etiqueta: "${tag}"`))) {
              reasons.push(`🏷️ Etiqueta: "${tag}"`);
            }
          }
        }
      }

      // --- CATEGORIA DE COMPRA (20 pts) ---
      for (const kw of keywords) {
        if (categoriaNorm && categoriaNorm.includes(kw)) {
          score += 20;
          if (!reasons.some(r => r.startsWith('📦'))) {
            reasons.push(`📦 Categoría de compra: "${customer.categoria_compra}"`);
          }
        }
      }

      // --- RESULTADOS DE VISITA (specific per visit, 15 pts each) ---
      for (const v of custVisits) {
        const resultadoNorm = normalizeStr(v.resultado || '');
        const obsNorm = normalizeStr(v.observaciones || '');
        const objNorm = normalizeStr(v.objetivo || '');
        const dateStr = formatVisitDate(v.scheduled_at);

        for (const kw of keywords) {
          if (resultadoNorm.includes(kw)) {
            score += 15;
            hasVisitMatch = true;
            const snippet = extractSnippet(v.resultado, kw, 50);
            reasons.push(`✅ Resultado (${dateStr}): "${snippet}"`);
            break;
          }
        }

        for (const kw of keywords) {
          if (obsNorm.includes(kw)) {
            score += 10;
            hasVisitMatch = true;
            const snippet = extractSnippet(v.observaciones, kw, 50);
            if (!reasons.some(r => r.includes(`Observación (${dateStr})`))) {
              reasons.push(`👁️ Observación (${dateStr}): "${snippet}"`);
            }
            break;
          }
        }

        for (const kw of keywords) {
          if (objNorm.includes(kw)) {
            score += 8;
            hasVisitMatch = true;
            const snippet = extractSnippet(v.objetivo, kw, 50);
            if (!reasons.some(r => r.includes(`Objetivo (${dateStr})`))) {
              reasons.push(`🎯 Objetivo (${dateStr}): "${snippet}"`);
            }
            break;
          }
        }
      }

      // --- NOTAS DEL CLIENTE (12 pts) ---
      for (const kw of keywords) {
        if (notasNorm.includes(kw)) {
          score += 12;
          const snippet = extractSnippet(customer.notas || '', kw, 60);
          if (!reasons.some(r => r.startsWith('📝'))) {
            reasons.push(`📝 Notas: "${snippet}"`);
          }
        }
      }

      if (score > 0 && reasons.length > 0) {
        const matchType: 'etiqueta' | 'gestion' | 'mixto' = hasTagMatch && hasVisitMatch
          ? 'mixto'
          : hasTagMatch
            ? 'etiqueta'
            : 'gestion';

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
          matchType,
        });
      }
    }

    // Sort: etiqueta matches first, then mixto, then gestion; within each group by score
    const typeOrder = { etiqueta: 0, mixto: 1, gestion: 2 };
    results.sort((a, b) => {
      const typeDiff = typeOrder[a.matchType] - typeOrder[b.matchType];
      if (typeDiff !== 0) return typeDiff;
      return b.score - a.score;
    });

    return NextResponse.json({
      results: results.slice(0, 60),
      total: results.length,
      query,
    });
  } catch (err: any) {
    console.error('Smart filter error:', err);
    return NextResponse.json({ error: err.message || 'Error interno' }, { status: 500 });
  }
}

function extractSnippet(text: string, keyword: string, windowSize: number = 50): string {
  const norm = normalizeStr(text);
  const kwNorm = normalizeStr(keyword);
  const idx = norm.indexOf(kwNorm);
  if (idx === -1) return text.slice(0, windowSize * 2).trim();
  const start = Math.max(0, idx - windowSize);
  const end = Math.min(text.length, idx + keyword.length + windowSize);
  let snippet = text.slice(start, end).trim();
  if (start > 0) snippet = '...' + snippet;
  if (end < text.length) snippet = snippet + '...';
  return snippet;
}

function formatVisitDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const day = d.getDate();
    const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    return `${day} ${month} ${year}`;
  } catch {
    return '';
  }
}

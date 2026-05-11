import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface CustomerFields {
  id: string;
  nombre: string;
  direccion: string | null;
  zona: string | null;
  ciudad: string | null;
  categoria_compra: string | null;
  etiquetas: string[] | null;
}

interface VisitRecordRaw {
  id: string;
  customer_id: string;
  scheduled_at: string;
  status: string;
  customer: CustomerFields[] | CustomerFields | null;
}

interface VisitRecord {
  id: string;
  customer_id: string;
  scheduled_at: string;
  status: string;
  customer: CustomerFields | null;
}

function normalizeVisit(raw: VisitRecordRaw): VisitRecord {
  return {
    ...raw,
    customer: Array.isArray(raw.customer) ? raw.customer[0] || null : raw.customer,
  };
}

interface CustomerPattern {
  customerId: string;
  customerName: string;
  customerAddress: string | null;
  customerZona: string | null;
  customerCiudad: string | null;
  customerCategoriaCompra: string | null;
  customerEtiquetas: string[];
  avgDaysBetweenVisits: number;
  preferredDayOfWeek: number;
  dayOfWeekConfidence: number;
  weekPositionPattern: 'inicio' | 'mitad' | 'fin' | null;
  weekPositionConfidence: number;
  preferredHour: number;
  lastVisitDate: string;
  lastVisitDateFormatted: string;
  daysSinceLastVisit: number;
  visitCount: number;
  completedCount: number;
  dayOfWeekDistribution: number[];
}

interface Recommendation {
  customerId: string;
  customerName: string;
  customerAddress: string | null;
  customerZona: string | null;
  customerCiudad: string | null;
  date: string;
  dayOfWeek: number;
  dayName: string;
  time: string;
  reason: string;
  reasons: string[];
}

const monthNames = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function formatDateES(d: Date): string {
  return `${d.getDate()} de ${monthNames[d.getMonth()]}`;
}

function analyzePatternsForCustomer(visits: VisitRecord[]): CustomerPattern | null {
  if (visits.length === 0) return null;

  const customer = visits[0].customer;
  if (!customer) return null;

  const sortedVisits = [...visits]
    .filter(v => v.status === 'completada' || v.status === 'programada')
    .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());

  if (sortedVisits.length === 0) return null;

  const completedVisits = sortedVisits.filter(v => v.status === 'completada');

  const intervals: number[] = [];
  for (let i = 1; i < sortedVisits.length; i++) {
    const prev = new Date(sortedVisits[i - 1].scheduled_at);
    const curr = new Date(sortedVisits[i].scheduled_at);
    const diffDays = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays > 0 && diffDays < 120) {
      intervals.push(diffDays);
    }
  }

  const avgInterval = intervals.length > 0
    ? intervals.reduce((a, b) => a + b, 0) / intervals.length
    : 14;

  const dayOfWeekCounts = new Array(7).fill(0);
  const hourCounts = new Array(24).fill(0);
  for (const v of sortedVisits) {
    const d = new Date(v.scheduled_at);
    dayOfWeekCounts[d.getDay()] += 1;
    hourCounts[d.getHours()] += 1;
  }

  const maxDayCount = Math.max(...dayOfWeekCounts);
  const preferredDay = dayOfWeekCounts.indexOf(maxDayCount);
  const dayConfidence = sortedVisits.length > 1 ? maxDayCount / sortedVisits.length : 0;

  // Week position: inicio (Lun-Mar), mitad (Mié-Jue), fin (Vie-Sáb)
  const inicioCount = dayOfWeekCounts[1] + dayOfWeekCounts[2]; // Lun + Mar
  const mitadCount = dayOfWeekCounts[3] + dayOfWeekCounts[4];  // Mié + Jue
  const finCount = dayOfWeekCounts[5] + dayOfWeekCounts[6];    // Vie + Sáb
  const totalWeekday = inicioCount + mitadCount + finCount;
  let weekPositionPattern: 'inicio' | 'mitad' | 'fin' | null = null;
  let weekPositionConfidence = 0;
  if (totalWeekday > 0) {
    const maxPos = Math.max(inicioCount, mitadCount, finCount);
    weekPositionConfidence = maxPos / totalWeekday;
    if (weekPositionConfidence >= 0.5) {
      if (maxPos === inicioCount) weekPositionPattern = 'inicio';
      else if (maxPos === mitadCount) weekPositionPattern = 'mitad';
      else weekPositionPattern = 'fin';
    }
  }

  const maxHourCount = Math.max(...hourCounts);
  const preferredHour = hourCounts.indexOf(maxHourCount);

  const lastVisit = new Date(sortedVisits[sortedVisits.length - 1].scheduled_at);
  const now = new Date();
  const daysSinceLast = (now.getTime() - lastVisit.getTime()) / (1000 * 60 * 60 * 24);

  return {
    customerId: customer.id,
    customerName: customer.nombre,
    customerAddress: customer.direccion || null,
    customerZona: customer.zona || null,
    customerCiudad: customer.ciudad || null,
    customerCategoriaCompra: customer.categoria_compra || null,
    customerEtiquetas: Array.isArray(customer.etiquetas) ? customer.etiquetas : [],
    avgDaysBetweenVisits: Math.round(avgInterval),
    preferredDayOfWeek: preferredDay,
    dayOfWeekConfidence: dayConfidence,
    weekPositionPattern,
    weekPositionConfidence,
    preferredHour: preferredHour || 9,
    lastVisitDate: lastVisit.toISOString(),
    lastVisitDateFormatted: formatDateES(lastVisit),
    daysSinceLastVisit: Math.round(daysSinceLast),
    visitCount: sortedVisits.length,
    completedCount: completedVisits.length,
    dayOfWeekDistribution: dayOfWeekCounts,
  };
}

const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

function generateRecommendations(
  patterns: CustomerPattern[],
  weekStart: Date,
  existingVisits: VisitRecord[],
  blockedDates: Set<string>,
  maxPerDay: number = 8
): Recommendation[] {
  const recommendations: Recommendation[] = [];

  const existingSet = new Set<string>();
  for (const v of existingVisits) {
    const dateKey = new Date(v.scheduled_at).toISOString().slice(0, 10);
    existingSet.add(`${v.customer_id}_${dateKey}`);
  }

  const weekDays: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    weekDays.push(d);
  }

  const slotsPerDay = new Map<string, number>();
  for (const d of weekDays) {
    slotsPerDay.set(d.toISOString().slice(0, 10), 0);
  }
  for (const v of existingVisits) {
    const dateKey = new Date(v.scheduled_at).toISOString().slice(0, 10);
    slotsPerDay.set(dateKey, (slotsPerDay.get(dateKey) || 0) + 1);
  }

  const sortedPatterns = [...patterns].sort((a, b) => {
    const aUrgency = a.daysSinceLastVisit / (a.avgDaysBetweenVisits || 14);
    const bUrgency = b.daysSinceLastVisit / (b.avgDaysBetweenVisits || 14);
    return bUrgency - aUrgency;
  });

  const MAX_PER_DAY = maxPerDay;

  for (const pattern of sortedPatterns) {
    const urgencyRatio = pattern.daysSinceLastVisit / (pattern.avgDaysBetweenVisits || 14);
    if (urgencyRatio < 0.5 && pattern.visitCount > 2) continue;

    let bestDay: Date | null = null;
    let bestScore = -Infinity;

    for (const day of weekDays) {
      const dow = day.getDay();
      if (dow === 0 || dow === 6) continue;

      const dateKey = day.toISOString().slice(0, 10);
      if (blockedDates.has(dateKey)) continue;
      const slotCount = slotsPerDay.get(dateKey) || 0;
      if (slotCount >= MAX_PER_DAY) continue;

      if (existingSet.has(`${pattern.customerId}_${dateKey}`)) continue;

      let score = 0;

      if (dow === pattern.preferredDayOfWeek) {
        score += 30 * pattern.dayOfWeekConfidence;
      }

      score += urgencyRatio * 20;

      score -= slotCount * 5;

      if (bestDay === null || score > bestScore) {
        bestScore = score;
        bestDay = day;
      }
    }

    if (!bestDay) continue;

    const dateKey = bestDay.toISOString().slice(0, 10);
    const dow = bestDay.getDay();

    const reasons: string[] = [];

    // 1. Last visit info - always include with specific date
    reasons.push(
      `📅 No la has visitado desde el ${pattern.lastVisitDateFormatted} (hace ${pattern.daysSinceLastVisit} días)`
    );

    // 2. Urgency indicator
    if (urgencyRatio >= 2) {
      reasons.push(`🔴 Visita muy atrasada: debió visitarse hace ${Math.round(pattern.daysSinceLastVisit - pattern.avgDaysBetweenVisits)} días`);
    } else if (urgencyRatio >= 1.2) {
      reasons.push(`🟠 Visita atrasada: su ciclo es cada ${pattern.avgDaysBetweenVisits} días y ya pasaron ${pattern.daysSinceLastVisit}`);
    } else if (urgencyRatio >= 0.8) {
      reasons.push(`🟡 Próxima a cumplir su ciclo de ${pattern.avgDaysBetweenVisits} días`);
    }

    // 3. Day-of-week pattern
    if (pattern.dayOfWeekConfidence >= 0.5 && pattern.visitCount >= 2) {
      const pct = Math.round(pattern.dayOfWeekConfidence * 100);
      if (dow === pattern.preferredDayOfWeek) {
        reasons.push(`✅ Siempre la visitas los ${dayNames[pattern.preferredDayOfWeek]} (${pct}% de las veces)`);
      } else {
        reasons.push(`📊 Normalmente la visitas los ${dayNames[pattern.preferredDayOfWeek]} (${pct}%), pero ese día ya está lleno`);
      }
    } else if (pattern.dayOfWeekConfidence >= 0.3 && pattern.visitCount >= 3) {
      reasons.push(`📊 Tendencia a visitarla los ${dayNames[pattern.preferredDayOfWeek]} (${Math.round(pattern.dayOfWeekConfidence * 100)}% de las veces)`);
    }

    // 4. Week position pattern
    if (pattern.weekPositionPattern && pattern.weekPositionConfidence >= 0.6 && pattern.visitCount >= 3) {
      const posLabels = { inicio: 'al inicio de semana (Lun-Mar)', mitad: 'a mitad de semana (Mié-Jue)', fin: 'al final de semana (Vie-Sáb)' };
      reasons.push(`🗓️ Sueles visitarla ${posLabels[pattern.weekPositionPattern]}`);
    }

    // 5. Frequency pattern
    if (pattern.visitCount >= 2 && pattern.avgDaysBetweenVisits > 0) {
      if (pattern.avgDaysBetweenVisits <= 7) {
        reasons.push(`🔄 Frecuencia: la visitas cada semana (~${pattern.avgDaysBetweenVisits} días)`);
      } else if (pattern.avgDaysBetweenVisits <= 16) {
        reasons.push(`🔄 Frecuencia: la visitas cada 2 semanas (~${pattern.avgDaysBetweenVisits} días)`);
      } else if (pattern.avgDaysBetweenVisits <= 35) {
        reasons.push(`🔄 Frecuencia: la visitas mensualmente (~${pattern.avgDaysBetweenVisits} días)`);
      } else {
        reasons.push(`🔄 Frecuencia: la visitas cada ~${pattern.avgDaysBetweenVisits} días`);
      }
    }

    // 6. Visit history context
    if (pattern.completedCount > 0) {
      reasons.push(`📈 ${pattern.completedCount} visita${pattern.completedCount > 1 ? 's' : ''} completada${pattern.completedCount > 1 ? 's' : ''} en los últimos 3 meses`);
    }

    // Primary reason (short summary for backward compat)
    let reason: string;
    if (urgencyRatio >= 1.5) {
      reason = `No visitada desde el ${pattern.lastVisitDateFormatted} — visita atrasada`;
    } else if (pattern.dayOfWeekConfidence > 0.5 && dow === pattern.preferredDayOfWeek) {
      reason = `Siempre la visitas los ${dayNames[pattern.preferredDayOfWeek]}`;
    } else if (pattern.weekPositionPattern && pattern.weekPositionConfidence >= 0.6) {
      const posShort = { inicio: 'inicio de semana', mitad: 'mitad de semana', fin: 'fin de semana' };
      reason = `La visitas al ${posShort[pattern.weekPositionPattern]}`;
    } else if (urgencyRatio >= 0.8) {
      reason = `Próxima a cumplir ciclo de ${pattern.avgDaysBetweenVisits} días`;
    } else {
      reason = `Cada ~${pattern.avgDaysBetweenVisits} días, última: ${pattern.lastVisitDateFormatted}`;
    }

    const hour = pattern.preferredHour || 9;
    const time = `${hour.toString().padStart(2, '0')}:00`;

    recommendations.push({
      customerId: pattern.customerId,
      customerName: pattern.customerName,
      customerAddress: pattern.customerAddress,
      customerZona: pattern.customerZona,
      customerCiudad: pattern.customerCiudad,
      date: dateKey,
      dayOfWeek: dow,
      dayName: dayNames[dow],
      time,
      reason,
      reasons,
    });

    slotsPerDay.set(dateKey, (slotsPerDay.get(dateKey) || 0) + 1);
    existingSet.add(`${pattern.customerId}_${dateKey}`);
  }

  return recommendations.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.time.localeCompare(b.time);
  });
}

function normalizeStr(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

export async function POST(req: NextRequest) {
  try {
    const { userId, weekStartDate, filters } = await req.json();
    if (!userId) {
      return NextResponse.json({ error: 'userId requerido' }, { status: 400 });
    }

    const filterCiudad = filters?.ciudad ? normalizeStr(filters.ciudad) : '';
    const filterZona = filters?.zona ? normalizeStr(filters.zona) : '';
    const filterInstructions = filters?.instructions?.trim() || '';
    const filterMaxPerDay = filters?.maxPerDay || 8;

    const weekStart = weekStartDate ? new Date(weekStartDate) : (() => {
      const now = new Date();
      const day = now.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      const monday = new Date(now);
      monday.setDate(now.getDate() + diff);
      monday.setHours(0, 0, 0, 0);
      return monday;
    })();

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const { data: historicalVisits, error: histError } = await supabase
      .from('visits')
      .select(`
        id, customer_id, scheduled_at, status,
        customer:customers(id, nombre, direccion, zona, ciudad, categoria_compra, etiquetas)
      `)
      .eq('user_id', userId)
      .is('deleted_at', null)
      .gte('scheduled_at', threeMonthsAgo.toISOString())
      .in('status', ['completada', 'programada'])
      .order('scheduled_at', { ascending: true });

    if (histError) {
      console.error('Error fetching historical visits:', histError);
      return NextResponse.json({ error: 'Error consultando visitas' }, { status: 500 });
    }

    const [weekVisitsResult, blockedDaysResult] = await Promise.all([
      supabase
        .from('visits')
        .select(`
          id, customer_id, scheduled_at, status,
          customer:customers(id, nombre, direccion, zona, ciudad, categoria_compra, etiquetas)
        `)
        .eq('user_id', userId)
        .is('deleted_at', null)
        .gte('scheduled_at', weekStart.toISOString())
        .lte('scheduled_at', weekEnd.toISOString())
        .in('status', ['programada']),
      supabase
        .from('calendar_blocked_days')
        .select('fecha')
        .gte('fecha', weekStart.toISOString().slice(0, 10))
        .lte('fecha', weekEnd.toISOString().slice(0, 10)),
    ]);

    const { data: weekVisits, error: weekError } = weekVisitsResult;
    if (weekError) {
      console.error('Error fetching week visits:', weekError);
      return NextResponse.json({ error: 'Error consultando visitas de la semana' }, { status: 500 });
    }

    const blockedDates = new Set<string>(
      (blockedDaysResult.data || []).map((d: { fecha: string }) => d.fecha)
    );

    const visitsByCustomer = new Map<string, VisitRecord[]>();
    for (const v of (historicalVisits as VisitRecordRaw[]).map(normalizeVisit)) {
      if (!v.customer_id) continue;
      if (!visitsByCustomer.has(v.customer_id)) {
        visitsByCustomer.set(v.customer_id, []);
      }
      visitsByCustomer.get(v.customer_id)!.push(v);
    }

    let patterns: CustomerPattern[] = [];
    for (const [, customerVisits] of visitsByCustomer) {
      const pattern = analyzePatternsForCustomer(customerVisits);
      if (pattern) {
        patterns.push(pattern);
      }
    }

    if (filterCiudad) {
      patterns = patterns.filter(p => {
        const ciudad = p.customerCiudad ? normalizeStr(p.customerCiudad) : '';
        return ciudad.includes(filterCiudad) || filterCiudad.includes(ciudad);
      });
    }
    if (filterZona) {
      patterns = patterns.filter(p => {
        const zona = p.customerZona ? normalizeStr(p.customerZona) : '';
        return zona.includes(filterZona) || filterZona.includes(zona);
      });
    }

    if (filterInstructions) {
      const instructionKeywords = normalizeStr(filterInstructions).split(/\s+/).filter(w => w.length > 2);
      if (instructionKeywords.length > 0) {
        patterns = patterns.filter(p => {
          const etiquetasStr = p.customerEtiquetas.join(' ');
          const searchable = normalizeStr(
            `${p.customerName} ${p.customerAddress || ''} ${p.customerZona || ''} ${p.customerCiudad || ''} ${p.customerCategoriaCompra || ''} ${etiquetasStr}`
          );
          return instructionKeywords.some(kw => searchable.includes(kw));
        });
      }
    }

    const normalizedWeekVisits = ((weekVisits || []) as VisitRecordRaw[]).map(normalizeVisit);

    const recommendations = generateRecommendations(
      patterns,
      weekStart,
      normalizedWeekVisits,
      blockedDates,
      filterMaxPerDay
    );

    return NextResponse.json({
      recommendations,
      patterns: patterns.map(p => ({
        customerName: p.customerName,
        avgDays: p.avgDaysBetweenVisits,
        preferredDay: dayNames[p.preferredDayOfWeek],
        dayConfidence: Math.round(p.dayOfWeekConfidence * 100),
        visitCount: p.visitCount,
        daysSinceLastVisit: p.daysSinceLastVisit,
      })),
      weekStart: weekStart.toISOString().slice(0, 10),
      weekEnd: weekEnd.toISOString().slice(0, 10),
      totalClientsAnalyzed: patterns.length,
      totalRecommendations: recommendations.length,
    });
  } catch (err: any) {
    console.error('RecomendCalend error:', err);
    return NextResponse.json({ error: err.message || 'Error interno' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

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
  tipo: string | null;
  etapa_embudo: string | null;
  calidad_pago: string | null;
  categoria_compra: string | null;
  etiquetas: string[] | null;
  codigo_cliente_ventas: number | null;
}

interface VisitRecordRaw {
  id: string;
  customer_id: string;
  scheduled_at: string;
  status: string;
  objetivo?: string | null;
  resultado?: string | null;
  next_action?: string | null;
  customer: CustomerFields[] | CustomerFields | null;
}

interface VisitRecord {
  id: string;
  customer_id: string;
  scheduled_at: string;
  status: string;
  objetivo: string | null;
  resultado: string | null;
  next_action: string | null;
  customer: CustomerFields | null;
}

function normalizeVisit(raw: VisitRecordRaw): VisitRecord {
  return {
    ...raw,
    objetivo: raw.objetivo ?? null,
    resultado: raw.resultado ?? null,
    next_action: raw.next_action ?? null,
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
  customerTipo: string | null;
  customerEtapaEmbudo: string | null;
  customerCalidadPago: string | null;
  customerCodigoVentas: number | null;
  avgDaysBetweenVisits: number;
  intervalStdDev: number;
  dueProbability: number;
  preferredDayOfWeek: number;
  dayOfWeekConfidence: number;
  dayOfWeekProb: number[];
  weekPositionPattern: 'inicio' | 'mitad' | 'fin' | null;
  weekPositionConfidence: number;
  preferredHour: number;
  hourProb: number[];
  lastVisitDate: string;
  lastVisitDateFormatted: string;
  daysSinceLastVisit: number;
  visitCount: number;
  completedCount: number;
  scheduledCount: number;
  completionRate: number;
  overdueDays: number;
  dayOfWeekDistribution: number[];
  lastObjetivo: string | null;
  lastResultado: string | null;
  lastNextAction: string | null;
}

interface Recommendation {
  recommendationId?: string;
  customerId: string;
  customerName: string;
  customerAddress: string | null;
  customerZona: string | null;
  customerCiudad: string | null;
  date: string;
  dayOfWeek: number;
  dayName: string;
  time: string;
  objetivo: string;
  reason: string;
  reasons: string[];
  scoreTotal: number;
  scoreBreakdown: Record<string, number>;
  features: Record<string, unknown>;
}

interface TerritoryDayPattern {
  dayOfWeek: number;
  city: string | null;
  cityCount: number;
  cityConfidence: number;
  zone: string | null;
  zoneCount: number;
  zoneConfidence: number;
  totalVisits: number;
}

interface FeedbackRecord {
  customer_id: string;
  status: string;
  recommended_date: string;
  recommended_time: string;
  features: Record<string, any> | null;
  created_at: string;
}

interface FeedbackStats {
  byCustomer: Map<string, FeedbackAggregate>;
  byCity: Map<string, FeedbackAggregate>;
  byZone: Map<string, FeedbackAggregate>;
  byDay: Map<string, FeedbackAggregate>;
  global: FeedbackAggregate;
}

interface FeedbackAggregate {
  total: number;
  accepted: number;
  rejected: number;
  completed: number;
  negativeOutcome: number;
  recentRejected: number;
}

interface BusinessStats {
  totalVentas: number;
  numVentas: number;
  monthsWithSales: number;
  lastSaleMonth: string | null;
}

interface InstructionPreferences {
  dayLocationPreferences: Map<number, string[]>;
  blockedHours: Map<number, Set<number>>;
  blockedWeekDays: Set<number>;
  generalKeywords: string[];
  notes: string[];
}

const monthNames = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const BUSINESS_START_HOUR = 8;
const BUSINESS_END_HOUR = 18;
const DEFAULT_RECOMMENDATION_HOUR = 9;
const dayAliases = [
  ['domingo'],
  ['lunes'],
  ['martes'],
  ['miercoles', 'miércoles'],
  ['jueves'],
  ['viernes'],
  ['sabado', 'sábado'],
];

function formatDateES(d: Date): string {
  return `${d.getDate()} de ${monthNames[d.getMonth()]}`;
}

function isBusinessHour(hour: number): boolean {
  return hour >= BUSINESS_START_HOUR && hour <= BUSINESS_END_HOUR;
}

function clampBusinessHour(hour: number): number {
  if (!Number.isFinite(hour)) return DEFAULT_RECOMMENDATION_HOUR;
  return Math.min(BUSINESS_END_HOUR, Math.max(BUSINESS_START_HOUR, Math.round(hour)));
}

// Elige la hora libre con mayor probabilidad histórica (horario "más pertinente"),
// con una leve penalización por alejarse de la hora modal del cliente.
function chooseBestHour(
  hourProb: number[],
  preferredHour: number,
  blockedHours?: Set<number>,
  usedHours?: Set<number>
): number | null {
  const isUnavailable = (hour: number) => blockedHours?.has(hour) || usedHours?.has(hour);
  const pref = clampBusinessHour(preferredHour);
  let best: number | null = null;
  let bestScore = -Infinity;
  for (let hour = BUSINESS_START_HOUR; hour <= BUSINESS_END_HOUR; hour++) {
    if (isUnavailable(hour)) continue;
    const score = (hourProb?.[hour] || 0) * 100 - Math.abs(hour - pref) * 0.5;
    if (score > bestScore) {
      bestScore = score;
      best = hour;
    }
  }
  return best;
}

function getPreferredBusinessHour(hourCounts: number[]): number {
  let bestHour = DEFAULT_RECOMMENDATION_HOUR;
  let bestCount = 0;

  for (let hour = BUSINESS_START_HOUR; hour <= BUSINESS_END_HOUR; hour++) {
    const count = hourCounts[hour] || 0;
    if (count > bestCount) {
      bestCount = count;
      bestHour = hour;
    }
  }

  return bestHour;
}

// Media y desviación estándar ponderadas (pesos exponenciales por recencia).
function weightedStats(values: number[], weights: number[]): { mean: number; std: number } {
  if (values.length === 0) return { mean: 0, std: 0 };
  const wSum = weights.reduce((a, b) => a + b, 0) || 1;
  const mean = values.reduce((acc, v, i) => acc + v * weights[i], 0) / wSum;
  const variance = values.reduce((acc, v, i) => acc + weights[i] * Math.pow(v - mean, 2), 0) / wSum;
  return { mean, std: Math.sqrt(Math.max(0, variance)) };
}

// Probabilidad de que el cliente esté "vencido" (listo para visita) dada la cadencia
// histórica. Curva logística centrada en el intervalo medio; el ancho escala con la
// variabilidad, de modo que clientes muy regulares generan urgencia más marcada.
function computeDueProbability(daysSince: number, meanInterval: number, stdInterval: number): number {
  if (meanInterval <= 0) return 0.5;
  const spread = Math.max(2.5, stdInterval > 0 ? stdInterval : meanInterval * 0.35);
  const z = (daysSince - meanInterval) / spread;
  return 1 / (1 + Math.exp(-z));
}

// Distribución de probabilidad por día de semana con suavizado de Laplace,
// para dar crédito parcial a días secundarios (no solo al día modal).
function smoothedDayProbabilities(dayCounts: number[]): number[] {
  const alpha = 0.5;
  const workingDays = [1, 2, 3, 4, 5, 6];
  const total = workingDays.reduce((acc, d) => acc + (dayCounts[d] || 0), 0);
  const denom = total + alpha * workingDays.length;
  const probs = new Array(7).fill(0);
  for (const d of workingDays) {
    probs[d] = ((dayCounts[d] || 0) + alpha) / denom;
  }
  return probs;
}

function smoothedHourProbabilities(hourCounts: number[]): number[] {
  const alpha = 0.3;
  const hours: number[] = [];
  for (let h = BUSINESS_START_HOUR; h <= BUSINESS_END_HOUR; h++) hours.push(h);
  const total = hours.reduce((acc, h) => acc + (hourCounts[h] || 0), 0);
  const denom = total + alpha * hours.length;
  const probs = new Array(24).fill(0);
  for (const h of hours) probs[h] = ((hourCounts[h] || 0) + alpha) / denom;
  return probs;
}

function truncateText(value: string, max = 90): string {
  const clean = value.replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

// Objetivo recomendado para la visita, inferido del historial y la etapa del embudo.
// Prioriza la "próxima acción" registrada en la última visita completada.
function buildRecommendedObjective(pattern: CustomerPattern, business: BusinessStats | null): string {
  if (pattern.lastNextAction && pattern.lastNextAction.trim().length > 2) {
    return truncateText(`Dar seguimiento: ${pattern.lastNextAction}`);
  }

  const etapa = (pattern.customerEtapaEmbudo || '').toLowerCase();
  const buysRegularly = !!business && (business.numVentas >= 3 || business.monthsWithSales >= 3);
  const veryOverdue = pattern.dueProbability >= 0.85 || (pattern.overdueDays > 0 && pattern.avgDaysBetweenVisits > 0 && pattern.overdueDays >= pattern.avgDaysBetweenVisits);

  if (etapa === 'negociacion') return 'Cerrar negociación y concretar el pedido';
  if (etapa === 'interesado') return 'Presentar propuesta y resolver objeciones';
  if (etapa === 'nuevo' || etapa === 'contactado') return 'Primer acercamiento y presentación de portafolio';
  if (etapa === 'perdido') return 'Reactivar cliente y detectar nueva necesidad';

  if (buysRegularly) return 'Levantar pedido de reposición y revisar stock';
  if (veryOverdue) return `Retomar contacto tras ${pattern.daysSinceLastVisit} días sin visita`;

  if (pattern.lastResultado && pattern.lastResultado.trim().length > 2) {
    return truncateText(`Continuar: ${pattern.lastResultado}`);
  }
  if (pattern.customerEtapaEmbudo === 'ganado' || pattern.customerTipo === 'cliente') {
    return 'Mantener relación y tomar nuevo pedido';
  }
  return 'Visita de seguimiento comercial';
}

function extractInstructionSegments(normalized: string) {
  const matches: { dow: number; index: number; alias: string }[] = [];
  dayAliases.forEach((aliases, dow) => {
    aliases.forEach(alias => {
      const re = new RegExp(`\\b${alias}\\b`, 'g');
      let match: RegExpExecArray | null;
      while ((match = re.exec(normalized)) !== null) {
        matches.push({ dow, index: match.index, alias });
      }
    });
  });

  matches.sort((a, b) => a.index - b.index);
  const segments = matches.map((match, idx) => {
    const next = matches[idx + 1]?.index ?? normalized.length;
    const punctuationEnd = normalized.slice(match.index, next).search(/[.;,\n]/);
    const end = punctuationEnd >= 0 ? match.index + punctuationEnd : next;
    return {
      dow: match.dow,
      text: normalized.slice(match.index, end).trim(),
    };
  });

  return segments.map((segment, idx) => {
    const nextSegment = segments[idx + 1];
    if (nextSegment && /^\w+\s+y$/.test(segment.text)) {
      const nextWithoutDay = nextSegment.text.replace(/^\w+\s+/, '').trim();
      return { ...segment, text: `${segment.text} ${nextWithoutDay}`.trim() };
    }
    return segment;
  });
}

function parseInstructionPreferences(instructions: string): InstructionPreferences {
  const normalized = normalizeStr(instructions || '');
  const dayLocationPreferences = new Map<number, string[]>();
  const blockedHours = new Map<number, Set<number>>();
  const blockedWeekDays = new Set<number>();
  const notes: string[] = [];
  const consumedSegments: string[] = [];
  const stopWords = new Set([
    'domingo', 'lunes', 'martes', 'miercoles', 'miércoles', 'jueves', 'viernes', 'sabado', 'sábado',
    'el', 'la', 'los', 'las', 'un', 'una', 'me', 'voy', 'ir', 'ire', 'estar', 'estare', 'ruta',
    'zona', 'ciudad', 'sector', 'a', 'al', 'en', 'por', 'para', 'de', 'del', 'las', 'los', 'con',
    'a-las', 'alas', 'visitar', 'visito',
  ]);
  const blockMarkers = ['banco', 'cita', 'reunion', 'ocupado', 'ocupada', 'bloqueado', 'bloqueada', 'no puedo', 'no visitar'];

  for (const segment of extractInstructionSegments(normalized)) {
    consumedSegments.push(segment.text);

    const hourMatch = segment.text.match(/\b(?:a\s+las|alas|a)\s+(\d{1,2})(?::(\d{2}))?\b/);
    const isBlock = blockMarkers.some(marker => segment.text.includes(marker));
    if (hourMatch && isBlock) {
      const hour = clampBusinessHour(Number(hourMatch[1]));
      if (!blockedHours.has(segment.dow)) blockedHours.set(segment.dow, new Set());
      blockedHours.get(segment.dow)!.add(hour);
      notes.push(`${dayNames[segment.dow]} ${hour.toString().padStart(2, '0')}:00 bloqueado por instrucción`);
    } else if (isBlock) {
      blockedWeekDays.add(segment.dow);
      notes.push(`${dayNames[segment.dow]} bloqueado por instrucción`);
    }

    if (!isBlock) {
      const cleanedTerms = segment.text
        .replace(/\b(?:a\s+las|alas|a)\s+\d{1,2}(?::\d{2})?\b/g, ' ')
        .split(/\s+/)
        .map(w => w.trim())
        .filter(w => w.length > 2 && !stopWords.has(w));

      if (cleanedTerms.length > 0) {
        dayLocationPreferences.set(segment.dow, cleanedTerms);
        notes.push(`${dayNames[segment.dow]} priorizar ${cleanedTerms.join(' ')}`);
      }
    }
  }

  let remaining = normalized;
  consumedSegments.forEach(segment => {
    remaining = remaining.replace(segment, ' ');
  });
  const generalKeywords = remaining.split(/\s+/).filter(w => w.length > 2 && !stopWords.has(w));

  return { dayLocationPreferences, blockedHours, blockedWeekDays, generalKeywords, notes };
}

function matchesInstructionLocation(pattern: CustomerPattern, terms: string[]): boolean {
  if (terms.length === 0) return false;
  // Instrucciones de tipo "el lunes me voy a Loja" son geográficas: se comparan
  // exclusivamente contra los campos de ubicación del cliente (ciudad, zona,
  // dirección) para respetar la instrucción con precisión y evitar falsos positivos
  // por coincidencias en el nombre o etiquetas.
  const searchable = normalizeStr([
    pattern.customerCiudad || '',
    pattern.customerZona || '',
    pattern.customerAddress || '',
  ].join(' '));

  if (!searchable.trim()) return false;

  return terms.some(term => {
    const t = normalizeStr(term);
    if (t.length < 3) return false;
    const escaped = t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`\\b${escaped}\\b`).test(searchable);
  });
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
  const scheduledVisits = sortedVisits.filter(v => v.status === 'programada');
  const visitsForPattern = completedVisits.length >= 2 ? completedVisits : sortedVisits;

  // Pesos exponenciales por recencia: las visitas recientes pesan más que las antiguas.
  const RECENCY_DECAY = 0.85;
  const n = visitsForPattern.length;
  const visitWeights = visitsForPattern.map((_, i) => Math.pow(RECENCY_DECAY, (n - 1) - i));

  const intervals: number[] = [];
  const intervalWeights: number[] = [];
  for (let i = 1; i < visitsForPattern.length; i++) {
    const prev = new Date(visitsForPattern[i - 1].scheduled_at);
    const curr = new Date(visitsForPattern[i].scheduled_at);
    const diffDays = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays > 0 && diffDays < 120) {
      intervals.push(diffDays);
      intervalWeights.push(Math.pow(RECENCY_DECAY, (visitsForPattern.length - 1) - i));
    }
  }

  const intervalStats = weightedStats(intervals, intervalWeights);
  const avgInterval = intervals.length > 0 ? intervalStats.mean : 14;
  const intervalStdDev = intervals.length > 1 ? intervalStats.std : 0;

  const dayOfWeekCounts = new Array(7).fill(0);
  const hourCounts = new Array(24).fill(0);
  visitsForPattern.forEach((v, i) => {
    const d = new Date(v.scheduled_at);
    const w = visitWeights[i];
    dayOfWeekCounts[d.getDay()] += w;
    const hour = d.getHours();
    if (isBusinessHour(hour)) {
      hourCounts[hour] += w;
    }
  });

  const totalDayWeight = dayOfWeekCounts.reduce((a, b) => a + b, 0);
  const maxDayCount = Math.max(...dayOfWeekCounts);
  const preferredDay = dayOfWeekCounts.indexOf(maxDayCount);
  const dayConfidence = visitsForPattern.length > 1 && totalDayWeight > 0 ? maxDayCount / totalDayWeight : 0;
  const dayOfWeekProb = smoothedDayProbabilities(dayOfWeekCounts);
  const hourProb = smoothedHourProbabilities(hourCounts);

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

  const preferredHour = getPreferredBusinessHour(hourCounts);

  const lastVisitSource = completedVisits.length > 0 ? completedVisits[completedVisits.length - 1] : sortedVisits[sortedVisits.length - 1];
  const lastVisit = new Date(lastVisitSource.scheduled_at);
  const now = new Date();
  const daysSinceLast = (now.getTime() - lastVisit.getTime()) / (1000 * 60 * 60 * 24);
  const overdueDays = Math.max(0, Math.round(daysSinceLast - avgInterval));
  const dueProbability = computeDueProbability(daysSinceLast, avgInterval, intervalStdDev);

  // Señales para inferir el objetivo de la próxima visita.
  const lastCompleted = completedVisits.length > 0 ? completedVisits[completedVisits.length - 1] : null;
  const mostRecentVisit = sortedVisits[sortedVisits.length - 1];
  const lastNextAction = lastCompleted?.next_action || null;
  const lastResultado = lastCompleted?.resultado || null;
  const lastObjetivo = mostRecentVisit?.objetivo || null;

  return {
    customerId: customer.id,
    customerName: customer.nombre,
    customerAddress: customer.direccion || null,
    customerZona: customer.zona || null,
    customerCiudad: customer.ciudad || null,
    customerCategoriaCompra: customer.categoria_compra || null,
    customerEtiquetas: Array.isArray(customer.etiquetas) ? customer.etiquetas : [],
    customerTipo: customer.tipo || null,
    customerEtapaEmbudo: customer.etapa_embudo || null,
    customerCalidadPago: customer.calidad_pago || null,
    customerCodigoVentas: customer.codigo_cliente_ventas || null,
    avgDaysBetweenVisits: Math.round(avgInterval),
    intervalStdDev: Math.round(intervalStdDev * 10) / 10,
    dueProbability,
    preferredDayOfWeek: preferredDay,
    dayOfWeekConfidence: dayConfidence,
    dayOfWeekProb,
    weekPositionPattern,
    weekPositionConfidence,
    preferredHour,
    hourProb,
    lastVisitDate: lastVisit.toISOString(),
    lastVisitDateFormatted: formatDateES(lastVisit),
    daysSinceLastVisit: Math.round(daysSinceLast),
    visitCount: sortedVisits.length,
    completedCount: completedVisits.length,
    scheduledCount: scheduledVisits.length,
    completionRate: sortedVisits.length > 0 ? completedVisits.length / sortedVisits.length : 0,
    overdueDays,
    dayOfWeekDistribution: dayOfWeekCounts,
    lastObjetivo,
    lastResultado,
    lastNextAction,
  };
}

const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

function locationKey(value: string | null): string {
  return value ? normalizeStr(value) : '';
}

function calculateHistoryScore(pattern: CustomerPattern): number {
  const urgencyRatio = pattern.daysSinceLastVisit / (pattern.avgDaysBetweenVisits || 14);
  const urgencyScore = Math.min(60, urgencyRatio * 18) + pattern.dueProbability * 20;
  const completionScore = Math.min(20, pattern.completedCount * 4) + pattern.completionRate * 10;
  const confidenceScore = Math.min(20, pattern.dayOfWeekConfidence * 12 + pattern.weekPositionConfidence * 8);
  return urgencyScore + completionScore + confidenceScore;
}

function emptyFeedbackAggregate(): FeedbackAggregate {
  return {
    total: 0,
    accepted: 0,
    rejected: 0,
    completed: 0,
    negativeOutcome: 0,
    recentRejected: 0,
  };
}

function addFeedback(map: Map<string, FeedbackAggregate>, key: string, record: FeedbackRecord, now: Date) {
  if (!key) return;
  const aggregate = map.get(key) || emptyFeedbackAggregate();
  aggregate.total += 1;
  if (record.status === 'accepted' || record.status === 'created') aggregate.accepted += 1;
  if (record.status === 'rejected') aggregate.rejected += 1;
  if (record.status === 'completed') aggregate.completed += 1;
  if (record.status === 'cancelled' || record.status === 'no_show') aggregate.negativeOutcome += 1;

  const createdAt = new Date(record.created_at);
  const daysAgo = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
  if (record.status === 'rejected' && daysAgo <= 30) aggregate.recentRejected += 1;
  map.set(key, aggregate);
}

function buildFeedbackStats(records: FeedbackRecord[]): FeedbackStats {
  const now = new Date();
  const stats: FeedbackStats = {
    byCustomer: new Map(),
    byCity: new Map(),
    byZone: new Map(),
    byDay: new Map(),
    global: emptyFeedbackAggregate(),
  };

  for (const record of records) {
    const features = record.features || {};
    addFeedback(stats.byCustomer, record.customer_id, record, now);
    addFeedback(stats.byCity, locationKey(features.city || null), record, now);
    addFeedback(stats.byZone, locationKey(features.zone || null), record, now);
    addFeedback(stats.byDay, String(features.dayOfWeek ?? new Date(record.recommended_date).getDay()), record, now);

    stats.global.total += 1;
    if (record.status === 'accepted' || record.status === 'created') stats.global.accepted += 1;
    if (record.status === 'rejected') stats.global.rejected += 1;
    if (record.status === 'completed') stats.global.completed += 1;
    if (record.status === 'cancelled' || record.status === 'no_show') stats.global.negativeOutcome += 1;
  }

  return stats;
}

function aggregateAdjustment(aggregate?: FeedbackAggregate): number {
  if (!aggregate || aggregate.total < 3) return 0;

  const acceptanceRate = (aggregate.accepted + aggregate.completed * 1.5) / aggregate.total;
  const rejectionRate = aggregate.rejected / aggregate.total;
  const negativeRate = aggregate.negativeOutcome / aggregate.total;

  return acceptanceRate * 18 - rejectionRate * 22 - negativeRate * 18 - aggregate.recentRejected * 2;
}

function getFeedbackScore(
  pattern: CustomerPattern,
  dow: number,
  feedbackStats: FeedbackStats
): { score: number; breakdown: Record<string, number> } {
  const customerScore = aggregateAdjustment(feedbackStats.byCustomer.get(pattern.customerId));
  const cityScore = aggregateAdjustment(feedbackStats.byCity.get(locationKey(pattern.customerCiudad))) * 0.5;
  const zoneScore = aggregateAdjustment(feedbackStats.byZone.get(locationKey(pattern.customerZona))) * 0.7;
  const dayScore = aggregateAdjustment(feedbackStats.byDay.get(String(dow))) * 0.35;
  const globalScore = aggregateAdjustment(feedbackStats.global) * 0.2;

  return {
    score: customerScore + cityScore + zoneScore + dayScore + globalScore,
    breakdown: {
      feedbackCustomer: Number(customerScore.toFixed(2)),
      feedbackCity: Number(cityScore.toFixed(2)),
      feedbackZone: Number(zoneScore.toFixed(2)),
      feedbackDay: Number(dayScore.toFixed(2)),
      feedbackGlobal: Number(globalScore.toFixed(2)),
    },
  };
}

function buildBusinessStats(rows: any[]): Map<number, BusinessStats> {
  const stats = new Map<number, BusinessStats>();

  for (const row of rows) {
    const code = Number(row.codigo_cliente);
    if (!code) continue;
    const current = stats.get(code) || {
      totalVentas: 0,
      numVentas: 0,
      monthsWithSales: 0,
      lastSaleMonth: null,
    };

    const total = Number(row.total_ventas || 0);
    current.totalVentas += total;
    current.numVentas += Number(row.num_ventas || 0);
    if (total > 0 || Number(row.num_ventas || 0) > 0) current.monthsWithSales += 1;

    const monthKey = `${row.anio}-${String(row.mes).padStart(2, '0')}`;
    if (!current.lastSaleMonth || monthKey > current.lastSaleMonth) {
      current.lastSaleMonth = monthKey;
    }

    stats.set(code, current);
  }

  return stats;
}

function getBusinessScore(pattern: CustomerPattern, businessStats: Map<number, BusinessStats>): { score: number; breakdown: Record<string, number>; stats: BusinessStats | null } {
  const stats = pattern.customerCodigoVentas ? businessStats.get(pattern.customerCodigoVentas) || null : null;

  let score = 0;
  if (stats) {
    score += Math.min(18, stats.monthsWithSales * 4);
    score += Math.min(18, Math.log10(stats.totalVentas + 1) * 4);
    if (stats.numVentas > 0) score += Math.min(10, stats.numVentas * 1.2);
  }

  if (pattern.customerCalidadPago === 'buena') score += 6;
  if (pattern.customerCalidadPago === 'mala') score -= 8;
  if (pattern.customerEtapaEmbudo === 'negociacion') score += 8;
  if (pattern.customerEtapaEmbudo === 'ganado') score += 5;
  if (pattern.customerEtapaEmbudo === 'perdido') score -= 10;

  return {
    score,
    stats,
    breakdown: {
      business: Number(score.toFixed(2)),
    },
  };
}

function mostCommonValue(values: string[]): { value: string | null; count: number; confidence: number } {
  if (values.length === 0) return { value: null, count: 0, confidence: 0 };

  const counts = new Map<string, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) || 0) + 1);
  }

  let bestValue: string | null = null;
  let bestCount = 0;
  for (const [value, count] of counts.entries()) {
    if (count > bestCount) {
      bestValue = value;
      bestCount = count;
    }
  }

  return {
    value: bestValue,
    count: bestCount,
    confidence: bestCount / values.length,
  };
}

function buildTerritoryDayPatterns(visits: VisitRecord[]): Map<number, TerritoryDayPattern> {
  const visitsByDay = new Map<number, VisitRecord[]>();

  for (const visit of visits) {
    if (!visit.customer) continue;
    if (visit.status !== 'completada') continue;

    const dow = new Date(visit.scheduled_at).getDay();
    if (dow === 0 || dow === 6) continue;
    if (!visitsByDay.has(dow)) visitsByDay.set(dow, []);
    visitsByDay.get(dow)!.push(visit);
  }

  const patterns = new Map<number, TerritoryDayPattern>();
  for (const [dow, dayVisits] of visitsByDay.entries()) {
    const cities = dayVisits.map(v => v.customer?.ciudad || null).filter(Boolean) as string[];
    const zones = dayVisits.map(v => v.customer?.zona || null).filter(Boolean) as string[];
    const city = mostCommonValue(cities);
    const zone = mostCommonValue(zones);

    patterns.set(dow, {
      dayOfWeek: dow,
      city: city.value,
      cityCount: city.count,
      cityConfidence: city.confidence,
      zone: zone.value,
      zoneCount: zone.count,
      zoneConfidence: zone.confidence,
      totalVisits: dayVisits.length,
    });
  }

  return patterns;
}

function generateRecommendations(
  patterns: CustomerPattern[],
  weekStart: Date,
  existingVisits: VisitRecord[],
  blockedDates: Set<string>,
  territoryDayPatterns: Map<number, TerritoryDayPattern>,
  feedbackStats: FeedbackStats,
  businessStats: Map<number, BusinessStats>,
  instructionPreferences: InstructionPreferences,
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
  const dayLocationCounts = new Map<string, { cities: Map<string, number>; zones: Map<string, number> }>();
  const primaryCityByDay = new Map<string, string>();
  const usedHoursByDay = new Map<string, Set<number>>();
  for (const d of weekDays) {
    const dateKey = d.toISOString().slice(0, 10);
    slotsPerDay.set(dateKey, 0);
    dayLocationCounts.set(dateKey, { cities: new Map(), zones: new Map() });
    usedHoursByDay.set(dateKey, new Set());
  }
  for (const v of existingVisits) {
    const scheduledAt = new Date(v.scheduled_at);
    const dateKey = scheduledAt.toISOString().slice(0, 10);
    slotsPerDay.set(dateKey, (slotsPerDay.get(dateKey) || 0) + 1);
    const usedHours = usedHoursByDay.get(dateKey);
    const existingHour = scheduledAt.getHours();
    if (usedHours && isBusinessHour(existingHour)) usedHours.add(existingHour);
    const locations = dayLocationCounts.get(dateKey);
    if (locations) {
      const city = locationKey(v.customer?.ciudad || null);
      const zone = locationKey(v.customer?.zona || null);
      if (city) locations.cities.set(city, (locations.cities.get(city) || 0) + 1);
      if (zone) locations.zones.set(zone, (locations.zones.get(zone) || 0) + 1);
    }
  }

  for (const [dateKey, locations] of dayLocationCounts.entries()) {
    let bestCity = '';
    let bestCount = 0;
    for (const [city, count] of locations.cities.entries()) {
      if (count > bestCount) {
        bestCity = city;
        bestCount = count;
      }
    }
    if (bestCity) primaryCityByDay.set(dateKey, bestCity);
  }

  const sortedPatterns = [...patterns].sort((a, b) => {
    return calculateHistoryScore(b) - calculateHistoryScore(a);
  });

  const MAX_PER_DAY = maxPerDay;
  const workingDayCount = weekDays.filter(day => {
    const dow = day.getDay();
    const dateKey = day.toISOString().slice(0, 10);
    return dow !== 0 && dow !== 6 && !blockedDates.has(dateKey) && !instructionPreferences.blockedWeekDays.has(dow);
  }).length || 5;
  const softTargetPerDay = Math.max(1, Math.min(MAX_PER_DAY, Math.ceil(sortedPatterns.length / workingDayCount)));

  for (const pattern of sortedPatterns) {
    const urgencyRatio = pattern.daysSinceLastVisit / (pattern.avgDaysBetweenVisits || 14);
    if (urgencyRatio < 0.5 && pattern.visitCount > 2) continue;

    let bestDay: Date | null = null;
    let bestScore = -Infinity;

    for (const day of weekDays) {
      const dow = day.getDay();
      if (dow === 0 || dow === 6) continue;
      if (instructionPreferences.blockedWeekDays.has(dow)) continue;

      const dateKey = day.toISOString().slice(0, 10);
      if (blockedDates.has(dateKey)) continue;
      const slotCount = slotsPerDay.get(dateKey) || 0;
      if (slotCount >= MAX_PER_DAY) continue;

      if (existingSet.has(`${pattern.customerId}_${dateKey}`)) continue;
      const dayBlockedHours = instructionPreferences.blockedHours.get(dow);
      const city = locationKey(pattern.customerCiudad);
      const primaryCity = primaryCityByDay.get(dateKey);
      const usedHours = usedHoursByDay.get(dateKey);
      if (chooseBestHour(pattern.hourProb, pattern.preferredHour, dayBlockedHours, usedHours) === null) continue;

      // Instrucción de ubicación por día (ej. "el lunes me voy a Loja").
      const dayInstructionTerms = instructionPreferences.dayLocationPreferences.get(dow) || [];
      const dayIsReserved = dayInstructionTerms.length > 0;
      const matchesDayInstruction = dayIsReserved && matchesInstructionLocation(pattern, dayInstructionTerms);

      // 1) Días con instrucción de ubicación quedan RESERVADOS: solo clientes de ese lugar.
      if (dayIsReserved && !matchesDayInstruction) continue;

      // 2) Clientes que pertenecen a un lugar instruido quedan FIJADOS a esos días.
      const constrainedInstructionDays = Array.from(instructionPreferences.dayLocationPreferences.entries())
        .filter(([, terms]) => matchesInstructionLocation(pattern, terms))
        .map(([instructionDow]) => instructionDow);
      if (constrainedInstructionDays.length > 0 && !constrainedInstructionDays.includes(dow)) continue;

      // La instrucción define la ciudad del día; solo aplicamos la regla de "una ciudad
      // por día" en días NO reservados por instrucción.
      if (!dayIsReserved && primaryCity && city && city !== primaryCity) continue;

      let score = 0;

      // Crédito parcial por afinidad al día de semana (no solo el día modal).
      score += 34 * pattern.dayOfWeekProb[dow];

      // Urgencia = ratio simple + probabilidad de vencimiento (modelo tipo supervivencia).
      score += urgencyRatio * 12 + pattern.dueProbability * 24;
      score += Math.min(16, pattern.completedCount * 3);
      score += pattern.completionRate * 8;

      const locations = dayLocationCounts.get(dateKey);
      const zone = locationKey(pattern.customerZona);
      const sameZoneCount = zone ? (locations?.zones.get(zone) || 0) : 0;
      const sameCityCount = city ? (locations?.cities.get(city) || 0) : 0;
      const territoryPattern = territoryDayPatterns.get(dow);
      const matchesHabitualZone = !!(
        territoryPattern?.zone &&
        zone &&
        locationKey(territoryPattern.zone) === zone &&
        territoryPattern.zoneConfidence >= 0.35 &&
        territoryPattern.zoneCount >= 2
      );
      const matchesHabitualCity = !!(
        territoryPattern?.city &&
        city &&
        locationKey(territoryPattern.city) === city &&
        territoryPattern.cityConfidence >= 0.35 &&
        territoryPattern.cityCount >= 2
      );
      if (sameZoneCount > 0) {
        score += Math.min(28, 18 + sameZoneCount * 5);
      } else if (sameCityCount > 0) {
        score += Math.min(18, 10 + sameCityCount * 3);
      }
      if (matchesHabitualZone) {
        score += Math.min(26, 14 + territoryPattern!.zoneConfidence * 18);
      } else if (matchesHabitualCity) {
        score += Math.min(22, 12 + territoryPattern!.cityConfidence * 14);
      }
      const feedback = getFeedbackScore(pattern, dow, feedbackStats);
      score += feedback.score;
      const business = getBusinessScore(pattern, businessStats);
      score += business.score;
      if (matchesDayInstruction) {
        score += 120;
      }
      if (dayBlockedHours?.has(clampBusinessHour(pattern.preferredHour))) {
        score -= 10;
      }

      // Los clientes fijados por instrucción no reciben penalización de carga:
      // el objetivo es llenar ese día con ese lugar.
      if (!matchesDayInstruction) {
        score -= slotCount * 10;
        if (slotCount >= softTargetPerDay) {
          score -= (slotCount - softTargetPerDay + 1) * 28;
        }
      }

      if (bestDay === null || score > bestScore) {
        bestScore = score;
        bestDay = day;
      }
    }

    if (!bestDay) continue;

    const dateKey = bestDay.toISOString().slice(0, 10);
    const dow = bestDay.getDay();

    const reasons: string[] = [];
    const locations = dayLocationCounts.get(dateKey);
    const city = locationKey(pattern.customerCiudad);
    const zone = locationKey(pattern.customerZona);
    const sameZoneCount = zone ? (locations?.zones.get(zone) || 0) : 0;
    const sameCityCount = city ? (locations?.cities.get(city) || 0) : 0;
    const territoryPattern = territoryDayPatterns.get(dow);
    const matchesHabitualZone = !!(
      territoryPattern?.zone &&
      zone &&
      locationKey(territoryPattern.zone) === zone &&
      territoryPattern.zoneConfidence >= 0.35 &&
      territoryPattern.zoneCount >= 2
    );
    const matchesHabitualCity = !!(
      territoryPattern?.city &&
      city &&
      locationKey(territoryPattern.city) === city &&
      territoryPattern.cityConfidence >= 0.35 &&
      territoryPattern.cityCount >= 2
    );
    const feedback = getFeedbackScore(pattern, dow, feedbackStats);
    const business = getBusinessScore(pattern, businessStats);
    const instructionTerms = instructionPreferences.dayLocationPreferences.get(dow) || [];
    const instructionMatch = matchesInstructionLocation(pattern, instructionTerms);
    const dayBlockedHours = instructionPreferences.blockedHours.get(dow);
    const urgencyScore = urgencyRatio * 12 + pattern.dueProbability * 24;
    const historyScore = Math.min(16, pattern.completedCount * 3) + pattern.completionRate * 8;
    const dayPatternScore = 34 * pattern.dayOfWeekProb[dow];
    const sameRouteScore = sameZoneCount > 0
      ? Math.min(28, 18 + sameZoneCount * 5)
      : sameCityCount > 0
      ? Math.min(18, 10 + sameCityCount * 3)
      : 0;
    const habitualTerritoryScore = matchesHabitualZone
      ? Math.min(26, 14 + (territoryPattern?.zoneConfidence || 0) * 18)
      : matchesHabitualCity
      ? Math.min(22, 12 + (territoryPattern?.cityConfidence || 0) * 14)
      : 0;
    const slotCountForBreakdown = slotsPerDay.get(dateKey) || 0;
    const loadPenalty = instructionMatch ? 0 : -1 * (
      slotCountForBreakdown * 10 +
      (slotCountForBreakdown >= softTargetPerDay ? (slotCountForBreakdown - softTargetPerDay + 1) * 28 : 0)
    );
    const instructionScore = instructionMatch ? 120 : 0;
    const objetivo = buildRecommendedObjective(pattern, business.stats);
    const scoreBreakdown = {
      urgency: Number(urgencyScore.toFixed(2)),
      history: Number(historyScore.toFixed(2)),
      dayPattern: Number(dayPatternScore.toFixed(2)),
      sameRoute: Number(sameRouteScore.toFixed(2)),
      habitualTerritory: Number(habitualTerritoryScore.toFixed(2)),
      instructions: Number(instructionScore.toFixed(2)),
      loadPenalty: Number(loadPenalty.toFixed(2)),
      ...feedback.breakdown,
      ...business.breakdown,
    };
    const scoreTotal = Object.values(scoreBreakdown).reduce((sum, value) => sum + value, 0);
    const features = {
      city: pattern.customerCiudad,
      zone: pattern.customerZona,
      dayOfWeek: dow,
      dayName: dayNames[dow],
      hour: clampBusinessHour(pattern.preferredHour),
      urgencyRatio: Number(urgencyRatio.toFixed(2)),
      dueProbability: Number(pattern.dueProbability.toFixed(2)),
      avgDaysBetweenVisits: pattern.avgDaysBetweenVisits,
      intervalStdDev: pattern.intervalStdDev,
      daysSinceLastVisit: pattern.daysSinceLastVisit,
      overdueDays: pattern.overdueDays,
      recommendedObjective: objetivo,
      visitCount: pattern.visitCount,
      completedCount: pattern.completedCount,
      completionRate: Number(pattern.completionRate.toFixed(2)),
      sameZoneCount,
      sameCityCount,
      matchesHabitualZone,
      matchesHabitualCity,
      instructionTerms,
      instructionMatch,
      blockedHours: Array.from(dayBlockedHours || []),
      blockedWeekDays: Array.from(instructionPreferences.blockedWeekDays),
      softTargetPerDay,
      customerCategoriaCompra: pattern.customerCategoriaCompra,
      customerEtiquetas: pattern.customerEtiquetas,
      customerTipo: pattern.customerTipo,
      customerEtapaEmbudo: pattern.customerEtapaEmbudo,
      customerCalidadPago: pattern.customerCalidadPago,
      customerCodigoVentas: pattern.customerCodigoVentas,
      businessStats: business.stats,
    };

    // 1. Last visit info - always include with specific date
    reasons.push(
      `📅 No la has visitado desde el ${pattern.lastVisitDateFormatted} (hace ${pattern.daysSinceLastVisit} días)`
    );

    // 2. Urgency indicator
    if (urgencyRatio >= 2) {
      reasons.push(`🔴 Visita muy atrasada: debió visitarse hace ${pattern.overdueDays} días según su ciclo histórico`);
    } else if (urgencyRatio >= 1.2) {
      reasons.push(`🟠 Visita atrasada: su ciclo es cada ${pattern.avgDaysBetweenVisits} días y ya pasaron ${pattern.daysSinceLastVisit}`);
    } else if (urgencyRatio >= 0.8) {
      reasons.push(`🟡 Próxima a cumplir su ciclo de ${pattern.avgDaysBetweenVisits} días`);
    }

    // 3. Geographical proximity
    if (sameZoneCount > 0 && pattern.customerZona) {
      reasons.push(`📍 Geocercanía: ese día ya tienes ${sameZoneCount} visita${sameZoneCount > 1 ? 's' : ''} en el sector ${pattern.customerZona}`);
    } else if (sameCityCount > 0 && pattern.customerCiudad) {
      reasons.push(`📍 Geocercanía: ese día ya tienes ${sameCityCount} visita${sameCityCount > 1 ? 's' : ''} en ${pattern.customerCiudad}`);
    } else if (matchesHabitualZone && territoryPattern?.zone) {
      reasons.push(`📍 Patrón territorial: los ${dayNames[dow]} sueles trabajar el sector ${territoryPattern.zone} (${Math.round(territoryPattern.zoneConfidence * 100)}% de tus visitas completadas ese día)`);
    } else if (matchesHabitualCity && territoryPattern?.city) {
      reasons.push(`📍 Patrón territorial: los ${dayNames[dow]} sueles ir a ${territoryPattern.city} (${Math.round(territoryPattern.cityConfidence * 100)}% de tus visitas completadas ese día)`);
    } else if (pattern.customerZona || pattern.customerCiudad) {
      reasons.push(`📍 Ubicación considerada: ${[pattern.customerZona, pattern.customerCiudad].filter(Boolean).join(', ')}`);
    }
    if (pattern.customerCiudad) {
      reasons.push(`🚗 Regla de ruta: este día se mantiene en ${pattern.customerCiudad}, sin alternar entre ciudades`);
    }

    // 4. Day-of-week pattern
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

    // 5. Week position pattern
    if (pattern.weekPositionPattern && pattern.weekPositionConfidence >= 0.6 && pattern.visitCount >= 3) {
      const posLabels = { inicio: 'al inicio de semana (Lun-Mar)', mitad: 'a mitad de semana (Mié-Jue)', fin: 'al final de semana (Vie-Sáb)' };
      reasons.push(`🗓️ Sueles visitarla ${posLabels[pattern.weekPositionPattern]}`);
    }

    // 6. Frequency pattern
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

    // 7. Visit history context
    if (pattern.completedCount > 0) {
      const completionPct = Math.round(pattern.completionRate * 100);
      reasons.push(`📈 Histórico: ${pattern.completedCount} visita${pattern.completedCount > 1 ? 's' : ''} completada${pattern.completedCount > 1 ? 's' : ''} de ${pattern.visitCount} (${completionPct}% de cumplimiento)`);
    }

    if (feedback.score >= 8) {
      reasons.push('🧠 Aprendizaje: recomendaciones similares han sido aceptadas o completadas antes');
    } else if (feedback.score <= -8) {
      reasons.push('🧠 Aprendizaje: recomendaciones similares han sido rechazadas o tuvieron mal resultado antes');
    }

    if (business.stats && business.score >= 10) {
      reasons.push(`💼 Señal comercial: ${business.stats.numVentas} venta${business.stats.numVentas !== 1 ? 's' : ''} y $${Math.round(business.stats.totalVentas).toLocaleString()} en historial reciente`);
    } else if (pattern.customerEtapaEmbudo === 'negociacion') {
      reasons.push('💼 Señal comercial: cliente en etapa de negociación');
    }

    if (instructionMatch) {
      reasons.push(`📝 Instrucción aplicada: ${dayNames[dow]} priorizar ${instructionTerms.join(' ')}`);
    }
    if (dayBlockedHours && dayBlockedHours.size > 0) {
      reasons.push(`📝 Instrucción aplicada: evitar ${Array.from(dayBlockedHours).map(h => `${h.toString().padStart(2, '0')}:00`).join(', ')} ese día`);
    }
    if (slotCountForBreakdown >= softTargetPerDay) {
      reasons.push(`⚖️ Balance semanal: se evita saturar más de ${softTargetPerDay} visita${softTargetPerDay > 1 ? 's' : ''} por día cuando hay espacio en otros días`);
    }

    // Primary reason (short summary for backward compat)
    let reason: string;
    if (sameZoneCount > 0 && urgencyRatio >= 0.8 && pattern.customerZona) {
      reason = `Aprovecha ruta por ${pattern.customerZona}: ciclo ${pattern.avgDaysBetweenVisits} días, última ${pattern.lastVisitDateFormatted}`;
    } else if (sameCityCount > 0 && urgencyRatio >= 0.8 && pattern.customerCiudad) {
      reason = `Aprovecha ruta en ${pattern.customerCiudad}: ciclo ${pattern.avgDaysBetweenVisits} días, última ${pattern.lastVisitDateFormatted}`;
    } else if (matchesHabitualZone && territoryPattern?.zone) {
      reason = `Encaja con tu patrón de ${dayNames[dow]} en ${territoryPattern.zone}`;
    } else if (matchesHabitualCity && territoryPattern?.city) {
      reason = `Encaja con tu patrón de ${dayNames[dow]} en ${territoryPattern.city}`;
    } else if (urgencyRatio >= 1.5) {
      reason = `Visita atrasada: ${pattern.overdueDays} días sobre su ciclo histórico`;
    } else if (pattern.dayOfWeekConfidence > 0.5 && dow === pattern.preferredDayOfWeek) {
      reason = `Buen encaje histórico: suele visitarse los ${dayNames[pattern.preferredDayOfWeek]}`;
    } else if (pattern.weekPositionPattern && pattern.weekPositionConfidence >= 0.6) {
      const posShort = { inicio: 'inicio de semana', mitad: 'mitad de semana', fin: 'fin de semana' };
      reason = `La visitas al ${posShort[pattern.weekPositionPattern]}`;
    } else if (urgencyRatio >= 0.8) {
      reason = `Próxima a cumplir ciclo de ${pattern.avgDaysBetweenVisits} días`;
    } else {
      reason = `Cada ~${pattern.avgDaysBetweenVisits} días, última: ${pattern.lastVisitDateFormatted}`;
    }

    const usedHours = usedHoursByDay.get(dateKey);
    const hour = chooseBestHour(pattern.hourProb, pattern.preferredHour, dayBlockedHours, usedHours);
    if (hour === null) continue;
    const time = `${hour.toString().padStart(2, '0')}:00`;
    reasons.push(`⏰ Horario más pertinente según su historial (${time}); no se repite la hora con otra visita del mismo día`);
    reasons.push(`🎯 Objetivo sugerido: ${objetivo}`);

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
      objetivo,
      reason,
      reasons,
      scoreTotal: Number(scoreTotal.toFixed(2)),
      scoreBreakdown,
      features,
    });

    slotsPerDay.set(dateKey, (slotsPerDay.get(dateKey) || 0) + 1);
    const locationCounts = dayLocationCounts.get(dateKey);
    if (locationCounts) {
      if (city) locationCounts.cities.set(city, (locationCounts.cities.get(city) || 0) + 1);
      if (zone) locationCounts.zones.set(zone, (locationCounts.zones.get(zone) || 0) + 1);
    }
    if (city && !primaryCityByDay.has(dateKey)) {
      primaryCityByDay.set(dateKey, city);
    }
    usedHoursByDay.get(dateKey)?.add(hour);
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
    const instructionPreferences = parseInstructionPreferences(filterInstructions);
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
        id, customer_id, scheduled_at, status, objetivo, resultado, next_action,
        customer:customers(id, nombre, direccion, zona, ciudad, tipo, etapa_embudo, calidad_pago, categoria_compra, etiquetas, codigo_cliente_ventas)
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

    const salesSince = new Date();
    salesSince.setMonth(salesSince.getMonth() - 6);

    const [weekVisitsResult, blockedDaysResult, businessSalesResult] = await Promise.all([
      supabase
        .from('visits')
        .select(`
          id, customer_id, scheduled_at, status,
          customer:customers(id, nombre, direccion, zona, ciudad, tipo, etapa_embudo, calidad_pago, categoria_compra, etiquetas, codigo_cliente_ventas)
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
      supabase
        .from('ventas_cliente_mensual')
        .select('anio, mes, codigo_cliente, num_ventas, total_ventas')
        .or(`anio.gt.${salesSince.getFullYear()},and(anio.eq.${salesSince.getFullYear()},mes.gte.${salesSince.getMonth() + 1})`),
    ]);

    const { data: weekVisits, error: weekError } = weekVisitsResult;
    if (weekError) {
      console.error('Error fetching week visits:', weekError);
      return NextResponse.json({ error: 'Error consultando visitas de la semana' }, { status: 500 });
    }

    if (businessSalesResult.error) {
      console.error('Error fetching business sales for recommendations:', businessSalesResult.error);
    }

    const blockedDates = new Set<string>(
      (blockedDaysResult.data || []).map((d: { fecha: string }) => d.fecha)
    );
    const businessStats = buildBusinessStats(businessSalesResult.data || []);

    const feedbackSince = new Date();
    feedbackSince.setMonth(feedbackSince.getMonth() - 6);
    const { data: feedbackRows, error: feedbackError } = await supabase
      .from('agenda_recommendations')
      .select('customer_id, status, recommended_date, recommended_time, features, created_at')
      .eq('user_id', userId)
      .gte('created_at', feedbackSince.toISOString());

    if (feedbackError && feedbackError.code !== '42P01') {
      console.error('Error fetching recommendation feedback:', feedbackError);
    }

    const normalizedHistoricalVisits = (historicalVisits as VisitRecordRaw[]).map(normalizeVisit);
    const territoryDayPatterns = buildTerritoryDayPatterns(normalizedHistoricalVisits);
    const feedbackStats = buildFeedbackStats((feedbackRows || []) as FeedbackRecord[]);

    const visitsByCustomer = new Map<string, VisitRecord[]>();
    for (const v of normalizedHistoricalVisits) {
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

    const normalizedWeekVisits = ((weekVisits || []) as VisitRecordRaw[]).map(normalizeVisit);

    const recommendations = generateRecommendations(
      patterns,
      weekStart,
      normalizedWeekVisits,
      blockedDates,
      territoryDayPatterns,
      feedbackStats,
      businessStats,
      instructionPreferences,
      filterMaxPerDay
    );

    const generationId = randomUUID();
    let persistedRecommendations = recommendations;
    if (recommendations.length > 0) {
      const rows = recommendations.map(r => ({
        generation_id: generationId,
        user_id: userId,
        customer_id: r.customerId,
        recommended_date: r.date,
        recommended_time: r.time,
        status: 'generated',
        score_total: r.scoreTotal,
        score_breakdown: r.scoreBreakdown,
        features: r.features,
        reason: r.reason,
        reasons: r.reasons,
      }));

      const { data: inserted, error: insertError } = await supabase
        .from('agenda_recommendations')
        .insert(rows)
        .select('id, customer_id, recommended_date, recommended_time');

      if (insertError) {
        console.error('Error persisting recommendations:', insertError);
      } else if (inserted) {
        const idMap = new Map(
          inserted.map((r: any) => [`${r.customer_id}_${r.recommended_date}_${String(r.recommended_time).slice(0, 5)}`, r.id])
        );
        persistedRecommendations = recommendations.map(r => ({
          ...r,
          recommendationId: idMap.get(`${r.customerId}_${r.date}_${r.time}`),
        }));
      }
    }

    return NextResponse.json({
      recommendations: persistedRecommendations,
      generationId,
      patterns: patterns.map(p => ({
        customerName: p.customerName,
        avgDays: p.avgDaysBetweenVisits,
        preferredDay: dayNames[p.preferredDayOfWeek],
        dayConfidence: Math.round(p.dayOfWeekConfidence * 100),
        visitCount: p.visitCount,
        daysSinceLastVisit: p.daysSinceLastVisit,
      })),
      territoryPatterns: Array.from(territoryDayPatterns.values()).map(p => ({
        dayName: dayNames[p.dayOfWeek],
        city: p.city,
        cityConfidence: Math.round(p.cityConfidence * 100),
        zone: p.zone,
        zoneConfidence: Math.round(p.zoneConfidence * 100),
        totalVisits: p.totalVisits,
      })),
      weekStart: weekStart.toISOString().slice(0, 10),
      weekEnd: weekEnd.toISOString().slice(0, 10),
      totalClientsAnalyzed: patterns.length,
      totalRecommendations: persistedRecommendations.length,
      feedbackStats: {
        samples: feedbackStats.global.total,
        accepted: feedbackStats.global.accepted,
        rejected: feedbackStats.global.rejected,
        completed: feedbackStats.global.completed,
        negativeOutcome: feedbackStats.global.negativeOutcome,
      },
      instructionNotes: instructionPreferences.notes,
    });
  } catch (err: any) {
    console.error('RecomendCalend error:', err);
    return NextResponse.json({ error: err.message || 'Error interno' }, { status: 500 });
  }
}

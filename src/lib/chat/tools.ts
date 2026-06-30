import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';

function getDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

function nowEC() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Guayaquil' }));
}

function dateStrEC() {
  const d = nowEC();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function normalize(s: string) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

async function resolveUserIds(db: ReturnType<typeof getDb>, anyId: string) {
  const { data } = await db
    .from('users_profile')
    .select('id, user_id')
    .or(`id.eq.${anyId},user_id.eq.${anyId}`)
    .limit(1)
    .maybeSingle();
  const profileId = data?.id || anyId;
  const authId = data?.user_id || anyId;
  return { profileId, authId };
}

// ============================================================
export const getCurrentDateTime = tool(
  async () => {
    const ec = nowEC();
    const dayNames = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
    return JSON.stringify({
      timezone: 'America/Guayaquil (UTC-5)',
      date: dateStrEC(),
      time: `${String(ec.getHours()).padStart(2, '0')}:${String(ec.getMinutes()).padStart(2, '0')}`,
      dayOfWeek: dayNames[ec.getDay()],
    });
  },
  {
    name: 'getCurrentDateTime',
    description: 'Returns current date/time in Ecuador (UTC-5). Call FIRST for any temporal query ("today", "now", "this week").',
    schema: z.object({}),
  }
);

// ============================================================
export const findUser = tool(
  async ({ name }: { name: string }) => {
    const db = getDb();
    const { data: allUsers } = await db
      .from('users_profile')
      .select('id, user_id, nombre_completo, email, telefono, rol, activo')
      .eq('activo', true);
    if (!allUsers || allUsers.length === 0) return JSON.stringify({ found: false, message: 'No hay usuarios activos' });

    const needle = normalize(name);
    const matches = allUsers.filter(u => normalize(u.nombre_completo).includes(needle));
    if (matches.length === 0) return JSON.stringify({ found: false, message: `No se encontró usuario con nombre "${name}". Usuarios disponibles: ${allUsers.map(u => u.nombre_completo).join(', ')}` });
    return JSON.stringify({ found: true, users: matches });
  },
  {
    name: 'findUser',
    description: 'Search for a user/employee by name (accent-insensitive). Returns profile id, user_id, full name, role. Pass the "id" to other tools.',
    schema: z.object({
      name: z.string().describe('Partial or full name of the person'),
    }),
  }
);

// ============================================================
const VISIT_SELECT = 'id, scheduled_at, status, objetivo, resultado, observaciones, location_text, customer:customers(nombre, direccion, ciudad)';

export const getUserScheduleToday = tool(
  async ({ userProfileId, date }: { userProfileId: string; date: string }) => {
    const db = getDb();
    const { profileId, authId } = await resolveUserIds(db, userProfileId);
    const dayStart = `${date}T00:00:00-05:00`;
    const dayEnd = `${date}T23:59:59-05:00`;

    const [v1, v2, activitiesRes] = await Promise.all([
      db.from('visits').select(VISIT_SELECT).is('deleted_at', null).eq('user_id', profileId).gte('scheduled_at', dayStart).lte('scheduled_at', dayEnd).order('scheduled_at'),
      db.from('visits').select(VISIT_SELECT).is('deleted_at', null).eq('user_id', authId).gte('scheduled_at', dayStart).lte('scheduled_at', dayEnd).order('scheduled_at'),
      db.from('activities').select('id, titulo, tipo, estado, prioridad, fecha_inicio, fecha_fin, ubicacion, es_virtual').gte('fecha_inicio', dayStart).lte('fecha_inicio', dayEnd).order('fecha_inicio'),
    ]);

    const seen = new Set<string>();
    const visits = [...(v1.data || []), ...(v2.data || [])].filter(v => { if (seen.has(v.id)) return false; seen.add(v.id); return true; });

    const activities = activitiesRes.data || [];
    const actIds = activities.map(a => a.id);
    const { data: participations } = actIds.length > 0
      ? await db.from('activity_participants').select('activity_id').eq('user_profile_id', profileId).in('activity_id', actIds)
      : { data: [] };
    const pIds = new Set((participations || []).map(p => p.activity_id));
    const { data: created } = await db.from('activities').select('id, titulo, tipo, estado, prioridad, fecha_inicio, fecha_fin, ubicacion, es_virtual').eq('created_by_user_id', profileId).gte('fecha_inicio', dayStart).lte('fecha_inicio', dayEnd);
    const cIds = new Set((created || []).map(a => a.id));
    const userActs = activities.filter(a => pIds.has(a.id) || cIds.has(a.id));

    return JSON.stringify({ date, visits, activities: userActs, summary: { totalVisits: visits.length, totalActivities: userActs.length } });
  },
  {
    name: 'getUserScheduleToday',
    description: 'Get visits and activities for a user on a specific date. Returns visit details including customer name, objetivo, resultado, and observaciones.',
    schema: z.object({
      userProfileId: z.string().describe('Profile id from findUser'),
      date: z.string().describe('YYYY-MM-DD'),
    }),
  }
);

// ============================================================
export const getUserActivitiesRange = tool(
  async ({ userProfileId, dateFrom, dateTo }: { userProfileId: string; dateFrom: string; dateTo: string }) => {
    const db = getDb();
    const { profileId, authId } = await resolveUserIds(db, userProfileId);
    const s = `${dateFrom}T00:00:00-05:00`;
    const e = `${dateTo}T23:59:59-05:00`;
    const vSel = 'id, scheduled_at, status, objetivo, resultado, customer:customers(nombre)';

    const [v1, v2, allAct] = await Promise.all([
      db.from('visits').select(vSel).is('deleted_at', null).eq('user_id', profileId).gte('scheduled_at', s).lte('scheduled_at', e).order('scheduled_at'),
      db.from('visits').select(vSel).is('deleted_at', null).eq('user_id', authId).gte('scheduled_at', s).lte('scheduled_at', e).order('scheduled_at'),
      db.from('activities').select('id, titulo, tipo, estado, fecha_inicio, fecha_fin').gte('fecha_inicio', s).lte('fecha_inicio', e).order('fecha_inicio'),
    ]);
    const seen = new Set<string>();
    const visits = [...(v1.data || []), ...(v2.data || [])].filter(v => { if (seen.has(v.id)) return false; seen.add(v.id); return true; });

    const actIds = (allAct.data || []).map(a => a.id);
    const uActIds = new Set<string>();
    if (actIds.length > 0) { const { data: p } = await db.from('activity_participants').select('activity_id').eq('user_profile_id', profileId).in('activity_id', actIds); (p || []).forEach(x => uActIds.add(x.activity_id)); }
    const { data: cr } = await db.from('activities').select('id').eq('created_by_user_id', profileId).gte('fecha_inicio', s).lte('fecha_inicio', e);
    (cr || []).forEach(a => uActIds.add(a.id));

    return JSON.stringify({ dateFrom, dateTo, visits, activities: (allAct.data || []).filter(a => uActIds.has(a.id)), totals: { visits: visits.length, activities: uActIds.size } });
  },
  {
    name: 'getUserActivitiesRange',
    description: 'Get visits and activities for a user in a date range. Good for "what did X do this week/month".',
    schema: z.object({
      userProfileId: z.string().describe('Profile id from findUser'),
      dateFrom: z.string().describe('YYYY-MM-DD'),
      dateTo: z.string().describe('YYYY-MM-DD'),
    }),
  }
);

// ============================================================
export const searchVisitsByCustomer = tool(
  async ({ customerName, userProfileId, limit: lim }: { customerName: string; userProfileId?: string; limit?: number }) => {
    const db = getDb();
    const { data: customers } = await db.from('customers').select('id, nombre').is('deleted_at', null);
    const needle = normalize(customerName);
    const matched = (customers || []).filter(c => normalize(c.nombre).includes(needle));
    if (matched.length === 0) return JSON.stringify({ found: false, message: `No se encontró cliente "${customerName}"` });

    const customerIds = matched.map(c => c.id);
    let query = db.from('visits')
      .select('id, scheduled_at, status, objetivo, resultado, observaciones, location_text, customer:customers(nombre, ciudad)')
      .is('deleted_at', null)
      .in('customer_id', customerIds)
      .order('scheduled_at', { ascending: false })
      .limit(lim || 10);

    if (userProfileId) {
      const { profileId, authId } = await resolveUserIds(db, userProfileId);
      const [r1, r2] = await Promise.all([
        db.from('visits').select('id, scheduled_at, status, objetivo, resultado, observaciones, location_text, customer:customers(nombre, ciudad)').is('deleted_at', null).in('customer_id', customerIds).eq('user_id', profileId).order('scheduled_at', { ascending: false }).limit(lim || 10),
        db.from('visits').select('id, scheduled_at, status, objetivo, resultado, observaciones, location_text, customer:customers(nombre, ciudad)').is('deleted_at', null).in('customer_id', customerIds).eq('user_id', authId).order('scheduled_at', { ascending: false }).limit(lim || 10),
      ]);
      const seen = new Set<string>();
      const visits = [...(r1.data || []), ...(r2.data || [])].filter(v => { if (seen.has(v.id)) return false; seen.add(v.id); return true; });
      return JSON.stringify({ found: true, customer: matched[0].nombre, visits });
    }

    const { data, error } = await query;
    if (error) return JSON.stringify({ error: error.message });
    return JSON.stringify({ found: true, customer: matched[0].nombre, visits: data || [] });
  },
  {
    name: 'searchVisitsByCustomer',
    description: 'Search visits to a specific customer by name. Returns visit history with resultado and observaciones. Optionally filter by the salesperson who made the visits.',
    schema: z.object({
      customerName: z.string().describe('Customer name to search for'),
      userProfileId: z.string().optional().describe('Optional: filter by salesperson profile id'),
      limit: z.number().optional().describe('Max results (default 10)'),
    }),
  }
);

// ============================================================
export const searchEvents = tool(
  async ({ query }: { query: string }) => {
    const db = getDb();
    const { data: all } = await db.from('events').select('id, nombre, tipo, modalidad, estado, fecha_inicio, fecha_fin, ubicacion, presupuesto_total, cupo_maximo, precio_por_persona').order('fecha_inicio', { ascending: false });
    const needle = normalize(query);
    const matches = (all || []).filter(e => normalize(e.nombre).includes(needle));
    if (matches.length === 0) {
      const names = (all || []).slice(0, 10).map(e => e.nombre);
      return JSON.stringify({ found: false, message: `No se encontraron eventos con "${query}". Eventos recientes: ${names.join(', ')}` });
    }
    return JSON.stringify({ found: true, events: matches.slice(0, 10) });
  },
  {
    name: 'searchEvents',
    description: 'Search events by name (accent-insensitive). Returns event info with ID. Use getEventInfo for full details.',
    schema: z.object({ query: z.string().describe('Event name to search') }),
  }
);

// ============================================================
export const getEventInfo = tool(
  async ({ eventId }: { eventId: string }) => {
    const db = getDb();
    const { data: ev, error } = await db.from('events').select('*').eq('id', eventId).single();
    if (error || !ev) return JSON.stringify({ found: false, message: 'Evento no encontrado' });

    const [expR, partR, actR] = await Promise.all([
      db.from('event_expenses').select('categoria, monto, estado').eq('event_id', eventId),
      db.from('event_participants').select('id, nombre, categoria, estado_inscripcion, estado_pago, monto_pagado, asistencia, numero_asiento').eq('event_id', eventId),
      db.from('event_activities').select('id, nombre, estado, porcentaje_avance, tipo').eq('event_id', eventId),
    ]);
    const expenses = expR.data || []; const participants = partR.data || []; const activities = actR.data || [];
    const totalGastos = expenses.filter(e => e.estado !== 'cancelado').reduce((s, e) => s + Number(e.monto), 0);
    const totalPagado = participants.reduce((s, p) => s + Number(p.monto_pagado), 0);
    const cats: Record<string, { total: number; confirmados: number }> = {};
    participants.forEach(p => { const c = p.categoria || 'Sin categoría'; if (!cats[c]) cats[c] = { total: 0, confirmados: 0 }; cats[c].total++; if (p.estado_inscripcion === 'confirmado') cats[c].confirmados++; });

    return JSON.stringify({ found: true, event: { nombre: ev.nombre, tipo: ev.tipo, modalidad: ev.modalidad, estado: ev.estado, fecha_inicio: ev.fecha_inicio, fecha_fin: ev.fecha_fin, ubicacion: ev.ubicacion, objetivo: ev.objetivo, marcas: ev.marcas },
      budget: { presupuesto_total: ev.presupuesto_total, total_gastos: totalGastos, precio_por_persona: ev.precio_por_persona, costo_fijo_total: ev.costo_fijo_total, ingresos_reales: totalPagado, utilidad: totalPagado - totalGastos },
      participants: { total: participants.length, confirmados: participants.filter(p => p.estado_inscripcion === 'confirmado').length, asistieron: participants.filter(p => p.asistencia).length, cupo_maximo: ev.cupo_maximo, por_categoria: cats },
      activities: { total: activities.length, completadas: activities.filter(a => a.estado === 'completada').length } });
  },
  {
    name: 'getEventInfo',
    description: 'Full event details: budget, expenses, participant counts by category, activity progress. Needs event ID from searchEvents.',
    schema: z.object({ eventId: z.string().describe('Event UUID') }),
  }
);

// ============================================================
export const getEventParticipantStats = tool(
  async ({ eventId, categoria }: { eventId: string; categoria?: string }) => {
    const db = getDb();
    let q = db.from('event_participants').select('id, nombre, categoria, estado_inscripcion, estado_pago, monto_pagado, asistencia, empresa, numero_asiento').eq('event_id', eventId);
    if (categoria) q = q.eq('categoria', categoria);
    const { data, error } = await q;
    if (error) return JSON.stringify({ error: error.message });
    const parts = data || [];
    const stats: Record<string, number> = {};
    parts.forEach(p => { const c = p.categoria || 'Sin categoría'; stats[c] = (stats[c] || 0) + 1; });
    return JSON.stringify({ eventId, total: parts.length, por_categoria: stats, asistencia: parts.filter(p => p.asistencia).length, participants: parts.slice(0, 50).map(p => ({ nombre: p.nombre, categoria: p.categoria, estado: p.estado_inscripcion, asiento: p.numero_asiento })) });
  },
  {
    name: 'getEventParticipantStats',
    description: 'Participant statistics for an event, optionally filtered by category.',
    schema: z.object({ eventId: z.string(), categoria: z.string().optional() }),
  }
);

// ============================================================
export const getUserVacations = tool(
  async ({ userProfileId }: { userProfileId: string }) => {
    const db = getDb();
    const { profileId } = await resolveUserIds(db, userProfileId);
    const { data, error } = await db.from('vacation_requests').select('id, fecha_inicio, fecha_fin, motivo, estado, aprobado_at, rechazo_motivo, created_at').eq('user_profile_id', profileId).order('fecha_inicio', { ascending: false }).limit(20);
    if (error) return JSON.stringify({ error: error.message });
    if (!data || data.length === 0) return JSON.stringify({ found: false, message: 'No tiene solicitudes de vacaciones registradas' });
    const today = dateStrEC();
    return JSON.stringify({ found: true, currentlyOnVacation: data.some(v => v.estado === 'aprobado' && v.fecha_inicio <= today && v.fecha_fin >= today), upcoming: data.filter(v => v.estado === 'aprobado' && v.fecha_inicio > today), allRequests: data });
  },
  {
    name: 'getUserVacations',
    description: 'Vacation requests for a user: current, upcoming, and history.',
    schema: z.object({ userProfileId: z.string().describe('Profile id from findUser') }),
  }
);

// ============================================================
export const getBlockedDaysInfo = tool(
  async ({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }) => {
    const db = getDb();
    const { data, error } = await db.from('calendar_blocked_days').select('id, fecha, motivo').gte('fecha', dateFrom).lte('fecha', dateTo).order('fecha');
    if (error) return JSON.stringify({ error: error.message });
    return JSON.stringify({ blockedDays: data || [], total: (data || []).length });
  },
  {
    name: 'getBlockedDaysInfo',
    description: 'Company-wide blocked/holiday days in a date range.',
    schema: z.object({ dateFrom: z.string(), dateTo: z.string() }),
  }
);

// ============================================================
export const getOrdersInfo = tool(
  async ({ customerName, dateFrom, dateTo }: { customerName?: string; dateFrom?: string; dateTo?: string }) => {
    const db = getDb();
    let q = db.from('orders').select('id, order_date, status, total, customer:customers(nombre, ciudad)').is('deleted_at', null).order('order_date', { ascending: false }).limit(30);
    if (dateFrom) q = q.gte('order_date', dateFrom);
    if (dateTo) q = q.lte('order_date', dateTo);
    const { data, error } = await q;
    if (error) return JSON.stringify({ error: error.message });
    let results = data || [];
    if (customerName) { const n = normalize(customerName); results = results.filter((o: any) => normalize(o.customer?.nombre || '').includes(n)); }
    return JSON.stringify({ orders: results.slice(0, 20), totals: { count: results.length, totalAmount: results.reduce((s, o) => s + Number(o.total || 0), 0) } });
  },
  {
    name: 'getOrdersInfo',
    description: 'Orders filtered by customer name and/or date range.',
    schema: z.object({ customerName: z.string().optional(), dateFrom: z.string().optional(), dateTo: z.string().optional() }),
  }
);

// ============================================================
export const getCustomerInfo = tool(
  async ({ name }: { name: string }) => {
    const db = getDb();
    const { data } = await db.from('customers').select('id, nombre, tipo, etapa_embudo, telefono, email, direccion, zona, ciudad, etiquetas, forma_pago, calidad_pago, categoria_compra').is('deleted_at', null);
    const needle = normalize(name);
    const matches = (data || []).filter(c => normalize(c.nombre).includes(needle));
    if (matches.length === 0) return JSON.stringify({ found: false, message: `No se encontró cliente "${name}"` });
    return JSON.stringify({ found: true, customers: matches.slice(0, 10) });
  },
  {
    name: 'getCustomerInfo',
    description: 'Search customers by name (accent-insensitive). Returns profile, funnel stage, contact info.',
    schema: z.object({ name: z.string().describe('Customer name') }),
  }
);

// ============================================================
export const getSalesGoalsInfo = tool(
  async ({ year, month, userProfileId }: { year: number; month: number; userProfileId?: string }) => {
    const db = getDb();
    let q = db.from('sales_goals')
      .select('id, anio, mes, meta_valor, brand:brands(nombre), user_profile_id')
      .eq('anio', year)
      .eq('mes', month);
    if (userProfileId) {
      const { profileId } = await resolveUserIds(db, userProfileId);
      q = q.eq('user_profile_id', profileId);
    }
    const { data, error } = await q;
    if (error) return JSON.stringify({ error: error.message });
    if (!data || data.length === 0) {
      const { data: anyGoals } = await db.from('sales_goals').select('anio, mes').limit(5);
      const periods = [...new Set((anyGoals || []).map(g => `${g.anio}-${String(g.mes).padStart(2, '0')}`))].sort().reverse();
      return JSON.stringify({ found: false, message: `No hay metas para ${year}-${String(month).padStart(2, '0')}. Periodos con metas: ${periods.join(', ')}` });
    }
    const goals = data.map((g: any) => ({
      marca: g.brand?.nombre || 'Sin marca',
      meta_valor: g.meta_valor,
      anio: g.anio,
      mes: g.mes,
    }));
    return JSON.stringify({ found: true, goals, total: goals.length, totalMetaValor: goals.reduce((s: number, g: any) => s + Number(g.meta_valor || 0), 0) });
  },
  {
    name: 'getSalesGoalsInfo',
    description: 'Sales goals for a month/year, optionally by user. Shows targets by brand. If the user asks about "meta" without specifying month, try the current month first, then check available periods.',
    schema: z.object({
      year: z.number().describe('Year e.g. 2026'),
      month: z.number().describe('Month 1-12'),
      userProfileId: z.string().optional().describe('Profile id from findUser'),
    }),
  }
);

// ============================================================
export const getVisitReport = tool(
  async ({ userProfileId, dateFrom, dateTo }: { userProfileId?: string; dateFrom: string; dateTo: string }) => {
    const db = getDb();
    const s = `${dateFrom}T00:00:00-05:00`;
    const e = `${dateTo}T23:59:59-05:00`;
    const sel = 'id, scheduled_at, status, objetivo, resultado, observaciones, user_id, customer:customers(nombre, ciudad)';

    let visits: any[] = [];
    if (userProfileId) {
      const { profileId, authId } = await resolveUserIds(db, userProfileId);
      const [r1, r2] = await Promise.all([
        db.from('visits').select(sel).is('deleted_at', null).eq('user_id', profileId).gte('scheduled_at', s).lte('scheduled_at', e).order('scheduled_at'),
        db.from('visits').select(sel).is('deleted_at', null).eq('user_id', authId).gte('scheduled_at', s).lte('scheduled_at', e).order('scheduled_at'),
      ]);
      const seen = new Set<string>();
      visits = [...(r1.data || []), ...(r2.data || [])].filter(v => { if (seen.has(v.id)) return false; seen.add(v.id); return true; });
    } else {
      const { data } = await db.from('visits').select(sel).is('deleted_at', null).gte('scheduled_at', s).lte('scheduled_at', e).order('scheduled_at');
      visits = data || [];
    }

    const byStatus: Record<string, number> = {};
    const withResult: any[] = [];
    const byCity: Record<string, number> = {};
    visits.forEach((v: any) => {
      byStatus[v.status] = (byStatus[v.status] || 0) + 1;
      if (v.resultado) withResult.push({ fecha: v.scheduled_at, cliente: v.customer?.nombre, resultado: v.resultado, observaciones: v.observaciones });
      const city = v.customer?.ciudad || 'Sin ciudad';
      byCity[city] = (byCity[city] || 0) + 1;
    });

    const uniqueCustomers = new Set(visits.map((v: any) => v.customer?.nombre).filter(Boolean));
    return JSON.stringify({
      periodo: { desde: dateFrom, hasta: dateTo },
      totalVisitas: visits.length,
      clientesUnicos: uniqueCustomers.size,
      porEstado: byStatus,
      porCiudad: byCity,
      tasaCompletadas: visits.length > 0 ? `${Math.round((byStatus['completada'] || 0) / visits.length * 100)}%` : '0%',
      visitasConResultado: withResult.length,
      resultados: withResult.slice(0, 30),
      visitasDetalle: visits.slice(0, 50).map((v: any) => ({ fecha: v.scheduled_at, cliente: v.customer?.nombre, ciudad: v.customer?.ciudad, estado: v.status, objetivo: v.objetivo, resultado: v.resultado })),
    });
  },
  {
    name: 'getVisitReport',
    description: 'Visit report for a date range, optionally by salesperson. Returns stats (by status, city), completion rate, results, and visit details. Perfect for "reporte de visitas de X este mes".',
    schema: z.object({
      userProfileId: z.string().optional().describe('Profile id from findUser. Omit for all sellers.'),
      dateFrom: z.string().describe('YYYY-MM-DD'),
      dateTo: z.string().describe('YYYY-MM-DD'),
    }),
  }
);

// ============================================================
export const getCustomerPortfolio = tool(
  async ({ userProfileId }: { userProfileId?: string }) => {
    const db = getDb();
    const { data: users } = await db.from('users_profile').select('id, user_id, nombre_completo, rol').eq('activo', true);
    const userMap: Record<string, string> = {};
    (users || []).forEach(u => { userMap[u.user_id] = u.nombre_completo; userMap[u.id] = u.nombre_completo; });

    let q = db.from('customers').select('id, nombre, user_id, tipo, etapa_embudo, ciudad, zona, calidad_pago, categoria_compra').is('deleted_at', null);
    if (userProfileId) {
      const { authId } = await resolveUserIds(db, userProfileId);
      q = q.eq('user_id', authId);
    }
    const { data, error } = await q;
    if (error) return JSON.stringify({ error: error.message });
    const custs = data || [];

    const byFunnel: Record<string, number> = {};
    const byCity: Record<string, number> = {};
    const bySeller: Record<string, number> = {};
    const byPayQuality: Record<string, number> = {};
    custs.forEach(c => {
      byFunnel[c.etapa_embudo || 'sin etapa'] = (byFunnel[c.etapa_embudo || 'sin etapa'] || 0) + 1;
      byCity[c.ciudad || 'sin ciudad'] = (byCity[c.ciudad || 'sin ciudad'] || 0) + 1;
      const seller = userMap[c.user_id] || 'Sin asignar';
      bySeller[seller] = (bySeller[seller] || 0) + 1;
      byPayQuality[c.calidad_pago || 'sin dato'] = (byPayQuality[c.calidad_pago || 'sin dato'] || 0) + 1;
    });

    return JSON.stringify({
      totalClientes: custs.length,
      porEtapaEmbudo: byFunnel,
      porCiudad: byCity,
      porVendedor: userProfileId ? undefined : bySeller,
      porCalidadPago: byPayQuality,
      clientes: custs.slice(0, 60).map(c => ({ nombre: c.nombre, ciudad: c.ciudad, embudo: c.etapa_embudo, calidad_pago: c.calidad_pago, vendedor: userMap[c.user_id] || 'Sin asignar' })),
    });
  },
  {
    name: 'getCustomerPortfolio',
    description: 'Customer portfolio report. Optionally filtered by seller. Shows counts by funnel stage, city, payment quality. Use for "cuántos clientes tiene Camila", "reporte de cartera".',
    schema: z.object({
      userProfileId: z.string().optional().describe('Profile id from findUser. Omit for all sellers.'),
    }),
  }
);

// ============================================================
export const getEventExpenseReport = tool(
  async ({ eventId }: { eventId: string }) => {
    const db = getDb();
    const { data: ev } = await db.from('events').select('nombre, presupuesto_total').eq('id', eventId).single();
    if (!ev) return JSON.stringify({ found: false, message: 'Evento no encontrado' });

    const { data: users } = await db.from('users_profile').select('id, nombre_completo').eq('activo', true);
    const uMap: Record<string, string> = {};
    (users || []).forEach(u => { uMap[u.id] = u.nombre_completo; });

    const { data, error } = await db.from('event_expenses').select('id, categoria, descripcion, proveedor, monto, fecha, estado, comprobante, num_comprobante, num_factura, created_by, notas').eq('event_id', eventId).order('fecha');
    if (error) return JSON.stringify({ error: error.message });
    const expenses = data || [];

    const byCat: Record<string, { monto: number; count: number }> = {};
    const byStatus: Record<string, { monto: number; count: number }> = {};
    let totalGastos = 0;
    expenses.forEach(e => {
      const cat = e.categoria || 'Sin categoría';
      if (!byCat[cat]) byCat[cat] = { monto: 0, count: 0 };
      byCat[cat].monto += Number(e.monto);
      byCat[cat].count++;
      const st = e.estado || 'sin estado';
      if (!byStatus[st]) byStatus[st] = { monto: 0, count: 0 };
      byStatus[st].monto += Number(e.monto);
      byStatus[st].count++;
      totalGastos += Number(e.monto);
    });

    return JSON.stringify({
      found: true,
      evento: ev.nombre,
      presupuesto: ev.presupuesto_total,
      totalGastos: Math.round(totalGastos * 100) / 100,
      saldo: Math.round(((ev.presupuesto_total || 0) - totalGastos) * 100) / 100,
      porcentajeUsado: ev.presupuesto_total ? `${Math.round(totalGastos / ev.presupuesto_total * 100)}%` : 'N/A',
      totalItems: expenses.length,
      porCategoria: byCat,
      porEstado: byStatus,
      gastos: expenses.map(e => ({
        categoria: e.categoria,
        descripcion: e.descripcion,
        proveedor: e.proveedor,
        monto: e.monto,
        fecha: e.fecha,
        estado: e.estado,
        comprobante: e.comprobante,
        num_factura: e.num_factura,
        registradoPor: uMap[e.created_by] || e.created_by,
      })),
    });
  },
  {
    name: 'getEventExpenseReport',
    description: 'Detailed event expense report: every expense item with category, provider, amount, status, receipt info. Shows budget vs actual spending. Use for "gastos del evento X", "desglose de gastos".',
    schema: z.object({ eventId: z.string().describe('Event UUID from searchEvents') }),
  }
);

// ============================================================
export const getAllSellersReport = tool(
  async ({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }) => {
    const db = getDb();
    const s = `${dateFrom}T00:00:00-05:00`;
    const e = `${dateTo}T23:59:59-05:00`;

    const { data: users } = await db.from('users_profile').select('id, user_id, nombre_completo, rol').eq('activo', true);
    const sellers = (users || []).filter(u => ['vendedor', 'supervisor_vendedor', 'vendedor_tecnico'].includes(u.rol));
    const uMap: Record<string, string> = {};
    (users || []).forEach(u => { uMap[u.id] = u.nombre_completo; uMap[u.user_id] = u.nombre_completo; });

    const { data: allVisits } = await db.from('visits').select('id, user_id, status, resultado').is('deleted_at', null).gte('scheduled_at', s).lte('scheduled_at', e);
    const { data: allCustomers } = await db.from('customers').select('user_id').is('deleted_at', null);
    const { data: allOrders } = await db.from('orders').select('user_id, total').is('deleted_at', null).gte('order_date', dateFrom).lte('order_date', dateTo);

    const report = sellers.map(seller => {
      const authId = seller.user_id;
      const profileId = seller.id;
      const visits = (allVisits || []).filter(v => v.user_id === authId || v.user_id === profileId);
      const custCount = (allCustomers || []).filter(c => c.user_id === authId).length;
      const orders = (allOrders || []).filter((o: any) => o.user_id === authId || o.user_id === profileId);
      const byStatus: Record<string, number> = {};
      visits.forEach(v => { byStatus[v.status] = (byStatus[v.status] || 0) + 1; });

      return {
        vendedor: seller.nombre_completo,
        rol: seller.rol,
        totalClientes: custCount,
        visitas: {
          total: visits.length,
          completadas: byStatus['completada'] || 0,
          noAtendio: byStatus['no_atendio'] || 0,
          programadas: byStatus['programada'] || 0,
          canceladas: byStatus['cancelada'] || 0,
          tasaExito: visits.length > 0 ? `${Math.round((byStatus['completada'] || 0) / visits.length * 100)}%` : '0%',
          conResultado: visits.filter(v => v.resultado).length,
        },
        pedidos: { total: orders.length, montoTotal: orders.reduce((sum, o) => sum + Number(o.total || 0), 0) },
      };
    });

    return JSON.stringify({ periodo: { desde: dateFrom, hasta: dateTo }, vendedores: report });
  },
  {
    name: 'getAllSellersReport',
    description: 'Comparative report of ALL sellers in a period: visits (by status, completion rate), client count, orders. Use for "reporte de todos los vendedores", "comparar vendedores", "desempeño del equipo".',
    schema: z.object({
      dateFrom: z.string().describe('YYYY-MM-DD'),
      dateTo: z.string().describe('YYYY-MM-DD'),
    }),
  }
);

// ============================================================
export const allTools = [
  getCurrentDateTime,
  findUser,
  getUserScheduleToday,
  getUserActivitiesRange,
  searchVisitsByCustomer,
  getVisitReport,
  getCustomerPortfolio,
  searchEvents,
  getEventInfo,
  getEventExpenseReport,
  getEventParticipantStats,
  getUserVacations,
  getBlockedDaysInfo,
  getOrdersInfo,
  getCustomerInfo,
  getSalesGoalsInfo,
  getAllSellersReport,
];

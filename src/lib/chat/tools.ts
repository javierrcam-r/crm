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
    description: 'Returns the current date and time in Ecuador timezone (UTC-5). Use this FIRST whenever the user asks about "today", "now", "this week", etc.',
    schema: z.object({}),
  }
);

export const findUser = tool(
  async ({ name }: { name: string }) => {
    const db = getDb();
    const { data, error } = await db
      .from('users_profile')
      .select('id, user_id, nombre_completo, email, telefono, rol, activo')
      .ilike('nombre_completo', `%${name}%`)
      .limit(5);
    if (error) return JSON.stringify({ error: error.message });
    if (!data || data.length === 0) return JSON.stringify({ found: false, message: `No se encontró usuario con nombre "${name}"` });
    return JSON.stringify({ found: true, users: data });
  },
  {
    name: 'findUser',
    description: 'Search for a user/employee by partial name. Returns profile_id (id), auth_user_id (user_id), full name, role. IMPORTANT: Use "id" for activities/vacations queries and "user_id" for visits queries.',
    schema: z.object({
      name: z.string().describe('Partial or full name of the user to search for'),
    }),
  }
);

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

export const getUserScheduleToday = tool(
  async ({ userProfileId, date }: { userProfileId: string; date: string }) => {
    const db = getDb();
    const { profileId, authId } = await resolveUserIds(db, userProfileId);
    const dayStart = `${date}T00:00:00-05:00`;
    const dayEnd = `${date}T23:59:59-05:00`;

    const visitSelect = 'id, scheduled_at, status, objetivo, resultado, location_text, customer:customers(nombre, direccion, ciudad)';
    const [visitsById, visitsByAuth, activitiesRes] = await Promise.all([
      db.from('visits')
        .select(visitSelect)
        .is('deleted_at', null)
        .eq('user_id', profileId)
        .gte('scheduled_at', dayStart)
        .lte('scheduled_at', dayEnd)
        .order('scheduled_at'),
      db.from('visits')
        .select(visitSelect)
        .is('deleted_at', null)
        .eq('user_id', authId)
        .gte('scheduled_at', dayStart)
        .lte('scheduled_at', dayEnd)
        .order('scheduled_at'),
      db.from('activities')
        .select('id, titulo, tipo, estado, prioridad, fecha_inicio, fecha_fin, ubicacion, es_virtual')
        .gte('fecha_inicio', dayStart)
        .lte('fecha_inicio', dayEnd)
        .order('fecha_inicio'),
    ]);

    const seenVisitIds = new Set<string>();
    const allVisits = [...(visitsById.data || []), ...(visitsByAuth.data || [])].filter(v => {
      if (seenVisitIds.has(v.id)) return false;
      seenVisitIds.add(v.id);
      return true;
    });

    const activities = activitiesRes.data || [];
    const actIds = activities.map(a => a.id);
    const { data: participations } = actIds.length > 0
      ? await db.from('activity_participants').select('activity_id').eq('user_profile_id', profileId).in('activity_id', actIds)
      : { data: [] };

    const participatingIds = new Set((participations || []).map(p => p.activity_id));
    const { data: createdActs } = await db
      .from('activities')
      .select('id, titulo, tipo, estado, prioridad, fecha_inicio, fecha_fin, ubicacion, es_virtual')
      .eq('created_by_user_id', profileId)
      .gte('fecha_inicio', dayStart)
      .lte('fecha_inicio', dayEnd);

    const createdIds = new Set((createdActs || []).map(a => a.id));
    const userActivities = activities.filter(a => participatingIds.has(a.id) || createdIds.has(a.id));

    return JSON.stringify({
      date,
      visits: allVisits,
      activities: userActivities,
      summary: { totalVisits: allVisits.length, totalActivities: userActivities.length },
    });
  },
  {
    name: 'getUserScheduleToday',
    description: 'Get all visits and activities scheduled for a specific user on a specific date. Pass either the profile id or user_id from findUser. Date must be YYYY-MM-DD format.',
    schema: z.object({
      userProfileId: z.string().describe('The user profile ID or user_id (UUID) from findUser'),
      date: z.string().describe('Date in YYYY-MM-DD format'),
    }),
  }
);

export const getUserActivitiesRange = tool(
  async ({ userProfileId, dateFrom, dateTo }: { userProfileId: string; dateFrom: string; dateTo: string }) => {
    const db = getDb();
    const { profileId, authId } = await resolveUserIds(db, userProfileId);
    const startISO = `${dateFrom}T00:00:00-05:00`;
    const endISO = `${dateTo}T23:59:59-05:00`;

    const vSelect = 'id, scheduled_at, status, objetivo, resultado, customer:customers(nombre)';
    const [visitsById, visitsByAuth, allActivities] = await Promise.all([
      db.from('visits')
        .select(vSelect)
        .is('deleted_at', null)
        .eq('user_id', profileId)
        .gte('scheduled_at', startISO)
        .lte('scheduled_at', endISO)
        .order('scheduled_at'),
      db.from('visits')
        .select(vSelect)
        .is('deleted_at', null)
        .eq('user_id', authId)
        .gte('scheduled_at', startISO)
        .lte('scheduled_at', endISO)
        .order('scheduled_at'),
      db.from('activities')
        .select('id, titulo, tipo, estado, fecha_inicio, fecha_fin')
        .gte('fecha_inicio', startISO)
        .lte('fecha_inicio', endISO)
        .order('fecha_inicio'),
    ]);

    const seenIds = new Set<string>();
    const allVisits = [...(visitsById.data || []), ...(visitsByAuth.data || [])].filter(v => {
      if (seenIds.has(v.id)) return false;
      seenIds.add(v.id);
      return true;
    });

    const actIds = (allActivities.data || []).map(a => a.id);
    let userActIds = new Set<string>();
    if (actIds.length > 0) {
      const { data: parts } = await db
        .from('activity_participants')
        .select('activity_id')
        .eq('user_profile_id', profileId)
        .in('activity_id', actIds);
      (parts || []).forEach(p => userActIds.add(p.activity_id));
    }
    const { data: created } = await db
      .from('activities')
      .select('id')
      .eq('created_by_user_id', profileId)
      .gte('fecha_inicio', startISO)
      .lte('fecha_inicio', endISO);
    (created || []).forEach(a => userActIds.add(a.id));

    const userActivities = (allActivities.data || []).filter(a => userActIds.has(a.id));

    return JSON.stringify({
      dateFrom, dateTo,
      visits: allVisits,
      activities: userActivities,
      totals: { visits: allVisits.length, activities: userActivities.length },
    });
  },
  {
    name: 'getUserActivitiesRange',
    description: 'Get all visits and activities for a user within a date range. Useful for "what did X do this week/month" queries.',
    schema: z.object({
      userProfileId: z.string().describe('The user profile ID or user_id (UUID) from findUser'),
      dateFrom: z.string().describe('Start date in YYYY-MM-DD format'),
      dateTo: z.string().describe('End date in YYYY-MM-DD format'),
    }),
  }
);

export const searchEvents = tool(
  async ({ query }: { query: string }) => {
    const db = getDb();
    const { data, error } = await db
      .from('events')
      .select('id, nombre, tipo, modalidad, estado, fecha_inicio, fecha_fin, ubicacion, presupuesto_total, cupo_maximo, cupo_minimo, precio_por_persona')
      .ilike('nombre', `%${query}%`)
      .order('fecha_inicio', { ascending: false })
      .limit(10);
    if (error) return JSON.stringify({ error: error.message });
    if (!data || data.length === 0) return JSON.stringify({ found: false, message: `No se encontraron eventos con "${query}"` });
    return JSON.stringify({ found: true, events: data });
  },
  {
    name: 'searchEvents',
    description: 'Search events by name. Returns basic event info including ID, name, dates, status, budget. Use the event ID to get more details with getEventInfo.',
    schema: z.object({
      query: z.string().describe('Search text for event name'),
    }),
  }
);

export const getEventInfo = tool(
  async ({ eventId }: { eventId: string }) => {
    const db = getDb();
    const { data: ev, error } = await db
      .from('events')
      .select('*')
      .eq('id', eventId)
      .single();
    if (error || !ev) return JSON.stringify({ found: false, message: 'Evento no encontrado' });

    const [expensesRes, participantsRes, activitiesRes] = await Promise.all([
      db.from('event_expenses').select('categoria, monto, estado').eq('event_id', eventId),
      db.from('event_participants').select('id, nombre, categoria, estado_inscripcion, estado_pago, monto_pagado, asistencia, numero_asiento').eq('event_id', eventId),
      db.from('event_activities').select('id, nombre, estado, porcentaje_avance, tipo').eq('event_id', eventId),
    ]);

    const expenses = expensesRes.data || [];
    const participants = participantsRes.data || [];
    const activities = activitiesRes.data || [];

    const totalGastos = expenses.filter(e => e.estado !== 'cancelado').reduce((s, e) => s + Number(e.monto), 0);
    const totalPagado = participants.reduce((s, p) => s + Number(p.monto_pagado), 0);
    const confirmados = participants.filter(p => p.estado_inscripcion === 'confirmado').length;
    const asistieron = participants.filter(p => p.asistencia).length;

    const categoryCounts: Record<string, { total: number; confirmados: number; asistieron: number }> = {};
    participants.forEach(p => {
      const cat = p.categoria || 'Sin categoría';
      if (!categoryCounts[cat]) categoryCounts[cat] = { total: 0, confirmados: 0, asistieron: 0 };
      categoryCounts[cat].total++;
      if (p.estado_inscripcion === 'confirmado') categoryCounts[cat].confirmados++;
      if (p.asistencia) categoryCounts[cat].asistieron++;
    });

    return JSON.stringify({
      found: true,
      event: {
        nombre: ev.nombre, tipo: ev.tipo, modalidad: ev.modalidad, estado: ev.estado,
        fecha_inicio: ev.fecha_inicio, fecha_fin: ev.fecha_fin,
        ubicacion: ev.ubicacion, plataforma: ev.plataforma,
        objetivo: ev.objetivo, marcas: ev.marcas,
      },
      budget: {
        presupuesto_total: ev.presupuesto_total,
        total_gastos: totalGastos,
        gastos_pagados: expenses.filter(e => e.estado === 'pagado').reduce((s, e) => s + Number(e.monto), 0),
        precio_por_persona: ev.precio_por_persona,
        costo_fijo_total: ev.costo_fijo_total,
        costo_variable_por_persona: ev.costo_variable_por_persona,
        ingresos_reales: totalPagado,
        utilidad: totalPagado - totalGastos,
      },
      participants: {
        total: participants.length,
        confirmados,
        asistieron,
        cupo_maximo: ev.cupo_maximo,
        por_categoria: categoryCounts,
      },
      activities: {
        total: activities.length,
        completadas: activities.filter(a => a.estado === 'completada').length,
        en_progreso: activities.filter(a => a.estado === 'en_progreso').length,
      },
    });
  },
  {
    name: 'getEventInfo',
    description: 'Get full event details including budget, expenses, participant counts by category, and activity progress. Requires event ID (use searchEvents first to find it).',
    schema: z.object({
      eventId: z.string().describe('The event UUID'),
    }),
  }
);

export const getEventParticipantStats = tool(
  async ({ eventId, categoria }: { eventId: string; categoria?: string }) => {
    const db = getDb();
    let query = db.from('event_participants')
      .select('id, nombre, categoria, estado_inscripcion, estado_pago, monto_pagado, asistencia, empresa, numero_asiento')
      .eq('event_id', eventId);
    if (categoria) query = query.eq('categoria', categoria);
    const { data, error } = await query;
    if (error) return JSON.stringify({ error: error.message });
    const participants = data || [];

    const stats = {
      total: participants.length,
      por_estado_inscripcion: {} as Record<string, number>,
      por_estado_pago: {} as Record<string, number>,
      por_categoria: {} as Record<string, number>,
      asistencia: participants.filter(p => p.asistencia).length,
      con_asiento: participants.filter(p => p.numero_asiento).length,
      total_recaudado: participants.reduce((s, p) => s + Number(p.monto_pagado), 0),
    };
    participants.forEach(p => {
      stats.por_estado_inscripcion[p.estado_inscripcion] = (stats.por_estado_inscripcion[p.estado_inscripcion] || 0) + 1;
      stats.por_estado_pago[p.estado_pago] = (stats.por_estado_pago[p.estado_pago] || 0) + 1;
      const cat = p.categoria || 'Sin categoría';
      stats.por_categoria[cat] = (stats.por_categoria[cat] || 0) + 1;
    });

    return JSON.stringify({
      eventId,
      filteredBy: categoria || 'all',
      stats,
      participants: participants.slice(0, 50).map(p => ({ nombre: p.nombre, categoria: p.categoria, estado: p.estado_inscripcion, asiento: p.numero_asiento })),
    });
  },
  {
    name: 'getEventParticipantStats',
    description: 'Get participant statistics for an event, optionally filtered by category. Shows counts by inscription status, payment status, attendance, and lists participants.',
    schema: z.object({
      eventId: z.string().describe('The event UUID'),
      categoria: z.string().optional().describe('Optional category name to filter by'),
    }),
  }
);

export const getUserVacations = tool(
  async ({ userProfileId }: { userProfileId: string }) => {
    const db = getDb();
    const { profileId } = await resolveUserIds(db, userProfileId);
    const { data, error } = await db
      .from('vacation_requests')
      .select('id, fecha_inicio, fecha_fin, motivo, estado, aprobado_at, rechazo_motivo, created_at')
      .eq('user_profile_id', profileId)
      .order('fecha_inicio', { ascending: false })
      .limit(20);
    if (error) return JSON.stringify({ error: error.message });
    if (!data || data.length === 0) return JSON.stringify({ found: false, message: 'No se encontraron solicitudes de vacaciones para este usuario' });

    const today = dateStrEC();
    const upcoming = data.filter(v => v.estado === 'aprobado' && v.fecha_inicio >= today);
    const current = data.find(v => v.estado === 'aprobado' && v.fecha_inicio <= today && v.fecha_fin >= today);

    return JSON.stringify({
      found: true,
      currentlyOnVacation: !!current,
      currentVacation: current || null,
      upcoming,
      allRequests: data,
    });
  },
  {
    name: 'getUserVacations',
    description: 'Get vacation requests for a user. Shows if they are currently on vacation, upcoming approved vacations, and all request history.',
    schema: z.object({
      userProfileId: z.string().describe('The user profile ID or user_id (UUID) from findUser'),
    }),
  }
);

export const getBlockedDaysInfo = tool(
  async ({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }) => {
    const db = getDb();
    const { data, error } = await db
      .from('calendar_blocked_days')
      .select('id, fecha, motivo')
      .gte('fecha', dateFrom)
      .lte('fecha', dateTo)
      .order('fecha');
    if (error) return JSON.stringify({ error: error.message });
    return JSON.stringify({ blockedDays: data || [], total: (data || []).length });
  },
  {
    name: 'getBlockedDaysInfo',
    description: 'Get non-working/holiday days within a date range. These are company-wide blocked days.',
    schema: z.object({
      dateFrom: z.string().describe('Start date YYYY-MM-DD'),
      dateTo: z.string().describe('End date YYYY-MM-DD'),
    }),
  }
);

export const getOrdersInfo = tool(
  async ({ customerName, dateFrom, dateTo }: { customerName?: string; dateFrom?: string; dateTo?: string }) => {
    const db = getDb();
    let query = db.from('orders')
      .select('id, order_date, status, total, customer:customers(nombre, ciudad)')
      .is('deleted_at', null)
      .order('order_date', { ascending: false })
      .limit(30);
    if (dateFrom) query = query.gte('order_date', dateFrom);
    if (dateTo) query = query.lte('order_date', dateTo);
    const { data, error } = await query;
    if (error) return JSON.stringify({ error: error.message });

    let results = data || [];
    if (customerName) {
      results = results.filter((o: any) =>
        o.customer?.nombre?.toLowerCase().includes(customerName.toLowerCase())
      );
    }
    const totalAmount = results.reduce((s, o) => s + Number(o.total || 0), 0);
    return JSON.stringify({
      orders: results.slice(0, 20),
      totals: { count: results.length, totalAmount },
    });
  },
  {
    name: 'getOrdersInfo',
    description: 'Get orders, optionally filtered by customer name and date range. Returns order list with totals.',
    schema: z.object({
      customerName: z.string().optional().describe('Customer name to filter by'),
      dateFrom: z.string().optional().describe('Start date YYYY-MM-DD'),
      dateTo: z.string().optional().describe('End date YYYY-MM-DD'),
    }),
  }
);

export const getCustomerInfo = tool(
  async ({ name }: { name: string }) => {
    const db = getDb();
    const { data, error } = await db
      .from('customers')
      .select('id, nombre, tipo, etapa_embudo, telefono, email, direccion, zona, ciudad, etiquetas, forma_pago, calidad_pago, categoria_compra')
      .is('deleted_at', null)
      .ilike('nombre', `%${name}%`)
      .limit(10);
    if (error) return JSON.stringify({ error: error.message });
    if (!data || data.length === 0) return JSON.stringify({ found: false, message: `No se encontró cliente con nombre "${name}"` });
    return JSON.stringify({ found: true, customers: data });
  },
  {
    name: 'getCustomerInfo',
    description: 'Search for customers/clients by name. Returns their profile, funnel stage, contact info, and payment quality.',
    schema: z.object({
      name: z.string().describe('Partial or full customer name'),
    }),
  }
);

export const getSalesGoalsInfo = tool(
  async ({ year, month, userProfileId }: { year: number; month: number; userProfileId?: string }) => {
    const db = getDb();
    let query = db.from('sales_goals')
      .select('id, anio, mes, marca, meta_cantidad, logro_cantidad, meta_monto, logro_monto, user_profile_id')
      .eq('anio', year)
      .eq('mes', month);
    if (userProfileId) query = query.eq('user_profile_id', userProfileId);
    const { data, error } = await query;
    if (error) return JSON.stringify({ error: error.message });
    return JSON.stringify({ goals: data || [], total: (data || []).length });
  },
  {
    name: 'getSalesGoalsInfo',
    description: 'Get sales goals for a specific month and year, optionally filtered by user. Shows targets and achievements by brand.',
    schema: z.object({
      year: z.number().describe('Year (e.g. 2026)'),
      month: z.number().describe('Month 1-12'),
      userProfileId: z.string().optional().describe('Optional user profile ID to filter by'),
    }),
  }
);

export const allTools = [
  getCurrentDateTime,
  findUser,
  getUserScheduleToday,
  getUserActivitiesRange,
  searchEvents,
  getEventInfo,
  getEventParticipantStats,
  getUserVacations,
  getBlockedDaysInfo,
  getOrdersInfo,
  getCustomerInfo,
  getSalesGoalsInfo,
];

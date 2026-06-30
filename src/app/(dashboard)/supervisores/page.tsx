'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Users, TrendingUp, Calendar, UserCheck, Target, Clock,
  CheckCircle, BarChart3, Award, Zap, Filter, CalendarDays, Star,
  ArrowRight, ChevronUp, ChevronDown, MapPin, AlertTriangle, Eye,
} from 'lucide-react';
import Card from '@/components/ui/Card';
import Select from '@/components/ui/Select';
import Badge from '@/components/ui/Badge';
import Input from '@/components/ui/Input';
import { useAuth } from '@/contexts/AuthContext';
import { getSupabaseClient } from '@/lib/supabase/client';
import { getActivities } from '@/lib/services/activities';
import { format, startOfWeek, endOfWeek, isBefore, isAfter } from 'date-fns';
import { es } from 'date-fns/locale';
import type { UserProfile, Activity } from '@/types/database';
import { SALES_VENDOR_ROLES } from '@/lib/auth/roles';

interface VendedorStats {
  id: string;
  user_id: string;
  nombre_completo: string;
  email: string;
  rol: string;
  totalClientes: number;
  clientes: number;
  prospectos: number;
  clientesNuevosPeriodo: number;
  prospectosNuevosPeriodo: number;
  totalVisitas: number;
  visitasCompletadas: number;
  visitasProgramadas: number;
  visitasCanceladas: number;
  visitasNoAtendio: number;
  visitasPeriodo: number;
  visitasCompletadasPeriodo: number;
  tasaCumplimiento: number;
  ranking: number;
  resultadosCategorias: { venta: { si: number; no: number }; cobro: { si: number; no: number }; seguimiento: { si: number; no: number }; prospeccion: { si: number; no: number } };
}

function DonutChart({ value, max, size = 100, strokeWidth = 10, color, bgColor = 'rgba(148,163,184,0.15)', children }: {
  value: number; max: number; size?: number; strokeWidth?: number; color: string; bgColor?: string; children?: React.ReactNode;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = max > 0 ? Math.min(value / max, 1) : 0;
  const offset = circumference * (1 - pct);
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={bgColor} strokeWidth={strokeWidth} />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={strokeWidth}
          strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
          className="transition-all duration-700" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {children}
      </div>
    </div>
  );
}

function parseResultadoCategorias(resultado: string | null): Record<string, boolean> {
  if (!resultado) return {};
  const out: Record<string, boolean> = {};
  const ventaMatch = resultado.match(/Venta:\s*(Sí|No)/i);
  const cobroMatch = resultado.match(/Cobro:\s*(Sí|No)/i);
  const segMatch = resultado.match(/Seguimiento:\s*(Sí|No)/i);
  const prospMatch = resultado.match(/Prospecci[oó]n:\s*(Sí|No)/i);
  if (ventaMatch) out.venta = ventaMatch[1].toLowerCase() === 'sí';
  if (cobroMatch) out.cobro = cobroMatch[1].toLowerCase() === 'sí';
  if (segMatch) out.seguimiento = segMatch[1].toLowerCase() === 'sí';
  if (prospMatch) out.prospeccion = prospMatch[1].toLowerCase() === 'sí';
  return out;
}

type PeriodFilter = 'hoy' | 'semana' | 'mes' | 'custom';

export default function SupervisoresPage() {
  const { userProfile } = useAuth();
  const [vendedores, setVendedores] = useState<VendedorStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVendedor, setSelectedVendedor] = useState<string>('');
  const [weekActivities, setWeekActivities] = useState<Activity[]>([]);
  const [showActivities, setShowActivities] = useState(true);
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('mes');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  const canView = userProfile?.rol === 'admin' || userProfile?.rol === 'supervisor' || userProfile?.rol === 'supervisor_nivel1' || userProfile?.rol === 'supervisor_vendedor';

  const getDateRange = () => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    let startDate = todayStr;
    let endDate = todayStr;

    switch (periodFilter) {
      case 'hoy':
        break;
      case 'semana': {
        const d = new Date(today);
        d.setDate(d.getDate() - 7);
        startDate = d.toISOString().split('T')[0];
        break;
      }
      case 'mes': {
        const d = new Date(today);
        d.setMonth(d.getMonth() - 1);
        startDate = d.toISOString().split('T')[0];
        break;
      }
      case 'custom':
        startDate = customStartDate || todayStr;
        endDate = customEndDate || todayStr;
        break;
    }
    return { startDate, endDate };
  };

  useEffect(() => {
    if (canView) {
      loadVendedoresStats();
      loadWeekActivities();
    }
  }, [canView, periodFilter, customStartDate, customEndDate]);

  const loadWeekActivities = async () => {
    try {
      const activitiesData = await getActivities();
      const now = new Date();
      const wStart = startOfWeek(now, { locale: es });
      const wEnd = endOfWeek(now, { locale: es });

      const filtered = activitiesData.filter(activity => {
        const canSeeAll = userProfile?.rol === 'admin' || userProfile?.rol === 'supervisor_nivel1' || userProfile?.rol === 'supervisor';
        const isMine = activity.created_by_user_id === userProfile?.id || activity.participants?.some(p => p.user_profile_id === userProfile?.id);
        const isStrategic = activity.tipo === 'reunion' || activity.tipo === 'capacitacion' || activity.tipo === 'seguimiento';
        const hasParticipants = Array.isArray(activity.participants) && activity.participants.length > 0;
        if (!isStrategic && !hasParticipants) return false;
        const notDone = activity.estado !== 'realizado';
        const actDate = new Date(activity.fecha_inicio);
        const isThisWeek = !isBefore(actDate, wStart) && !isAfter(actDate, wEnd);
        const isOverdue = isBefore(actDate, now) && activity.estado !== 'realizado';
        return (isMine || canSeeAll) && notDone && (isThisWeek || isOverdue);
      });

      filtered.sort((a, b) => new Date(a.fecha_inicio).getTime() - new Date(b.fecha_inicio).getTime());
      setWeekActivities(filtered);
    } catch (error) {
      console.error('Error cargando actividades:', error);
    }
  };

  const loadVendedoresStats = async () => {
    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { startDate } = getDateRange();

      const { data: users, error: usersError } = await supabase
        .from('users_profile')
        .select('*')
        .in('rol', SALES_VENDOR_ROLES)
        .eq('activo', true)
        .order('nombre_completo');

      if (usersError) throw usersError;

      const statsPromises = (users || []).map(async (user: UserProfile) => {
        const userIds = [user.id, user.user_id].filter(Boolean);

        // Clientes propios (por user_id en customers)
        const { data: ownCustomers } = await supabase
          .from('customers')
          .select('id, tipo, created_at')
          .in('user_id', userIds)
          .is('deleted_at', null);

        // Clientes asignados (por customer_vendor_assignments)
        const { data: assignments } = await supabase
          .from('customer_vendor_assignments')
          .select('customer_id')
          .in('vendor_user_id', userIds);

        const assignedIds = (assignments || []).map(a => a.customer_id);
        let assignedCustomers: any[] = [];
        if (assignedIds.length > 0) {
          const { data } = await supabase
            .from('customers')
            .select('id, tipo, created_at')
            .in('id', assignedIds)
            .is('deleted_at', null);
          assignedCustomers = data || [];
        }

        // Combinar sin duplicados
        const ownIds = new Set((ownCustomers || []).map(c => c.id));
        const allCustomers = [
          ...(ownCustomers || []),
          ...assignedCustomers.filter(c => !ownIds.has(c.id)),
        ];
        const customers = allCustomers;

        const { data: visits } = await supabase
          .from('visits')
          .select('status, scheduled_at, resultado')
          .in('user_id', userIds)
          .is('deleted_at', null);

        const clientes = customers?.filter(c => c.tipo === 'cliente').length || 0;
        const prospectos = customers?.filter(c => c.tipo === 'prospecto').length || 0;
        const clientesNuevosPeriodo = customers?.filter(c => c.tipo === 'cliente' && c.created_at && c.created_at >= startDate).length || 0;
        const prospectosNuevosPeriodo = customers?.filter(c => c.tipo === 'prospecto' && c.created_at && c.created_at >= startDate).length || 0;

        const visitasCompletadas = visits?.filter(v => v.status === 'completada').length || 0;
        const visitasProgramadas = visits?.filter(v => v.status === 'programada').length || 0;
        const visitasCanceladas = visits?.filter(v => v.status === 'cancelada').length || 0;
        const visitasNoAtendio = visits?.filter(v => v.status === 'no_atendio').length || 0;
        const totalVisitas = visits?.length || 0;
        const visitasPeriodo = visits?.filter(v => v.scheduled_at && v.scheduled_at >= startDate).length || 0;
        const visitasCompletadasPeriodo = visits?.filter(v => v.status === 'completada' && v.scheduled_at && v.scheduled_at >= startDate).length || 0;
        const tasaCumplimiento = visitasPeriodo > 0 ? Math.round((visitasCompletadasPeriodo / visitasPeriodo) * 100) : 0;

        const resultadosCategorias = { venta: { si: 0, no: 0 }, cobro: { si: 0, no: 0 }, seguimiento: { si: 0, no: 0 }, prospeccion: { si: 0, no: 0 } };
        const periodVisits = (visits || []).filter(v => v.status === 'completada' && v.scheduled_at && v.scheduled_at >= startDate);
        for (const v of periodVisits) {
          const cats = parseResultadoCategorias(v.resultado);
          if ('venta' in cats) { cats.venta ? resultadosCategorias.venta.si++ : resultadosCategorias.venta.no++; }
          if ('cobro' in cats) { cats.cobro ? resultadosCategorias.cobro.si++ : resultadosCategorias.cobro.no++; }
          if ('seguimiento' in cats) { cats.seguimiento ? resultadosCategorias.seguimiento.si++ : resultadosCategorias.seguimiento.no++; }
          if ('prospeccion' in cats) { cats.prospeccion ? resultadosCategorias.prospeccion.si++ : resultadosCategorias.prospeccion.no++; }
        }

        return {
          id: user.id,
          user_id: user.user_id,
          nombre_completo: user.nombre_completo,
          email: user.email,
          rol: user.rol,
          totalClientes: customers?.length || 0,
          clientes, prospectos, clientesNuevosPeriodo, prospectosNuevosPeriodo,
          totalVisitas, visitasCompletadas, visitasProgramadas, visitasCanceladas, visitasNoAtendio,
          visitasPeriodo, visitasCompletadasPeriodo, tasaCumplimiento,
          ranking: 0,
          resultadosCategorias,
        } as VendedorStats;
      });

      let stats = await Promise.all(statsPromises);
      stats = stats.sort((a, b) => b.visitasCompletadasPeriodo - a.visitasCompletadasPeriodo);
      setVendedores(stats);
    } catch (error) {
      console.error('Error cargando stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!canView) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md text-center p-8">
          <BarChart3 className="h-12 w-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Acceso Denegado</h2>
          <p className="text-gray-600 dark:text-gray-300">Solo supervisores y administradores pueden ver esta página.</p>
        </Card>
      </div>
    );
  }

  const fv = selectedVendedor ? vendedores.filter(v => v.id === selectedVendedor) : vendedores;

  const totals = {
    vendedores: fv.length,
    clientes: fv.reduce((s, v) => s + v.clientes, 0),
    prospectos: fv.reduce((s, v) => s + v.prospectos, 0),
    clientesNuevos: fv.reduce((s, v) => s + v.clientesNuevosPeriodo, 0),
    prospectosNuevos: fv.reduce((s, v) => s + v.prospectosNuevosPeriodo, 0),
    visitasPeriodo: fv.reduce((s, v) => s + v.visitasPeriodo, 0),
    visitasCompletadas: fv.reduce((s, v) => s + v.visitasCompletadasPeriodo, 0),
    visitasProgramadas: fv.reduce((s, v) => s + v.visitasProgramadas, 0),
    totalVisitas: fv.reduce((s, v) => s + v.totalVisitas, 0),
  };

  const tasaGlobal = totals.visitasPeriodo > 0 ? Math.round((totals.visitasCompletadas / totals.visitasPeriodo) * 100) : 0;

  const catTotals = {
    venta: { si: fv.reduce((s, v) => s + v.resultadosCategorias.venta.si, 0), no: fv.reduce((s, v) => s + v.resultadosCategorias.venta.no, 0) },
    cobro: { si: fv.reduce((s, v) => s + v.resultadosCategorias.cobro.si, 0), no: fv.reduce((s, v) => s + v.resultadosCategorias.cobro.no, 0) },
    seguimiento: { si: fv.reduce((s, v) => s + v.resultadosCategorias.seguimiento.si, 0), no: fv.reduce((s, v) => s + v.resultadosCategorias.seguimiento.no, 0) },
    prospeccion: { si: fv.reduce((s, v) => s + v.resultadosCategorias.prospeccion.si, 0), no: fv.reduce((s, v) => s + v.resultadosCategorias.prospeccion.no, 0) },
  };

  const mejorVendedor = selectedVendedor ? fv[0] : (vendedores.length > 0 ? vendedores[0] : null);

  const getPeriodLabel = () => {
    switch (periodFilter) {
      case 'hoy': return 'Hoy';
      case 'semana': return 'Últ. Semana';
      case 'mes': return 'Últ. Mes';
      case 'custom': return 'Personalizado';
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <TrendingUp className="h-6 w-6 sm:h-7 sm:w-7 text-indigo-600 dark:text-indigo-400" />
              Panel de Supervisor
            </h1>
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 mt-1">
              Métricas de visitas, clientes y rendimiento del equipo
            </p>
          </div>
          <Select value={selectedVendedor} onChange={e => setSelectedVendedor(e.target.value)} className="w-full sm:w-56">
            <option value="">📊 Todos los vendedores</option>
            {vendedores.map(v => <option key={v.id} value={v.id}>{v.nombre_completo}</option>)}
          </Select>
        </div>

        {/* Filtros de Período */}
        <Card padding="sm" className="bg-slate-50 dark:bg-dark-700">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-1.5 text-xs sm:text-sm text-gray-600 dark:text-gray-300">
              <Filter className="h-4 w-4" />
              <span className="font-medium">Período:</span>
            </div>
            {(['hoy', 'semana', 'mes', 'custom'] as PeriodFilter[]).map(p => (
              <button
                key={p}
                onClick={() => setPeriodFilter(p)}
                className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                  periodFilter === p ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-dark-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-500'
                }`}
              >
                {p === 'hoy' ? 'Hoy' : p === 'semana' ? 'Semana' : p === 'mes' ? 'Mes' : 'Rango'}
              </button>
            ))}
            {periodFilter === 'custom' && (
              <div className="flex items-center gap-2 w-full sm:w-auto mt-2 sm:mt-0">
                <Input type="date" value={customStartDate} onChange={e => setCustomStartDate(e.target.value)} className="text-xs sm:text-sm" />
                <span className="text-gray-500 dark:text-gray-400 text-xs">a</span>
                <Input type="date" value={customEndDate} onChange={e => setCustomEndDate(e.target.value)} className="text-xs sm:text-sm" />
              </div>
            )}
          </div>
        </Card>

        {/* Objetivos Estratégicos */}
        {weekActivities.length > 0 && (
          <Card className="border-purple-200 dark:border-purple-800 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20">
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => setShowActivities(!showActivities)}>
              <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/40"><Star className="h-5 w-5 text-purple-600 dark:text-purple-400 fill-purple-600 dark:fill-purple-400" /></div>
              <div className="flex-1">
                <h3 className="font-semibold text-purple-900 dark:text-purple-200">Objetivos Estratégicos</h3>
                <p className="text-xs text-purple-600 dark:text-purple-400">Esta semana y pendientes</p>
              </div>
              <Badge variant="purple">{weekActivities.length}</Badge>
              {showActivities ? <ChevronUp className="h-5 w-5 text-purple-600" /> : <ChevronDown className="h-5 w-5 text-purple-600" />}
            </div>
            {showActivities && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 mt-3">
                {weekActivities.slice(0, 6).map(activity => {
                  const actDate = new Date(activity.fecha_inicio);
                  const isOverdue = isBefore(actDate, new Date()) && activity.estado !== 'realizado';
                  return (
                    <Link key={activity.id} href="/actividades" className={`flex flex-col gap-2 p-3 rounded-lg transition-colors ${isOverdue ? 'bg-red-100/70 dark:bg-red-900/30 hover:bg-red-100 border border-red-200 dark:border-red-800' : 'bg-white/70 dark:bg-dark-700 hover:bg-white border border-purple-100 dark:border-purple-800'}`}>
                      <div className="flex items-start gap-2">
                        <div className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${activity.prioridad === 'alta' || activity.prioridad === 'urgente' ? 'bg-red-500' : activity.prioridad === 'media' ? 'bg-amber-500' : 'bg-green-500'}`} />
                        <div className="flex-1 min-w-0">
                          <p className={`font-medium truncate text-sm ${isOverdue ? 'text-red-800 dark:text-red-300' : 'text-gray-900 dark:text-white'}`}>{activity.titulo}</p>
                          <p className={`text-xs ${isOverdue ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'}`}>
                            {isOverdue && '⚠️ '}{format(actDate, "EEE dd MMM 'a las' HH:mm", { locale: es })}
                          </p>
                        </div>
                        <Badge variant={activity.estado === 'planificacion' ? 'blue' : 'yellow'} className="text-[10px] shrink-0">
                          {activity.estado === 'planificacion' ? 'Plan' : 'En prog'}
                        </Badge>
                      </div>
                    </Link>
                  );
                })}
                {weekActivities.length > 6 && (
                  <Link href="/actividades" className="text-sm text-purple-600 dark:text-purple-400 hover:text-purple-800 flex items-center gap-1 col-span-full mt-1">
                    Ver todas ({weekActivities.length}) <ArrowRight className="h-4 w-4" />
                  </Link>
                )}
              </div>
            )}
          </Card>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-300">Cargando métricas...</p>
          </div>
        </div>
      ) : (
        <>
          {/* KPIs con Donuts - Glassmorphism */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {/* Cumplimiento */}
            <div className="relative rounded-2xl border border-white/20 dark:border-slate-700/60 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl overflow-hidden shadow-lg">
              <div className="absolute -top-10 -right-10 w-28 h-28 rounded-full bg-emerald-400/10 blur-2xl" />
              <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent" />
              <div className="relative p-4 flex flex-col items-center">
                <DonutChart value={totals.visitasCompletadas} max={totals.visitasPeriodo} size={90} strokeWidth={9} color="#10b981">
                  <span className="text-xl font-bold text-gray-900 dark:text-white">{tasaGlobal}%</span>
                </DonutChart>
                <p className="text-xs font-semibold text-gray-700 dark:text-gray-200 mt-2">Cumplimiento</p>
                <p className="text-[10px] text-gray-400 dark:text-gray-500">{totals.visitasCompletadas}/{totals.visitasPeriodo} visitas</p>
              </div>
            </div>

            {/* Visitas */}
            <div className="relative rounded-2xl border border-white/20 dark:border-slate-700/60 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl overflow-hidden shadow-lg">
              <div className="absolute -top-10 -right-10 w-28 h-28 rounded-full bg-blue-400/10 blur-2xl" />
              <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-blue-500/30 to-transparent" />
              <div className="relative p-4 flex flex-col items-center">
                <DonutChart value={totals.visitasCompletadas} max={totals.totalVisitas} size={90} strokeWidth={9} color="#3b82f6">
                  <span className="text-xl font-bold text-gray-900 dark:text-white">{totals.visitasPeriodo}</span>
                </DonutChart>
                <p className="text-xs font-semibold text-gray-700 dark:text-gray-200 mt-2">Visitas ({getPeriodLabel()})</p>
                <p className="text-[10px] text-gray-400 dark:text-gray-500">{totals.visitasCompletadas} completadas</p>
              </div>
            </div>

            {/* Clientes */}
            <div className="relative rounded-2xl border border-white/20 dark:border-slate-700/60 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl overflow-hidden shadow-lg">
              <div className="absolute -top-10 -right-10 w-28 h-28 rounded-full bg-purple-400/10 blur-2xl" />
              <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-purple-500/30 to-transparent" />
              <div className="relative p-4 flex flex-col items-center">
                <DonutChart value={totals.clientes} max={totals.clientes + totals.prospectos} size={90} strokeWidth={9} color="#8b5cf6">
                  <span className="text-xl font-bold text-gray-900 dark:text-white">{totals.clientes}</span>
                </DonutChart>
                <p className="text-xs font-semibold text-gray-700 dark:text-gray-200 mt-2">Clientes</p>
                <p className="text-[10px] text-gray-400 dark:text-gray-500">+{totals.clientesNuevos} nuevos</p>
              </div>
            </div>

            {/* Prospectos */}
            <div className="relative rounded-2xl border border-white/20 dark:border-slate-700/60 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl overflow-hidden shadow-lg">
              <div className="absolute -top-10 -right-10 w-28 h-28 rounded-full bg-amber-400/10 blur-2xl" />
              <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-amber-500/30 to-transparent" />
              <div className="relative p-4 flex flex-col items-center">
                <DonutChart value={totals.prospectos} max={totals.clientes + totals.prospectos} size={90} strokeWidth={9} color="#f59e0b">
                  <span className="text-xl font-bold text-gray-900 dark:text-white">{totals.prospectos}</span>
                </DonutChart>
                <p className="text-xs font-semibold text-gray-700 dark:text-gray-200 mt-2">Prospectos</p>
                <p className="text-[10px] text-gray-400 dark:text-gray-500">+{totals.prospectosNuevos} nuevos</p>
              </div>
            </div>
          </div>

          {/* Resultados por Categoría - Glassmorphism */}
          {(catTotals.venta.si + catTotals.venta.no + catTotals.cobro.si + catTotals.cobro.no + catTotals.seguimiento.si + catTotals.seguimiento.no + catTotals.prospeccion.si + catTotals.prospeccion.no) > 0 && (
            <div className="relative rounded-2xl border border-white/20 dark:border-slate-700/60 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl overflow-hidden shadow-lg">
              <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-indigo-500/30 to-transparent" />
              <div className="absolute -top-16 -left-16 w-40 h-40 rounded-full bg-indigo-400/5 blur-3xl" />
              <div className="absolute -bottom-16 -right-16 w-40 h-40 rounded-full bg-purple-400/5 blur-3xl" />
              <div className="relative p-5">
                <div className="flex items-center gap-2 mb-5">
                  <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-500/30">
                    <BarChart3 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Resultados por Categoría</h2>
                  <Badge variant="purple" className="text-[10px]">{getPeriodLabel()}</Badge>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    { key: 'venta', label: 'Venta', icon: '💰', color: '#10b981', data: catTotals.venta },
                    { key: 'cobro', label: 'Cobro', icon: '🧾', color: '#3b82f6', data: catTotals.cobro },
                    { key: 'seguimiento', label: 'Seguimiento', icon: '🔄', color: '#f59e0b', data: catTotals.seguimiento },
                    { key: 'prospeccion', label: 'Prospección', icon: '🔍', color: '#8b5cf6', data: catTotals.prospeccion },
                  ].map(cat => {
                    const total = cat.data.si + cat.data.no;
                    if (total === 0) return null;
                    const pct = Math.round((cat.data.si / total) * 100);
                    return (
                      <div key={cat.key} className="flex flex-col items-center p-3 rounded-xl bg-white/50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-700/40">
                        <DonutChart value={cat.data.si} max={total} size={80} strokeWidth={8} color={cat.color}>
                          <span className="text-lg font-bold text-gray-900 dark:text-white">{pct}%</span>
                        </DonutChart>
                        <div className="mt-2 text-center">
                          <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{cat.icon} {cat.label}</p>
                          <div className="flex items-center justify-center gap-3 mt-1">
                            <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">✓ {cat.data.si} sí</span>
                            <span className="text-[10px] font-medium text-red-500 dark:text-red-400">✗ {cat.data.no} no</span>
                          </div>
                          <p className="text-[9px] text-gray-400 dark:text-gray-500 mt-0.5">{total} visitas con este objetivo</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Mejor vendedor + Resumen */}
          <div className="grid lg:grid-cols-3 gap-3 sm:gap-4">
            {mejorVendedor && (
              <Card className={`bg-gradient-to-br ${selectedVendedor ? 'from-indigo-50 to-blue-50 dark:from-indigo-900/20 dark:to-blue-900/20 border-indigo-200 dark:border-indigo-800' : 'from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20 border-amber-200 dark:border-amber-800'}`} padding="sm">
                <div className="flex items-center gap-3 mb-3">
                  <div className={`p-2 ${selectedVendedor ? 'bg-indigo-100 dark:bg-indigo-900/40' : 'bg-amber-100 dark:bg-amber-900/40'} rounded-full`}>
                    {selectedVendedor ? <UserCheck className="h-6 w-6 text-indigo-600 dark:text-indigo-400" /> : <Award className="h-6 w-6 text-amber-600 dark:text-amber-400" />}
                  </div>
                  <div>
                    <p className={`text-[10px] sm:text-xs ${selectedVendedor ? 'text-indigo-600 dark:text-indigo-400' : 'text-amber-600 dark:text-amber-400'} font-semibold uppercase`}>
                      {selectedVendedor ? '👤 Vendedor Seleccionado' : '🏆 Mejor Vendedor'}
                    </p>
                    <p className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">{mejorVendedor.nombre_completo}</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-white/70 dark:bg-dark-700 rounded-lg p-2 text-center">
                    <p className="text-sm sm:text-base font-bold text-blue-600 dark:text-blue-400">{mejorVendedor.visitasCompletadasPeriodo}</p>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400">Completadas</p>
                  </div>
                  <div className="bg-white/70 dark:bg-dark-700 rounded-lg p-2 text-center">
                    <p className="text-sm sm:text-base font-bold text-emerald-600 dark:text-emerald-400">{mejorVendedor.tasaCumplimiento}%</p>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400">Cumplimiento</p>
                  </div>
                  <div className="bg-white/70 dark:bg-dark-700 rounded-lg p-2 text-center">
                    <p className="text-sm sm:text-base font-bold text-purple-600 dark:text-purple-400">{mejorVendedor.clientes}</p>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400">Clientes</p>
                  </div>
                </div>
              </Card>
            )}

            <Card padding="sm" className="lg:col-span-2">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-3">Resumen de Actividad</p>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 sm:gap-3">
                <div className="text-center p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg">
                  <Users className="h-4 w-4 text-indigo-600 dark:text-indigo-400 mx-auto mb-1" />
                  <p className="text-lg font-bold text-gray-900 dark:text-white">{selectedVendedor ? 1 : vendedores.length}</p>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400">Vendedores</p>
                </div>
                <div className="text-center p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                  <Calendar className="h-4 w-4 text-blue-600 dark:text-blue-400 mx-auto mb-1" />
                  <p className="text-lg font-bold text-gray-900 dark:text-white">{totals.visitasPeriodo}</p>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400">Visitas</p>
                </div>
                <div className="text-center p-2 bg-emerald-50 dark:bg-emerald-900/30 rounded-lg">
                  <CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400 mx-auto mb-1" />
                  <p className="text-lg font-bold text-gray-900 dark:text-white">{totals.visitasCompletadas}</p>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400">Completadas</p>
                </div>
                <div className="text-center p-2 bg-amber-50 dark:bg-amber-900/30 rounded-lg">
                  <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400 mx-auto mb-1" />
                  <p className="text-lg font-bold text-gray-900 dark:text-white">{totals.visitasProgramadas}</p>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400">Programadas</p>
                </div>
                <div className="text-center p-2 bg-green-50 dark:bg-green-900/30 rounded-lg">
                  <UserCheck className="h-4 w-4 text-green-600 dark:text-green-400 mx-auto mb-1" />
                  <p className="text-lg font-bold text-gray-900 dark:text-white">{totals.clientes}</p>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400">Clientes</p>
                </div>
                <div className="text-center p-2 bg-purple-50 dark:bg-purple-900/30 rounded-lg">
                  <Target className="h-4 w-4 text-purple-600 dark:text-purple-400 mx-auto mb-1" />
                  <p className="text-lg font-bold text-gray-900 dark:text-white">{totals.prospectos}</p>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400">Prospectos</p>
                </div>
              </div>
            </Card>
          </div>

          {/* Vendedores - Cards */}
          <div>
            <h2 className="text-sm sm:text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <Users className="h-4 w-4 sm:h-5 sm:w-5 text-indigo-600 dark:text-indigo-400" />
              Vendedores
              <Badge variant="blue" className="text-[10px] sm:text-xs">{fv.length}</Badge>
              <Badge variant="purple" className="text-[10px] sm:text-xs">{getPeriodLabel()}</Badge>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {fv.map(v => {
                const cumplColor = v.tasaCumplimiento >= 70 ? '#10b981' : v.tasaCumplimiento >= 50 ? '#f59e0b' : '#ef4444';
                return (
                  <div key={v.id} className="relative rounded-2xl border border-white/20 dark:border-slate-700/60 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl overflow-hidden shadow-lg hover:shadow-xl transition-shadow">
                    <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-indigo-500/20 to-transparent" />
                    <div className="relative p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center flex-shrink-0">
                          <span className="text-white font-bold text-sm">{v.nombre_completo.charAt(0)}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-900 dark:text-white text-sm truncate">{v.nombre_completo}</p>
                          <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate">{v.email}</p>
                        </div>
                        <DonutChart value={v.visitasCompletadasPeriodo} max={v.visitasPeriodo} size={48} strokeWidth={5} color={cumplColor}>
                          <span className="text-[10px] font-bold text-gray-900 dark:text-white">{v.tasaCumplimiento}%</span>
                        </DonutChart>
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        <div className="text-center p-1.5 bg-white/50 dark:bg-slate-800/50 rounded-lg border border-gray-100 dark:border-slate-700/40">
                          <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300">{v.clientes}</p>
                          <p className="text-[9px] text-gray-500 dark:text-gray-400">Clientes</p>
                        </div>
                        <div className="text-center p-1.5 bg-white/50 dark:bg-slate-800/50 rounded-lg border border-gray-100 dark:border-slate-700/40">
                          <p className="text-sm font-bold text-amber-700 dark:text-amber-300">{v.prospectos}</p>
                          <p className="text-[9px] text-gray-500 dark:text-gray-400">Prospectos</p>
                        </div>
                        <div className="text-center p-1.5 bg-white/50 dark:bg-slate-800/50 rounded-lg border border-gray-100 dark:border-slate-700/40">
                          <p className="text-sm font-bold text-blue-700 dark:text-blue-300">{v.visitasPeriodo}</p>
                          <p className="text-[9px] text-gray-500 dark:text-gray-400">Visitas</p>
                        </div>
                        <div className="text-center p-1.5 bg-white/50 dark:bg-slate-800/50 rounded-lg border border-gray-100 dark:border-slate-700/40">
                          <p className="text-sm font-bold text-blue-700 dark:text-blue-300">{v.visitasCompletadasPeriodo}</p>
                          <p className="text-[9px] text-gray-500 dark:text-gray-400">Complet.</p>
                        </div>
                      </div>
                      {v.visitasPeriodo > 0 && (
                        <div className="mt-2">
                          <div className="flex justify-between text-[10px] text-gray-500 dark:text-gray-400 mb-1">
                            <span>{v.visitasCompletadasPeriodo} completadas de {v.visitasPeriodo}</span>
                          </div>
                          <div className="w-full bg-gray-100 dark:bg-dark-600 rounded-full h-1.5">
                            <div className="h-1.5 rounded-full transition-all" style={{ width: `${Math.min(v.tasaCumplimiento, 100)}%`, backgroundColor: cumplColor }} />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Detalle vendedor seleccionado */}
          {selectedVendedor && fv.length === 1 && (() => {
            const d = fv[0];
            const rc = d.resultadosCategorias;
            const hasResults = (rc.venta.si + rc.venta.no + rc.cobro.si + rc.cobro.no + rc.seguimiento.si + rc.seguimiento.no + rc.prospeccion.si + rc.prospeccion.no) > 0;
            return (
              <div className="relative rounded-2xl border border-white/20 dark:border-slate-700/60 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl overflow-hidden shadow-lg">
                <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-indigo-500/30 to-transparent" />
                <div className="relative p-5">
                  <h3 className="text-sm sm:text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <Eye className="h-4 w-4 text-indigo-500" /> Detalle: {d.nombre_completo}
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
                    <div className="bg-white/50 dark:bg-slate-800/50 rounded-xl p-3 border border-gray-100 dark:border-slate-700/40">
                      <h4 className="text-[10px] sm:text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1"><Users className="h-3 w-3 text-emerald-600" />Clientes</h4>
                      <div className="space-y-1.5 text-xs sm:text-sm">
                        <div className="flex justify-between"><span className="text-gray-600 dark:text-gray-400">Total</span><span className="font-bold dark:text-white">{d.totalClientes}</span></div>
                        <div className="flex justify-between"><span className="text-gray-600 dark:text-gray-400">Clientes</span><Badge variant="green" className="text-[10px]">{d.clientes}</Badge></div>
                        <div className="flex justify-between"><span className="text-gray-600 dark:text-gray-400">Prospectos</span><Badge variant="yellow" className="text-[10px]">{d.prospectos}</Badge></div>
                        <div className="flex justify-between"><span className="text-gray-600 dark:text-gray-400">Nuevos (período)</span><span className="font-medium text-emerald-600">+{d.clientesNuevosPeriodo}</span></div>
                      </div>
                    </div>

                    <div className="bg-white/50 dark:bg-slate-800/50 rounded-xl p-3 border border-gray-100 dark:border-slate-700/40">
                      <h4 className="text-[10px] sm:text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1"><Calendar className="h-3 w-3 text-blue-600" />Visitas (período)</h4>
                      <div className="space-y-1.5 text-xs sm:text-sm">
                        <div className="flex justify-between"><span className="text-gray-600 dark:text-gray-400">Programadas</span><span className="font-bold dark:text-white">{d.visitasPeriodo}</span></div>
                        <div className="flex justify-between"><span className="text-gray-600 dark:text-gray-400">Completadas</span><Badge variant="green" className="text-[10px]">{d.visitasCompletadasPeriodo}</Badge></div>
                        <div className="flex justify-between"><span className="text-gray-600 dark:text-gray-400">Cumplimiento</span><Badge variant={d.tasaCumplimiento >= 70 ? 'green' : 'yellow'} className="text-[10px]">{d.tasaCumplimiento}%</Badge></div>
                      </div>
                    </div>

                    <div className="bg-white/50 dark:bg-slate-800/50 rounded-xl p-3 border border-gray-100 dark:border-slate-700/40">
                      <h4 className="text-[10px] sm:text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1"><BarChart3 className="h-3 w-3 text-indigo-600" />Histórico Total</h4>
                      <div className="space-y-1.5 text-xs sm:text-sm">
                        <div className="flex justify-between"><span className="text-gray-600 dark:text-gray-400">Visitas totales</span><span className="font-bold dark:text-white">{d.totalVisitas}</span></div>
                        <div className="flex justify-between"><span className="text-gray-600 dark:text-gray-400">Completadas</span><span className="font-medium text-emerald-600">{d.visitasCompletadas}</span></div>
                        <div className="flex justify-between"><span className="text-gray-600 dark:text-gray-400">No atendió</span><span className="font-medium text-red-600">{d.visitasNoAtendio}</span></div>
                        <div className="flex justify-between"><span className="text-gray-600 dark:text-gray-400">Canceladas</span><span className="font-medium text-gray-500">{d.visitasCanceladas}</span></div>
                      </div>
                    </div>
                  </div>

                  {hasResults && (
                    <>
                      <h4 className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-3 flex items-center gap-1.5">
                        <BarChart3 className="h-3.5 w-3.5 text-purple-500" /> Resultados por Objetivo ({getPeriodLabel()})
                      </h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {[
                          { key: 'venta', label: 'Venta', icon: '💰', color: '#10b981', data: rc.venta },
                          { key: 'cobro', label: 'Cobro', icon: '🧾', color: '#3b82f6', data: rc.cobro },
                          { key: 'seguimiento', label: 'Seguimiento', icon: '🔄', color: '#f59e0b', data: rc.seguimiento },
                          { key: 'prospeccion', label: 'Prospección', icon: '🔍', color: '#8b5cf6', data: rc.prospeccion },
                        ].map(cat => {
                          const total = cat.data.si + cat.data.no;
                          if (total === 0) return null;
                          const pct = Math.round((cat.data.si / total) * 100);
                          return (
                            <div key={cat.key} className="flex flex-col items-center p-3 rounded-xl bg-white/50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-700/40">
                              <DonutChart value={cat.data.si} max={total} size={60} strokeWidth={6} color={cat.color}>
                                <span className="text-xs font-bold text-gray-900 dark:text-white">{pct}%</span>
                              </DonutChart>
                              <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mt-1.5">{cat.icon} {cat.label}</p>
                              <div className="flex gap-2 mt-0.5">
                                <span className="text-[9px] text-emerald-600">✓{cat.data.si}</span>
                                <span className="text-[9px] text-red-500">✗{cat.data.no}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })()}
        </>
      )}
    </div>
  );
}

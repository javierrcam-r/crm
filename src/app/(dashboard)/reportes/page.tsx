'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import {
  FileDown, CheckCircle2, XCircle, Ban,
  Clock, BarChart3, Search, Target, MessageSquare,
  Eye, Sparkles, Loader2, Calendar, ArrowRight, RefreshCw, X,
  ChevronLeft, ChevronRight, CalendarDays, Zap,
} from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { getCustomers, type Customer } from '@/lib/services/customers';
import { getVisits, type Visit } from '@/lib/services/visits';
import { formatDate, exportToCSV } from '@/lib/utils';
import { searchItems } from '@/lib/search';
import VoiceSearch from '@/components/ui/VoiceSearch';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, startOfYear, endOfYear, subMonths, addMonths, subWeeks, addWeeks, subYears, addYears } from 'date-fns';
import { es } from 'date-fns/locale';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';

const STATUS_CFG: Record<string, { label: string; color: string; colorLight: string; dot: string; glass: string; glassLight: string; icon: any }> = {
  completada:  { label: 'Completadas',  color: 'text-emerald-400', colorLight: 'text-emerald-600', dot: 'bg-emerald-400 dark:bg-emerald-400',  glass: 'from-emerald-500/20 to-emerald-500/5 border-emerald-500/20', glassLight: 'from-emerald-500/10 to-emerald-50 border-emerald-200', icon: CheckCircle2 },
  programada:  { label: 'Programadas',  color: 'text-blue-400',    colorLight: 'text-blue-600',    dot: 'bg-blue-400 dark:bg-blue-400',      glass: 'from-blue-500/20 to-blue-500/5 border-blue-500/20',       glassLight: 'from-blue-500/10 to-blue-50 border-blue-200',       icon: Clock },
  no_atendio:  { label: 'No atendió',   color: 'text-amber-400',   colorLight: 'text-amber-600',   dot: 'bg-amber-400 dark:bg-amber-400',    glass: 'from-amber-500/20 to-amber-500/5 border-amber-500/20',     glassLight: 'from-amber-500/10 to-amber-50 border-amber-200',     icon: Ban },
  cancelada:   { label: 'Canceladas',   color: 'text-red-400',     colorLight: 'text-red-600',     dot: 'bg-red-400 dark:bg-red-400',        glass: 'from-red-500/20 to-red-500/5 border-red-500/20',           glassLight: 'from-red-500/10 to-red-50 border-red-200',           icon: XCircle },
  reprogramada:{ label: 'Reprogramadas',color: 'text-purple-400',  colorLight: 'text-purple-600',  dot: 'bg-purple-400 dark:bg-purple-400',  glass: 'from-purple-500/20 to-purple-500/5 border-purple-500/20',   glassLight: 'from-purple-500/10 to-purple-50 border-purple-200',   icon: RefreshCw },
};

const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

type PeriodMode = 'year' | 'month' | 'week' | 'custom';

function GlassCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`relative rounded-2xl border border-gray-200 dark:border-slate-700/60 bg-white dark:bg-slate-900 overflow-hidden shadow-sm dark:shadow-none ${className}`}>
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-indigo-500/15 dark:via-indigo-500/25 to-transparent" />
      {children}
    </div>
  );
}

function GlassStat({ icon: Icon, label, value, sub, color, glow }: { icon: any; label: string; value: string | number; sub?: string; color: string; glow: string }) {
  return (
    <div className="relative rounded-xl border border-gray-200 dark:border-slate-700/60 bg-white dark:bg-slate-900 p-3 sm:p-4 overflow-hidden group shadow-sm dark:shadow-none">
      <div className={`absolute -top-8 -right-8 w-20 h-20 rounded-full blur-2xl opacity-10 dark:opacity-15 group-hover:opacity-20 dark:group-hover:opacity-30 transition-opacity ${glow}`} />
      <div className="relative flex items-start justify-between">
        <div>
          <p className="text-[10px] sm:text-[11px] font-medium text-gray-400 dark:text-slate-400 uppercase tracking-wider">{label}</p>
          <p className={`text-lg sm:text-2xl font-bold mt-0.5 text-gray-900 dark:${color}`}>{value}</p>
          {sub && <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-0.5">{sub}</p>}
        </div>
        <div className={`p-1.5 sm:p-2 rounded-lg border border-gray-100 dark:border-slate-700/50 bg-gray-50 dark:bg-slate-800/80 ${color}`}>
          <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        </div>
      </div>
    </div>
  );
}

function GlassProgress({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between text-[11px] mb-1.5">
        <span className="text-gray-500 dark:text-slate-400">{label}</span>
        <span className={`font-bold ${color}`}>{pct}%</span>
      </div>
      <div className="h-2 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ${color.replace('text-', 'bg-')}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function ReportesPage() {
  const { userProfile } = useAuth();
  const [loading, setLoading] = useState(true);

  const [periodMode, setPeriodMode] = useState<PeriodMode>('year');
  const [refDate, setRefDate] = useState(new Date());
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const { dateFrom, dateTo, periodLabel } = useMemo(() => {
    if (periodMode === 'custom' && customFrom && customTo) {
      return { dateFrom: customFrom, dateTo: customTo, periodLabel: `${customFrom} — ${customTo}` };
    }
    if (periodMode === 'year') {
      const s = startOfYear(refDate);
      const e = endOfYear(refDate);
      return { dateFrom: format(s, 'yyyy-MM-dd'), dateTo: format(e, 'yyyy-MM-dd'), periodLabel: format(refDate, "yyyy") };
    }
    if (periodMode === 'week') {
      const s = startOfWeek(refDate, { weekStartsOn: 1 });
      const e = endOfWeek(refDate, { weekStartsOn: 1 });
      return { dateFrom: format(s, 'yyyy-MM-dd'), dateTo: format(e, 'yyyy-MM-dd'), periodLabel: `Semana del ${format(s, "d MMM", { locale: es })} al ${format(e, "d MMM", { locale: es })}` };
    }
    const s = startOfMonth(refDate);
    const e = endOfMonth(refDate);
    return { dateFrom: format(s, 'yyyy-MM-dd'), dateTo: format(e, 'yyyy-MM-dd'), periodLabel: format(refDate, "MMMM yyyy", { locale: es }) };
  }, [periodMode, refDate, customFrom, customTo]);

  const navigate = (dir: -1 | 1) => {
    setRefDate(d => {
      if (periodMode === 'year') return dir === -1 ? subYears(d, 1) : addYears(d, 1);
      if (periodMode === 'week') return dir === -1 ? subWeeks(d, 1) : addWeeks(d, 1);
      return dir === -1 ? subMonths(d, 1) : addMonths(d, 1);
    });
  };

  const [visits, setVisits] = useState<Visit[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [clientSearch, setClientSearch] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [selectedVisit, setSelectedVisit] = useState<Visit | null>(null);
  const [aiSummary, setAiSummary] = useState<{ summary: string; recommendation: string } | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const loadVisits = useCallback(async () => {
    try { setVisits(await getVisits({ date_from: dateFrom, date_to: dateTo })); } catch {}
  }, [dateFrom, dateTo]);
  const loadCustomers = useCallback(async () => {
    try { setCustomers(await getCustomers()); } catch {}
  }, []);

  useEffect(() => { Promise.all([loadVisits(), loadCustomers()]).finally(() => setLoading(false)); }, []);
  useEffect(() => { loadVisits(); }, [dateFrom, dateTo, loadVisits]);

  const byStatus = useMemo(() => { const m: Record<string, number> = {}; visits.forEach(v => { m[v.status] = (m[v.status] || 0) + 1; }); return m; }, [visits]);
  const totalVisits = visits.length;
  const withResult = visits.filter(v => v.resultado).length;

  const visitedCustomerIds = useMemo(() => new Set(visits.map(v => v.customer_id)), [visits]);
  const filteredCustomers = useMemo(() => {
    let list = customers.filter(c => visitedCustomerIds.has(c.id));
    if (clientSearch) { list = searchItems(list, clientSearch, [{ key: 'nombre', weight: 2 }, { key: 'ciudad' }]); }
    return list.sort((a, b) => visits.filter(v => v.customer_id === b.id).length - visits.filter(v => v.customer_id === a.id).length);
  }, [customers, visitedCustomerIds, clientSearch, visits]);

  const customerVisits = useMemo(() => {
    if (!selectedCustomerId) return [];
    return visits.filter(v => v.customer_id === selectedCustomerId).sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
  }, [selectedCustomerId, visits]);
  const selectedCustomer = customers.find(c => c.id === selectedCustomerId);

  const loadAiSummary = async (custId: string) => {
    if (!userProfile) return;
    setAiLoading(true); setAiSummary(null);
    try {
      const res = await fetch('/api/visit-summary', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ customerId: custId, userId: userProfile.id }) });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setAiSummary(data);
    } catch { toast.error('Error al generar resumen IA'); } finally { setAiLoading(false); }
  };

  const exportVisits = () => {
    if (visits.length === 0) { toast.error('No hay datos'); return; }
    exportToCSV(visits.map(v => ({ fecha: formatDate(v.scheduled_at), cliente: v.customer?.nombre || '', estado: v.status, objetivo: v.objetivo || '', resultado: v.resultado || '', observaciones: v.observaciones || '', ciudad: v.customer?.ciudad || '' })),
      `visitas_${dateFrom}_${dateTo}`, [{ key: 'fecha', label: 'Fecha' }, { key: 'cliente', label: 'Cliente' }, { key: 'estado', label: 'Estado' }, { key: 'objetivo', label: 'Objetivo' }, { key: 'resultado', label: 'Resultado' }, { key: 'observaciones', label: 'Observaciones' }, { key: 'ciudad', label: 'Ciudad' }]);
    toast.success('Exportado');
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="relative"><div className="w-10 h-10 rounded-xl bg-indigo-500/20 animate-pulse" /><div className="absolute inset-0 rounded-xl border-2 border-indigo-400/30 border-t-indigo-400 animate-spin" /></div>
    </div>
  );

  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3 sm:gap-4">
        <div className="relative">
          <div className="absolute -inset-1 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl opacity-40 blur-md" />
          <div className="relative p-2.5 sm:p-3 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-700 shadow-xl shadow-indigo-500/25">
            <BarChart3 className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
          </div>
        </div>
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white tracking-tight">Reportes</h1>
          <p className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-400">Panel de rendimiento y análisis</p>
        </div>
      </div>

      {/* === PERIOD FILTER BAR === */}
      <div className="relative rounded-2xl border border-gray-200 dark:border-slate-700/60 bg-white dark:bg-slate-900 overflow-hidden shadow-sm dark:shadow-none">
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-indigo-500/15 dark:via-indigo-500/25 to-transparent" />
        <div className="relative p-3 sm:p-4 space-y-3">
          {/* Mode selector */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            {([
              { key: 'year' as PeriodMode, label: 'Año', icon: CalendarDays },
              { key: 'month' as PeriodMode, label: 'Mes', icon: Calendar },
              { key: 'week' as PeriodMode, label: 'Semana', icon: Clock },
              { key: 'custom' as PeriodMode, label: 'Rango', icon: ArrowRight },
            ]).map(m => (
              <button key={m.key} onClick={() => setPeriodMode(m.key)}
                className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${periodMode === m.key
                  ? 'bg-indigo-50 dark:bg-indigo-600/25 text-indigo-600 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/40'
                  : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 border border-transparent hover:border-gray-200 dark:hover:border-slate-700'}`}>
                <m.icon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{m.label}</span>
              </button>
            ))}
          </div>

          {/* Period controls */}
          {periodMode !== 'custom' ? (
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-400 dark:text-slate-400 hover:text-gray-700 dark:hover:text-white transition-all">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm font-semibold text-gray-900 dark:text-white capitalize min-w-[120px] sm:min-w-[140px] text-center">{periodLabel}</span>
              <button onClick={() => navigate(1)} className="p-1.5 rounded-lg border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-400 dark:text-slate-400 hover:text-gray-700 dark:hover:text-white transition-all">
                <ChevronRight className="w-4 h-4" />
              </button>

              {(periodMode === 'month' || periodMode === 'year') && (
                <div className="flex gap-1 ml-1 sm:ml-2 overflow-x-auto pb-1 sm:pb-0">
                  {MONTHS.map((m, i) => {
                    const isActive = periodMode === 'month' && refDate.getMonth() === i && refDate.getFullYear() === currentYear;
                    const isCurrent = currentMonth === i && refDate.getFullYear() === currentYear;
                    return (
                      <button key={m} onClick={() => { setPeriodMode('month'); setRefDate(new Date(refDate.getFullYear(), i, 1)); }}
                        className={`px-1.5 sm:px-2 py-1 rounded-md text-[10px] sm:text-[11px] font-medium transition-all whitespace-nowrap ${isActive
                          ? 'bg-indigo-50 dark:bg-indigo-600/30 text-indigo-600 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/40'
                          : isCurrent
                          ? 'text-gray-700 dark:text-slate-300 border border-gray-300 dark:border-slate-600'
                          : 'text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 border border-transparent hover:border-gray-200 dark:hover:border-slate-700'}`}>
                        {m}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
              <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
                className="px-3 py-1.5 rounded-lg text-xs bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white focus:border-indigo-500 focus:outline-none dark:[color-scheme:dark]" />
              <span className="text-gray-400 dark:text-slate-500 text-xs">a</span>
              <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
                className="px-3 py-1.5 rounded-lg text-xs bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white focus:border-indigo-500 focus:outline-none dark:[color-scheme:dark]" />
            </div>
          )}
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
        <GlassStat icon={BarChart3} label="Total" value={totalVisits} color="text-white" glow="bg-indigo-500" />
        {Object.entries(STATUS_CFG).map(([key, cfg]) => (
          <GlassStat key={key} icon={cfg.icon} label={cfg.label} value={byStatus[key] || 0}
            sub={totalVisits > 0 ? `${Math.round(((byStatus[key] || 0) / totalVisits) * 100)}%` : '0%'}
            color={cfg.color} glow={cfg.dot} />
        ))}
      </div>

      {/* Performance bars */}
      <GlassCard className="p-4 sm:p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Rendimiento</h2>
          <button onClick={exportVisits} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium text-gray-400 dark:text-slate-400 hover:text-gray-700 dark:hover:text-white border border-gray-200 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-800 transition-all">
            <FileDown className="w-3.5 h-3.5" /> CSV
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
          <GlassProgress label="Tasa de completación" value={byStatus['completada'] || 0} max={totalVisits} color="text-emerald-500 dark:text-emerald-400" />
          <GlassProgress label="No atendieron" value={byStatus['no_atendio'] || 0} max={totalVisits} color="text-amber-500 dark:text-amber-400" />
          <GlassProgress label="Con resultado" value={withResult} max={totalVisits} color="text-blue-500 dark:text-blue-400" />
        </div>
      </GlassCard>

      {/* Client section */}
      <GlassCard className="p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Historial por Cliente</h2>
            {selectedCustomer && (
              <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 text-xs border border-indigo-200 dark:border-indigo-500/20">
                {selectedCustomer.nombre}
                <button onClick={() => { setSelectedCustomerId(null); setAiSummary(null); }} className="hover:text-red-500 dark:hover:text-red-400 transition-colors">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-52">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 dark:text-slate-500" />
              <input type="text" value={clientSearch} onChange={e => setClientSearch(e.target.value)} placeholder="Buscar cliente..."
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-500" />
            </div>
            <VoiceSearch onResult={(text) => setClientSearch(text)} />
          </div>
        </div>

        {!selectedCustomerId ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5 sm:gap-2">
            {filteredCustomers.slice(0, 30).map(c => {
              const cv = visits.filter(v => v.customer_id === c.id);
              const comp = cv.filter(v => v.status === 'completada').length;
              return (
                <button key={c.id} onClick={() => { setSelectedCustomerId(c.id); setAiSummary(null); }}
                  className="flex items-center gap-2.5 p-2.5 sm:p-3 rounded-xl border border-gray-100 dark:border-slate-700/50 hover:border-indigo-300 dark:hover:border-indigo-500/40 bg-gray-50/50 dark:bg-slate-800/50 hover:bg-indigo-50/50 dark:hover:bg-slate-800 text-left transition-all group">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 group-hover:border-indigo-300 dark:group-hover:border-indigo-500/40 transition-colors">
                    <span className="text-xs font-bold text-gray-500 dark:text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-300 transition-colors">{cv.length}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs sm:text-sm font-medium text-gray-700 dark:text-slate-200 truncate group-hover:text-gray-900 dark:group-hover:text-white transition-colors">{c.nombre}</p>
                    <p className="text-[10px] text-gray-400 dark:text-slate-500">{c.ciudad || 'Sin ciudad'} · {comp}/{cv.length} completadas</p>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-gray-300 dark:text-slate-700 group-hover:text-indigo-500 dark:group-hover:text-indigo-400 shrink-0 transition-colors" />
                </button>
              );
            })}
            {filteredCustomers.length === 0 && <p className="col-span-full text-center text-xs text-gray-400 dark:text-slate-500 py-8">Sin clientes con visitas en este período</p>}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(STATUS_CFG).map(([key, cfg]) => {
                const count = customerVisits.filter(v => v.status === key).length;
                if (count === 0) return null;
                return <span key={key} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium border bg-gradient-to-r dark:${cfg.glass} ${cfg.glassLight} dark:${cfg.color} ${cfg.colorLight}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} /> {cfg.label}: {count}
                </span>;
              })}
            </div>

            {/* Timeline */}
            <div className="relative">
              <div className="absolute left-[9px] top-3 bottom-3 w-px bg-gradient-to-b from-indigo-400/40 dark:from-indigo-500/40 via-gray-200 dark:via-slate-700 to-transparent" />
              <div className="space-y-0.5">
                {customerVisits.map(v => {
                  const cfg = STATUS_CFG[v.status] || STATUS_CFG['programada'];
                  const d = new Date(v.scheduled_at);
                  return (
                    <button key={v.id} onClick={() => setSelectedVisit(v)}
                      className="relative w-full flex items-start gap-2.5 pl-1 pr-2 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800/70 text-left transition-all group">
                      <div className="relative z-10 w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 group-hover:border-indigo-400 dark:group-hover:border-indigo-400/60 transition-colors">
                        <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[11px] font-semibold text-gray-700 dark:text-slate-200">{format(d, "d MMM yyyy", { locale: es })}</span>
                          <span className="text-[9px] text-gray-400 dark:text-slate-500">{format(d, "HH:mm")}</span>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded border bg-gradient-to-r font-medium dark:${cfg.glass} ${cfg.glassLight} dark:${cfg.color} ${cfg.colorLight}`}>{cfg.label}</span>
                        </div>
                        {v.objetivo && <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-0.5 truncate"><Target className="w-2.5 h-2.5 inline mr-0.5" />{v.objetivo}</p>}
                        {v.resultado && <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5 truncate"><MessageSquare className="w-2.5 h-2.5 inline mr-0.5" />{v.resultado}</p>}
                      </div>
                      <Eye className="w-3.5 h-3.5 text-gray-300 dark:text-slate-700 group-hover:text-indigo-500 dark:group-hover:text-indigo-400 shrink-0 mt-1 transition-colors" />
                    </button>
                  );
                })}
              </div>
              {customerVisits.length === 0 && <p className="text-center text-xs text-gray-400 dark:text-slate-500 py-6 pl-6">Sin visitas en este período</p>}
            </div>

            {/* AI Analysis */}
            <div className="relative rounded-xl overflow-hidden border border-indigo-200 dark:border-indigo-500/30 bg-gradient-to-br from-indigo-50 to-white dark:from-indigo-950/80 dark:to-slate-900">
              <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-indigo-400/30 dark:via-indigo-400/40 to-transparent" />
              <div className="absolute -top-12 -right-12 w-32 h-32 bg-indigo-400/10 dark:bg-indigo-600/10 rounded-full blur-3xl" />
              <div className="relative p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-1 rounded-md bg-indigo-100 dark:bg-indigo-600/30"><Sparkles className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" /></div>
                    <h3 className="text-xs font-semibold text-gray-900 dark:text-white">Análisis IA</h3>
                  </div>
                  <button onClick={() => loadAiSummary(selectedCustomerId!)} disabled={aiLoading}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium border border-indigo-200 dark:border-indigo-500/30 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-600/20 disabled:opacity-50 transition-all">
                    {aiLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                    {aiLoading ? 'Analizando...' : aiSummary ? 'Regenerar' : 'Generar'}
                  </button>
                </div>
                {aiSummary ? (
                  <div className="space-y-2.5">
                    <div><p className="text-[9px] uppercase font-bold text-indigo-500 dark:text-indigo-400 tracking-wider mb-1">Resumen Ejecutivo</p><p className="text-xs text-gray-600 dark:text-slate-300 leading-relaxed">{aiSummary.summary}</p></div>
                    {aiSummary.recommendation && <div><p className="text-[9px] uppercase font-bold text-purple-500 dark:text-purple-400 tracking-wider mb-1">Recomendación</p><p className="text-xs text-gray-600 dark:text-slate-300 leading-relaxed">{aiSummary.recommendation}</p></div>}
                  </div>
                ) : !aiLoading ? <p className="text-[11px] text-gray-400 dark:text-slate-500">Genera un resumen ejecutivo y recomendación con IA.</p> : null}
              </div>
            </div>
          </div>
        )}
      </GlassCard>

      {/* Visit Detail Modal */}
      {selectedVisit && (
        <Modal isOpen onClose={() => setSelectedVisit(null)} title="Detalle de Visita">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br ${STATUS_CFG[selectedVisit.status]?.glassLight || 'from-gray-100 to-gray-50 border-gray-200'} dark:bg-gradient-to-br dark:${STATUS_CFG[selectedVisit.status]?.glass || 'from-gray-500/20 to-gray-500/5 border-gray-500/20'} border`}>
                {(() => { const I = STATUS_CFG[selectedVisit.status]?.icon || Clock; return <I className={`w-5 h-5 ${STATUS_CFG[selectedVisit.status]?.colorLight || 'text-gray-500'} dark:${STATUS_CFG[selectedVisit.status]?.color || 'text-gray-400'}`} />; })()}
              </div>
              <div>
                <p className="font-semibold text-gray-900 dark:text-white">{selectedVisit.customer?.nombre || 'Cliente'}</p>
                <p className="text-sm text-gray-500">{format(new Date(selectedVisit.scheduled_at), "EEEE d 'de' MMMM, yyyy · HH:mm", { locale: es })}</p>
              </div>
            </div>
            {[
              { label: 'Objetivo', value: selectedVisit.objetivo, icon: Target },
              { label: 'Resultado', value: selectedVisit.resultado, icon: CheckCircle2 },
              { label: 'Observaciones', value: selectedVisit.observaciones, icon: MessageSquare },
              { label: 'Siguiente acción', value: selectedVisit.next_action, icon: ArrowRight },
            ].filter(f => f.value).map(f => (
              <div key={f.label} className="p-3 rounded-xl bg-gray-50 dark:bg-dark-600">
                <div className="flex items-center gap-1.5 mb-1"><f.icon className="w-3.5 h-3.5 text-gray-400" /><p className="text-[10px] uppercase font-semibold text-gray-400 tracking-wider">{f.label}</p></div>
                <p className="text-sm text-gray-700 dark:text-gray-300">{f.value}</p>
              </div>
            ))}
            {selectedVisit.next_visit_at && (
              <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20">
                <div className="flex items-center gap-1.5 mb-1"><Calendar className="w-3.5 h-3.5 text-blue-500" /><p className="text-[10px] uppercase font-semibold text-blue-500 tracking-wider">Próxima visita</p></div>
                <p className="text-sm text-blue-700 dark:text-blue-300">{format(new Date(selectedVisit.next_visit_at), "d 'de' MMMM, yyyy · HH:mm", { locale: es })}</p>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}

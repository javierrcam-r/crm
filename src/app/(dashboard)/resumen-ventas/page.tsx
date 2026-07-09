'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getVentasResumen, getVentasResumenPorVendedor, getAniosDisponibles, getNombreComprobante } from '@/lib/services/ventasResumen';
import { getCustomerStatsForVendor, getCustomerStatsAllVendors, type CustomerStatsResult, type VendorCustomerStats } from '@/lib/services/customerStats';
import { getVentasCliente, getVentasClientePorVendedor, buildClienteRanking, buildClienteTimeline, type ClienteRanking } from '@/lib/services/ventasCliente';
import { getSidebarConfig, bulkSetSidebarVisibility, isMenuVisible, ALL_ROLES } from '@/lib/services/sidebarConfig';
import type { VentasClienteConNombre } from '@/types/database';
import type { VentasResumenConVendedor } from '@/types/database';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  ShoppingCart,
  Users,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  ReceiptText,
  UserCheck,
  IdCard,
  Link2,
  Search,
  Eye,
  EyeOff,
  Shield,
  Lock,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Area,
  AreaChart,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import toast from 'react-hot-toast';

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const MESES_FULL = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

const COLORS = [
  '#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#06b6d4', '#f97316', '#ec4899', '#14b8a6', '#84cc16',
];

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
}

function formatCurrencyFull(value: number): string {
  return new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

function formatCurrencyShort(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
}

function StatCard({ icon: Icon, label, value, sub, color, trend }: {
  icon: any; label: string; value: string; sub?: string; color: string; trend?: 'up' | 'down' | null;
}) {
  return (
    <Card className="relative overflow-hidden">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{label}</p>
          <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
          {sub && (
            <p className={`text-xs mt-1 flex items-center gap-1 ${
              trend === 'up' ? 'text-emerald-600 dark:text-emerald-400' :
              trend === 'down' ? 'text-red-500 dark:text-red-400' :
              'text-gray-500 dark:text-gray-400'
            }`}>
              {trend === 'up' && <TrendingUp className="h-3 w-3" />}
              {trend === 'down' && <TrendingDown className="h-3 w-3" />}
              {sub}
            </p>
          )}
        </div>
        <div className={`p-2 rounded-xl ${color}`}>
          <Icon className="h-5 w-5 text-white" />
        </div>
      </div>
    </Card>
  );
}

type ModoIva = 'con_iva' | 'sin_iva';
type ActiveTab = 'ventas' | 'clientes';

export default function ResumenVentasPage() {
  const { userProfile, isUserAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<ActiveTab>('ventas');
  const [data, setData] = useState<VentasResumenConVendedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [anio, setAnio] = useState(new Date().getFullYear());
  const [aniosDisp, setAniosDisp] = useState<number[]>([]);
  const [vendedorFilter, setVendedorFilter] = useState<string>('todos');
  const [mesFilter, setMesFilter] = useState<number>(0);
  const [comprobanteFilter, setComprobanteFilter] = useState<string>('todos');
  const [modoIva, setModoIva] = useState<ModoIva>('con_iva');

  const [clientStats, setClientStats] = useState<CustomerStatsResult | null>(null);
  const [loadingClients, setLoadingClients] = useState(false);
  const [clientSearch, setClientSearch] = useState('');

  const [ventasClienteData, setVentasClienteData] = useState<VentasClienteConNombre[]>([]);
  const [loadingVentasCliente, setLoadingVentasCliente] = useState(false);
  const [selectedCliente, setSelectedCliente] = useState<number | null>(null);

  const [ventasVisible, setVentasVisible] = useState<boolean | null>(null);
  const [togglingVisibility, setTogglingVisibility] = useState(false);

  const esSupervisor = userProfile?.rol === 'admin' || userProfile?.rol === 'supervisor' ||
    userProfile?.rol === 'supervisor_nivel1' || userProfile?.rol === 'supervisor_vendedor';

  useEffect(() => {
    if (!userProfile) return;
    getSidebarConfig().then(config => {
      if (isUserAdmin) {
        const anyHidden = ALL_ROLES.some(r => !isMenuVisible(config, 'resumen_ventas', r.key));
        setVentasVisible(!anyHidden);
      } else {
        const visible = isMenuVisible(config, 'resumen_ventas', userProfile.rol);
        setVentasVisible(visible);
      }
    }).catch(() => setVentasVisible(true));
  }, [userProfile, isUserAdmin]);

  const toggleVisibility = async () => {
    const newVisible = !ventasVisible;
    setTogglingVisibility(true);
    try {
      const items = ALL_ROLES.map(r => ({
        menu_key: 'resumen_ventas',
        menu_label: 'Resumen Ventas',
        rol: r.key,
        visible: newVisible,
      }));
      await bulkSetSidebarVisibility(items);
      setVentasVisible(newVisible);
      toast.success(newVisible ? 'Resumen de Ventas visible para todos' : 'Resumen de Ventas oculto (solo admin)');
    } catch {
      toast.error('Error al cambiar visibilidad');
    } finally {
      setTogglingVisibility(false);
    }
  };

  const getValor = useCallback((row: VentasResumenConVendedor): number => {
    return modoIva === 'con_iva' ? row.total_ventas : (row.total_sin_iva || 0);
  }, [modoIva]);

  const loadData = useCallback(async () => {
    if (!userProfile) return;
    setLoading(true);
    try {
      let result: VentasResumenConVendedor[];
      if (esSupervisor) {
        result = await getVentasResumen(anio);
      } else {
        const codigoVentas = (userProfile as any).codigo_ventas;
        if (!codigoVentas) {
          toast.error('Tu usuario no tiene código de ventas asignado');
          setData([]);
          return;
        }
        result = await getVentasResumenPorVendedor(codigoVentas, anio);
      }
      setData(result);
    } catch {
      toast.error('Error cargando datos de ventas');
    } finally {
      setLoading(false);
    }
  }, [userProfile, anio, esSupervisor]);

  useEffect(() => {
    getAniosDisponibles().then(a => {
      if (a.length > 0) setAniosDisp(a);
    });
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const loadClientStats = useCallback(async () => {
    if (!userProfile) return;
    setLoadingClients(true);
    try {
      let result: CustomerStatsResult;
      if (esSupervisor) {
        result = await getCustomerStatsAllVendors();
      } else {
        result = await getCustomerStatsForVendor(userProfile.id, userProfile.user_id);
      }
      setClientStats(result);
    } catch {
      toast.error('Error cargando estadísticas de clientes');
    } finally {
      setLoadingClients(false);
    }
  }, [userProfile, esSupervisor]);

  const loadVentasCliente = useCallback(async () => {
    if (!userProfile) return;
    setLoadingVentasCliente(true);
    try {
      let result: VentasClienteConNombre[];
      if (esSupervisor) {
        result = await getVentasCliente(anio);
      } else {
        const codigoVentas = (userProfile as any).codigo_ventas;
        if (!codigoVentas) { setVentasClienteData([]); return; }
        result = await getVentasClientePorVendedor(codigoVentas, anio);
      }
      setVentasClienteData(result);
    } catch {
      // table may not exist yet
      setVentasClienteData([]);
    } finally {
      setLoadingVentasCliente(false);
    }
  }, [userProfile, anio, esSupervisor]);

  useEffect(() => {
    if (activeTab === 'clientes') {
      if (!clientStats) loadClientStats();
      loadVentasCliente();
    }
  }, [activeTab, clientStats, loadClientStats, loadVentasCliente]);

  const filteredClients = useMemo(() => {
    if (!clientStats) return [];
    let list = clientStats.customers;
    if (clientSearch.trim()) {
      const q = clientSearch.toLowerCase();
      list = list.filter(c =>
        c.nombre.toLowerCase().includes(q) ||
        c.num_identificacion?.toLowerCase().includes(q) ||
        c.ciudad?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [clientStats, clientSearch]);

  const clienteRanking = useMemo(() => {
    return buildClienteRanking(ventasClienteData);
  }, [ventasClienteData]);

  const filteredClienteRanking = useMemo(() => {
    if (!clientSearch.trim()) return clienteRanking;
    const q = clientSearch.toLowerCase();
    return clienteRanking.filter(c =>
      c.cliente_nombre.toLowerCase().includes(q) ||
      String(c.codigo_cliente).includes(q)
    );
  }, [clienteRanking, clientSearch]);

  const selectedClienteTimeline = useMemo(() => {
    if (selectedCliente === null) return null;
    return buildClienteTimeline(ventasClienteData, selectedCliente);
  }, [ventasClienteData, selectedCliente]);

  const selectedClienteInfo = useMemo(() => {
    if (selectedCliente === null) return null;
    return clienteRanking.find(c => c.codigo_cliente === selectedCliente) || null;
  }, [selectedCliente, clienteRanking]);

  const comprobantesDisponibles = useMemo(() => {
    const codes = [...new Set(data.map(d => d.codcomprobante))].sort();
    return codes.map(c => ({ codigo: c, nombre: getNombreComprobante(c) }));
  }, [data]);

  const filteredData = useMemo(() => {
    let filtered = data;
    if (vendedorFilter !== 'todos' && esSupervisor) {
      filtered = filtered.filter(d => d.vendedor_id === vendedorFilter);
    }
    if (mesFilter > 0) {
      filtered = filtered.filter(d => d.mes === mesFilter);
    }
    if (comprobanteFilter !== 'todos') {
      filtered = filtered.filter(d => d.codcomprobante === Number(comprobanteFilter));
    }
    return filtered;
  }, [data, vendedorFilter, mesFilter, comprobanteFilter, esSupervisor]);

  const vendedores = useMemo(() => {
    const map = new Map<string, string>();
    data.forEach(d => {
      if (d.vendedor_id) map.set(d.vendedor_id, d.vendedor_nombre || '');
    });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [data]);

  const chartData = useMemo(() => {
    const months: { [key: number]: { mes: string; total: number; sinIva: number; ventas: number } } = {};
    for (let m = 1; m <= 12; m++) {
      months[m] = { mes: MESES[m - 1], total: 0, sinIva: 0, ventas: 0 };
    }
    filteredData.forEach(d => {
      if (months[d.mes]) {
        months[d.mes].total += d.total_ventas;
        months[d.mes].sinIva += (d.total_sin_iva || 0);
        months[d.mes].ventas += d.num_ventas;
      }
    });
    return Object.values(months);
  }, [filteredData]);

  const chartDataPorVendedor = useMemo(() => {
    if (!esSupervisor || vendedorFilter !== 'todos') return [];
    const vendedorNames = [...new Set(data.map(d => d.vendedor_nombre || ''))];
    const months: any[] = [];
    for (let m = 1; m <= 12; m++) {
      const row: any = { mes: MESES[m - 1] };
      vendedorNames.forEach(name => { row[name] = 0; });
      const mesData = data.filter(d => d.mes === m && (comprobanteFilter === 'todos' || d.codcomprobante === Number(comprobanteFilter)));
      mesData.forEach(d => {
        const val = getValor(d);
        row[d.vendedor_nombre || ''] = (row[d.vendedor_nombre || ''] || 0) + val;
      });
      months.push(row);
    }
    return { data: months, vendedores: vendedorNames };
  }, [data, esSupervisor, vendedorFilter, comprobanteFilter, getValor]);

  const stats = useMemo(() => {
    const totalConIva = filteredData.reduce((s, d) => s + d.total_ventas, 0);
    const totalSinIva = filteredData.reduce((s, d) => s + (d.total_sin_iva || 0), 0);
    const totalIva = filteredData.reduce((s, d) => s + (d.total_iva || 0), 0);
    const totalTransacciones = filteredData.reduce((s, d) => s + d.num_ventas, 0);

    const totalDisplay = modoIva === 'con_iva' ? totalConIva : totalSinIva;
    const ticketPromedio = totalTransacciones > 0 ? totalDisplay / totalTransacciones : 0;

    const mesActual = new Date().getMonth() + 1;
    const datosMesActual = filteredData.filter(d => d.mes === mesActual);
    const totalMesActualConIva = datosMesActual.reduce((s, d) => s + d.total_ventas, 0);
    const totalMesActualSinIva = datosMesActual.reduce((s, d) => s + (d.total_sin_iva || 0), 0);
    const totalMesActual = modoIva === 'con_iva' ? totalMesActualConIva : totalMesActualSinIva;

    const datosMesAnterior = filteredData.filter(d => d.mes === (mesActual === 1 ? 12 : mesActual - 1));
    const totalMesAnteriorConIva = datosMesAnterior.reduce((s, d) => s + d.total_ventas, 0);
    const totalMesAnteriorSinIva = datosMesAnterior.reduce((s, d) => s + (d.total_sin_iva || 0), 0);
    const totalMesAnterior = modoIva === 'con_iva' ? totalMesAnteriorConIva : totalMesAnteriorSinIva;

    let variacion = 0;
    let variacionTrend: 'up' | 'down' | null = null;
    if (totalMesAnterior > 0) {
      variacion = ((totalMesActual - totalMesAnterior) / totalMesAnterior) * 100;
      variacionTrend = variacion >= 0 ? 'up' : 'down';
    }

    const vendedoresActivos = new Set(filteredData.map(d => d.codigo_vendedor)).size;

    return { totalDisplay, totalConIva, totalSinIva, totalIva, totalTransacciones, ticketPromedio, totalMesActual, variacion, variacionTrend, vendedoresActivos };
  }, [filteredData, modoIva]);

  const rankingVendedores = useMemo(() => {
    if (!esSupervisor) return [];
    const map = new Map<string, { nombre: string; totalConIva: number; totalSinIva: number; ventas: number }>();
    const src = vendedorFilter === 'todos' ? data : filteredData;
    const filteredSrc = comprobanteFilter === 'todos' ? src : src.filter(d => d.codcomprobante === Number(comprobanteFilter));
    const finalSrc = mesFilter > 0 ? filteredSrc.filter(d => d.mes === mesFilter) : filteredSrc;

    finalSrc.forEach(d => {
      const key = d.vendedor_nombre || `#${d.codigo_vendedor}`;
      const prev = map.get(key) || { nombre: key, totalConIva: 0, totalSinIva: 0, ventas: 0 };
      prev.totalConIva += d.total_ventas;
      prev.totalSinIva += (d.total_sin_iva || 0);
      prev.ventas += d.num_ventas;
      map.set(key, prev);
    });
    return Array.from(map.values())
      .map(v => ({ ...v, total: modoIva === 'con_iva' ? v.totalConIva : v.totalSinIva }))
      .sort((a, b) => b.total - a.total);
  }, [data, filteredData, esSupervisor, vendedorFilter, comprobanteFilter, mesFilter, modoIva]);

  const exportCSV = () => {
    if (filteredData.length === 0) { toast.error('No hay datos'); return; }
    const header = 'Año,Mes,Vendedor,Comprobante,Num Ventas,Total con IVA,Subtotal sin IVA,IVA\n';
    const rows = filteredData.map(d =>
      `${d.anio},${MESES_FULL[d.mes - 1]},${d.vendedor_nombre},${getNombreComprobante(d.codcomprobante)},${d.num_ventas},${d.total_ventas.toFixed(2)},${(d.total_sin_iva || 0).toFixed(2)},${(d.total_iva || 0).toFixed(2)}`
    ).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `resumen_ventas_${anio}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV exportado');
  };

  if (!isUserAdmin && ventasVisible === false) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-gray-100 dark:bg-dark-700 rounded-full flex items-center justify-center">
            <Lock className="h-8 w-8 text-gray-400 dark:text-gray-500" />
          </div>
          <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-300">Acceso restringido</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm">
            El módulo de Resumen de Ventas no está habilitado para tu perfil. Contacta al administrador si necesitas acceso.
          </p>
        </div>
      </div>
    );
  }

  if (loading || ventasVisible === null) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400 dark:text-gray-400">Cargando resumen de ventas...</div>
      </div>
    );
  }

  const ivaLabel = modoIva === 'con_iva' ? 'Con IVA' : 'Sin IVA';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Resumen de Ventas</h1>
            {isUserAdmin && (
              <button
                onClick={toggleVisibility}
                disabled={togglingVisibility}
                title={ventasVisible ? 'Visible para todos — clic para ocultar' : 'Solo admin — clic para mostrar a todos'}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                  ventasVisible
                    ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/40'
                    : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/40'
                } disabled:opacity-50`}
              >
                {togglingVisibility ? (
                  <div className="h-3.5 w-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : ventasVisible ? (
                  <Eye className="h-3.5 w-3.5" />
                ) : (
                  <EyeOff className="h-3.5 w-3.5" />
                )}
                {ventasVisible ? 'Visible para todos' : 'Solo admin'}
              </button>
            )}
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {esSupervisor ? 'Vista consolidada de todos los vendedores' : 'Tu resumen personal de ventas'}
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Tab toggle */}
          <div className="flex items-center bg-white dark:bg-dark-700 border border-gray-200 dark:border-dark-500 rounded-xl p-0.5">
            <button
              onClick={() => setActiveTab('ventas')}
              className={`px-4 py-1.5 text-xs font-medium rounded-lg transition-all flex items-center gap-1.5 ${
                activeTab === 'ventas'
                  ? 'bg-indigo-500 text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <DollarSign className="h-3.5 w-3.5" />
              Ventas
            </button>
            <button
              onClick={() => setActiveTab('clientes')}
              className={`px-4 py-1.5 text-xs font-medium rounded-lg transition-all flex items-center gap-1.5 ${
                activeTab === 'clientes'
                  ? 'bg-indigo-500 text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <Users className="h-3.5 w-3.5" />
              Clientes
            </button>
          </div>
          {activeTab === 'ventas' && (
            <>
              {/* Toggle IVA */}
              <div className="flex items-center bg-white dark:bg-dark-700 border border-gray-200 dark:border-dark-500 rounded-xl p-0.5">
                <button
                  onClick={() => setModoIva('con_iva')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                    modoIva === 'con_iva'
                      ? 'bg-indigo-500 text-white shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  Con IVA
                </button>
                <button
                  onClick={() => setModoIva('sin_iva')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                    modoIva === 'sin_iva'
                      ? 'bg-indigo-500 text-white shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  Sin IVA
                </button>
              </div>

              {/* Filtro año */}
              <div className="flex items-center gap-1 bg-white dark:bg-dark-700 border border-gray-200 dark:border-dark-500 rounded-xl px-1 py-1">
                <button
                  onClick={() => setAnio(a => Math.max(a - 1, aniosDisp[0] || 2024))}
                  className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-600 transition-colors"
                >
                  <ChevronLeft className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                </button>
                <span className="px-3 text-sm font-semibold text-gray-900 dark:text-white min-w-[4rem] text-center">
                  {anio}
                </span>
                <button
                  onClick={() => setAnio(a => Math.min(a + 1, new Date().getFullYear()))}
                  className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-600 transition-colors"
                >
                  <ChevronRight className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                </button>
              </div>

              {/* Filtro mes */}
              <select
                value={mesFilter}
                onChange={e => setMesFilter(Number(e.target.value))}
                className="text-sm border border-gray-200 dark:border-dark-500 rounded-xl px-3 py-2 bg-white dark:bg-dark-700 text-gray-900 dark:text-white"
              >
                <option value={0}>Todos los meses</option>
                {MESES_FULL.map((mes, i) => (
                  <option key={i} value={i + 1}>{mes}</option>
                ))}
              </select>

              {/* Filtro tipo de comprobante */}
              {comprobantesDisponibles.length > 1 && (
                <select
                  value={comprobanteFilter}
                  onChange={e => setComprobanteFilter(e.target.value)}
                  className="text-sm border border-gray-200 dark:border-dark-500 rounded-xl px-3 py-2 bg-white dark:bg-dark-700 text-gray-900 dark:text-white"
                >
                  <option value="todos">Todos los comprobantes</option>
                  {comprobantesDisponibles.map(c => (
                    <option key={c.codigo} value={c.codigo}>{c.nombre}</option>
                  ))}
                </select>
              )}

              {/* Filtro vendedor (solo supervisores) */}
              {esSupervisor && vendedores.length > 0 && (
                <select
                  value={vendedorFilter}
                  onChange={e => setVendedorFilter(e.target.value)}
                  className="text-sm border border-gray-200 dark:border-dark-500 rounded-xl px-3 py-2 bg-white dark:bg-dark-700 text-gray-900 dark:text-white"
                >
                  <option value="todos">Todos los vendedores</option>
                  {vendedores.map(([id, nombre]) => (
                    <option key={id} value={id}>{nombre}</option>
                  ))}
                </select>
              )}

              <button
                onClick={exportCSV}
                className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-200 dark:border-dark-500 rounded-xl bg-white dark:bg-dark-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-dark-600 transition-colors"
              >
                <Download className="h-4 w-4" />
                CSV
              </button>
            </>
          )}
          {activeTab === 'clientes' && (
            <div className="flex items-center gap-1 bg-white dark:bg-dark-700 border border-gray-200 dark:border-dark-500 rounded-xl px-1 py-1">
              <button
                onClick={() => setAnio(a => Math.max(a - 1, aniosDisp[0] || 2024))}
                className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-600 transition-colors"
              >
                <ChevronLeft className="h-4 w-4 text-gray-500 dark:text-gray-400" />
              </button>
              <span className="px-3 text-sm font-semibold text-gray-900 dark:text-white min-w-[4rem] text-center">
                {anio}
              </span>
              <button
                onClick={() => setAnio(a => Math.min(a + 1, new Date().getFullYear()))}
                className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-600 transition-colors"
              >
                <ChevronRight className="h-4 w-4 text-gray-500 dark:text-gray-400" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ===== VENTAS TAB ===== */}
      {activeTab === 'ventas' && (<>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          icon={DollarSign}
          label={`Total ${anio} (${ivaLabel})`}
          value={formatCurrency(stats.totalDisplay)}
          color="bg-indigo-500"
        />
        <StatCard
          icon={ReceiptText}
          label="IVA total"
          value={formatCurrency(stats.totalIva)}
          sub={`Base: ${formatCurrency(stats.totalSinIva)}`}
          color="bg-cyan-500"
        />
        <StatCard
          icon={ShoppingCart}
          label="Transacciones"
          value={stats.totalTransacciones.toLocaleString()}
          sub={`Ticket prom. ${formatCurrency(stats.ticketPromedio)}`}
          color="bg-emerald-500"
        />
        <StatCard
          icon={TrendingUp}
          label={`Mes actual (${ivaLabel})`}
          value={formatCurrency(stats.totalMesActual)}
          sub={stats.variacionTrend ? `${stats.variacion >= 0 ? '+' : ''}${stats.variacion.toFixed(1)}% vs mes anterior` : undefined}
          trend={stats.variacionTrend}
          color="bg-amber-500"
        />
        <StatCard
          icon={Users}
          label="Vendedores activos"
          value={stats.vendedoresActivos.toString()}
          color="bg-purple-500"
        />
      </div>

      {/* Gráfico principal: Serie de tiempo mensual */}
      <Card>
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Ventas mensuales {anio}</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">Total facturado por mes ({ivaLabel})</p>
        </div>
        <div className="h-[300px] sm:h-[350px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gradientTotal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradientSinIva" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="mes" tick={{ fontSize: 12 }} className="text-gray-500 dark:text-gray-400" />
              <YAxis tickFormatter={formatCurrencyShort} tick={{ fontSize: 11 }} className="text-gray-500" />
              <Tooltip
                formatter={(value) => [formatCurrency(Number(value ?? 0)), ivaLabel]}
                contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}
              />
              {modoIva === 'con_iva' ? (
                <Area type="monotone" dataKey="total" stroke="#6366f1" strokeWidth={2.5} fill="url(#gradientTotal)" name="total" />
              ) : (
                <Area type="monotone" dataKey="sinIva" stroke="#06b6d4" strokeWidth={2.5} fill="url(#gradientSinIva)" name="sinIva" />
              )}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Gráfico por vendedor (solo supervisores, vista "todos") */}
      {esSupervisor && vendedorFilter === 'todos' && chartDataPorVendedor && 'vendedores' in chartDataPorVendedor && (
        <Card>
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Ventas por vendedor {anio}</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">Comparativa mensual entre vendedores ({ivaLabel})</p>
          </div>
          <div className="h-[350px] sm:h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartDataPorVendedor.data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={formatCurrencyShort} tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(value) => formatCurrency(Number(value ?? 0))}
                  contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {chartDataPorVendedor.vendedores.map((name: string, i: number) => (
                  <Bar key={name} dataKey={name} fill={COLORS[i % COLORS.length]} radius={[4, 4, 0, 0]} stackId="a" />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {/* Número de transacciones */}
      <Card>
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Transacciones mensuales</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">Cantidad de facturas emitidas por mes</p>
        </div>
        <div className="h-[250px] sm:h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(value) => [Number(value ?? 0).toLocaleString(), 'Facturas']}
                contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}
              />
              <Line type="monotone" dataKey="ventas" stroke="#10b981" strokeWidth={2.5} dot={{ r: 4, fill: '#10b981' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Ranking vendedores (solo supervisores) */}
      {esSupervisor && rankingVendedores.length > 0 && (
        <Card>
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Ranking de vendedores {anio}</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">Ordenado por total ({ivaLabel})</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-dark-600">
                  <th className="text-left py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">#</th>
                  <th className="text-left py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">Vendedor</th>
                  <th className="text-right py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">Facturas</th>
                  <th className="text-right py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">Con IVA</th>
                  <th className="text-right py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">Sin IVA</th>
                  <th className="text-right py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">Ticket Prom.</th>
                  <th className="text-left py-3 px-4 text-gray-500 dark:text-gray-400 font-medium w-1/5">% del Total</th>
                </tr>
              </thead>
              <tbody>
                {rankingVendedores.map((v, i) => {
                  const maxTotal = rankingVendedores[0]?.total || 1;
                  const totalGeneral = rankingVendedores.reduce((s, r) => s + r.total, 0);
                  const pct = totalGeneral > 0 ? (v.total / totalGeneral) * 100 : 0;
                  return (
                    <tr key={v.nombre} className="border-b border-gray-100 dark:border-dark-700 hover:bg-gray-50 dark:hover:bg-dark-800 transition-colors">
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                          i === 0 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                          i === 1 ? 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300' :
                          i === 2 ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' :
                          'bg-gray-100 text-gray-500 dark:bg-dark-700 dark:text-gray-400'
                        }`}>
                          {i + 1}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-medium text-gray-900 dark:text-white">{v.nombre}</td>
                      <td className="py-3 px-4 text-right text-gray-600 dark:text-gray-300">{v.ventas.toLocaleString()}</td>
                      <td className="py-3 px-4 text-right font-semibold text-gray-900 dark:text-white">{formatCurrency(v.totalConIva)}</td>
                      <td className="py-3 px-4 text-right text-gray-600 dark:text-gray-300">{formatCurrency(v.totalSinIva)}</td>
                      <td className="py-3 px-4 text-right text-gray-600 dark:text-gray-300">
                        {v.ventas > 0 ? formatCurrency(v.total / v.ventas) : '-'}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-gray-100 dark:bg-dark-700 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-700"
                              style={{
                                width: `${(v.total / maxTotal) * 100}%`,
                                backgroundColor: COLORS[i % COLORS.length],
                              }}
                            />
                          </div>
                          <span className="text-xs text-gray-500 dark:text-gray-400 w-10 text-right">{pct.toFixed(1)}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Tabla detalle mensual */}
      <Card>
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Detalle mensual {anio}</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {filteredData.length} registros
            {mesFilter > 0 && ` · ${MESES_FULL[mesFilter - 1]}`}
            {comprobanteFilter !== 'todos' && ` · ${getNombreComprobante(Number(comprobanteFilter))}`}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-dark-600">
                <th className="text-left py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">Mes</th>
                {esSupervisor && <th className="text-left py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">Vendedor</th>}
                <th className="text-left py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">Comprobante</th>
                <th className="text-right py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">Facturas</th>
                <th className="text-right py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">Total con IVA</th>
                <th className="text-right py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">Subtotal sin IVA</th>
                <th className="text-right py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">IVA</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.map((d) => (
                <tr key={d.id} className="border-b border-gray-100 dark:border-dark-700 hover:bg-gray-50 dark:hover:bg-dark-800 transition-colors">
                  <td className="py-2.5 px-4 text-gray-900 dark:text-white">{MESES_FULL[d.mes - 1]}</td>
                  {esSupervisor && <td className="py-2.5 px-4 text-gray-600 dark:text-gray-300">{d.vendedor_nombre}</td>}
                  <td className="py-2.5 px-4">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                      d.codcomprobante === 1 ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                      d.codcomprobante === 4 ? 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                      'bg-gray-100 text-gray-600 dark:bg-dark-700 dark:text-gray-400'
                    }`}>
                      <FileText className="h-3 w-3" />
                      {getNombreComprobante(d.codcomprobante)}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 text-right text-gray-600 dark:text-gray-300">{d.num_ventas.toLocaleString()}</td>
                  <td className="py-2.5 px-4 text-right font-medium text-gray-900 dark:text-white">{formatCurrencyFull(d.total_ventas)}</td>
                  <td className="py-2.5 px-4 text-right text-gray-600 dark:text-gray-300">{formatCurrencyFull(d.total_sin_iva || 0)}</td>
                  <td className="py-2.5 px-4 text-right text-gray-600 dark:text-gray-300">{formatCurrencyFull(d.total_iva || 0)}</td>
                </tr>
              ))}
              {filteredData.length > 0 && (
                <tr className="bg-gray-50 dark:bg-dark-800 font-semibold">
                  <td className="py-3 px-4 text-gray-900 dark:text-white">Total</td>
                  {esSupervisor && <td className="py-3 px-4"></td>}
                  <td className="py-3 px-4"></td>
                  <td className="py-3 px-4 text-right text-gray-900 dark:text-white">
                    {filteredData.reduce((s, d) => s + d.num_ventas, 0).toLocaleString()}
                  </td>
                  <td className="py-3 px-4 text-right text-gray-900 dark:text-white">
                    {formatCurrencyFull(filteredData.reduce((s, d) => s + d.total_ventas, 0))}
                  </td>
                  <td className="py-3 px-4 text-right text-gray-900 dark:text-white">
                    {formatCurrencyFull(filteredData.reduce((s, d) => s + (d.total_sin_iva || 0), 0))}
                  </td>
                  <td className="py-3 px-4 text-right text-gray-900 dark:text-white">
                    {formatCurrencyFull(filteredData.reduce((s, d) => s + (d.total_iva || 0), 0))}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      </>)}

      {/* ===== CLIENTES TAB ===== */}
      {activeTab === 'clientes' && (
        (loadingClients || loadingVentasCliente) ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-gray-400 dark:text-gray-400">Cargando datos de clientes y ventas...</div>
          </div>
        ) : clientStats && (
          <>
            {/* KPI Cards Clientes */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              <StatCard
                icon={Users}
                label="Total Clientes"
                value={clientStats.global.totalClientes.toLocaleString()}
                sub={`${clientStats.global.clientes} activos`}
                color="bg-indigo-500"
              />
              <StatCard
                icon={UserCheck}
                label="Clientes Activos"
                value={clientStats.global.clientes.toLocaleString()}
                sub={`${clientStats.global.prospectos} prospectos`}
                color="bg-emerald-500"
              />
              <StatCard
                icon={IdCard}
                label="Con Identificación"
                value={clientStats.global.conIdentificacion.toLocaleString()}
                sub={clientStats.global.totalClientes > 0 ? `${((clientStats.global.conIdentificacion / clientStats.global.totalClientes) * 100).toFixed(0)}% del total` : undefined}
                color="bg-cyan-500"
              />
              <StatCard
                icon={Link2}
                label="Vinculados a Ventas"
                value={clientStats.global.conCodigoVentas.toLocaleString()}
                sub={clientStats.global.totalClientes > 0 ? `${((clientStats.global.conCodigoVentas / clientStats.global.totalClientes) * 100).toFixed(0)}% del total` : undefined}
                color="bg-amber-500"
              />
              <StatCard
                icon={ShoppingCart}
                label={`Pedidos ${anio}`}
                value={clienteRanking.reduce((s, c) => s + c.num_ventas, 0).toLocaleString()}
                sub={`${clienteRanking.length} clientes con ventas`}
                color="bg-purple-500"
              />
            </div>

            {/* Charts row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Pie chart: distribución por tipo */}
              <Card>
                <div className="mb-4">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Distribución por Estado</h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Clientes, prospectos y perdidos</p>
                </div>
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'Clientes', value: clientStats.global.clientes },
                          { name: 'Prospectos', value: clientStats.global.prospectos },
                          { name: 'Perdidos', value: clientStats.global.perdidos },
                        ].filter(d => d.value > 0)}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={3}
                        dataKey="value"
                        label={({ name, percent }: any) => `${name || ''} ${((percent || 0) * 100).toFixed(0)}%`}
                      >
                        <Cell fill="#10b981" />
                        <Cell fill="#6366f1" />
                        <Cell fill="#ef4444" />
                      </Pie>
                      <Tooltip
                        formatter={(value) => [Number(value ?? 0).toLocaleString(), 'Clientes']}
                        contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              {/* Pie chart: top 10 clientes por ventas */}
              <Card>
                <div className="mb-4">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Top 10 Clientes por Ventas {anio}</h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Participación en facturación total</p>
                </div>
                <div className="h-[280px]">
                  {clienteRanking.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={clienteRanking.slice(0, 10).map(c => ({ name: c.cliente_nombre.length > 20 ? c.cliente_nombre.slice(0, 20) + '...' : c.cliente_nombre, value: c.total_ventas }))}
                          cx="50%"
                          cy="50%"
                          outerRadius={100}
                          dataKey="value"
                          label={({ percent }: any) => `${((percent || 0) * 100).toFixed(0)}%`}
                        >
                          {clienteRanking.slice(0, 10).map((_, i) => (
                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value) => [formatCurrency(Number(value ?? 0)), 'Ventas']}
                          contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                      Sin datos de ventas por cliente
                    </div>
                  )}
                </div>
              </Card>
            </div>

            {/* Timeline del cliente seleccionado */}
            {selectedCliente !== null && selectedClienteTimeline && selectedClienteInfo && (
              <Card>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                      Ventas de {selectedClienteInfo.cliente_nombre} - {anio}
                    </h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {selectedClienteInfo.num_ventas} pedidos · {formatCurrency(selectedClienteInfo.total_ventas)} total · {selectedClienteInfo.meses_activo} meses activo
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedCliente(null)}
                    className="text-xs text-gray-500 hover:text-gray-900 dark:hover:text-white px-3 py-1.5 rounded-lg border border-gray-200 dark:border-dark-500 hover:bg-gray-50 dark:hover:bg-dark-600 transition-colors"
                  >
                    Cerrar
                  </button>
                </div>
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={selectedClienteTimeline} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
                      <YAxis tickFormatter={formatCurrencyShort} tick={{ fontSize: 11 }} />
                      <Tooltip
                        formatter={(value) => [formatCurrency(Number(value ?? 0)), 'Ventas']}
                        contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}
                      />
                      <Bar dataKey="total" fill="#6366f1" radius={[6, 6, 0, 0]} name="Total" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            )}

            {/* Ranking vendedores por clientes (solo supervisores) */}
            {esSupervisor && clientStats.porVendedor.length > 1 && (
              <Card>
                <div className="mb-4">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Clientes por Vendedor</h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Comparativa de cartera entre vendedores</p>
                </div>
                <div className="h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={clientStats.porVendedor.slice(0, 15)}
                      layout="vertical"
                      margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis type="number" tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="vendedor_nombre" tick={{ fontSize: 11 }} width={140} />
                      <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="clientes" name="Clientes" fill="#10b981" stackId="a" />
                      <Bar dataKey="prospectos" name="Prospectos" fill="#6366f1" stackId="a" />
                      <Bar dataKey="perdidos" name="Perdidos" fill="#ef4444" stackId="a" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            )}

            {/* Ranking de clientes por ventas */}
            <Card>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Ranking de Clientes por Ventas {anio}</h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {filteredClienteRanking.length} clientes con facturación · Haz clic para ver detalle mensual
                  </p>
                </div>
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Buscar cliente..."
                    value={clientSearch}
                    onChange={e => setClientSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 dark:border-dark-500 rounded-xl bg-white dark:bg-dark-700 text-gray-900 dark:text-white placeholder-gray-400"
                  />
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-dark-600">
                      <th className="text-left py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">#</th>
                      <th className="text-left py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">Cliente</th>
                      <th className="text-right py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">Pedidos</th>
                      <th className="text-right py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">Total Ventas</th>
                      <th className="text-right py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">Sin IVA</th>
                      <th className="text-right py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">Meses</th>
                      <th className="text-left py-3 px-4 text-gray-500 dark:text-gray-400 font-medium w-1/6">% del Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredClienteRanking.slice(0, 100).map((c, i) => {
                      const maxTotal = filteredClienteRanking[0]?.total_ventas || 1;
                      const totalGeneral = filteredClienteRanking.reduce((s, r) => s + r.total_ventas, 0);
                      const pct = totalGeneral > 0 ? (c.total_ventas / totalGeneral) * 100 : 0;
                      const isSelected = selectedCliente === c.codigo_cliente;
                      return (
                        <tr
                          key={c.codigo_cliente}
                          onClick={() => setSelectedCliente(isSelected ? null : c.codigo_cliente)}
                          className={`border-b border-gray-100 dark:border-dark-700 cursor-pointer transition-colors ${
                            isSelected ? 'bg-indigo-50 dark:bg-indigo-900/20' : 'hover:bg-gray-50 dark:hover:bg-dark-800'
                          }`}
                        >
                          <td className="py-3 px-4">
                            <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                              i === 0 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                              i === 1 ? 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300' :
                              i === 2 ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' :
                              'bg-gray-100 text-gray-500 dark:bg-dark-700 dark:text-gray-400'
                            }`}>
                              {i + 1}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <p className="font-medium text-gray-900 dark:text-white">{c.cliente_nombre}</p>
                            <p className="text-[10px] text-gray-400 dark:text-gray-500 font-mono">#{c.codigo_cliente}</p>
                          </td>
                          <td className="py-3 px-4 text-right text-gray-600 dark:text-gray-300">{c.num_ventas.toLocaleString()}</td>
                          <td className="py-3 px-4 text-right font-semibold text-gray-900 dark:text-white">{formatCurrency(c.total_ventas)}</td>
                          <td className="py-3 px-4 text-right text-gray-600 dark:text-gray-300">{formatCurrency(c.total_sin_iva)}</td>
                          <td className="py-3 px-4 text-right text-gray-600 dark:text-gray-300">{c.meses_activo}</td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-2 bg-gray-100 dark:bg-dark-700 rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all duration-700"
                                  style={{
                                    width: `${(c.total_ventas / maxTotal) * 100}%`,
                                    backgroundColor: COLORS[i % COLORS.length],
                                  }}
                                />
                              </div>
                              <span className="text-xs text-gray-500 dark:text-gray-400 w-10 text-right">{pct.toFixed(1)}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {filteredClienteRanking.length > 0 && (
                      <tr className="bg-gray-50 dark:bg-dark-800 font-semibold">
                        <td className="py-3 px-4"></td>
                        <td className="py-3 px-4 text-gray-900 dark:text-white">Total</td>
                        <td className="py-3 px-4 text-right text-gray-900 dark:text-white">
                          {filteredClienteRanking.reduce((s, c) => s + c.num_ventas, 0).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-right text-gray-900 dark:text-white">
                          {formatCurrency(filteredClienteRanking.reduce((s, c) => s + c.total_ventas, 0))}
                        </td>
                        <td className="py-3 px-4 text-right text-gray-900 dark:text-white">
                          {formatCurrency(filteredClienteRanking.reduce((s, c) => s + c.total_sin_iva, 0))}
                        </td>
                        <td className="py-3 px-4" colSpan={2}></td>
                      </tr>
                    )}
                  </tbody>
                </table>
                {filteredClienteRanking.length === 0 && ventasClienteData.length === 0 && (
                  <p className="text-center text-sm text-gray-400 dark:text-gray-500 py-8">
                    Sin datos de ventas por cliente. Ejecuta el script de sincronización.
                  </p>
                )}
                {filteredClienteRanking.length > 100 && (
                  <p className="text-center text-xs text-gray-400 dark:text-gray-500 py-3">
                    Mostrando 100 de {filteredClienteRanking.length} resultados.
                  </p>
                )}
              </div>
            </Card>
          </>
        )
      )}
    </div>
  );
}

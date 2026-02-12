'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Users,
  ShoppingCart,
  TrendingUp,
  Calendar,
  DollarSign,
  UserCheck,
  Target,
  Clock,
  CheckCircle,
  BarChart3,
  Package,
  Award,
  Zap,
  Filter,
  CalendarDays,
  Star,
  ArrowRight,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
} from 'recharts';
import Card from '@/components/ui/Card';
import Select from '@/components/ui/Select';
import Badge from '@/components/ui/Badge';
import Input from '@/components/ui/Input';
import { useAuth } from '@/contexts/AuthContext';
import { getSupabaseClient } from '@/lib/supabase/client';
import { formatCurrency } from '@/lib/utils';
import { getActivities } from '@/lib/services/activities';
import { format, startOfWeek, endOfWeek, isBefore, isAfter } from 'date-fns';
import { es } from 'date-fns/locale';
import type { UserProfile, Activity } from '@/types/database';

interface VendedorStats {
  id: string;
  username: string;
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
  visitasPendientes: number;
  visitasCanceladas: number;
  visitasPeriodo: number;
  tasaConversion: number;
  totalPedidos: number;
  pedidosPeriodo: number;
  pedidosEntregados: number;
  pedidosPendientes: number;
  ventasTotalPeriodo: number;
  ticketPromedio: number;
  totalProductos: number;
  ranking: number;
}

interface TopCliente {
  nombre: string;
  totalProductos: number;
  totalPedidos: number;
  totalVentas: number;
}

interface TopProducto {
  nombre: string;
  cantidad: number;
  total: number;
}

type PeriodFilter = 'hoy' | 'semana' | 'mes' | 'custom';

export default function SupervisoresPage() {
  const { userProfile } = useAuth();
  const [vendedores, setVendedores] = useState<VendedorStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVendedor, setSelectedVendedor] = useState<string>('');
  const [topClientes, setTopClientes] = useState<TopCliente[]>([]);
  const [topProductos, setTopProductos] = useState<TopProducto[]>([]);
  const [weekActivities, setWeekActivities] = useState<Activity[]>([]);
  const [showActivities, setShowActivities] = useState(true);
  
  // Filtros de período
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('mes');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');

  const canView = userProfile?.rol === 'admin' || userProfile?.rol === 'supervisor' || userProfile?.rol === 'supervisor_nivel1' || userProfile?.rol === 'supervisor_vendedor';

  // Calcular fechas según el período
  const getDateRange = () => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    let startDate = todayStr;
    let endDate = todayStr;

    switch (periodFilter) {
      case 'hoy':
        startDate = todayStr;
        endDate = todayStr;
        break;
      case 'semana':
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);
        startDate = weekAgo.toISOString().split('T')[0];
        break;
      case 'mes':
        const monthAgo = new Date(today);
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        startDate = monthAgo.toISOString().split('T')[0];
        break;
      case 'custom':
        startDate = customStartDate || todayStr;
        endDate = customEndDate || todayStr;
        break;
    }

    return { startDate, endDate, todayStr };
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
      const weekStart = startOfWeek(now, { locale: es });
      const weekEnd = endOfWeek(now, { locale: es });
      
      const myWeekActivities = activitiesData.filter(activity => {
        // Solo las del usuario o donde participa
        const isMyActivity = activity.created_by_user_id === userProfile?.id ||
                            activity.participants?.some(p => p.user_profile_id === userProfile?.id);
        
        // Si es admin o supervisor_nivel1, ve todas las ESTRATÉGICAS (no las personales de otros)
        const canSeeAll = userProfile?.rol === 'admin' || userProfile?.rol === 'supervisor_nivel1';
        
        // Excluir actividades diarias personales (tarea/otro sin participantes)
        // Estas solo se ven en el calendario, no en el dashboard
        // Las actividades estratégicas son: reunion, capacitacion, seguimiento
        // O cualquier actividad que tenga participantes asignados
        const isStrategicType = activity.tipo === 'reunion' || activity.tipo === 'capacitacion' || activity.tipo === 'seguimiento';
        const hasParticipants = Array.isArray(activity.participants) && activity.participants.length > 0;
        const isDailyPersonal = !isStrategicType && !hasParticipants;
        
        // Las actividades diarias personales NO deben aparecer aquí
        if (isDailyPersonal) return false;
        
        // Actividades que NO estén completadas
        const notCompleted = activity.estado !== 'realizado';
        
        // Actividades de esta semana o vencidas
        const activityDate = new Date(activity.fecha_inicio);
        const isThisWeek = !isBefore(activityDate, weekStart) && !isAfter(activityDate, weekEnd);
        const isOverdue = isBefore(activityDate, now) && activity.estado !== 'realizado';
        
        return (isMyActivity || canSeeAll) && notCompleted && (isThisWeek || isOverdue);
      });
      
      // Ordenar por fecha más cercana primero
      myWeekActivities.sort((a, b) => 
        new Date(a.fecha_inicio).getTime() - new Date(b.fecha_inicio).getTime()
      );
      
      setWeekActivities(myWeekActivities);
    } catch (error) {
      console.error('Error cargando actividades:', error);
    }
  };

  const loadVendedoresStats = async () => {
    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { startDate, endDate, todayStr } = getDateRange();
      
      const { data: users, error: usersError } = await supabase
        .from('users_profile')
        .select('*')
        .eq('rol', 'vendedor')
        .eq('activo', true)
        .order('nombre_completo');

      if (usersError) throw usersError;

      const statsPromises = (users || []).map(async (user: UserProfile) => {
        const userIds = [user.id, user.user_id].filter(Boolean);

        // Clientes
        const { data: customers } = await supabase
          .from('customers')
          .select('tipo, created_at')
          .in('user_id', userIds)
          .is('deleted_at', null);

        // Visitas
        const { data: visits } = await supabase
          .from('visits')
          .select('status, scheduled_at')
          .in('user_id', userIds)
          .is('deleted_at', null);

        // Pedidos con total
        const { data: orders } = await supabase
          .from('orders')
          .select('id, status, total, order_date, customer_id')
          .in('user_id', userIds)
          .is('deleted_at', null);

        // Productos
        const { data: products } = await supabase
          .from('products')
          .select('id')
          .in('user_id', userIds)
          .is('deleted_at', null);

        // Métricas de clientes
        const clientes = customers?.filter(c => c.tipo === 'cliente').length || 0;
        const prospectos = customers?.filter(c => c.tipo === 'prospecto').length || 0;
        const clientesNuevosPeriodo = customers?.filter(c => 
          c.tipo === 'cliente' && c.created_at && c.created_at >= startDate
        ).length || 0;
        const prospectosNuevosPeriodo = customers?.filter(c => 
          c.tipo === 'prospecto' && c.created_at && c.created_at >= startDate
        ).length || 0;

        // Métricas de visitas
        const visitasCompletadas = visits?.filter(v => v.status === 'completada').length || 0;
        const visitasPendientes = visits?.filter(v => v.status === 'programada').length || 0;
        const visitasCanceladas = visits?.filter(v => v.status === 'cancelada').length || 0;
        const visitasPeriodo = visits?.filter(v => 
          v.scheduled_at && v.scheduled_at >= startDate
        ).length || 0;

        const totalVisitas = visits?.length || 0;
        const tasaConversion = totalVisitas > 0 
          ? Math.round((visitasCompletadas / totalVisitas) * 100) 
          : 0;

        // Métricas de pedidos
        const pedidosPeriodo = orders?.filter(o => o.order_date >= startDate).length || 0;
        const pedidosEntregados = orders?.filter(o => o.status === 'entregado').length || 0;
        const pedidosPendientes = orders?.filter(o => 
          o.status !== 'entregado' && o.status !== 'cancelado'
        ).length || 0;

        // Ventas del período
        const ventasTotalPeriodo = orders
          ?.filter(o => o.order_date >= startDate)
          .reduce((sum, o) => sum + (o.total || 0), 0) || 0;

        const ticketPromedio = pedidosPeriodo > 0 
          ? Math.round(ventasTotalPeriodo / pedidosPeriodo) 
          : 0;

        return {
          id: user.id,
          username: user.username || user.email?.split('@')[0] || '',
          nombre_completo: user.nombre_completo,
          email: user.email,
          rol: user.rol,
          totalClientes: customers?.length || 0,
          clientes,
          prospectos,
          clientesNuevosPeriodo,
          prospectosNuevosPeriodo,
          totalVisitas,
          visitasCompletadas,
          visitasPendientes,
          visitasCanceladas,
          visitasPeriodo,
          tasaConversion,
          totalPedidos: orders?.length || 0,
          pedidosPeriodo,
          pedidosEntregados,
          pedidosPendientes,
          ventasTotalPeriodo,
          ticketPromedio,
          totalProductos: products?.length || 0,
          ranking: 0,
        } as VendedorStats;
      });

      let stats = await Promise.all(statsPromises);
      
      stats = stats.sort((a, b) => b.ventasTotalPeriodo - a.ventasTotalPeriodo);
      stats = stats.map((s, i) => ({ ...s, ranking: i + 1 }));

      setVendedores(stats);

      await loadTopData(supabase, startDate);

    } catch (error) {
      console.error('Error cargando stats de vendedores:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTopData = async (supabase: ReturnType<typeof getSupabaseClient>, startDate: string, userId?: string) => {
    try {
      // Obtener el user_id real del vendedor seleccionado
      let userIds: string[] = [];
      if (userId) {
        const selectedVendedorData = vendedores.find(v => v.id === userId);
        if (selectedVendedorData) {
          userIds = [selectedVendedorData.id];
        }
      }

      // Construir query de orders
      let ordersQuery = supabase
        .from('orders')
        .select(`
          id,
          total,
          order_date,
          user_id,
          customer:customers(nombre)
        `)
        .gte('order_date', startDate)
        .is('deleted_at', null);

      // Si hay un vendedor seleccionado, filtrar por su user_id
      if (userIds.length > 0) {
        ordersQuery = ordersQuery.in('user_id', userIds);
      }

      const { data: ordersData, error: ordersError } = await ordersQuery;

      if (ordersError) {
        console.error('Error obteniendo orders:', ordersError);
      }

      // Obtener order_items de los pedidos filtrados
      const orderIdsFromOrders = (ordersData || []).map((o: any) => o.id);
      
      let itemsData: any[] = [];
      if (orderIdsFromOrders.length > 0) {
        const { data, error: itemsError } = await supabase
          .from('order_items')
          .select(`
            qty,
            line_total,
            order_id,
            product:products(nombre)
          `)
          .in('order_id', orderIdsFromOrders);

        if (itemsError) {
          console.error('Error obteniendo order_items:', itemsError);
        }
        itemsData = data || [];
      }

      // Crear mapa de orders del período
      const orderIds = new Set((ordersData || []).map((o: any) => o.id));
      const orderCustomerMap = new Map<string, string>();
      (ordersData || []).forEach((o: any) => {
        orderCustomerMap.set(o.id, o.customer?.nombre || 'Sin nombre');
      });

      // Filtrar items por orders del período
      const filteredItems = itemsData.filter((item: any) => orderIds.has(item.order_id));

      // Top clientes por cantidad de productos pedidos
      const clienteMap = new Map<string, { nombre: string; totalProductos: number; totalPedidos: Set<string>; totalVentas: number }>();
      
      filteredItems.forEach((item: any) => {
        const nombre = orderCustomerMap.get(item.order_id) || 'Sin nombre';
        const current = clienteMap.get(nombre) || { 
          nombre, 
          totalProductos: 0, 
          totalPedidos: new Set<string>(), 
          totalVentas: 0 
        };
        current.totalProductos += item.qty || 0;
        current.totalPedidos.add(item.order_id);
        current.totalVentas += item.line_total || 0;
        clienteMap.set(nombre, current);
      });

      const topC = Array.from(clienteMap.values())
        .map(c => ({ ...c, totalPedidos: c.totalPedidos.size }))
        .sort((a, b) => b.totalProductos - a.totalProductos)
        .slice(0, 5);
      setTopClientes(topC);

      // Top productos vendidos
      const productoMap = new Map<string, { nombre: string; cantidad: number; total: number }>();
      filteredItems.forEach((item: any) => {
        const nombre = item.product?.nombre || 'Sin nombre';
        if (nombre === 'Sin nombre') return;
        const current = productoMap.get(nombre) || { nombre, cantidad: 0, total: 0 };
        current.cantidad += item.qty || 0;
        current.total += item.line_total || 0;
        productoMap.set(nombre, current);
      });
      
      const topP = Array.from(productoMap.values())
        .sort((a, b) => b.cantidad - a.cantidad)
        .slice(0, 5);
      setTopProductos(topP);

    } catch (error) {
      console.error('Error cargando top data:', error);
    }
  };

  // Recargar top data cuando cambie el vendedor seleccionado
  useEffect(() => {
    if (canView && vendedores.length > 0) {
      const supabase = getSupabaseClient();
      const { startDate } = getDateRange();
      loadTopData(supabase, startDate, selectedVendedor || undefined);
    }
  }, [selectedVendedor, vendedores]);

  if (!canView) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md text-center p-8">
          <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Acceso Denegado
          </h2>
          <p className="text-gray-600">
            Solo supervisores y administradores pueden ver esta página.
          </p>
        </Card>
      </div>
    );
  }

  const filteredVendedores = selectedVendedor
    ? vendedores.filter(v => v.id === selectedVendedor)
    : vendedores;

  // Calcular totales basados en los vendedores filtrados
  const totals = {
    vendedores: filteredVendedores.length,
    clientes: filteredVendedores.reduce((sum, v) => sum + v.clientes, 0),
    prospectos: filteredVendedores.reduce((sum, v) => sum + v.prospectos, 0),
    clientesNuevosPeriodo: filteredVendedores.reduce((sum, v) => sum + v.clientesNuevosPeriodo, 0),
    prospectosNuevosPeriodo: filteredVendedores.reduce((sum, v) => sum + v.prospectosNuevosPeriodo, 0),
    pedidosPeriodo: filteredVendedores.reduce((sum, v) => sum + v.pedidosPeriodo, 0),
    ventasPeriodo: filteredVendedores.reduce((sum, v) => sum + v.ventasTotalPeriodo, 0),
    visitasPeriodo: filteredVendedores.reduce((sum, v) => sum + v.visitasPeriodo, 0),
    visitasCompletadas: filteredVendedores.reduce((sum, v) => sum + v.visitasCompletadas, 0),
    visitasPendientes: filteredVendedores.reduce((sum, v) => sum + v.visitasPendientes, 0),
  };

  // Mejor vendedor: si hay uno seleccionado, mostrarlo; si no, el primero del ranking
  const mejorVendedor = selectedVendedor 
    ? filteredVendedores[0] 
    : (vendedores.length > 0 ? vendedores[0] : null);

  const getPeriodLabel = () => {
    switch (periodFilter) {
      case 'hoy': return 'Hoy';
      case 'semana': return 'Última Semana';
      case 'mes': return 'Último Mes';
      case 'custom': return 'Período Personalizado';
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
              <TrendingUp className="h-6 w-6 sm:h-7 sm:w-7 text-indigo-600" />
              Panel de Supervisor
            </h1>
            <p className="text-xs sm:text-sm text-gray-600 mt-1">
              Dashboard de métricas y rendimiento del equipo
            </p>
          </div>
          <div className="w-full sm:w-auto">
            <Select
              value={selectedVendedor}
              onChange={(e) => setSelectedVendedor(e.target.value)}
              className="w-full sm:w-56"
            >
              <option value="">📊 Todos los vendedores</option>
              {vendedores.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.nombre_completo}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {/* Filtros de Período */}
        <Card padding="sm" className="bg-slate-50">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-1.5 text-xs sm:text-sm text-gray-600">
              <Filter className="h-4 w-4" />
              <span className="font-medium">Período:</span>
            </div>
            <div className="flex flex-wrap gap-1.5 sm:gap-2">
              <button
                onClick={() => setPeriodFilter('hoy')}
                className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                  periodFilter === 'hoy' 
                    ? 'bg-indigo-600 text-white' 
                    : 'bg-white text-gray-700 hover:bg-gray-100'
                }`}
              >
                Hoy
              </button>
              <button
                onClick={() => setPeriodFilter('semana')}
                className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                  periodFilter === 'semana' 
                    ? 'bg-indigo-600 text-white' 
                    : 'bg-white text-gray-700 hover:bg-gray-100'
                }`}
              >
                Semana
              </button>
              <button
                onClick={() => setPeriodFilter('mes')}
                className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                  periodFilter === 'mes' 
                    ? 'bg-indigo-600 text-white' 
                    : 'bg-white text-gray-700 hover:bg-gray-100'
                }`}
              >
                Mes
              </button>
              <button
                onClick={() => setPeriodFilter('custom')}
                className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors flex items-center gap-1 ${
                  periodFilter === 'custom' 
                    ? 'bg-indigo-600 text-white' 
                    : 'bg-white text-gray-700 hover:bg-gray-100'
                }`}
              >
                <CalendarDays className="h-3.5 w-3.5" />
                Rango
              </button>
            </div>
            
            {periodFilter === 'custom' && (
              <div className="flex items-center gap-2 w-full sm:w-auto mt-2 sm:mt-0">
                <Input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="text-xs sm:text-sm w-full sm:w-auto"
                />
                <span className="text-gray-500 text-xs">a</span>
                <Input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="text-xs sm:text-sm w-full sm:w-auto"
                />
              </div>
            )}
          </div>
        </Card>

        {/* Recordatorio de Actividades Estratégicas */}
        {weekActivities.length > 0 && (
          <Card className="border-purple-200 bg-gradient-to-r from-purple-50 to-indigo-50">
            <div 
              className="flex items-center gap-2 cursor-pointer"
              onClick={() => setShowActivities(!showActivities)}
            >
              <div className="p-2 rounded-lg bg-purple-100">
                <Star className="h-5 w-5 text-purple-600 fill-purple-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-purple-900">Actividades Estratégicas</h3>
                <p className="text-xs text-purple-600">Esta semana y pendientes</p>
              </div>
              <Badge variant="purple">{weekActivities.length}</Badge>
              <button className="p-1 hover:bg-purple-100 rounded-lg transition-colors">
                {showActivities ? (
                  <ChevronUp className="h-5 w-5 text-purple-600" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-purple-600" />
                )}
              </button>
            </div>
            
            {showActivities && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 mt-3">
                  {weekActivities.slice(0, 6).map((activity) => {
                    const activityDate = new Date(activity.fecha_inicio);
                    const isOverdue = isBefore(activityDate, new Date()) && activity.estado !== 'realizado';
                    const participants = activity.participants || [];
                    
                    return (
                      <Link
                        key={activity.id}
                        href="/actividades"
                        className={`flex flex-col gap-2 p-3 rounded-lg transition-colors ${
                          isOverdue 
                            ? 'bg-red-100/70 hover:bg-red-100 border border-red-200' 
                            : 'bg-white/70 hover:bg-white border border-purple-100'
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <div className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${
                            activity.prioridad === 'alta' ? 'bg-red-500' :
                            activity.prioridad === 'media' ? 'bg-amber-500' : 'bg-green-500'
                          }`} />
                          <div className="flex-1 min-w-0">
                            <p className={`font-medium truncate text-sm ${isOverdue ? 'text-red-800' : 'text-gray-900'}`}>
                              {activity.titulo}
                            </p>
                            <p className={`text-xs ${isOverdue ? 'text-red-600' : 'text-gray-500'}`}>
                              {isOverdue && '⚠️ '}
                              {format(activityDate, "EEE dd MMM 'a las' HH:mm", { locale: es })}
                            </p>
                          </div>
                          <Badge 
                            variant={activity.estado === 'planificacion' ? 'blue' : 'yellow'} 
                            className="text-[10px] shrink-0"
                          >
                            {activity.estado === 'planificacion' ? 'Plan' : 'En prog'}
                          </Badge>
                        </div>
                        {/* Participantes */}
                        {participants.length > 0 && (
                          <div className="flex items-center gap-1 ml-4">
                            <Users className="h-3 w-3 text-gray-400" />
                            <p className="text-[10px] text-gray-500 truncate">
                              {participants.slice(0, 3).map(p => p.user_profile?.nombre_completo?.split(' ')[0] || 'Usuario').join(', ')}
                              {participants.length > 3 && ` +${participants.length - 3}`}
                            </p>
                          </div>
                        )}
                      </Link>
                    );
                  })}
                </div>
                {weekActivities.length > 6 && (
                  <Link 
                    href="/actividades" 
                    className="mt-3 text-sm text-purple-600 hover:text-purple-800 flex items-center gap-1"
                  >
                    Ver todas ({weekActivities.length}) <ArrowRight className="h-4 w-4" />
                  </Link>
                )}
              </>
            )}
          </Card>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
            <p className="mt-4 text-gray-600">Cargando métricas del equipo...</p>
          </div>
        </div>
      ) : (
        <>
          {/* KPIs Principales */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <Card className="bg-gradient-to-br from-indigo-500 to-indigo-600 text-white" padding="sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-indigo-100 text-xs sm:text-sm">Ventas ({getPeriodLabel()})</p>
                  <p className="text-xl sm:text-2xl lg:text-3xl font-bold mt-1">{formatCurrency(totals.ventasPeriodo)}</p>
                  <p className="text-indigo-200 text-[10px] sm:text-xs mt-1">
                    {totals.pedidosPeriodo} pedidos
                  </p>
                </div>
                <DollarSign className="h-8 w-8 sm:h-10 sm:w-10 lg:h-12 lg:w-12 text-indigo-300" />
              </div>
            </Card>
            
            <Card className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white" padding="sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-emerald-100 text-xs sm:text-sm">Pedidos ({getPeriodLabel()})</p>
                  <p className="text-xl sm:text-2xl lg:text-3xl font-bold mt-1">{totals.pedidosPeriodo}</p>
                  <p className="text-emerald-200 text-[10px] sm:text-xs mt-1">
                    {totals.visitasPeriodo} visitas
                  </p>
                </div>
                <Zap className="h-8 w-8 sm:h-10 sm:w-10 lg:h-12 lg:w-12 text-emerald-300" />
              </div>
            </Card>

            <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white" padding="sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-purple-100 text-xs sm:text-sm">Total Clientes</p>
                  <p className="text-xl sm:text-2xl lg:text-3xl font-bold mt-1">{totals.clientes}</p>
                  <p className="text-purple-200 text-[10px] sm:text-xs mt-1">
                    +{totals.clientesNuevosPeriodo} nuevos
                  </p>
                </div>
                <UserCheck className="h-8 w-8 sm:h-10 sm:w-10 lg:h-12 lg:w-12 text-purple-300" />
              </div>
            </Card>

            <Card className="bg-gradient-to-br from-amber-500 to-amber-600 text-white" padding="sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-amber-100 text-xs sm:text-sm">Total Prospectos</p>
                  <p className="text-xl sm:text-2xl lg:text-3xl font-bold mt-1">{totals.prospectos}</p>
                  <p className="text-amber-200 text-[10px] sm:text-xs mt-1">
                    +{totals.prospectosNuevosPeriodo} nuevos
                  </p>
                </div>
                <Target className="h-8 w-8 sm:h-10 sm:w-10 lg:h-12 lg:w-12 text-amber-300" />
              </div>
            </Card>
          </div>

          {/* Fila 2: Mejor Vendedor / Vendedor Seleccionado + Métricas Secundarias */}
          <div className="grid lg:grid-cols-3 gap-3 sm:gap-4">
            {/* Mejor Vendedor o Vendedor Seleccionado */}
            {mejorVendedor && (
              <Card className={`bg-gradient-to-br ${selectedVendedor ? 'from-indigo-50 to-blue-50 border-indigo-200' : 'from-yellow-50 to-amber-50 border-amber-200'}`} padding="sm">
                <div className="flex items-center gap-2 sm:gap-3 mb-3">
                  <div className={`p-2 ${selectedVendedor ? 'bg-indigo-100' : 'bg-amber-100'} rounded-full`}>
                    {selectedVendedor ? (
                      <UserCheck className="h-6 w-6 text-indigo-600" />
                    ) : (
                      <Award className="h-6 w-6 text-amber-600" />
                    )}
                  </div>
                  <div>
                    <p className={`text-[10px] sm:text-xs ${selectedVendedor ? 'text-indigo-600' : 'text-amber-600'} font-semibold uppercase`}>
                      {selectedVendedor ? '👤 Vendedor Seleccionado' : '🏆 Mejor Vendedor'}
                    </p>
                    <p className="text-base sm:text-lg font-bold text-gray-900">{mejorVendedor.nombre_completo}</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-white/70 rounded-lg p-2 text-center">
                    <p className="text-sm sm:text-base font-bold text-emerald-600">{formatCurrency(mejorVendedor.ventasTotalPeriodo)}</p>
                    <p className="text-[10px] text-gray-500">Ventas</p>
                  </div>
                  <div className="bg-white/70 rounded-lg p-2 text-center">
                    <p className="text-sm sm:text-base font-bold text-indigo-600">{mejorVendedor.pedidosPeriodo}</p>
                    <p className="text-[10px] text-gray-500">Pedidos</p>
                  </div>
                  <div className="bg-white/70 rounded-lg p-2 text-center">
                    <p className="text-sm sm:text-base font-bold text-purple-600">{mejorVendedor.clientes}</p>
                    <p className="text-[10px] text-gray-500">Clientes</p>
                  </div>
                </div>
              </Card>
            )}

            {/* Métricas Secundarias en 2 columnas */}
            <Card padding="sm" className="lg:col-span-2">
              <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Resumen de Actividad</p>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 sm:gap-3">
                <div className="text-center p-2 bg-indigo-50 rounded-lg">
                  <Users className="h-4 w-4 text-indigo-600 mx-auto mb-1" />
                  <p className="text-lg font-bold text-gray-900">{selectedVendedor ? 1 : vendedores.length}</p>
                  <p className="text-[10px] text-gray-500">{selectedVendedor ? 'Seleccionado' : 'Vendedores'}</p>
                </div>
                <div className="text-center p-2 bg-blue-50 rounded-lg">
                  <Calendar className="h-4 w-4 text-blue-600 mx-auto mb-1" />
                  <p className="text-lg font-bold text-gray-900">{totals.visitasPeriodo}</p>
                  <p className="text-[10px] text-gray-500">Visitas</p>
                </div>
                <div className="text-center p-2 bg-emerald-50 rounded-lg">
                  <CheckCircle className="h-4 w-4 text-emerald-600 mx-auto mb-1" />
                  <p className="text-lg font-bold text-gray-900">{totals.visitasCompletadas}</p>
                  <p className="text-[10px] text-gray-500">Completadas</p>
                </div>
                <div className="text-center p-2 bg-amber-50 rounded-lg">
                  <Clock className="h-4 w-4 text-amber-600 mx-auto mb-1" />
                  <p className="text-lg font-bold text-gray-900">{totals.visitasPendientes}</p>
                  <p className="text-[10px] text-gray-500">Pendientes</p>
                </div>
                <div className="text-center p-2 bg-purple-50 rounded-lg">
                  <ShoppingCart className="h-4 w-4 text-purple-600 mx-auto mb-1" />
                  <p className="text-lg font-bold text-gray-900">{totals.pedidosPeriodo}</p>
                  <p className="text-[10px] text-gray-500">Pedidos</p>
                </div>
                <div className="text-center p-2 bg-green-50 rounded-lg">
                  <DollarSign className="h-4 w-4 text-green-600 mx-auto mb-1" />
                  <p className="text-lg font-bold text-gray-900">
                    {totals.pedidosPeriodo > 0 ? formatCurrency(totals.ventasPeriodo / totals.pedidosPeriodo) : '$0'}
                  </p>
                  <p className="text-[10px] text-gray-500">Ticket Prom.</p>
                </div>
              </div>
            </Card>
          </div>

          {/* Fila 3: Gráficos Top Clientes y Top Productos */}
          <div className="grid lg:grid-cols-2 gap-3 sm:gap-4">
            {/* Top 5 Clientes */}
            <Card padding="sm">
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-emerald-600" />
                Top 5 Clientes
                <Badge variant="green" className="text-[10px]">por productos</Badge>
              </h3>
              {topClientes.length === 0 ? (
                <div className="h-[220px] flex items-center justify-center">
                  <p className="text-sm text-gray-400">Sin datos en este período</p>
                </div>
              ) : (
                <div className="h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={topClientes}
                      layout="vertical"
                      margin={{ top: 5, right: 35, left: 5, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                      <XAxis type="number" tick={{ fontSize: 10 }} axisLine={false} />
                      <YAxis 
                        type="category" 
                        dataKey="nombre" 
                        width={100}
                        tick={{ fontSize: 11 }}
                        tickFormatter={(value) => value.length > 14 ? `${value.substring(0, 14)}...` : value}
                        axisLine={false}
                      />
                      <Tooltip 
                        formatter={(value, name) => {
                          if (name === 'totalProductos') return [`${value} unidades`, 'Productos comprados'];
                          return [String(value), name];
                        }}
                        labelFormatter={(label) => `👤 ${label}`}
                        contentStyle={{ 
                          backgroundColor: 'white', 
                          border: 'none',
                          borderRadius: '12px',
                          fontSize: '12px',
                          boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.15)'
                        }}
                      />
                      <Bar dataKey="totalProductos" radius={[0, 6, 6, 0]} barSize={28}>
                        {topClientes.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={['#10b981', '#34d399', '#6ee7b7', '#a7f3d0', '#d1fae5'][index]} />
                        ))}
                        <LabelList dataKey="totalProductos" position="right" fontSize={11} fontWeight={600} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>

            {/* Top 5 Productos */}
            <Card padding="sm">
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <Package className="h-4 w-4 text-purple-600" />
                Top 5 Productos Vendidos
                <Badge variant="purple" className="text-[10px]">por cantidad</Badge>
              </h3>
              {topProductos.length === 0 ? (
                <div className="h-[220px] flex items-center justify-center">
                  <p className="text-sm text-gray-400">Sin datos en este período</p>
                </div>
              ) : (
                <div className="h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={topProductos}
                      layout="vertical"
                      margin={{ top: 5, right: 45, left: 5, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                      <XAxis type="number" tick={{ fontSize: 10 }} axisLine={false} />
                      <YAxis 
                        type="category" 
                        dataKey="nombre" 
                        width={120}
                        tick={{ fontSize: 11 }}
                        tickFormatter={(value) => value.length > 16 ? `${value.substring(0, 16)}...` : value}
                        axisLine={false}
                      />
                      <Tooltip 
                        formatter={(value, name) => {
                          if (name === 'cantidad') return [`${value} unidades`, 'Vendidas'];
                          return [String(value), name];
                        }}
                        labelFormatter={(label) => `📦 ${label}`}
                        contentStyle={{ 
                          backgroundColor: 'white', 
                          border: 'none',
                          borderRadius: '12px',
                          fontSize: '12px',
                          boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.15)'
                        }}
                      />
                      <Bar dataKey="cantidad" name="cantidad" radius={[0, 6, 6, 0]} barSize={28}>
                        {topProductos.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={['#8b5cf6', '#a78bfa', '#c4b5fd', '#ddd6fe', '#ede9fe'][index]} />
                        ))}
                        <LabelList 
                          dataKey="cantidad" 
                          position="right" 
                          fontSize={11}
                          fontWeight={600}
                          formatter={(value) => `${value}`}
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
              {/* Resumen de totales por producto */}
              {topProductos.length > 0 && (
                <div className="mt-2 pt-2 border-t border-gray-100 grid grid-cols-5 gap-1">
                  {topProductos.map((p, i) => (
                    <div key={i} className="text-center">
                      <p className="text-[10px] text-gray-400">{i + 1}º</p>
                      <p className="text-xs font-semibold text-purple-600">{formatCurrency(p.total)}</p>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* Tabla de Vendedores */}
          <Card padding="sm">
            <h2 className="text-sm sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4 flex items-center gap-2">
              <BarChart3 className="h-4 w-4 sm:h-5 sm:w-5 text-indigo-600" />
              Ranking de Vendedores
              <Badge variant="blue" className="ml-2 text-[10px] sm:text-xs">{filteredVendedores.length}</Badge>
              <Badge variant="purple" className="text-[10px] sm:text-xs">{getPeriodLabel()}</Badge>
            </h2>
            
            <div className="overflow-x-auto -mx-3 sm:-mx-4">
              <table className="w-full min-w-[600px]">
                <thead>
                  <tr className="border-b-2 border-gray-200 bg-gray-50">
                    <th className="text-left py-2 sm:py-3 px-2 sm:px-3 text-[10px] sm:text-xs font-bold text-gray-600 uppercase">#</th>
                    <th className="text-left py-2 sm:py-3 px-2 sm:px-3 text-[10px] sm:text-xs font-bold text-gray-600 uppercase">Vendedor</th>
                    <th className="text-center py-2 sm:py-3 px-2 sm:px-3 text-[10px] sm:text-xs font-bold text-gray-600 uppercase">Clientes</th>
                    <th className="text-center py-2 sm:py-3 px-2 sm:px-3 text-[10px] sm:text-xs font-bold text-gray-600 uppercase">Prosp.</th>
                    <th className="text-center py-2 sm:py-3 px-2 sm:px-3 text-[10px] sm:text-xs font-bold text-gray-600 uppercase">% Conv.</th>
                    <th className="text-center py-2 sm:py-3 px-2 sm:px-3 text-[10px] sm:text-xs font-bold text-gray-600 uppercase">Pedidos</th>
                    <th className="text-right py-2 sm:py-3 px-2 sm:px-3 text-[10px] sm:text-xs font-bold text-gray-600 uppercase">Ventas</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredVendedores.map((vendedor) => (
                    <tr 
                      key={vendedor.id} 
                      className={`border-b border-gray-100 hover:bg-indigo-50/50 transition-colors ${
                        vendedor.ranking === 1 ? 'bg-amber-50' : ''
                      }`}
                    >
                      <td className="py-2 sm:py-3 px-2 sm:px-3">
                        {vendedor.ranking === 1 ? (
                          <span className="text-base sm:text-lg">🏆</span>
                        ) : (
                          <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-gray-100 flex items-center justify-center text-[10px] sm:text-xs text-gray-600 font-medium">
                            {vendedor.ranking}
                          </span>
                        )}
                      </td>
                      <td className="py-2 sm:py-3 px-2 sm:px-3">
                        <div>
                          <p className="font-semibold text-gray-900 text-xs sm:text-sm">{vendedor.nombre_completo}</p>
                          <p className="text-[10px] sm:text-xs text-gray-500">@{vendedor.username}</p>
                        </div>
                      </td>
                      <td className="text-center py-2 sm:py-3 px-2 sm:px-3">
                        <Badge variant="green" className="text-[10px] sm:text-xs">{vendedor.clientes}</Badge>
                      </td>
                      <td className="text-center py-2 sm:py-3 px-2 sm:px-3">
                        <Badge variant="yellow" className="text-[10px] sm:text-xs">{vendedor.prospectos}</Badge>
                      </td>
                      <td className="text-center py-2 sm:py-3 px-2 sm:px-3">
                        <span className={`text-[10px] sm:text-sm font-bold ${
                          vendedor.tasaConversion >= 70 ? 'text-emerald-600' :
                          vendedor.tasaConversion >= 50 ? 'text-amber-600' : 'text-red-600'
                        }`}>
                          {vendedor.tasaConversion}%
                        </span>
                      </td>
                      <td className="text-center py-2 sm:py-3 px-2 sm:px-3">
                        <span className="text-xs sm:text-sm font-bold text-indigo-600">{vendedor.pedidosPeriodo}</span>
                      </td>
                      <td className="text-right py-2 sm:py-3 px-2 sm:px-3">
                        <span className="text-xs sm:text-sm font-bold text-emerald-600">
                          {formatCurrency(vendedor.ventasTotalPeriodo)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-indigo-50 font-bold border-t-2 border-indigo-200">
                    <td className="py-2 sm:py-3 px-2 sm:px-3"></td>
                    <td className="py-2 sm:py-3 px-2 sm:px-3 text-indigo-900 text-xs sm:text-sm">TOTALES</td>
                    <td className="text-center py-2 sm:py-3 px-2 sm:px-3 text-emerald-700 text-xs sm:text-sm">
                      {filteredVendedores.reduce((sum, v) => sum + v.clientes, 0)}
                    </td>
                    <td className="text-center py-2 sm:py-3 px-2 sm:px-3 text-amber-700 text-xs sm:text-sm">
                      {filteredVendedores.reduce((sum, v) => sum + v.prospectos, 0)}
                    </td>
                    <td className="text-center py-2 sm:py-3 px-2 sm:px-3 text-gray-600 text-xs sm:text-sm">-</td>
                    <td className="text-center py-2 sm:py-3 px-2 sm:px-3 text-indigo-700 text-xs sm:text-sm">
                      {filteredVendedores.reduce((sum, v) => sum + v.pedidosPeriodo, 0)}
                    </td>
                    <td className="text-right py-2 sm:py-3 px-2 sm:px-3 text-emerald-700 text-xs sm:text-sm">
                      {formatCurrency(filteredVendedores.reduce((sum, v) => sum + v.ventasTotalPeriodo, 0))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>

          {/* Detalles del vendedor seleccionado */}
          {selectedVendedor && filteredVendedores.length === 1 && (
            <Card padding="sm">
              <h3 className="text-sm sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">
                Detalle: {filteredVendedores[0].nombre_completo}
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                <div className="bg-gray-50 rounded-xl p-3 sm:p-4">
                  <h4 className="text-[10px] sm:text-sm font-semibold text-gray-700 mb-2 sm:mb-3 flex items-center gap-1 sm:gap-2">
                    <Users className="h-3 w-3 sm:h-4 sm:w-4 text-emerald-600" />
                    Clientes
                  </h4>
                  <div className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Total</span>
                      <span className="font-bold">{filteredVendedores[0].totalClientes}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Clientes</span>
                      <Badge variant="green" className="text-[10px]">{filteredVendedores[0].clientes}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Prospectos</span>
                      <Badge variant="yellow" className="text-[10px]">{filteredVendedores[0].prospectos}</Badge>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-xl p-3 sm:p-4">
                  <h4 className="text-[10px] sm:text-sm font-semibold text-gray-700 mb-2 sm:mb-3 flex items-center gap-1 sm:gap-2">
                    <Calendar className="h-3 w-3 sm:h-4 sm:w-4 text-blue-600" />
                    Visitas
                  </h4>
                  <div className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Total</span>
                      <span className="font-bold">{filteredVendedores[0].totalVisitas}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Completadas</span>
                      <Badge variant="green" className="text-[10px]">{filteredVendedores[0].visitasCompletadas}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Conversión</span>
                      <Badge variant={filteredVendedores[0].tasaConversion >= 70 ? 'green' : 'yellow'} className="text-[10px]">
                        {filteredVendedores[0].tasaConversion}%
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-xl p-3 sm:p-4">
                  <h4 className="text-[10px] sm:text-sm font-semibold text-gray-700 mb-2 sm:mb-3 flex items-center gap-1 sm:gap-2">
                    <ShoppingCart className="h-3 w-3 sm:h-4 sm:w-4 text-purple-600" />
                    Pedidos
                  </h4>
                  <div className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Total</span>
                      <span className="font-bold">{filteredVendedores[0].totalPedidos}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Período</span>
                      <Badge variant="blue" className="text-[10px]">{filteredVendedores[0].pedidosPeriodo}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Entregados</span>
                      <span className="font-medium">{filteredVendedores[0].pedidosEntregados}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-xl p-3 sm:p-4 border border-emerald-200">
                  <h4 className="text-[10px] sm:text-sm font-semibold text-emerald-700 mb-2 sm:mb-3 flex items-center gap-1 sm:gap-2">
                    <DollarSign className="h-3 w-3 sm:h-4 sm:w-4" />
                    Ventas
                  </h4>
                  <div className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Período</span>
                      <span className="font-bold text-emerald-700">{formatCurrency(filteredVendedores[0].ventasTotalPeriodo)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Ticket Prom.</span>
                      <span className="font-semibold text-emerald-600">{formatCurrency(filteredVendedores[0].ticketPromedio)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

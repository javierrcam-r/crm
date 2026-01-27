'use client';

import { useEffect, useState } from 'react';
import {
  Users,
  ShoppingCart,
  TrendingUp,
  Calendar,
  DollarSign,
  UserCheck,
  UserPlus,
  BarChart3,
  Target,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ArrowUp,
  ArrowDown,
  Percent,
  Package,
  MapPin,
  Phone,
  Award,
  Zap,
} from 'lucide-react';
import Card from '@/components/ui/Card';
import Select from '@/components/ui/Select';
import Badge from '@/components/ui/Badge';
import { useAuth } from '@/contexts/AuthContext';
import { getSupabaseClient } from '@/lib/supabase/client';
import { formatCurrency } from '@/lib/utils';
import type { UserProfile } from '@/types/database';

interface VendedorStats {
  id: string;
  username: string;
  nombre_completo: string;
  email: string;
  rol: string;
  // Clientes
  totalClientes: number;
  clientes: number;
  prospectos: number;
  clientesNuevosMes: number;
  // Visitas
  totalVisitas: number;
  visitasCompletadas: number;
  visitasPendientes: number;
  visitasCanceladas: number;
  visitasHoy: number;
  visitasSemana: number;
  tasaConversion: number;
  // Pedidos
  totalPedidos: number;
  pedidosHoy: number;
  pedidosSemana: number;
  pedidosMes: number;
  pedidosEntregados: number;
  pedidosPendientes: number;
  // Ventas
  ventasTotalMes: number;
  ventasTotalSemana: number;
  ventasTotalHoy: number;
  ticketPromedio: number;
  // Productos
  totalProductos: number;
  // Rankings
  ranking: number;
}

interface TopCliente {
  nombre: string;
  totalPedidos: number;
  totalVentas: number;
}

interface TopProducto {
  nombre: string;
  cantidad: number;
  total: number;
}

export default function SupervisoresPage() {
  const { userProfile, isUserAdmin } = useAuth();
  const [vendedores, setVendedores] = useState<VendedorStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVendedor, setSelectedVendedor] = useState<string>('');
  const [topClientes, setTopClientes] = useState<TopCliente[]>([]);
  const [topProductos, setTopProductos] = useState<TopProducto[]>([]);

  // Solo supervisores y admins pueden ver esta página
  const canView = userProfile?.rol === 'admin' || userProfile?.rol === 'supervisor';

  useEffect(() => {
    if (canView) {
      loadVendedoresStats();
    }
  }, [canView]);

  const loadVendedoresStats = async () => {
    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      
      // Obtener solo vendedores
      const { data: users, error: usersError } = await supabase
        .from('users_profile')
        .select('*')
        .eq('rol', 'vendedor')
        .eq('activo', true)
        .order('nombre_completo');

      if (usersError) throw usersError;

      // Fechas para filtros
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);
      const weekAgoStr = weekAgo.toISOString().split('T')[0];
      
      const monthAgo = new Date(today);
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      const monthAgoStr = monthAgo.toISOString().split('T')[0];

      // Cargar stats para cada vendedor
      const statsPromises = (users || []).map(async (user: UserProfile) => {
        // Usar tanto id como user_id para buscar datos
        const userIds = [user.id, user.user_id].filter(Boolean);

        // Clientes - buscar por cualquiera de los IDs
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
          .select('status, total, order_date, customer_id')
          .in('user_id', userIds)
          .is('deleted_at', null);

        // Productos
        const { data: products } = await supabase
          .from('products')
          .select('id')
          .in('user_id', userIds)
          .is('deleted_at', null);

        // Calcular métricas de clientes
        const clientes = customers?.filter(c => c.tipo === 'cliente').length || 0;
        const prospectos = customers?.filter(c => c.tipo === 'prospecto').length || 0;
        const clientesNuevosMes = customers?.filter(c => 
          c.created_at && c.created_at >= monthAgoStr
        ).length || 0;

        // Calcular métricas de visitas
        const visitasCompletadas = visits?.filter(v => v.status === 'completada').length || 0;
        const visitasPendientes = visits?.filter(v => v.status === 'programada').length || 0;
        const visitasCanceladas = visits?.filter(v => v.status === 'cancelada').length || 0;
        const visitasHoy = visits?.filter(v => 
          v.scheduled_at?.startsWith(todayStr)
        ).length || 0;
        const visitasSemana = visits?.filter(v => 
          v.scheduled_at && v.scheduled_at >= weekAgoStr
        ).length || 0;

        // Tasa de conversión (visitas completadas / total)
        const totalVisitas = visits?.length || 0;
        const tasaConversion = totalVisitas > 0 
          ? Math.round((visitasCompletadas / totalVisitas) * 100) 
          : 0;

        // Calcular métricas de pedidos
        const pedidosHoy = orders?.filter(o => o.order_date === todayStr).length || 0;
        const pedidosSemana = orders?.filter(o => o.order_date >= weekAgoStr).length || 0;
        const pedidosMes = orders?.filter(o => o.order_date >= monthAgoStr).length || 0;
        const pedidosEntregados = orders?.filter(o => o.status === 'entregado').length || 0;
        const pedidosPendientes = orders?.filter(o => 
          o.status !== 'entregado' && o.status !== 'cancelado'
        ).length || 0;

        // Calcular ventas
        const ventasTotalHoy = orders
          ?.filter(o => o.order_date === todayStr)
          .reduce((sum, o) => sum + (o.total || 0), 0) || 0;
        const ventasTotalSemana = orders
          ?.filter(o => o.order_date >= weekAgoStr)
          .reduce((sum, o) => sum + (o.total || 0), 0) || 0;
        const ventasTotalMes = orders
          ?.filter(o => o.order_date >= monthAgoStr)
          .reduce((sum, o) => sum + (o.total || 0), 0) || 0;

        // Ticket promedio
        const ticketPromedio = pedidosMes > 0 
          ? Math.round(ventasTotalMes / pedidosMes) 
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
          clientesNuevosMes,
          totalVisitas,
          visitasCompletadas,
          visitasPendientes,
          visitasCanceladas,
          visitasHoy,
          visitasSemana,
          tasaConversion,
          totalPedidos: orders?.length || 0,
          pedidosHoy,
          pedidosSemana,
          pedidosMes,
          pedidosEntregados,
          pedidosPendientes,
          ventasTotalMes,
          ventasTotalSemana,
          ventasTotalHoy,
          ticketPromedio,
          totalProductos: products?.length || 0,
          ranking: 0,
        } as VendedorStats;
      });

      let stats = await Promise.all(statsPromises);
      
      // Calcular rankings por ventas del mes
      stats = stats.sort((a, b) => b.ventasTotalMes - a.ventasTotalMes);
      stats = stats.map((s, i) => ({ ...s, ranking: i + 1 }));

      setVendedores(stats);

      // Cargar top clientes y productos globales
      await loadTopData(supabase, monthAgoStr);

    } catch (error) {
      console.error('Error cargando stats de vendedores:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTopData = async (supabase: any, monthAgoStr: string) => {
    try {
      // Top clientes por ventas
      const { data: ordersWithCustomers } = await supabase
        .from('orders')
        .select(`
          total,
          customer:customers(nombre)
        `)
        .gte('order_date', monthAgoStr)
        .is('deleted_at', null);

      if (ordersWithCustomers) {
        const clienteMap = new Map<string, { nombre: string; totalPedidos: number; totalVentas: number }>();
        ordersWithCustomers.forEach((o: any) => {
          const nombre = o.customer?.nombre || 'Sin nombre';
          const current = clienteMap.get(nombre) || { nombre, totalPedidos: 0, totalVentas: 0 };
          current.totalPedidos++;
          current.totalVentas += o.total || 0;
          clienteMap.set(nombre, current);
        });
        const topC = Array.from(clienteMap.values())
          .sort((a, b) => b.totalVentas - a.totalVentas)
          .slice(0, 5);
        setTopClientes(topC);
      }

      // Top productos
      const { data: orderItems } = await supabase
        .from('order_items')
        .select(`
          quantity,
          subtotal,
          product:products(nombre)
        `)
        .is('deleted_at', null);

      if (orderItems) {
        const productoMap = new Map<string, { nombre: string; cantidad: number; total: number }>();
        orderItems.forEach((item: any) => {
          const nombre = item.product?.nombre || 'Sin nombre';
          const current = productoMap.get(nombre) || { nombre, cantidad: 0, total: 0 };
          current.cantidad += item.quantity || 0;
          current.total += item.subtotal || 0;
          productoMap.set(nombre, current);
        });
        const topP = Array.from(productoMap.values())
          .sort((a, b) => b.total - a.total)
          .slice(0, 5);
        setTopProductos(topP);
      }
    } catch (error) {
      console.error('Error cargando top data:', error);
    }
  };

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

  // Filtrar vendedores
  const filteredVendedores = selectedVendedor
    ? vendedores.filter(v => v.id === selectedVendedor)
    : vendedores;

  // Totales generales
  const totals = {
    vendedores: vendedores.length,
    clientes: vendedores.reduce((sum, v) => sum + v.clientes, 0),
    prospectos: vendedores.reduce((sum, v) => sum + v.prospectos, 0),
    clientesNuevosMes: vendedores.reduce((sum, v) => sum + v.clientesNuevosMes, 0),
    pedidosHoy: vendedores.reduce((sum, v) => sum + v.pedidosHoy, 0),
    pedidosSemana: vendedores.reduce((sum, v) => sum + v.pedidosSemana, 0),
    pedidosMes: vendedores.reduce((sum, v) => sum + v.pedidosMes, 0),
    ventasHoy: vendedores.reduce((sum, v) => sum + v.ventasTotalHoy, 0),
    ventasSemana: vendedores.reduce((sum, v) => sum + v.ventasTotalSemana, 0),
    ventasMes: vendedores.reduce((sum, v) => sum + v.ventasTotalMes, 0),
    visitasHoy: vendedores.reduce((sum, v) => sum + v.visitasHoy, 0),
    visitasCompletadas: vendedores.reduce((sum, v) => sum + v.visitasCompletadas, 0),
    visitasPendientes: vendedores.reduce((sum, v) => sum + v.visitasPendientes, 0),
  };

  // Mejor vendedor del mes
  const mejorVendedor = vendedores.length > 0 ? vendedores[0] : null;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
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

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
            <p className="mt-4 text-gray-600">Cargando métricas del equipo...</p>
          </div>
        </div>
      ) : (
        <>
          {/* KPIs Principales - Fila 1 */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <Card className="bg-gradient-to-br from-indigo-500 to-indigo-600 text-white" padding="sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-indigo-100 text-xs sm:text-sm">Ventas del Mes</p>
                  <p className="text-xl sm:text-2xl lg:text-3xl font-bold mt-1">{formatCurrency(totals.ventasMes)}</p>
                  <p className="text-indigo-200 text-[10px] sm:text-xs mt-1">
                    {totals.pedidosMes} pedidos
                  </p>
                </div>
                <DollarSign className="h-8 w-8 sm:h-10 sm:w-10 lg:h-12 lg:w-12 text-indigo-300" />
              </div>
            </Card>
            
            <Card className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white" padding="sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-emerald-100 text-xs sm:text-sm">Ventas Hoy</p>
                  <p className="text-xl sm:text-2xl lg:text-3xl font-bold mt-1">{formatCurrency(totals.ventasHoy)}</p>
                  <p className="text-emerald-200 text-[10px] sm:text-xs mt-1">
                    {totals.pedidosHoy} pedidos
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
                    +{totals.clientesNuevosMes} este mes
                  </p>
                </div>
                <UserCheck className="h-8 w-8 sm:h-10 sm:w-10 lg:h-12 lg:w-12 text-purple-300" />
              </div>
            </Card>

            <Card className="bg-gradient-to-br from-amber-500 to-amber-600 text-white" padding="sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-amber-100 text-xs sm:text-sm">Prospectos</p>
                  <p className="text-xl sm:text-2xl lg:text-3xl font-bold mt-1">{totals.prospectos}</p>
                  <p className="text-amber-200 text-[10px] sm:text-xs mt-1">
                    Por convertir
                  </p>
                </div>
                <Target className="h-8 w-8 sm:h-10 sm:w-10 lg:h-12 lg:w-12 text-amber-300" />
              </div>
            </Card>
          </div>

          {/* KPIs Secundarios - Fila 2 */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 sm:gap-3">
            <Card padding="sm" className="text-center">
              <Users className="h-4 w-4 sm:h-5 sm:w-5 text-indigo-600 mx-auto mb-1" />
              <p className="text-lg sm:text-xl font-bold text-gray-900">{totals.vendedores}</p>
              <p className="text-[10px] sm:text-xs text-gray-500">Vendedores</p>
            </Card>
            <Card padding="sm" className="text-center">
              <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 mx-auto mb-1" />
              <p className="text-lg sm:text-xl font-bold text-gray-900">{totals.visitasHoy}</p>
              <p className="text-[10px] sm:text-xs text-gray-500">Visitas Hoy</p>
            </Card>
            <Card padding="sm" className="text-center">
              <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-600 mx-auto mb-1" />
              <p className="text-lg sm:text-xl font-bold text-gray-900">{totals.visitasCompletadas}</p>
              <p className="text-[10px] sm:text-xs text-gray-500">Completadas</p>
            </Card>
            <Card padding="sm" className="text-center">
              <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-amber-600 mx-auto mb-1" />
              <p className="text-lg sm:text-xl font-bold text-gray-900">{totals.visitasPendientes}</p>
              <p className="text-[10px] sm:text-xs text-gray-500">Pendientes</p>
            </Card>
            <Card padding="sm" className="text-center">
              <ShoppingCart className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600 mx-auto mb-1" />
              <p className="text-lg sm:text-xl font-bold text-gray-900">{totals.pedidosSemana}</p>
              <p className="text-[10px] sm:text-xs text-gray-500">Ped. Semana</p>
            </Card>
            <Card padding="sm" className="text-center">
              <DollarSign className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 mx-auto mb-1" />
              <p className="text-lg sm:text-xl font-bold text-gray-900">{formatCurrency(totals.ventasSemana)}</p>
              <p className="text-[10px] sm:text-xs text-gray-500">Vtas. Semana</p>
            </Card>
          </div>

          {/* Mejor Vendedor y Top Rankings */}
          <div className="grid md:grid-cols-3 gap-3 sm:gap-4">
            {/* Mejor Vendedor */}
            {mejorVendedor && (
              <Card className="bg-gradient-to-br from-yellow-50 to-amber-50 border-amber-200" padding="sm">
                <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
                  <div className="p-1.5 sm:p-2 bg-amber-100 rounded-full">
                    <Award className="h-5 w-5 sm:h-6 sm:w-6 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-[10px] sm:text-xs text-amber-600 font-semibold uppercase">Mejor Vendedor del Mes</p>
                    <p className="text-sm sm:text-lg font-bold text-gray-900">{mejorVendedor.nombre_completo}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:gap-3 mt-3 sm:mt-4">
                  <div className="bg-white/60 rounded-lg p-2 text-center">
                    <p className="text-sm sm:text-lg font-bold text-emerald-600">{formatCurrency(mejorVendedor.ventasTotalMes)}</p>
                    <p className="text-[10px] sm:text-xs text-gray-600">Ventas Mes</p>
                  </div>
                  <div className="bg-white/60 rounded-lg p-2 text-center">
                    <p className="text-sm sm:text-lg font-bold text-indigo-600">{mejorVendedor.pedidosMes}</p>
                    <p className="text-[10px] sm:text-xs text-gray-600">Pedidos</p>
                  </div>
                </div>
              </Card>
            )}

            {/* Top 5 Clientes */}
            <Card padding="sm">
              <h3 className="text-xs sm:text-sm font-semibold text-gray-700 mb-2 sm:mb-3 flex items-center gap-2">
                <UserCheck className="h-3 w-3 sm:h-4 sm:w-4 text-emerald-600" />
                Top 5 Clientes (Mes)
              </h3>
              <div className="space-y-1.5 sm:space-y-2">
                {topClientes.length === 0 ? (
                  <p className="text-xs sm:text-sm text-gray-500 text-center py-4">Sin datos</p>
                ) : (
                  topClientes.map((cliente, i) => (
                    <div key={i} className="flex items-center justify-between text-xs sm:text-sm">
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        <span className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-gray-100 flex items-center justify-center text-[10px] sm:text-xs font-bold text-gray-600">
                          {i + 1}
                        </span>
                        <span className="truncate max-w-[80px] sm:max-w-[120px]">{cliente.nombre}</span>
                      </div>
                      <span className="font-semibold text-emerald-600">{formatCurrency(cliente.totalVentas)}</span>
                    </div>
                  ))
                )}
              </div>
            </Card>

            {/* Top 5 Productos */}
            <Card padding="sm">
              <h3 className="text-xs sm:text-sm font-semibold text-gray-700 mb-2 sm:mb-3 flex items-center gap-2">
                <Package className="h-3 w-3 sm:h-4 sm:w-4 text-purple-600" />
                Top 5 Productos
              </h3>
              <div className="space-y-1.5 sm:space-y-2">
                {topProductos.length === 0 ? (
                  <p className="text-xs sm:text-sm text-gray-500 text-center py-4">Sin datos</p>
                ) : (
                  topProductos.map((producto, i) => (
                    <div key={i} className="flex items-center justify-between text-xs sm:text-sm">
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        <span className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-gray-100 flex items-center justify-center text-[10px] sm:text-xs font-bold text-gray-600">
                          {i + 1}
                        </span>
                        <span className="truncate max-w-[80px] sm:max-w-[120px]">{producto.nombre}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-semibold text-purple-600">{formatCurrency(producto.total)}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>

          {/* Tabla de Vendedores */}
          <Card padding="sm">
            <h2 className="text-sm sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4 flex items-center gap-2">
              <BarChart3 className="h-4 w-4 sm:h-5 sm:w-5 text-indigo-600" />
              Ranking de Vendedores
              <Badge variant="blue" className="ml-2 text-[10px] sm:text-xs">{filteredVendedores.length} vendedores</Badge>
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
                    <th className="text-center py-2 sm:py-3 px-2 sm:px-3 text-[10px] sm:text-xs font-bold text-gray-600 uppercase">Ped. Mes</th>
                    <th className="text-right py-2 sm:py-3 px-2 sm:px-3 text-[10px] sm:text-xs font-bold text-gray-600 uppercase">Ventas Mes</th>
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
                        <span className="text-xs sm:text-sm font-bold text-indigo-600">{vendedor.pedidosMes}</span>
                      </td>
                      <td className="text-right py-2 sm:py-3 px-2 sm:px-3">
                        <span className="text-xs sm:text-sm font-bold text-emerald-600">
                          {formatCurrency(vendedor.ventasTotalMes)}
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
                      {filteredVendedores.reduce((sum, v) => sum + v.pedidosMes, 0)}
                    </td>
                    <td className="text-right py-2 sm:py-3 px-2 sm:px-3 text-emerald-700 text-xs sm:text-sm">
                      {formatCurrency(filteredVendedores.reduce((sum, v) => sum + v.ventasTotalMes, 0))}
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
                {/* Clientes */}
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

                {/* Visitas */}
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

                {/* Pedidos */}
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
                      <span className="text-gray-600">Semana</span>
                      <span className="font-medium">{filteredVendedores[0].pedidosSemana}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Mes</span>
                      <Badge variant="blue" className="text-[10px]">{filteredVendedores[0].pedidosMes}</Badge>
                    </div>
                  </div>
                </div>

                {/* Ventas */}
                <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-xl p-3 sm:p-4 border border-emerald-200">
                  <h4 className="text-[10px] sm:text-sm font-semibold text-emerald-700 mb-2 sm:mb-3 flex items-center gap-1 sm:gap-2">
                    <DollarSign className="h-3 w-3 sm:h-4 sm:w-4" />
                    Ventas
                  </h4>
                  <div className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Hoy</span>
                      <span className="font-semibold text-emerald-600">{formatCurrency(filteredVendedores[0].ventasTotalHoy)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Semana</span>
                      <span className="font-semibold text-emerald-600">{formatCurrency(filteredVendedores[0].ventasTotalSemana)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Mes</span>
                      <span className="font-bold text-emerald-700">{formatCurrency(filteredVendedores[0].ventasTotalMes)}</span>
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

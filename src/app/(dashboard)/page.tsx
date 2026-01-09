'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Calendar,
  Users,
  ShoppingCart,
  TrendingUp,
  Clock,
  AlertTriangle,
  Plus,
  ArrowRight,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  MapPin,
  Phone,
} from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { getVisitStats, getTodayVisits, getPendingVisits, getVisitsByDate } from '@/lib/services/visits';
import { getOrderStats, getTodayOrders, getOrdersByDate } from '@/lib/services/orders';
import { getCustomerStats } from '@/lib/services/customers';
import { formatTime, formatDate, formatCurrency, visitStatusLabels, orderStatusLabels } from '@/lib/utils';
import { format, addDays, subDays, isToday } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Visit } from '@/lib/services/visits';
import type { Order } from '@/lib/services/orders';

interface Stats {
  visits: {
    today: number;
    todayCompleted: number;
    pending: number;
    weekTotal: number;
    weekCompleted: number;
  };
  orders: {
    todayCount: number;
    todayTotal: number;
    weekCount: number;
    weekTotal: number;
  };
  customers: {
    total: number;
    clientes: number;
    prospectos: number;
  };
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [todayVisits, setTodayVisits] = useState<Visit[]>([]);
  const [pendingVisits, setPendingVisits] = useState<Visit[]>([]);
  const [todayOrders, setTodayOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  // Resumen del día
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [dayVisits, setDayVisits] = useState<Visit[]>([]);
  const [dayOrders, setDayOrders] = useState<Order[]>([]);
  const [loadingDay, setLoadingDay] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    loadDayData(selectedDate);
  }, [selectedDate]);

  const loadData = async () => {
    try {
      const [visitStats, orderStats, customerStats, visits, pending, orders] = await Promise.all([
        getVisitStats(),
        getOrderStats(),
        getCustomerStats(),
        getTodayVisits(),
        getPendingVisits(),
        getTodayOrders(),
      ]);

      setStats({
        visits: visitStats,
        orders: orderStats,
        customers: customerStats,
      });
      setTodayVisits(visits);
      setPendingVisits(pending);
      setTodayOrders(orders);
    } catch (error) {
      console.error('Error cargando dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadDayData = async (date: Date) => {
    setLoadingDay(true);
    try {
      const dateStr = format(date, 'yyyy-MM-dd');
      const [visits, orders] = await Promise.all([
        getVisitsByDate(dateStr),
        getOrdersByDate(dateStr),
      ]);
      setDayVisits(visits);
      setDayOrders(orders);
    } catch (error) {
      console.error('Error cargando datos del día:', error);
    } finally {
      setLoadingDay(false);
    }
  };

  const goToPreviousDay = () => setSelectedDate(subDays(selectedDate, 1));
  const goToNextDay = () => setSelectedDate(addDays(selectedDate, 1));
  const goToToday = () => setSelectedDate(new Date());

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Cargando dashboard...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 md:space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 text-sm md:text-base mt-1">Resumen de tu actividad</p>
        </div>
        <div className="flex flex-wrap gap-2 md:gap-3">
          <Link href="/calendario/nueva" className="flex-1 md:flex-none">
            <Button icon={<Plus className="h-4 w-4" />} className="w-full md:w-auto">
              <span className="hidden sm:inline">Nueva</span> Visita
            </Button>
          </Link>
          <Link href="/pedidos/nuevo" className="flex-1 md:flex-none">
            <Button variant="secondary" icon={<ShoppingCart className="h-4 w-4" />} className="w-full md:w-auto">
              <span className="hidden sm:inline">Nuevo</span> Pedido
            </Button>
          </Link>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <Card className="animate-fade-in stagger-1" padding="sm">
          <div className="flex items-center gap-3 md:gap-4">
            <div className="p-2 md:p-3 rounded-xl bg-indigo-50 shrink-0">
              <Calendar className="h-5 w-5 md:h-6 md:w-6 text-indigo-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xs md:text-sm text-gray-500 truncate">Visitas Hoy</p>
              <p className="text-xl md:text-2xl font-bold text-gray-900">{stats?.visits.today || 0}</p>
              <p className="text-[10px] md:text-xs text-emerald-600">
                {stats?.visits.todayCompleted || 0} completadas
              </p>
            </div>
          </div>
        </Card>

        <Card className="animate-fade-in stagger-2" padding="sm">
          <div className="flex items-center gap-3 md:gap-4">
            <div className="p-2 md:p-3 rounded-xl bg-amber-50 shrink-0">
              <AlertTriangle className="h-5 w-5 md:h-6 md:w-6 text-amber-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xs md:text-sm text-gray-500 truncate">Pendientes</p>
              <p className="text-xl md:text-2xl font-bold text-gray-900">{stats?.visits.pending || 0}</p>
              <p className="text-[10px] md:text-xs text-amber-600">Requieren atención</p>
            </div>
          </div>
        </Card>

        <Card className="animate-fade-in stagger-3" padding="sm">
          <div className="flex items-center gap-3 md:gap-4">
            <div className="p-2 md:p-3 rounded-xl bg-emerald-50 shrink-0">
              <ShoppingCart className="h-5 w-5 md:h-6 md:w-6 text-emerald-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xs md:text-sm text-gray-500 truncate">Pedidos Hoy</p>
              <p className="text-xl md:text-2xl font-bold text-gray-900">{stats?.orders.todayCount || 0}</p>
              <p className="text-[10px] md:text-xs text-emerald-600 truncate">
                {formatCurrency(stats?.orders.todayTotal || 0)}
              </p>
            </div>
          </div>
        </Card>

        <Card className="animate-fade-in stagger-4" padding="sm">
          <div className="flex items-center gap-3 md:gap-4">
            <div className="p-2 md:p-3 rounded-xl bg-purple-50 shrink-0">
              <TrendingUp className="h-5 w-5 md:h-6 md:w-6 text-purple-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xs md:text-sm text-gray-500 truncate">Semana</p>
              <p className="text-xl md:text-2xl font-bold text-gray-900">{stats?.orders.weekCount || 0}</p>
              <p className="text-[10px] md:text-xs text-purple-600 truncate">
                {formatCurrency(stats?.orders.weekTotal || 0)}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Resumen del Día con Selector */}
      <Card className="animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Calendar className="h-5 w-5 text-indigo-500" />
            Resumen del Día
          </h2>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={goToPreviousDay}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <button
              onClick={goToToday}
              className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors min-w-[140px] text-center"
            >
              {isToday(selectedDate) ? 'Hoy' : format(selectedDate, "EEE d 'de' MMM", { locale: es })}
            </button>
            <Button variant="ghost" size="sm" onClick={goToNextDay}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {loadingDay ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-gray-400">Cargando...</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Visitas del día */}
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-3 flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Visitas ({dayVisits.length})
              </h3>
              {dayVisits.length === 0 ? (
                <div className="text-center py-8 bg-gray-50 rounded-xl">
                  <Calendar className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">Sin visitas programadas</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                  {dayVisits.map((visit) => (
                    <Link
                      key={visit.id}
                      href={`/calendario/${visit.id}`}
                      className="block p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors border border-transparent hover:border-gray-200"
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-sm font-bold text-indigo-600 shrink-0">
                            {formatTime(visit.scheduled_at)}
                          </span>
                          <span className="font-medium text-gray-900 truncate">
                            {visit.customer?.nombre || 'Cliente'}
                          </span>
                        </div>
                        <Badge
                          variant={
                            visit.status === 'completada' ? 'green' :
                            visit.status === 'programada' ? 'blue' :
                            visit.status === 'cancelada' ? 'gray' : 'yellow'
                          }
                        >
                          {visitStatusLabels[visit.status]}
                        </Badge>
                      </div>
                      
                      {visit.objetivo && (
                        <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                          {visit.objetivo}
                        </p>
                      )}

                      {/* Comentarios/Resultado si está completada */}
                      {visit.status === 'completada' && visit.resultado && (
                        <div className="mt-2 p-2 bg-emerald-50 rounded-lg">
                          <div className="flex items-start gap-2">
                            <MessageSquare className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                            <p className="text-sm text-emerald-700 line-clamp-2">
                              {visit.resultado}
                            </p>
                          </div>
                        </div>
                      )}

                      {visit.observaciones && (
                        <div className="mt-2 p-2 bg-blue-50 rounded-lg">
                          <div className="flex items-start gap-2">
                            <MessageSquare className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                            <p className="text-sm text-blue-700 line-clamp-2">
                              {visit.observaciones}
                            </p>
                          </div>
                        </div>
                      )}

                      {visit.customer?.direccion && (
                        <div className="flex items-center gap-1.5 mt-2 text-xs text-gray-500">
                          <MapPin className="h-3 w-3" />
                          <span className="truncate">{visit.customer.direccion}</span>
                        </div>
                      )}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Pedidos del día */}
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-3 flex items-center gap-2">
                <ShoppingCart className="h-4 w-4" />
                Pedidos ({dayOrders.length})
                {dayOrders.length > 0 && (
                  <span className="text-emerald-600">
                    - {formatCurrency(dayOrders.reduce((sum, o) => sum + (o.total || 0), 0))}
                  </span>
                )}
              </h3>
              {dayOrders.length === 0 ? (
                <div className="text-center py-8 bg-gray-50 rounded-xl">
                  <ShoppingCart className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">Sin pedidos</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                  {dayOrders.map((order) => (
                    <Link
                      key={order.id}
                      href={`/pedidos/${order.id}`}
                      className="block p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors border border-transparent hover:border-gray-200"
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 truncate">
                            {order.customer?.nombre || 'Cliente'}
                          </p>
                          {order.customer?.telefono && (
                            <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
                              <Phone className="h-3 w-3" />
                              {order.customer.telefono}
                            </div>
                          )}
                        </div>
                        <Badge
                          variant={
                            order.status === 'entregado' ? 'green' :
                            order.status === 'confirmado' ? 'blue' :
                            order.status === 'cancelado' ? 'red' : 'gray'
                          }
                        >
                          {orderStatusLabels[order.status]}
                        </Badge>
                      </div>
                      
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-lg font-bold text-emerald-600">
                          {formatCurrency(order.total)}
                        </span>
                        {order.total_bonificado > 0 && (
                          <span className="text-xs text-amber-600">
                            Bonif: {formatCurrency(order.total_bonificado)}
                          </span>
                        )}
                      </div>

                      {order.observacion_general && (
                        <div className="mt-2 p-2 bg-gray-100 rounded-lg">
                          <p className="text-xs text-gray-600 line-clamp-2">
                            {order.observacion_general}
                          </p>
                        </div>
                      )}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Card>

      {/* Visitas Pendientes (Vencidas) */}
      {pendingVisits.length > 0 && (
        <Card className="animate-fade-in border-amber-200 bg-amber-50/30">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              <h2 className="text-base md:text-lg font-semibold text-gray-900">
                Visitas Vencidas
              </h2>
              <Badge variant="yellow">{pendingVisits.length}</Badge>
            </div>
          </div>
          <div className="space-y-2 md:space-y-3">
            {pendingVisits.slice(0, 3).map((visit) => (
              <Link
                key={visit.id}
                href={`/calendario/${visit.id}`}
                className="flex items-center justify-between p-3 rounded-xl bg-white border border-amber-100 hover:border-amber-200 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Clock className="h-4 w-4 text-amber-500 shrink-0" />
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 truncate">
                      {visit.customer?.nombre || 'Cliente'}
                    </p>
                    <p className="text-sm text-gray-500 truncate">{visit.objetivo}</p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-gray-400 shrink-0" />
              </Link>
            ))}
          </div>
        </Card>
      )}

      {/* Grid de Visitas y Pedidos de HOY */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        {/* Visitas de Hoy */}
        <Card className="animate-fade-in">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base md:text-lg font-semibold text-gray-900">Agenda de Hoy</h2>
            <Link href="/calendario" className="text-xs md:text-sm text-indigo-600 hover:text-indigo-700 font-medium">
              Ver calendario →
            </Link>
          </div>
          {todayVisits.length === 0 ? (
            <div className="text-center py-6 md:py-8">
              <Calendar className="h-10 w-10 md:h-12 md:w-12 text-gray-200 mx-auto mb-3" />
              <p className="text-sm text-gray-500">No hay visitas programadas para hoy</p>
              <Link href="/calendario/nueva">
                <Button variant="ghost" size="sm" className="mt-3">
                  Programar visita
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-2 md:space-y-3">
              {todayVisits.slice(0, 5).map((visit) => (
                <Link
                  key={visit.id}
                  href={`/calendario/${visit.id}`}
                  className="flex items-center justify-between p-2.5 md:p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-2 md:gap-3 min-w-0">
                    <div className="text-center min-w-[45px] md:min-w-[50px]">
                      <p className="text-sm md:text-lg font-bold text-indigo-600">
                        {formatTime(visit.scheduled_at)}
                      </p>
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 text-sm md:text-base truncate">
                        {visit.customer?.nombre || 'Cliente'}
                      </p>
                      <p className="text-xs md:text-sm text-gray-500 truncate max-w-[150px] md:max-w-[200px]">
                        {visit.objetivo}
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant={
                      visit.status === 'completada' ? 'green' :
                      visit.status === 'programada' ? 'blue' :
                      visit.status === 'cancelada' ? 'gray' : 'yellow'
                    }
                  >
                    <span className="hidden sm:inline">{visitStatusLabels[visit.status]}</span>
                    <span className="sm:hidden">
                      {visit.status === 'completada' ? '✓' : visit.status === 'programada' ? '○' : '!'}
                    </span>
                  </Badge>
                </Link>
              ))}
            </div>
          )}
        </Card>

        {/* Pedidos de Hoy */}
        <Card className="animate-fade-in">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base md:text-lg font-semibold text-gray-900">Pedidos de Hoy</h2>
            <Link href="/pedidos" className="text-xs md:text-sm text-indigo-600 hover:text-indigo-700 font-medium">
              Ver todos →
            </Link>
          </div>
          {todayOrders.length === 0 ? (
            <div className="text-center py-6 md:py-8">
              <ShoppingCart className="h-10 w-10 md:h-12 md:w-12 text-gray-200 mx-auto mb-3" />
              <p className="text-sm text-gray-500">No hay pedidos para hoy</p>
              <Link href="/pedidos/nuevo">
                <Button variant="ghost" size="sm" className="mt-3">
                  Crear pedido
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-2 md:space-y-3">
              {todayOrders.slice(0, 5).map((order) => (
                <Link
                  key={order.id}
                  href={`/pedidos/${order.id}`}
                  className="flex items-center justify-between p-2.5 md:p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-2 md:gap-3 min-w-0">
                    <div className="p-1.5 md:p-2 rounded-lg bg-emerald-100 shrink-0">
                      <ShoppingCart className="h-3.5 w-3.5 md:h-4 md:w-4 text-emerald-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 text-sm md:text-base truncate">
                        {order.customer?.nombre || 'Cliente'}
                      </p>
                      <p className="text-xs md:text-sm text-emerald-600 font-semibold">
                        {formatCurrency(order.total)}
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant={
                      order.status === 'entregado' ? 'green' :
                      order.status === 'confirmado' ? 'blue' :
                      order.status === 'cancelado' ? 'red' : 'gray'
                    }
                  >
                    <span className="hidden sm:inline">{orderStatusLabels[order.status]}</span>
                    <span className="sm:hidden">
                      {order.status === 'entregado' ? '✓' : order.status === 'confirmado' ? '◉' : '○'}
                    </span>
                  </Badge>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
        <Card className="animate-fade-in" padding="sm">
          <div className="flex items-center gap-3 md:gap-4">
            <Users className="h-7 w-7 md:h-8 md:w-8 text-indigo-500 shrink-0" />
            <div className="min-w-0">
              <p className="text-xl md:text-2xl font-bold text-gray-900">{stats?.customers.total || 0}</p>
              <p className="text-xs md:text-sm text-gray-500 truncate">
                {stats?.customers.clientes || 0} clientes · {stats?.customers.prospectos || 0} prospectos
              </p>
            </div>
          </div>
          <Link href="/clientes">
            <Button variant="ghost" size="sm" className="w-full mt-3 md:mt-4">
              Ver Clientes
            </Button>
          </Link>
        </Card>

        <Card className="animate-fade-in" padding="sm">
          <div className="flex items-center gap-3 md:gap-4">
            <CheckCircle className="h-7 w-7 md:h-8 md:w-8 text-emerald-500 shrink-0" />
            <div className="min-w-0">
              <p className="text-xl md:text-2xl font-bold text-gray-900">
                {stats?.visits.weekTotal || 0}
              </p>
              <p className="text-xs md:text-sm text-gray-500 truncate">
                Visitas semana ({stats?.visits.weekCompleted || 0} completadas)
              </p>
            </div>
          </div>
          <Link href="/calendario">
            <Button variant="ghost" size="sm" className="w-full mt-3 md:mt-4">
              Ver Calendario
            </Button>
          </Link>
        </Card>

        <Card className="animate-fade-in" padding="sm">
          <div className="flex items-center gap-3 md:gap-4">
            <TrendingUp className="h-7 w-7 md:h-8 md:w-8 text-purple-500 shrink-0" />
            <div className="min-w-0">
              <p className="text-xl md:text-2xl font-bold text-gray-900 truncate">
                {formatCurrency(stats?.orders.weekTotal || 0)}
              </p>
              <p className="text-xs md:text-sm text-gray-500">
                Ventas semana
              </p>
            </div>
          </div>
          <Link href="/reportes">
            <Button variant="ghost" size="sm" className="w-full mt-3 md:mt-4">
              Ver Reportes
            </Button>
          </Link>
        </Card>
      </div>
    </div>
  );
}

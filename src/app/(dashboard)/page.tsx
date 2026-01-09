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
} from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { getVisitStats, getTodayVisits, getPendingVisits } from '@/lib/services/visits';
import { getOrderStats, getTodayOrders } from '@/lib/services/orders';
import { getCustomerStats } from '@/lib/services/customers';
import { formatTime, formatCurrency, visitStatusLabels, orderStatusLabels } from '@/lib/utils';
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

  useEffect(() => {
    loadData();
  }, []);

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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Cargando dashboard...</div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 mt-1">Resumen de tu actividad</p>
        </div>
        <div className="flex gap-3">
          <Link href="/calendario/nueva">
            <Button icon={<Plus className="h-4 w-4" />}>Nueva Visita</Button>
          </Link>
          <Link href="/pedidos/nuevo">
            <Button variant="secondary" icon={<ShoppingCart className="h-4 w-4" />}>
              Nuevo Pedido
            </Button>
          </Link>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="animate-fade-in stagger-1">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-indigo-50">
              <Calendar className="h-6 w-6 text-indigo-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Visitas Hoy</p>
              <p className="text-2xl font-bold text-gray-900">{stats?.visits.today || 0}</p>
              <p className="text-xs text-emerald-600">
                {stats?.visits.todayCompleted || 0} completadas
              </p>
            </div>
          </div>
        </Card>

        <Card className="animate-fade-in stagger-2">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-amber-50">
              <AlertTriangle className="h-6 w-6 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Visitas Pendientes</p>
              <p className="text-2xl font-bold text-gray-900">{stats?.visits.pending || 0}</p>
              <p className="text-xs text-amber-600">Requieren atención</p>
            </div>
          </div>
        </Card>

        <Card className="animate-fade-in stagger-3">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-emerald-50">
              <ShoppingCart className="h-6 w-6 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Pedidos Hoy</p>
              <p className="text-2xl font-bold text-gray-900">{stats?.orders.todayCount || 0}</p>
              <p className="text-xs text-emerald-600">
                {formatCurrency(stats?.orders.todayTotal || 0)}
              </p>
            </div>
          </div>
        </Card>

        <Card className="animate-fade-in stagger-4">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-purple-50">
              <TrendingUp className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Pedidos Semana</p>
              <p className="text-2xl font-bold text-gray-900">{stats?.orders.weekCount || 0}</p>
              <p className="text-xs text-purple-600">
                {formatCurrency(stats?.orders.weekTotal || 0)}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Visitas Pendientes (Vencidas) */}
      {pendingVisits.length > 0 && (
        <Card className="animate-fade-in border-amber-200 bg-amber-50/30">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              <h2 className="text-lg font-semibold text-gray-900">
                Visitas Vencidas
              </h2>
              <Badge variant="yellow">{pendingVisits.length}</Badge>
            </div>
          </div>
          <div className="space-y-3">
            {pendingVisits.slice(0, 3).map((visit) => (
              <Link
                key={visit.id}
                href={`/calendario/${visit.id}`}
                className="flex items-center justify-between p-3 rounded-xl bg-white border border-amber-100 hover:border-amber-200 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Clock className="h-4 w-4 text-amber-500" />
                  <div>
                    <p className="font-medium text-gray-900">
                      {visit.customer?.nombre || 'Cliente'}
                    </p>
                    <p className="text-sm text-gray-500">{visit.objetivo}</p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-gray-400" />
              </Link>
            ))}
          </div>
        </Card>
      )}

      {/* Grid de Visitas y Pedidos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Visitas de Hoy */}
        <Card className="animate-fade-in">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Agenda de Hoy</h2>
            <Link href="/calendario" className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">
              Ver calendario →
            </Link>
          </div>
          {todayVisits.length === 0 ? (
            <div className="text-center py-8">
              <Calendar className="h-12 w-12 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-500">No hay visitas programadas para hoy</p>
              <Link href="/calendario/nueva">
                <Button variant="ghost" size="sm" className="mt-3">
                  Programar visita
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {todayVisits.slice(0, 5).map((visit) => (
                <Link
                  key={visit.id}
                  href={`/calendario/${visit.id}`}
                  className="flex items-center justify-between p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="text-center min-w-[50px]">
                      <p className="text-lg font-bold text-indigo-600">
                        {formatTime(visit.scheduled_at)}
                      </p>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">
                        {visit.customer?.nombre || 'Cliente'}
                      </p>
                      <p className="text-sm text-gray-500 truncate max-w-[200px]">
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
                    {visitStatusLabels[visit.status]}
                  </Badge>
                </Link>
              ))}
            </div>
          )}
        </Card>

        {/* Pedidos de Hoy */}
        <Card className="animate-fade-in">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Pedidos de Hoy</h2>
            <Link href="/pedidos" className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">
              Ver todos →
            </Link>
          </div>
          {todayOrders.length === 0 ? (
            <div className="text-center py-8">
              <ShoppingCart className="h-12 w-12 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-500">No hay pedidos para hoy</p>
              <Link href="/pedidos/nuevo">
                <Button variant="ghost" size="sm" className="mt-3">
                  Crear pedido
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {todayOrders.slice(0, 5).map((order) => (
                <Link
                  key={order.id}
                  href={`/pedidos/${order.id}`}
                  className="flex items-center justify-between p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-emerald-100">
                      <ShoppingCart className="h-4 w-4 text-emerald-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">
                        {order.customer?.nombre || 'Cliente'}
                      </p>
                      <p className="text-sm text-emerald-600 font-semibold">
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
                    {orderStatusLabels[order.status]}
                  </Badge>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="animate-fade-in">
          <div className="flex items-center gap-4">
            <Users className="h-8 w-8 text-indigo-500" />
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats?.customers.total || 0}</p>
              <p className="text-sm text-gray-500">
                {stats?.customers.clientes || 0} clientes · {stats?.customers.prospectos || 0} prospectos
              </p>
            </div>
          </div>
          <Link href="/clientes">
            <Button variant="ghost" size="sm" className="w-full mt-4">
              Ver Clientes
            </Button>
          </Link>
        </Card>

        <Card className="animate-fade-in">
          <div className="flex items-center gap-4">
            <CheckCircle className="h-8 w-8 text-emerald-500" />
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {stats?.visits.weekTotal || 0}
              </p>
              <p className="text-sm text-gray-500">
                Visitas esta semana ({stats?.visits.weekCompleted || 0} completadas)
              </p>
            </div>
          </div>
          <Link href="/calendario">
            <Button variant="ghost" size="sm" className="w-full mt-4">
              Ver Calendario
            </Button>
          </Link>
        </Card>

        <Card className="animate-fade-in">
          <div className="flex items-center gap-4">
            <TrendingUp className="h-8 w-8 text-purple-500" />
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(stats?.orders.weekTotal || 0)}
              </p>
              <p className="text-sm text-gray-500">
                Total ventas esta semana
              </p>
            </div>
          </div>
          <Link href="/reportes">
            <Button variant="ghost" size="sm" className="w-full mt-4">
              Ver Reportes
            </Button>
          </Link>
        </Card>
      </div>
    </div>
  );
}

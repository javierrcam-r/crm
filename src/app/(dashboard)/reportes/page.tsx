'use client';

import { useEffect, useState } from 'react';
import {
  Calendar,
  FileDown,
  TrendingUp,
  Package,
  Users,
  ShoppingCart,
} from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Badge from '@/components/ui/Badge';
import {
  getDailySummary,
  getTopProducts,
  getOrders,
  type Order,
} from '@/lib/services/orders';
import { getCustomers, type Customer } from '@/lib/services/customers';
import {
  formatDate,
  formatCurrency,
  orderStatusLabels,
  exportToCSV,
} from '@/lib/utils';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';
import toast from 'react-hot-toast';

interface TopProduct {
  id: string;
  name: string;
  sku: string;
  category: string;
  totalQty: number;
  totalAmount: number;
}

export default function ReportesPage() {
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [dateFrom, setDateFrom] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [dateTo, setDateTo] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  
  const [dailyOrders, setDailyOrders] = useState<Order[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [periodOrders, setPeriodOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    loadDailySummary();
  }, [selectedDate]);

  useEffect(() => {
    loadPeriodData();
  }, [dateFrom, dateTo]);

  const loadData = async () => {
    try {
      const [customersData, topProductsData] = await Promise.all([
        getCustomers(),
        getTopProducts(30),
      ]);
      setCustomers(customersData);
      setTopProducts(topProductsData);
    } catch (error) {
      console.error('Error cargando datos:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadDailySummary = async () => {
    try {
      const data = await getDailySummary(selectedDate);
      setDailyOrders(data);
    } catch (error) {
      console.error('Error cargando resumen diario:', error);
    }
  };

  const loadPeriodData = async () => {
    try {
      const data = await getOrders({
        date_from: dateFrom,
        date_to: dateTo,
      });
      setPeriodOrders(data);
    } catch (error) {
      console.error('Error cargando datos del período:', error);
    }
  };

  // Daily stats
  const dailyTotalAmount = dailyOrders.reduce((sum, o) => sum + o.total, 0);
  const dailyTotalItems = dailyOrders.reduce(
    (sum, o) => sum + (o.items?.reduce((s, i) => s + i.qty, 0) || 0),
    0
  );

  // Period stats
  const periodTotalAmount = periodOrders.reduce((sum, o) => sum + o.total, 0);
  const periodTotalOrders = periodOrders.length;
  const periodDelivered = periodOrders.filter((o) => o.status === 'entregado').length;

  // Export functions
  const exportDailyOrders = () => {
    if (dailyOrders.length === 0) {
      toast.error('No hay datos para exportar');
      return;
    }

    const data = dailyOrders.map((order) => ({
      fecha: formatDate(order.order_date),
      cliente: order.customer?.nombre || '',
      estado: orderStatusLabels[order.status],
      subtotal: order.subtotal,
      bonificado: order.total_bonificado,
      total: order.total,
      observacion: order.observacion_general || '',
    }));

    exportToCSV(data, `pedidos_${selectedDate}`, [
      { key: 'fecha', label: 'Fecha' },
      { key: 'cliente', label: 'Cliente' },
      { key: 'estado', label: 'Estado' },
      { key: 'subtotal', label: 'Subtotal' },
      { key: 'bonificado', label: 'Bonificado' },
      { key: 'total', label: 'Total' },
      { key: 'observacion', label: 'Observación' },
    ]);

    toast.success('Archivo exportado');
  };

  const exportPeriodOrders = () => {
    if (periodOrders.length === 0) {
      toast.error('No hay datos para exportar');
      return;
    }

    const data = periodOrders.map((order) => ({
      fecha: formatDate(order.order_date),
      cliente: order.customer?.nombre || '',
      estado: orderStatusLabels[order.status],
      subtotal: order.subtotal,
      bonificado: order.total_bonificado,
      total: order.total,
      observacion: order.observacion_general || '',
    }));

    exportToCSV(data, `pedidos_${dateFrom}_a_${dateTo}`, [
      { key: 'fecha', label: 'Fecha' },
      { key: 'cliente', label: 'Cliente' },
      { key: 'estado', label: 'Estado' },
      { key: 'subtotal', label: 'Subtotal' },
      { key: 'bonificado', label: 'Bonificado' },
      { key: 'total', label: 'Total' },
      { key: 'observacion', label: 'Observación' },
    ]);

    toast.success('Archivo exportado');
  };

  const exportTopProducts = () => {
    if (topProducts.length === 0) {
      toast.error('No hay datos para exportar');
      return;
    }

    exportToCSV(
      topProducts.map((p) => ({
        sku: p.sku,
        producto: p.name,
        categoria: p.category,
        cantidad_vendida: p.totalQty,
        monto_total: p.totalAmount,
      })),
      'productos_mas_vendidos',
      [
        { key: 'sku', label: 'SKU' },
        { key: 'producto', label: 'Producto' },
        { key: 'categoria', label: 'Categoría' },
        { key: 'cantidad_vendida', label: 'Cantidad Vendida' },
        { key: 'monto_total', label: 'Monto Total' },
      ]
    );

    toast.success('Archivo exportado');
  };

  const exportCustomers = () => {
    if (customers.length === 0) {
      toast.error('No hay datos para exportar');
      return;
    }

    exportToCSV(
      customers.map((c) => ({
        nombre: c.nombre,
        tipo: c.tipo,
        telefono: c.telefono || '',
        email: c.email || '',
        direccion: c.direccion || '',
        zona: c.zona || '',
        ciudad: c.ciudad || '',
        etapa: c.etapa_embudo,
        etiquetas: c.etiquetas?.join(', ') || '',
      })),
      'clientes',
      [
        { key: 'nombre', label: 'Nombre' },
        { key: 'tipo', label: 'Tipo' },
        { key: 'telefono', label: 'Teléfono' },
        { key: 'email', label: 'Email' },
        { key: 'direccion', label: 'Dirección' },
        { key: 'zona', label: 'Zona' },
        { key: 'ciudad', label: 'Ciudad' },
        { key: 'etapa', label: 'Etapa' },
        { key: 'etiquetas', label: 'Etiquetas' },
      ]
    );

    toast.success('Archivo exportado');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Cargando reportes...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Reportes</h1>
        <p className="text-gray-500 mt-1">
          Analiza tus ventas y exporta datos
        </p>
      </div>

      {/* Quick Exports */}
      <Card>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Exportar Datos
        </h2>
        <div className="flex flex-wrap gap-3">
          <Button
            variant="secondary"
            icon={<FileDown className="h-4 w-4" />}
            onClick={exportCustomers}
          >
            Clientes (CSV)
          </Button>
          <Button
            variant="secondary"
            icon={<FileDown className="h-4 w-4" />}
            onClick={exportTopProducts}
          >
            Productos Más Vendidos (CSV)
          </Button>
        </div>
      </Card>

      {/* Resumen Diario */}
      <Card>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <h2 className="text-lg font-semibold text-gray-900">
            Resumen del Día
          </h2>
          <div className="flex items-center gap-3">
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-auto"
            />
            <Button
              variant="secondary"
              size="sm"
              icon={<FileDown className="h-4 w-4" />}
              onClick={exportDailyOrders}
            >
              Exportar
            </Button>
          </div>
        </div>

        {/* Daily Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="p-4 rounded-lg bg-indigo-50 text-center">
            <ShoppingCart className="h-6 w-6 text-indigo-600 mx-auto mb-2" />
            <p className="text-2xl font-bold text-gray-900">
              {dailyOrders.length}
            </p>
            <p className="text-sm text-gray-500">Pedidos</p>
          </div>
          <div className="p-4 rounded-lg bg-emerald-50 text-center">
            <TrendingUp className="h-6 w-6 text-emerald-600 mx-auto mb-2" />
            <p className="text-2xl font-bold text-emerald-600">
              {formatCurrency(dailyTotalAmount)}
            </p>
            <p className="text-sm text-gray-500">Total Ventas</p>
          </div>
          <div className="p-4 rounded-lg bg-purple-50 text-center">
            <Package className="h-6 w-6 text-purple-600 mx-auto mb-2" />
            <p className="text-2xl font-bold text-gray-900">
              {dailyTotalItems}
            </p>
            <p className="text-sm text-gray-500">Productos Vendidos</p>
          </div>
        </div>

        {/* Daily Orders List */}
        {dailyOrders.length === 0 ? (
          <p className="text-center text-gray-500 py-8">
            No hay pedidos para este día
          </p>
        ) : (
          <div className="space-y-3">
            {dailyOrders.map((order) => (
              <div
                key={order.id}
                className="flex items-center justify-between p-3 rounded-lg bg-gray-50"
              >
                <div>
                  <p className="font-medium text-gray-900">
                    {order.customer?.nombre}
                  </p>
                  <p className="text-sm text-gray-500">
                    {order.items?.length || 0} productos
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-emerald-600">
                    {formatCurrency(order.total)}
                  </p>
                  <Badge
                    variant={
                      order.status === 'entregado'
                        ? 'green'
                        : order.status === 'confirmado'
                        ? 'blue'
                        : 'gray'
                    }
                  >
                    {orderStatusLabels[order.status]}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Resumen por Período */}
      <Card>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <h2 className="text-lg font-semibold text-gray-900">
            Resumen por Período
          </h2>
          <div className="flex items-center gap-3">
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-auto"
            />
            <span className="text-gray-500">a</span>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-auto"
            />
            <Button
              variant="secondary"
              size="sm"
              icon={<FileDown className="h-4 w-4" />}
              onClick={exportPeriodOrders}
            >
              Exportar
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-lg bg-gray-50 text-center">
            <p className="text-2xl font-bold text-gray-900">
              {periodTotalOrders}
            </p>
            <p className="text-sm text-gray-500">Total Pedidos</p>
          </div>
          <div className="p-4 rounded-lg bg-emerald-50 text-center">
            <p className="text-2xl font-bold text-emerald-600">
              {formatCurrency(periodTotalAmount)}
            </p>
            <p className="text-sm text-gray-500">Total Ventas</p>
          </div>
          <div className="p-4 rounded-lg bg-gray-50 text-center">
            <p className="text-2xl font-bold text-gray-900">
              {periodDelivered}
            </p>
            <p className="text-sm text-gray-500">Entregados</p>
          </div>
          <div className="p-4 rounded-lg bg-gray-50 text-center">
            <p className="text-2xl font-bold text-gray-900">
              {periodTotalOrders > 0
                ? formatCurrency(periodTotalAmount / periodTotalOrders)
                : formatCurrency(0)}
            </p>
            <p className="text-sm text-gray-500">Promedio por Pedido</p>
          </div>
        </div>
      </Card>

      {/* Productos Más Vendidos */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Productos Más Vendidos (30 días)
          </h2>
          <Button
            variant="ghost"
            size="sm"
            icon={<FileDown className="h-4 w-4" />}
            onClick={exportTopProducts}
          >
            Exportar
          </Button>
        </div>

        {topProducts.length === 0 ? (
          <p className="text-center text-gray-500 py-8">
            No hay datos de productos vendidos
          </p>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Producto</th>
                  <th>Categoría</th>
                  <th className="text-right">Cantidad</th>
                  <th className="text-right">Monto Total</th>
                </tr>
              </thead>
              <tbody>
                {topProducts.slice(0, 10).map((product, index) => (
                  <tr key={product.id}>
                    <td>
                      <span
                        className={
                          index < 3
                            ? 'font-bold text-amber-600'
                            : 'text-gray-400'
                        }
                      >
                        {index + 1}
                      </span>
                    </td>
                    <td>
                      <div>
                        <p className="font-medium text-gray-900">
                          {product.name}
                        </p>
                        <p className="text-sm text-gray-500">{product.sku}</p>
                      </div>
                    </td>
                    <td>
                      <Badge variant="blue">{product.category}</Badge>
                    </td>
                    <td className="text-right">
                      <span className="font-semibold text-gray-900">
                        {product.totalQty}
                      </span>
                    </td>
                    <td className="text-right">
                      <span className="font-semibold text-emerald-600">
                        {formatCurrency(product.totalAmount)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

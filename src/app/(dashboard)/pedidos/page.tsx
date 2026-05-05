'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Plus,
  Search,
  Filter,
  ShoppingCart,
  Eye,
  Download,
} from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Badge from '@/components/ui/Badge';
import EmptyState from '@/components/ui/EmptyState';
import { getOrders, getOrder, type Order } from '@/lib/services/orders';
import { fuzzySearch } from '@/lib/search';
import VoiceSearch from '@/components/ui/VoiceSearch';
import {
  formatDate,
  formatCurrency,
  orderStatusLabels,
  cn,
} from '@/lib/utils';
import type { OrderStatus } from '@/types/database';
import { jsPDF } from 'jspdf';
import toast from 'react-hot-toast';

export default function PedidosPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    loadOrders();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadOrders();
    }, 300);
    return () => clearTimeout(timer);
  }, [filterStatus, filterDateFrom, filterDateTo]);

  const loadOrders = async () => {
    try {
      const data = await getOrders({
        status: (filterStatus as OrderStatus) || undefined,
        date_from: filterDateFrom || undefined,
        date_to: filterDateTo || undefined,
      });
      setOrders(data);
    } catch (error) {
      console.error('Error cargando pedidos:', error);
    } finally {
      setLoading(false);
    }
  };

  const clearFilters = () => {
    setSearch('');
    setFilterStatus('');
    setFilterDateFrom('');
    setFilterDateTo('');
  };

  const filteredOrders = orders.filter((order) => {
    if (!search) return true;
    return fuzzySearch(search, order.customer?.nombre || '') > 0 ||
      fuzzySearch(search, order.id) > 0;
  });

  const statusOptions = [
    { value: 'borrador', label: 'Borrador' },
    { value: 'enviado', label: 'Enviado' },
    { value: 'confirmado', label: 'Confirmado' },
    { value: 'entregado', label: 'Entregado' },
    { value: 'cancelado', label: 'Cancelado' },
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'entregado':
        return 'green';
      case 'confirmado':
        return 'blue';
      case 'enviado':
        return 'purple';
      case 'cancelado':
        return 'red';
      default:
        return 'gray';
    }
  };

  const exportPDF = async (e: React.MouseEvent, orderId: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    try {
      toast.loading('Generando PDF...', { id: 'pdf-export' });
      
      // Obtener datos completos del pedido
      const order = await getOrder(orderId);
      
      if (!order) {
        toast.error('No se pudo cargar el pedido', { id: 'pdf-export' });
        return;
      }

      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      
      // Configuración
      const marginLeft = 20;
      const marginRight = 20;
      const contentWidth = pageWidth - marginLeft - marginRight;
      let y = 25;

      // Encabezado
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.text('Pedido', pageWidth / 2, y, { align: 'center' });
      y += 8;
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100);
      doc.text(formatDate(order.order_date), pageWidth / 2, y, { align: 'center' });
      y += 12;

      // Línea separadora
      doc.setDrawColor(200);
      doc.line(marginLeft, y, pageWidth - marginRight, y);
      y += 10;

      // Cliente
      doc.setFontSize(11);
      doc.setTextColor(0);
      doc.setFont('helvetica', 'bold');
      doc.text('Cliente: ', marginLeft, y);
      doc.setFont('helvetica', 'normal');
      doc.text(order.customer?.nombre || 'Sin nombre', marginLeft + 18, y);
      y += 12;

      // Línea separadora
      doc.setDrawColor(230);
      doc.line(marginLeft, y, pageWidth - marginRight, y);
      y += 8;

      // Tabla de productos - Columnas ajustadas
      const colProducto = marginLeft;
      const colCant = pageWidth - marginRight - 45;
      const colObs = pageWidth - marginRight - 30;
      const productMaxWidth = colCant - colProducto - 10;

      // Encabezados de tabla
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(80);
      doc.text('PRODUCTO', colProducto, y);
      doc.text('CANT.', colCant, y);
      doc.text('OBS.', colObs, y);
      y += 3;
      doc.setDrawColor(50);
      doc.line(marginLeft, y, pageWidth - marginRight, y);
      y += 8;

      // Items
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0);
      doc.setFontSize(10);

      for (const item of order.items || []) {
        // Verificar si necesitamos nueva página
        if (y > 260) {
          doc.addPage();
          y = 25;
        }

        // Nombre del producto completo (con múltiples líneas si es necesario)
        let productName = item.product?.nombre || 'Producto';
        if (item.bonificado) {
          productName += ' (Bonif.)';
        }
        
        // Dividir nombre en múltiples líneas si es muy largo
        const productLines = doc.splitTextToSize(productName, productMaxWidth);
        
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(0);
        doc.text(productLines, colProducto, y);
        
        // Cantidad (centrada en su columna)
        doc.text(item.qty.toString(), colCant + 5, y);
        
        // Observación del item
        const obs = item.observacion_item || '-';
        doc.setFontSize(9);
        doc.setTextColor(80);
        doc.text(obs.substring(0, 15), colObs, y);
        
        // Calcular altura de la fila basada en líneas del producto
        const rowHeight = Math.max(productLines.length * 5, 7) + 5;
        y += rowHeight;
        
        // Si hay observación larga, mostrarla en línea siguiente
        if (item.observacion_item && item.observacion_item.length > 15) {
          doc.setFontSize(8);
          doc.setTextColor(100);
          const fullObs = doc.splitTextToSize('→ ' + item.observacion_item, contentWidth - 10);
          doc.text(fullObs, colProducto + 5, y);
          y += fullObs.length * 4 + 3;
        }
      }

      // Observación general
      if (order.observacion_general) {
        y += 5;
        doc.setDrawColor(230);
        doc.line(marginLeft, y, pageWidth - marginRight, y);
        y += 8;

        doc.setFillColor(249, 249, 249);
        doc.rect(marginLeft, y - 3, contentWidth, 20, 'F');
        doc.setDrawColor(50);
        doc.line(marginLeft, y - 3, marginLeft, y + 17);
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('Observación:', marginLeft + 5, y + 3);
        doc.setFont('helvetica', 'normal');
        const obsGeneral = doc.splitTextToSize(order.observacion_general, contentWidth - 10);
        doc.text(obsGeneral, marginLeft + 5, y + 10);
        y += 25;
      }

      // Footer
      y = doc.internal.pageSize.getHeight() - 15;
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text('CRM Camila Fernández', pageWidth / 2, y, { align: 'center' });

      // Generar nombre del archivo
      const clienteName = (order.customer?.nombre || 'Cliente').replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ ]/g, '');
      const now = new Date();
      const fecha = now.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-');
      const hora = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }).replace(':', '');
      const fileName = `${clienteName} - ${fecha} - ${hora} - vendedor CamilaFernandez.pdf`;

      // Descargar
      doc.save(fileName);
      toast.success('PDF exportado', { id: 'pdf-export' });
    } catch (error) {
      console.error('Error exportando PDF:', error);
      toast.error('Error al exportar PDF', { id: 'pdf-export' });
    }
  };

  // Stats
  const totalOrders = filteredOrders.length;
  const totalAmount = filteredOrders.reduce((sum, o) => sum + o.total, 0);
  const pendingOrders = filteredOrders.filter(
    (o) => o.status === 'borrador' || o.status === 'enviado' || o.status === 'confirmado'
  ).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500 dark:text-gray-400">Cargando pedidos...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">Pedidos</h1>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-300 mt-1">Gestiona los pedidos de tus clientes</p>
        </div>
        <Link href="/pedidos/nuevo" className="w-full sm:w-auto">
          <Button icon={<Plus className="h-4 w-4" />} className="w-full sm:w-auto justify-center">Nuevo Pedido</Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <Card className="text-center">
          <p className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white">{totalOrders}</p>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Total</p>
        </Card>
        <Card className="text-center">
          <p className="text-base sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400 break-words">
            {formatCurrency(totalAmount)}
          </p>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Monto Total</p>
        </Card>
        <Card className="text-center">
          <p className="text-lg sm:text-2xl font-bold text-amber-600 dark:text-amber-400">{pendingOrders}</p>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Pendientes</p>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card padding="sm">
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
          <div className="flex-1 flex items-center gap-2">
            <div className="flex-1">
              <Input
                placeholder="Buscar por cliente..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                icon={<Search className="h-4 w-4" />}
              />
            </div>
            <VoiceSearch onResult={(text) => setSearch(text)} />
          </div>
          <Button
            variant="secondary"
            onClick={() => setShowFilters(!showFilters)}
            icon={<Filter className="h-4 w-4" />}
            className="w-full sm:w-auto justify-center"
          >
            Filtros
          </Button>
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mt-4 pt-4 border-t border-gray-200 dark:border-dark-500">
            <Select
              options={statusOptions}
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              placeholder="Todos los estados"
            />
            <Input
              type="date"
              value={filterDateFrom}
              onChange={(e) => setFilterDateFrom(e.target.value)}
              placeholder="Desde"
            />
            <Input
              type="date"
              value={filterDateTo}
              onChange={(e) => setFilterDateTo(e.target.value)}
              placeholder="Hasta"
            />
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              Limpiar filtros
            </Button>
          </div>
        )}
      </Card>

      {/* Order List */}
      {filteredOrders.length === 0 ? (
        <EmptyState
          icon={ShoppingCart}
          title="No hay pedidos"
          description="Crea tu primer pedido"
          action={{
            label: 'Nuevo Pedido',
            onClick: () => (window.location.href = '/pedidos/nuevo'),
          }}
        />
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((order, index) => (
            <Card
              key={order.id}
              hover
              className={cn(
                'animate-fade-in',
                `stagger-${(index % 5) + 1}`
              )}
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4">
                <Link href={`/pedidos/${order.id}`} className="flex items-center gap-3 sm:gap-4 flex-1 cursor-pointer min-w-0">
                  <div className="p-2.5 sm:p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 flex-shrink-0">
                    <ShoppingCart className="h-5 w-5 sm:h-6 sm:w-6 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-gray-900 dark:text-white truncate">
                      {order.customer?.nombre || 'Cliente'}
                    </p>
                    <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                      {formatDate(order.order_date)}
                    </p>
                    {order.observacion_general && (
                      <p className="text-xs sm:text-sm text-gray-400 dark:text-gray-500 mt-1 truncate max-w-[300px]">
                        {order.observacion_general}
                      </p>
                    )}
                  </div>
                </Link>
                <div className="flex items-center justify-between md:justify-end gap-3 sm:gap-4 flex-wrap">
                  <div className="text-right">
                    <p className="text-base sm:text-xl font-bold text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(order.total)}
                    </p>
                    {order.total_bonificado > 0 && (
                      <p className="text-xs text-amber-600 dark:text-amber-400">
                        Bonif: {formatCurrency(order.total_bonificado)}
                      </p>
                    )}
                  </div>
                  <Badge variant={getStatusBadge(order.status)}>
                    {orderStatusLabels[order.status]}
                  </Badge>
                  <button
                    onClick={(e) => exportPDF(e, order.id)}
                    className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-indigo-600 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
                    title="Exportar PDF"
                  >
                    <Download className="h-4 w-4" />
                    <span className="hidden sm:inline">Export PDF</span>
                  </button>
                  <Link href={`/pedidos/${order.id}`}>
                    <Eye className="h-5 w-5 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 cursor-pointer" />
                  </Link>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

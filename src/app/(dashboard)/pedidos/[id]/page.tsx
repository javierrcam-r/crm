'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  ShoppingCart,
  User,
  Phone,
  MapPin,
  Calendar,
  Gift,
  Trash2,
  Send,
  CheckCircle,
  Truck,
  XCircle,
  FileDown,
  Edit,
} from 'lucide-react';
import jsPDF from 'jspdf';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import {
  getOrder,
  updateOrder,
  deleteOrder,
  type Order,
} from '@/lib/services/orders';
import {
  formatDate,
  formatCurrency,
  formatTime,
  orderStatusLabels,
} from '@/lib/utils';
import toast from 'react-hot-toast';

export default function PedidoDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const orderId = params.id as string;

  useEffect(() => {
    loadOrder();
  }, [orderId]);

  const loadOrder = async () => {
    try {
      const data = await getOrder(orderId);
      setOrder(data);
    } catch (error) {
      console.error('Error cargando pedido:', error);
      toast.error('Error al cargar el pedido');
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (status: string) => {
    setActionLoading(true);
    try {
      await updateOrder(orderId, { status: status as Order['status'] });
      toast.success('Estado actualizado');
      loadOrder();
    } catch (error) {
      console.error('Error actualizando:', error);
      toast.error('Error al actualizar');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    setActionLoading(true);
    try {
      await deleteOrder(orderId);
      toast.success('Pedido eliminado');
      router.push('/pedidos');
    } catch (error) {
      console.error('Error eliminando:', error);
      toast.error('Error al eliminar');
    } finally {
      setActionLoading(false);
      setShowDeleteModal(false);
    }
  };

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

  // Formateo de fecha sin desfase por zona horaria (YYYY-MM-DD)
  const formatOrderDateLocal = (dateInput: string | Date | null | undefined) => {
    if (!dateInput) return '';
    // Si es Date, usar componentes UTC para evitar desfase por timezone
    if (dateInput instanceof Date) {
      const y = dateInput.getUTCFullYear();
      const m = dateInput.getUTCMonth() + 1;
      const d = dateInput.getUTCDate();
      return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
    }
    // Si es string YYYY-MM-DD, formatear sin crear Date con TZ
    const parts = dateInput.split('-').map(Number);
    if (parts.length === 3 && parts.every((n) => !Number.isNaN(n))) {
      const [year, month, day] = parts;
      return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
    }
    return formatDate(dateInput);
  };

  // Para nombre de archivo (yyyy-MM-dd) sin desfase
  const formatOrderDateFile = (dateInput: string | Date | null | undefined) => {
    if (!dateInput) return 'fecha';
    if (dateInput instanceof Date) {
      const y = dateInput.getUTCFullYear();
      const m = dateInput.getUTCMonth() + 1;
      const d = dateInput.getUTCDate();
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
    const parts = (dateInput as string).split('-').map(Number);
    if (parts.length === 3 && parts.every((n) => !Number.isNaN(n))) {
      const [year, month, day] = parts;
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
    // fallback
    return formatDate(dateInput, 'yyyy-MM-dd');
  };

  const exportToPDF = () => {
    if (!order) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    let y = 20;

    // Definir columnas con posiciones absolutas
    const colWidths = { cod: 25, producto: 80, cant: 20, obs: 61 };
    const colPos = {
      cod: margin,
      producto: margin + colWidths.cod,
      cant: margin + colWidths.cod + colWidths.producto,
      obs: margin + colWidths.cod + colWidths.producto + colWidths.cant
    };
    const tableWidth = colWidths.cod + colWidths.producto + colWidths.cant + colWidths.obs;

    // ===== ENCABEZADO =====
    // Línea superior decorativa
    doc.setDrawColor(50, 50, 50);
    doc.setLineWidth(1);
    doc.line(margin, y - 5, margin + tableWidth, y - 5);

    doc.setFontSize(10);
    doc.setTextColor(120, 120, 120);
    doc.setFont('helvetica', 'normal');
    doc.text('PEDIDO', pageWidth / 2, y, { align: 'center' });
    y += 8;

    doc.setFontSize(18);
    doc.setTextColor(30, 30, 30);
    doc.setFont('helvetica', 'bold');
    doc.text(order.customer?.nombre || 'Sin cliente', pageWidth / 2, y, { align: 'center' });
    y += 7;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    let subInfo = formatOrderDateLocal(order.order_date as string);
    if (order.customer?.telefono) {
      subInfo += `   |   Tel: ${order.customer.telefono}`;
    }
    doc.text(subInfo, pageWidth / 2, y, { align: 'center' });
    y += 10;

    // ===== FUNCIÓN PARA DIBUJAR ENCABEZADO DE TABLA =====
    let headerY = 0;
    const drawTableHeader = () => {
      headerY = y;
      // Fondo del encabezado
      doc.setFillColor(45, 45, 45);
      doc.rect(margin, y, tableWidth, 10, 'F');
      
      // Textos del encabezado
      doc.setFontSize(9);
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.text('CÓDIGO', colPos.cod + 3, y + 7);
      doc.text('PRODUCTO', colPos.producto + 3, y + 7);
      doc.text('CANT.', colPos.cant + colWidths.cant / 2, y + 7, { align: 'center' });
      doc.text('OBSERVACIÓN', colPos.obs + 3, y + 7);
      y += 12;
    };

    drawTableHeader();

    // ===== FILAS DE PRODUCTOS =====
    order.items?.forEach((item, index) => {
      const codigo = item.product?.sku || '-';
      const nombre = item.product?.nombre || 'Producto';
      const cantidad = String(item.qty);
      let obs = item.observacion_item || '';
      if (item.bonificado && item.motivo_bonificado) {
        obs = obs ? `${obs} | ${item.motivo_bonificado}` : item.motivo_bonificado;
      }
      if (item.bonificado && !obs) {
        obs = 'Bonificado';
      }
      if (!obs) obs = '-';

      // Calcular altura de fila
      doc.setFontSize(9);
      const nombreLines = doc.splitTextToSize(nombre, colWidths.producto - 6);
      doc.setFontSize(8);
      const obsLines = doc.splitTextToSize(obs, colWidths.obs - 6);
      const maxLines = Math.max(nombreLines.length, obsLines.length, 1);
      const rowHeight = maxLines * 5 + 6;

      // Nueva página si es necesario
      if (y + rowHeight > 270) {
        // Cerrar tabla actual
        doc.setDrawColor(45, 45, 45);
        doc.setLineWidth(0.5);
        doc.rect(margin, headerY, tableWidth, y - headerY);
        // Líneas verticales internas
        doc.line(colPos.producto, headerY, colPos.producto, y);
        doc.line(colPos.cant, headerY, colPos.cant, y);
        doc.line(colPos.obs, headerY, colPos.obs, y);
        
        doc.addPage();
        y = 20;
        drawTableHeader();
      }

      // Fondo alterno
      if (index % 2 === 0) {
        doc.setFillColor(248, 248, 248);
        doc.rect(margin, y - 1, tableWidth, rowHeight, 'F');
      }

      const textY = y + 4;

      // Código
      doc.setFontSize(8);
      doc.setTextColor(80, 80, 80);
      doc.setFont('helvetica', 'normal');
      doc.text(codigo, colPos.cod + 3, textY);

      // Producto
      doc.setFontSize(9);
      doc.setTextColor(20, 20, 20);
      doc.setFont('helvetica', 'bold');
      doc.text(nombreLines, colPos.producto + 3, textY);

      // Cantidad
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 30, 30);
      doc.text(cantidad, colPos.cant + colWidths.cant / 2, textY, { align: 'center' });

      // Observación
      doc.setFontSize(8);
      doc.setTextColor(70, 70, 70);
      doc.setFont('helvetica', 'normal');
      doc.text(obsLines, colPos.obs + 3, textY);

      y += rowHeight;

      // Línea horizontal entre filas
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.3);
      doc.line(margin, y - 1, margin + tableWidth, y - 1);
    });

    // Cerrar tabla - borde exterior
    doc.setDrawColor(45, 45, 45);
    doc.setLineWidth(0.5);
    doc.rect(margin, headerY, tableWidth, y - headerY);
    
    // Líneas verticales internas
    doc.line(colPos.producto, headerY, colPos.producto, y);
    doc.line(colPos.cant, headerY, colPos.cant, y);
    doc.line(colPos.obs, headerY, colPos.obs, y);

    y += 12;

    // ===== OBSERVACIONES GENERALES =====
    if (order.observacion_general) {
      if (y > 250) {
        doc.addPage();
        y = 15;
      }

      doc.setFillColor(30, 30, 30);
      doc.rect(margin, y - 3, pageWidth - margin * 2, 6, 'F');
      doc.setFontSize(7);
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.text('OBSERVACIONES GENERALES', margin + 2, y + 1);
      y += 6;

      doc.setFontSize(9);
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'normal');
      const obsLines = doc.splitTextToSize(order.observacion_general, pageWidth - margin * 2 - 6);
      
      doc.setFillColor(250, 250, 250);
      doc.setDrawColor(180, 180, 180);
      const boxHeight = obsLines.length * 4 + 6;
      doc.rect(margin, y - 2, pageWidth - margin * 2, boxHeight, 'FD');
      doc.text(obsLines, margin + 3, y + 2);
      y += boxHeight + 5;
    }

    // ===== PIE DE PÁGINA =====
    doc.setFontSize(6);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `CRM Vendedora • ${formatOrderDateLocal(new Date().toISOString().split('T')[0])} ${formatTime(new Date())}`,
      pageWidth / 2,
      288,
      { align: 'center' }
    );

    // Guardar
    const fileName = `Pedido_${order.customer?.nombre?.replace(/\s+/g, '_') || 'cliente'}_${formatOrderDateFile(order.order_date as string)}.pdf`;
    doc.save(fileName);
    toast.success('PDF exportado');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500 dark:text-gray-400">Cargando pedido...</div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl text-gray-900 dark:text-white">Pedido no encontrado</h2>
        <Link href="/pedidos">
          <Button variant="secondary" className="mt-4">
            Volver a Pedidos
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start sm:items-center gap-3 sm:gap-4">
            <Link href="/pedidos">
              <Button variant="ghost" size="sm" icon={<ArrowLeft className="h-4 w-4" />}>
                Volver
              </Button>
            </Link>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Detalle de Pedido</h1>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <Badge variant={getStatusBadge(order.status)}>
                  {orderStatusLabels[order.status]}
                </Badge>
                <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                  {formatOrderDateLocal(order.order_date as string)}
                </span>
              </div>
            </div>
          </div>
          <div className="flex flex-col xs:flex-row flex-wrap gap-2 sm:gap-3 w-full sm:w-auto">
            {order.status !== 'entregado' && order.status !== 'cancelado' && (
              <Link href={`/pedidos/${orderId}/editar`}>
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<Edit className="h-4 w-4" />}
                  className="w-full xs:w-auto"
                >
                  Editar
                </Button>
              </Link>
            )}
            <Button
              variant="secondary"
              size="sm"
              icon={<FileDown className="h-4 w-4" />}
              onClick={exportToPDF}
              className="w-full xs:w-auto"
            >
              Exportar PDF
            </Button>
            <Button
              variant="ghost"
              size="sm"
              icon={<Trash2 className="h-4 w-4 text-red-500" />}
              onClick={() => setShowDeleteModal(true)}
              className="w-full xs:w-auto justify-center"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Cliente */}
          <Card className="lg:col-span-1">
            <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-4">Cliente</h2>
            {order.customer ? (
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <User className="h-5 w-5 text-indigo-500 dark:text-indigo-400 mt-0.5 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs text-gray-400 dark:text-gray-500">Nombre</p>
                    <Link
                      href={`/clientes/${order.customer.id}`}
                      className="text-gray-900 dark:text-white font-medium hover:text-indigo-600 dark:hover:text-indigo-400 break-words"
                    >
                      {order.customer.nombre}
                    </Link>
                  </div>
                </div>

                {order.customer.telefono && (
                  <div className="flex items-start gap-3">
                    <Phone className="h-5 w-5 text-indigo-500 dark:text-indigo-400 mt-0.5 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs text-gray-400 dark:text-gray-500">Teléfono</p>
                      <a
                        href={`tel:${order.customer.telefono}`}
                        className="text-gray-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400"
                      >
                        {order.customer.telefono}
                      </a>
                    </div>
                  </div>
                )}

                {order.customer.direccion && (
                  <div className="flex items-start gap-3">
                    <MapPin className="h-5 w-5 text-indigo-500 dark:text-indigo-400 mt-0.5 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs text-gray-400 dark:text-gray-500">Dirección</p>
                      <p className="text-gray-900 dark:text-white break-words">{order.customer.direccion}</p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-gray-500 dark:text-gray-400">Cliente no encontrado</p>
            )}
          </Card>

          {/* Totales */}
          <Card className="lg:col-span-2">
            <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-4">Resumen</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
              <div className="text-center p-3 sm:p-4 rounded-lg bg-gray-50 dark:bg-dark-800">
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Subtotal</p>
                <p className="text-base sm:text-xl font-bold text-gray-900 dark:text-white break-words">
                  {formatCurrency(order.subtotal)}
                </p>
              </div>
              <div className="text-center p-3 sm:p-4 rounded-lg bg-amber-50 dark:bg-amber-900/30">
                <p className="text-xs sm:text-sm text-amber-700 dark:text-amber-300">Bonificado</p>
                <p className="text-base sm:text-xl font-bold text-amber-600 dark:text-amber-400 break-words">
                  {formatCurrency(order.total_bonificado)}
                </p>
              </div>
              <div className="text-center p-3 sm:p-4 rounded-lg bg-emerald-50 dark:bg-emerald-900/30">
                <p className="text-xs sm:text-sm text-emerald-700 dark:text-emerald-300">Total</p>
                <p className="text-base sm:text-xl font-bold text-emerald-600 dark:text-emerald-400 break-words">
                  {formatCurrency(order.total)}
                </p>
              </div>
            </div>

            {order.observacion_general && (
              <div className="mt-4 p-3 sm:p-4 rounded-lg bg-gray-50 dark:bg-dark-800">
                <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">Observaciones</p>
                <p className="text-gray-900 dark:text-gray-100">{order.observacion_general}</p>
              </div>
            )}
          </Card>
        </div>

        {/* Productos */}
        <Card>
          <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Productos ({order.items?.length || 0})
          </h2>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th className="text-center">Cant.</th>
                  <th className="text-right">Precio</th>
                  <th className="text-right">Subtotal</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {order.items?.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {item.product?.nombre || 'Producto'}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {item.product?.sku}
                        </p>
                        {item.observacion_item && (
                          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1 italic">
                            "{item.observacion_item}"
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="text-center">
                      <span className="font-semibold text-gray-900 dark:text-white">{item.qty}</span>
                    </td>
                    <td className="text-right">
                      <span className="text-gray-500 dark:text-gray-400">
                        {formatCurrency(item.unit_price)}
                      </span>
                    </td>
                    <td className="text-right">
                      {item.bonificado ? (
                        <span className="text-amber-600 dark:text-amber-400 line-through">
                          {formatCurrency(item.qty * item.unit_price)}
                        </span>
                      ) : (
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                          {formatCurrency(item.line_total)}
                        </span>
                      )}
                    </td>
                    <td>
                      {item.bonificado ? (
                        <div>
                          <Badge variant="yellow">
                            <Gift className="h-3 w-3 mr-1" />
                            Bonificado
                          </Badge>
                          {item.motivo_bonificado && (
                            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                              {item.motivo_bonificado}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400 dark:text-gray-500">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Actions */}
        {order.status !== 'cancelado' && order.status !== 'entregado' && (
          <Card>
            <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-4">Acciones</h2>
            <div className="flex flex-wrap gap-3">
              {order.status === 'borrador' && (
                <>
                  <Button
                    variant="secondary"
                    icon={<Send className="h-4 w-4" />}
                    onClick={() => updateStatus('enviado')}
                    loading={actionLoading}
                  >
                    Marcar como Enviado
                  </Button>
                  <Button
                    icon={<CheckCircle className="h-4 w-4" />}
                    onClick={() => updateStatus('confirmado')}
                    loading={actionLoading}
                  >
                    Confirmar Pedido
                  </Button>
                </>
              )}
              {order.status === 'enviado' && (
                <Button
                  icon={<CheckCircle className="h-4 w-4" />}
                  onClick={() => updateStatus('confirmado')}
                  loading={actionLoading}
                >
                  Confirmar Pedido
                </Button>
              )}
              {order.status === 'confirmado' && (
                <Button
                  variant="success"
                  icon={<Truck className="h-4 w-4" />}
                  onClick={() => updateStatus('entregado')}
                  loading={actionLoading}
                >
                  Marcar como Entregado
                </Button>
              )}
              <Button
                variant="danger"
                icon={<XCircle className="h-4 w-4" />}
                onClick={() => updateStatus('cancelado')}
                loading={actionLoading}
              >
                Cancelar Pedido
              </Button>
            </div>
          </Card>
        )}

        {/* Delete Modal */}
        <Modal
          isOpen={showDeleteModal}
          onClose={() => setShowDeleteModal(false)}
          title="Eliminar Pedido"
          size="sm"
        >
          <div className="p-4 sm:p-6">
            <p className="text-gray-500 dark:text-gray-300 mb-6">
              ¿Estás segura de eliminar este pedido? Esta acción no se puede deshacer.
            </p>
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
              <Button variant="secondary" onClick={() => setShowDeleteModal(false)} className="w-full sm:w-auto">
                Cancelar
              </Button>
              <Button variant="danger" onClick={handleDelete} loading={actionLoading} className="w-full sm:w-auto">
                Eliminar
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </>
  );
}

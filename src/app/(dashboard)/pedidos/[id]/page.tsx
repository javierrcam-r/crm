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
  Printer,
} from 'lucide-react';
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Cargando pedido...</div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl text-gray-900">Pedido no encontrado</h2>
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
      {/* ========== VERSIÓN PARA IMPRIMIR (Minimalista) ========== */}
      <div className="print-only">
        <div className="print-header">
          <h1>Pedido</h1>
          <p>{formatDate(order.order_date)}</p>
        </div>

        <div className="print-cliente">
          <strong>Cliente:</strong> {order.customer?.nombre || 'Sin nombre'}
        </div>

        <table className="print-table">
          <thead>
            <tr>
              <th>Producto</th>
              <th style={{ width: '60px', textAlign: 'center' }}>Cant.</th>
              <th>Observación</th>
            </tr>
          </thead>
          <tbody>
            {order.items?.map((item, index) => (
              <tr key={item.id}>
                <td>
                  <span className="print-producto-nombre">{item.product?.nombre || 'Producto'}</span>
                  {item.bonificado && <span className="print-bonificado"> (Bonificado)</span>}
                </td>
                <td style={{ textAlign: 'center' }}>{item.qty}</td>
                <td className="print-obs">
                  {item.observacion_item || '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {order.observacion_general && (
          <div className="print-observacion-general">
            <strong>Observación:</strong> {order.observacion_general}
          </div>
        )}

        <div className="print-footer">
          CRM Camila Fernández
        </div>
      </div>

      {/* ========== VERSIÓN NORMAL (pantalla) ========== */}
      <div className="no-print max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/pedidos">
              <Button variant="ghost" size="sm" icon={<ArrowLeft className="h-4 w-4" />}>
                Volver
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Detalle de Pedido</h1>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant={getStatusBadge(order.status)}>
                  {orderStatusLabels[order.status]}
                </Badge>
                <span className="text-sm text-gray-500">
                  {formatDate(order.order_date)}
                </span>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              icon={<Printer className="h-4 w-4" />}
              onClick={() => window.print()}
            >
              Imprimir
            </Button>
            <Button
              variant="ghost"
              size="sm"
              icon={<Trash2 className="h-4 w-4 text-red-500" />}
              onClick={() => setShowDeleteModal(true)}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Cliente */}
          <Card className="lg:col-span-1">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Cliente</h2>
            {order.customer ? (
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <User className="h-5 w-5 text-indigo-500 mt-0.5" />
                  <div>
                    <p className="text-xs text-gray-400">Nombre</p>
                    <Link
                      href={`/clientes/${order.customer.id}`}
                      className="text-gray-900 font-medium hover:text-indigo-600"
                    >
                      {order.customer.nombre}
                    </Link>
                  </div>
                </div>

                {order.customer.telefono && (
                  <div className="flex items-start gap-3">
                    <Phone className="h-5 w-5 text-indigo-500 mt-0.5" />
                    <div>
                      <p className="text-xs text-gray-400">Teléfono</p>
                      <a
                        href={`tel:${order.customer.telefono}`}
                        className="text-gray-900 hover:text-indigo-600"
                      >
                        {order.customer.telefono}
                      </a>
                    </div>
                  </div>
                )}

                {order.customer.direccion && (
                  <div className="flex items-start gap-3">
                    <MapPin className="h-5 w-5 text-indigo-500 mt-0.5" />
                    <div>
                      <p className="text-xs text-gray-400">Dirección</p>
                      <p className="text-gray-900">{order.customer.direccion}</p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-gray-500">Cliente no encontrado</p>
            )}
          </Card>

          {/* Totales */}
          <Card className="lg:col-span-2">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Resumen</h2>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-4 rounded-lg bg-gray-50">
                <p className="text-sm text-gray-500">Subtotal</p>
                <p className="text-xl font-bold text-gray-900">
                  {formatCurrency(order.subtotal)}
                </p>
              </div>
              <div className="text-center p-4 rounded-lg bg-amber-50">
                <p className="text-sm text-amber-700">Bonificado</p>
                <p className="text-xl font-bold text-amber-600">
                  {formatCurrency(order.total_bonificado)}
                </p>
              </div>
              <div className="text-center p-4 rounded-lg bg-emerald-50">
                <p className="text-sm text-emerald-700">Total</p>
                <p className="text-xl font-bold text-emerald-600">
                  {formatCurrency(order.total)}
                </p>
              </div>
            </div>

            {order.observacion_general && (
              <div className="mt-4 p-4 rounded-lg bg-gray-50">
                <p className="text-xs text-gray-400 mb-1">Observaciones</p>
                <p className="text-gray-900">{order.observacion_general}</p>
              </div>
            )}
          </Card>
        </div>

        {/* Productos */}
        <Card>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
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
                        <p className="font-medium text-gray-900">
                          {item.product?.nombre || 'Producto'}
                        </p>
                        <p className="text-sm text-gray-500">
                          {item.product?.sku}
                        </p>
                        {item.observacion_item && (
                          <p className="text-sm text-gray-400 mt-1 italic">
                            "{item.observacion_item}"
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="text-center">
                      <span className="font-semibold text-gray-900">{item.qty}</span>
                    </td>
                    <td className="text-right">
                      <span className="text-gray-500">
                        {formatCurrency(item.unit_price)}
                      </span>
                    </td>
                    <td className="text-right">
                      {item.bonificado ? (
                        <span className="text-amber-600 line-through">
                          {formatCurrency(item.qty * item.unit_price)}
                        </span>
                      ) : (
                        <span className="font-semibold text-emerald-600">
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
                            <p className="text-xs text-amber-600 mt-1">
                              {item.motivo_bonificado}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
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
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Acciones</h2>
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
          <div className="p-6">
            <p className="text-gray-500 mb-6">
              ¿Estás segura de eliminar este pedido? Esta acción no se puede deshacer.
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>
                Cancelar
              </Button>
              <Button variant="danger" onClick={handleDelete} loading={actionLoading}>
                Eliminar
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </>
  );
}

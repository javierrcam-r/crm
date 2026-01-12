'use client';

import { Suspense, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Search,
  Plus,
  Trash2,
  Gift,
  Loader2,
} from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import Badge from '@/components/ui/Badge';
import { getCustomers, type Customer } from '@/lib/services/customers';
import { getActiveProducts, type Product } from '@/lib/services/products';
import {
  getOrder,
  updateOrder,
  addOrderItem,
  updateOrderItem,
  deleteOrderItem,
  type Order,
  type OrderItem,
} from '@/lib/services/orders';
import { formatCurrency, cn } from '@/lib/utils';
import { searchProducts, searchCustomers } from '@/lib/search';
import toast from 'react-hot-toast';

interface OrderItemDraft {
  id: string;
  isNew: boolean;
  product: Product;
  qty: number;
  unit_price: number;
  bonificado: boolean;
  motivo_bonificado: string;
  observacion_item: string;
}

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
    </div>
  );
}

export default function EditarPedidoPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <EditarPedidoContent />
    </Suspense>
  );
}

function EditarPedidoContent() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.id as string;

  const [order, setOrder] = useState<Order | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state
  const [customerId, setCustomerId] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [observacionGeneral, setObservacionGeneral] = useState('');
  const [items, setItems] = useState<OrderItemDraft[]>([]);
  const [deletedItemIds, setDeletedItemIds] = useState<string[]>([]);

  // Product search
  const [productSearch, setProductSearch] = useState('');
  const [showProductSearch, setShowProductSearch] = useState(false);

  useEffect(() => {
    loadData();
  }, [orderId]);

  const loadData = async () => {
    try {
      const [orderData, customersData, productsData] = await Promise.all([
        getOrder(orderId),
        getCustomers(),
        getActiveProducts(),
      ]);

      setOrder(orderData);
      setCustomers(customersData);
      setProducts(productsData);

      // Populate form with existing order data
      setCustomerId(orderData.customer_id);
      setObservacionGeneral(orderData.observacion_general || '');

      // Convert order items to draft format
      const draftItems: OrderItemDraft[] =
        orderData.items?.map((item) => ({
          id: item.id,
          isNew: false,
          product: item.product as Product,
          qty: item.qty,
          unit_price: item.unit_price,
          bonificado: item.bonificado,
          motivo_bonificado: item.motivo_bonificado || '',
          observacion_item: item.observacion_item || '',
        })) || [];

      setItems(draftItems);
    } catch (error) {
      console.error('Error cargando datos:', error);
      toast.error('Error al cargar el pedido');
    } finally {
      setLoading(false);
    }
  };

  const selectedCustomer = customers.find((c) => c.id === customerId);

  // Búsqueda robusta de clientes (ignora tildes, busca en cualquier orden)
  const filteredCustomers = customerSearch.trim()
    ? searchCustomers(customers, customerSearch)
    : customers;

  // Búsqueda robusta de productos (ignora tildes, busca en cualquier orden)
  const filteredProducts = productSearch.trim()
    ? searchProducts(products, productSearch)
    : products;

  const addItem = (product: Product) => {
    const existing = items.find((i) => i.product.id === product.id);
    if (existing) {
      setItems((prev) =>
        prev.map((i) =>
          i.product.id === product.id ? { ...i, qty: i.qty + 1 } : i
        )
      );
    } else {
      setItems((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          isNew: true,
          product,
          qty: 1,
          unit_price: product.precio,
          bonificado: false,
          motivo_bonificado: '',
          observacion_item: '',
        },
      ]);
    }
    setProductSearch('');
    setShowProductSearch(false);
  };

  const removeItem = (itemId: string, isNew: boolean) => {
    if (!isNew) {
      setDeletedItemIds((prev) => [...prev, itemId]);
    }
    setItems((prev) => prev.filter((i) => i.id !== itemId));
  };

  const updateItem = (itemId: string, updates: Partial<OrderItemDraft>) => {
    setItems((prev) =>
      prev.map((i) => (i.id === itemId ? { ...i, ...updates } : i))
    );
  };

  // Calculate totals
  const subtotal = items.reduce((sum, i) => sum + i.qty * i.unit_price, 0);
  const totalBonificado = items
    .filter((i) => i.bonificado)
    .reduce((sum, i) => sum + i.qty * i.unit_price, 0);
  const total = items
    .filter((i) => !i.bonificado)
    .reduce((sum, i) => sum + i.qty * i.unit_price, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!customerId) {
      toast.error('Selecciona un cliente');
      return;
    }

    if (items.length === 0) {
      toast.error('Agrega al menos un producto');
      return;
    }

    setSaving(true);

    try {
      // IMPORTANTE: Primero actualizar items, luego el pedido
      // porque el trigger recalcula totales cuando se modifican items
      
      // Delete removed items
      for (const itemId of deletedItemIds) {
        await deleteOrderItem(itemId);
      }

      // Update existing items and add new ones
      for (const item of items) {
        if (item.isNew) {
          await addOrderItem({
            order_id: orderId,
            product_id: item.product.id,
            qty: item.qty,
            unit_price: item.unit_price,
            bonificado: item.bonificado,
            motivo_bonificado: item.motivo_bonificado || undefined,
            observacion_item: item.observacion_item || undefined,
          });
        } else {
          await updateOrderItem(item.id, {
            qty: item.qty,
            unit_price: item.unit_price,
            bonificado: item.bonificado,
            motivo_bonificado: item.motivo_bonificado || undefined,
            observacion_item: item.observacion_item || undefined,
          });
        }
      }

      // Update order AL FINAL (después de items) para que no sea sobrescrito por el trigger
      const finalObservation = observacionGeneral.trim();
      const obsToSend = finalObservation === '' ? null : finalObservation;
      const updated = await updateOrder(orderId, {
        customer_id: customerId,
        observacion_general: obsToSend,
      });

      // Validar inmediatamente que el valor se guardó
      const reloaded = await getOrder(orderId);
      if ((reloaded.observacion_general || '') !== (obsToSend || '')) {
        console.warn('La observación no coincidió después de guardar', {
          enviado: finalObservation,
          enviadoFinal: obsToSend,
          recibido: reloaded.observacion_general,
          updatedReturn: updated?.observacion_general,
        });
        toast.error('No se pudo actualizar la observación. Intenta de nuevo.');
        setSaving(false);
        return;
      }

      toast.success('Pedido actualizado exitosamente');
      router.push(`/pedidos/${orderId}`);
    } catch (error) {
      console.error('Error actualizando pedido:', error);
      toast.error('Error al actualizar el pedido');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingFallback />;
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
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href={`/pedidos/${orderId}`}>
          <Button variant="ghost" size="sm" icon={<ArrowLeft className="h-4 w-4" />}>
            Volver
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Editar Pedido</h1>
          <p className="text-gray-500">Modifica los datos del pedido</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Cliente */}
        <Card>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Cliente</h2>
          {selectedCustomer ? (
            <div className="flex items-center justify-between p-4 rounded-lg bg-gray-50">
              <div>
                <p className="font-semibold text-gray-900">{selectedCustomer.nombre}</p>
                {selectedCustomer.telefono && (
                  <p className="text-sm text-gray-500">{selectedCustomer.telefono}</p>
                )}
                {selectedCustomer.direccion && (
                  <p className="text-sm text-gray-500">{selectedCustomer.direccion}</p>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCustomerId('')}
                type="button"
              >
                Cambiar
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <Input
                placeholder="Buscar cliente por nombre o teléfono..."
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                icon={<Search className="h-4 w-4" />}
              />
              <div className="max-h-[200px] overflow-y-auto space-y-2">
                {filteredCustomers.slice(0, 10).map((customer) => (
                  <button
                    key={customer.id}
                    type="button"
                    onClick={() => setCustomerId(customer.id)}
                    className="w-full text-left p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
                  >
                    <p className="font-medium text-gray-900">{customer.nombre}</p>
                    <p className="text-sm text-gray-500">
                      {[customer.telefono, customer.zona, customer.ciudad]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </Card>

        {/* Productos */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Productos</h2>
            <Button
              variant="secondary"
              size="sm"
              icon={<Plus className="h-4 w-4" />}
              onClick={() => setShowProductSearch(true)}
              type="button"
            >
              Agregar
            </Button>
          </div>

          {/* Product Search */}
          {showProductSearch && (
            <div className="mb-4 p-4 rounded-lg bg-gray-50 space-y-3">
              <Input
                placeholder="Buscar producto por nombre o SKU..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                icon={<Search className="h-4 w-4" />}
                autoFocus
              />
              <div className="max-h-[200px] overflow-y-auto space-y-2">
                {filteredProducts.slice(0, 10).map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => addItem(product)}
                    className="w-full text-left p-3 rounded-lg bg-white hover:bg-gray-100 transition-colors flex items-center justify-between border border-gray-200"
                  >
                    <div>
                      <p className="font-medium text-gray-900">{product.nombre}</p>
                      <p className="text-sm text-gray-500">
                        {product.sku} · {product.categoria || 'Sin categoría'}
                      </p>
                    </div>
                    <span className="text-emerald-600 font-semibold">
                      {formatCurrency(product.precio)}
                    </span>
                  </button>
                ))}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowProductSearch(false);
                  setProductSearch('');
                }}
                type="button"
              >
                Cerrar
              </Button>
            </div>
          )}

          {/* Items Table */}
          {items.length === 0 ? (
            <p className="text-center text-gray-500 py-8">
              No hay productos agregados
            </p>
          ) : (
            <div className="space-y-4">
              {items.map((item) => (
                <div
                  key={item.id}
                  className={cn(
                    'p-4 rounded-lg border border-gray-200',
                    item.bonificado && 'border-amber-300 bg-amber-50/50'
                  )}
                >
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-gray-900">
                          {item.product.nombre}
                        </p>
                        {item.bonificado && (
                          <Badge variant="yellow">
                            <Gift className="h-3 w-3 mr-1" />
                            Bonificado
                          </Badge>
                        )}
                        {item.isNew && (
                          <Badge variant="blue">Nuevo</Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-500">{item.product.sku}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeItem(item.id, item.isNew)}
                      type="button"
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <label className="label">Cantidad</label>
                      <Input
                        type="number"
                        min={1}
                        value={item.qty}
                        onChange={(e) =>
                          updateItem(item.id, { qty: parseInt(e.target.value) || 1 })
                        }
                      />
                    </div>
                    <div>
                      <label className="label">Precio Unit.</label>
                      <Input
                        type="number"
                        min={0}
                        step={100}
                        value={item.unit_price}
                        onChange={(e) =>
                          updateItem(item.id, {
                            unit_price: parseFloat(e.target.value) || 0,
                          })
                        }
                      />
                    </div>
                    <div>
                      <label className="label">Subtotal</label>
                      <p className="text-lg font-semibold text-emerald-600 py-2.5">
                        {item.bonificado ? (
                          <span className="line-through text-gray-400">
                            {formatCurrency(item.qty * item.unit_price)}
                          </span>
                        ) : (
                          formatCurrency(item.qty * item.unit_price)
                        )}
                      </p>
                    </div>
                    <div className="flex items-end">
                      <label className="flex items-center gap-2 py-2.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={item.bonificado}
                          onChange={(e) =>
                            updateItem(item.id, { bonificado: e.target.checked })
                          }
                          className="h-4 w-4 rounded border-gray-300 bg-white text-amber-500 focus:ring-amber-500"
                        />
                        <span className="text-sm text-gray-700">Bonificado</span>
                      </label>
                    </div>
                  </div>

                  {item.bonificado && (
                    <div className="mt-3">
                      <Input
                        placeholder="Motivo de la bonificación..."
                        value={item.motivo_bonificado}
                        onChange={(e) =>
                          updateItem(item.id, { motivo_bonificado: e.target.value })
                        }
                      />
                    </div>
                  )}

                  <div className="mt-3">
                    <Input
                      placeholder="Observación del ítem (opcional)..."
                      value={item.observacion_item}
                      onChange={(e) =>
                        updateItem(item.id, { observacion_item: e.target.value })
                      }
                    />
                  </div>
                </div>
              ))}

              {/* Totals */}
              <div className="border-t border-gray-200 pt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Subtotal</span>
                  <span className="text-gray-900">{formatCurrency(subtotal)}</span>
                </div>
                {totalBonificado > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-amber-600">Total Bonificado</span>
                    <span className="text-amber-600">
                      -{formatCurrency(totalBonificado)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold">
                  <span className="text-gray-900">Total</span>
                  <span className="text-emerald-600">{formatCurrency(total)}</span>
                </div>
              </div>
            </div>
          )}
        </Card>

        {/* Observaciones */}
        <Card>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Observaciones Generales
          </h2>
          <Textarea
            value={observacionGeneral}
            onChange={(e) => setObservacionGeneral(e.target.value)}
            placeholder="Notas sobre el pedido, instrucciones de entrega, etc."
            rows={3}
          />
        </Card>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Link href={`/pedidos/${orderId}`}>
            <Button variant="secondary">Cancelar</Button>
          </Link>
          <Button type="submit" loading={saving}>
            Guardar Cambios
          </Button>
        </div>
      </form>
    </div>
  );
}


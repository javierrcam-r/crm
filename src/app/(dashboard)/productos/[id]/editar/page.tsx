'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import { getProduct, updateProduct, type Product } from '@/lib/services/products';
import toast from 'react-hot-toast';
import type { ProductUpdate } from '@/types/database';

export default function EditarProductoPage() {
  const params = useParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<ProductUpdate>({
    sku: '',
    nombre: '',
    categoria: '',
    precio: 0,
    activo: true,
    descripcion: '',
  });

  const productId = params.id as string;

  useEffect(() => {
    loadProduct();
  }, [productId]);

  const loadProduct = async () => {
    try {
      const product = await getProduct(productId);
      setFormData({
        sku: product.sku,
        nombre: product.nombre,
        categoria: product.categoria || '',
        precio: product.precio,
        activo: product.activo,
        descripcion: product.descripcion || '',
      });
    } catch (error) {
      console.error('Error cargando producto:', error);
      toast.error('Error al cargar el producto');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.nombre?.trim()) {
      toast.error('El nombre es obligatorio');
      return;
    }

    if ((formData.precio ?? 0) < 0) {
      toast.error('El precio no puede ser negativo');
      return;
    }

    setSaving(true);

    try {
      await updateProduct(productId, formData);
      toast.success('Producto actualizado');
      router.push('/productos');
    } catch (error: any) {
      console.error('Error actualizando producto:', error);
      if (error.message?.includes('duplicate')) {
        toast.error('Ya existe un producto con ese SKU');
      } else {
        toast.error('Error al actualizar el producto');
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Cargando producto...</div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/productos">
          <Button variant="ghost" size="sm" icon={<ArrowLeft className="h-4 w-4" />}>
            Volver
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Editar Producto</h1>
          <p className="text-gray-500">Modifica los datos del producto</p>
        </div>
      </div>

      {/* Form */}
      <Card>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Identificación */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">
              Identificación
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="SKU *"
                value={formData.sku || ''}
                onChange={(e) => setFormData({ ...formData, sku: e.target.value.toUpperCase() })}
                placeholder="COD-001"
                required
              />
              <Input
                label="Categoría"
                value={formData.categoria || ''}
                onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
                placeholder="Limpieza, Higiene, etc."
              />
            </div>
            <Input
              label="Nombre del Producto *"
              value={formData.nombre || ''}
              onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
              placeholder="Nombre descriptivo del producto"
              required
            />
          </div>

          {/* Precio */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">
              Precio
            </h3>
            <Input
              label="Precio Unitario *"
              type="number"
              min={0}
              step={100}
              value={formData.precio || 0}
              onChange={(e) => setFormData({ ...formData, precio: parseFloat(e.target.value) || 0 })}
              placeholder="0"
            />
          </div>

          {/* Descripción */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">
              Información Adicional
            </h3>
            <Textarea
              label="Descripción"
              value={formData.descripcion || ''}
              onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
              placeholder="Descripción opcional del producto..."
              rows={3}
            />
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="activo"
                checked={formData.activo}
                onChange={(e) => setFormData({ ...formData, activo: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300 bg-white text-indigo-600 focus:ring-indigo-500"
              />
              <label htmlFor="activo" className="text-sm text-gray-700">
                Producto activo (disponible para pedidos)
              </label>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <Link href="/productos">
              <Button variant="secondary">Cancelar</Button>
            </Link>
            <Button type="submit" loading={saving}>
              Guardar Cambios
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

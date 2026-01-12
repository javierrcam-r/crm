'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Plus,
  Search,
  Filter,
  Package,
  Edit,
  Trash2,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import EmptyState from '@/components/ui/EmptyState';
import {
  getProducts,
  getCategories,
  updateProduct,
  deleteProduct,
  type Product,
} from '@/lib/services/products';
import { formatCurrency, cn } from '@/lib/utils';
import { searchProducts } from '@/lib/search';
import toast from 'react-hot-toast';

export default function ProductosPage() {
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCategoria, setFilterCategoria] = useState('');
  const [filterActivo, setFilterActivo] = useState<string>('');
  const [categories, setCategories] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [deleteModal, setDeleteModal] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [productsData, categoriesData] = await Promise.all([
        getProducts(),
        getCategories(),
      ]);
      setAllProducts(productsData);
      setCategories(categoriesData);
    } catch (error) {
      console.error('Error cargando productos:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filtrado robusto en el cliente (ignora tildes, busca en cualquier orden)
  const products = (() => {
    let filtered = allProducts;
    
    // Filtro por categoría
    if (filterCategoria) {
      filtered = filtered.filter(p => p.categoria === filterCategoria);
    }
    
    // Filtro por estado activo
    if (filterActivo) {
      const isActivo = filterActivo === 'true';
      filtered = filtered.filter(p => p.activo === isActivo);
    }
    
    // Búsqueda robusta por texto
    if (search.trim()) {
      filtered = searchProducts(filtered, search);
    }
    
    return filtered;
  })();

  const toggleActivo = async (product: Product) => {
    try {
      await updateProduct(product.id, { activo: !product.activo });
      setAllProducts((prev) =>
        prev.map((p) =>
          p.id === product.id ? { ...p, activo: !p.activo } : p
        )
      );
      toast.success(
        product.activo ? 'Producto desactivado' : 'Producto activado'
      );
    } catch (error) {
      console.error('Error actualizando:', error);
      toast.error('Error al actualizar el producto');
    }
  };

  const handleDelete = async () => {
    if (!deleteModal) return;
    setDeleting(true);
    try {
      await deleteProduct(deleteModal.id);
      setAllProducts((prev) => prev.filter((p) => p.id !== deleteModal.id));
      toast.success('Producto eliminado');
      setDeleteModal(null);
    } catch (error) {
      console.error('Error eliminando:', error);
      toast.error('Error al eliminar el producto');
    } finally {
      setDeleting(false);
    }
  };

  const clearFilters = () => {
    setSearch('');
    setFilterCategoria('');
    setFilterActivo('');
  };

  const categoriaOptions = categories.map((c) => ({ value: c, label: c }));
  const activoOptions = [
    { value: 'true', label: 'Activos' },
    { value: 'false', label: 'Inactivos' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Cargando productos...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Catálogo de Productos</h1>
          <p className="text-gray-500 mt-1">Gestiona tu catálogo de productos</p>
        </div>
        <Link href="/productos/nuevo">
          <Button icon={<Plus className="h-4 w-4" />}>Nuevo Producto</Button>
        </Link>
      </div>

      {/* Search and Filters */}
      <Card padding="sm">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <Input
              placeholder="Buscar por nombre o SKU..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              icon={<Search className="h-4 w-4" />}
            />
          </div>
          <Button
            variant="secondary"
            onClick={() => setShowFilters(!showFilters)}
            icon={<Filter className="h-4 w-4" />}
          >
            Filtros
          </Button>
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 pt-4 border-t border-gray-200">
            <Select
              options={categoriaOptions}
              value={filterCategoria}
              onChange={(e) => setFilterCategoria(e.target.value)}
              placeholder="Todas las categorías"
            />
            <Select
              options={activoOptions}
              value={filterActivo}
              onChange={(e) => setFilterActivo(e.target.value)}
              placeholder="Todos los estados"
            />
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              Limpiar filtros
            </Button>
          </div>
        )}
      </Card>

      {/* Product List */}
      {products.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No hay productos"
          description="Agrega tu primer producto al catálogo"
          action={{
            label: 'Nuevo Producto',
            onClick: () => (window.location.href = '/productos/nuevo'),
          }}
        />
      ) : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Producto</th>
                <th>Categoría</th>
                <th className="text-right">Precio</th>
                <th>Estado</th>
                <th className="text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product, index) => (
                <tr
                  key={product.id}
                  className={cn(
                    'animate-fade-in',
                    `stagger-${(index % 5) + 1}`
                  )}
                >
                  <td>
                    <span className="font-mono text-sm text-gray-500">
                      {product.sku}
                    </span>
                  </td>
                  <td>
                    <div>
                      <p className="font-medium text-gray-900">{product.nombre}</p>
                      {product.descripcion && (
                        <p className="text-sm text-gray-400 truncate max-w-[300px]">
                          {product.descripcion}
                        </p>
                      )}
                    </div>
                  </td>
                  <td>
                    {product.categoria ? (
                      <Badge variant="blue">{product.categoria}</Badge>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="text-right">
                    <span className="font-semibold text-emerald-600">
                      {formatCurrency(product.precio)}
                    </span>
                  </td>
                  <td>
                    <button
                      onClick={() => toggleActivo(product)}
                      className="flex items-center gap-2"
                    >
                      {product.activo ? (
                        <>
                          <ToggleRight className="h-5 w-5 text-emerald-500" />
                          <span className="text-sm text-emerald-600">Activo</span>
                        </>
                      ) : (
                        <>
                          <ToggleLeft className="h-5 w-5 text-gray-400" />
                          <span className="text-sm text-gray-400">Inactivo</span>
                        </>
                      )}
                    </button>
                  </td>
                  <td>
                    <div className="flex justify-end gap-2">
                      <Link href={`/productos/${product.id}/editar`}>
                        <Button variant="ghost" size="sm">
                          <Edit className="h-4 w-4" />
                        </Button>
                      </Link>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteModal(product)}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="text-center">
          <p className="text-2xl font-bold text-gray-900">{allProducts.length}</p>
          <p className="text-sm text-gray-500">Total Productos</p>
        </Card>
        <Card className="text-center">
          <p className="text-2xl font-bold text-emerald-600">
            {allProducts.filter((p) => p.activo).length}
          </p>
          <p className="text-sm text-gray-500">Activos</p>
        </Card>
        <Card className="text-center">
          <p className="text-2xl font-bold text-gray-400">
            {allProducts.filter((p) => !p.activo).length}
          </p>
          <p className="text-sm text-gray-500">Inactivos</p>
        </Card>
        <Card className="text-center">
          <p className="text-2xl font-bold text-indigo-600">{categories.length}</p>
          <p className="text-sm text-gray-500">Categorías</p>
        </Card>
      </div>

      {/* Delete Modal */}
      <Modal
        isOpen={!!deleteModal}
        onClose={() => setDeleteModal(null)}
        title="Eliminar Producto"
        size="sm"
      >
        <div className="p-6">
          <p className="text-gray-500 mb-6">
            ¿Estás segura de eliminar{' '}
            <strong className="text-gray-900">{deleteModal?.nombre}</strong>?
            Esta acción no se puede deshacer.
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setDeleteModal(null)}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={handleDelete} loading={deleting}>
              Eliminar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

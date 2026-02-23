'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Target,
  Plus,
  Edit,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Save,
  Users,
  Package,
} from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import Badge from '@/components/ui/Badge';
import {
  getBrands,
  getAllBrands,
  createBrand,
  updateBrand,
  deleteBrand,
  getSalesGoals,
  bulkUpsertSalesGoals,
} from '@/lib/services/salesGoals';
import { getAllUsersForSelection } from '@/lib/services/activities';
import type { Brand, SalesGoal, UserProfile } from '@/types/database';
import { format, addMonths, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import toast from 'react-hot-toast';
import { useAuth } from '@/contexts/AuthContext';

export default function MetasPage() {
  const router = useRouter();
  const { userProfile } = useAuth();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [brands, setBrands] = useState<Brand[]>([]);
  const [allBrands, setAllBrands] = useState<Brand[]>([]);
  const [users, setUsers] = useState<Pick<UserProfile, 'id' | 'nombre_completo' | 'email' | 'rol'>[]>([]);
  const [goals, setGoals] = useState<SalesGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Modal para marcas
  const [showBrandModal, setShowBrandModal] = useState(false);
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null);
  const [brandName, setBrandName] = useState('');
  const [brandLogoUrl, setBrandLogoUrl] = useState('');

  // Formulario de metas (solo valor)
  const [goalsForm, setGoalsForm] = useState<Record<string, Record<string, number>>>({});

  const anio = selectedDate.getFullYear();
  const mes = selectedDate.getMonth() + 1;

  const isSupervisor = userProfile?.rol === 'admin' ||
    userProfile?.rol === 'supervisor' ||
    userProfile?.rol === 'supervisor_nivel1';

  useEffect(() => {
    if (userProfile && !isSupervisor) {
      router.replace('/');
    }
  }, [userProfile, isSupervisor, router]);

  useEffect(() => {
    if (isSupervisor) {
      loadData();
    }
  }, [anio, mes, isSupervisor]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [brandsData, allBrandsData, usersData, goalsData] = await Promise.all([
        getBrands(),
        getAllBrands(),
        getAllUsersForSelection(),
        getSalesGoals(anio, mes),
      ]);

      setBrands(brandsData);
      setAllBrands(allBrandsData);
      // Solo vendedores y supervisor_vendedor
      const vendedores = usersData.filter(u => u.rol === 'vendedor' || u.rol === 'supervisor_vendedor');
      setUsers(vendedores);
      setGoals(goalsData);

      const form: Record<string, Record<string, number>> = {};
      vendedores.forEach(user => {
        form[user.id] = {};
        brandsData.forEach(brand => {
          const existing = goalsData.find(g => g.user_profile_id === user.id && g.brand_id === brand.id);
          form[user.id][brand.id] = existing ? Number(existing.meta_valor) : 0;
        });
      });
      setGoalsForm(form);
    } catch (error) {
      console.error('Error cargando datos:', error);
      toast.error('Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  const goToPreviousMonth = () => setSelectedDate(subMonths(selectedDate, 1));
  const goToNextMonth = () => setSelectedDate(addMonths(selectedDate, 1));

  const handleSaveBrand = async () => {
    if (!brandName.trim()) {
      toast.error('El nombre es obligatorio');
      return;
    }

    try {
      const brandData = { nombre: brandName, logo_url: brandLogoUrl || null };
      if (editingBrand) {
        await updateBrand(editingBrand.id, brandData);
        toast.success('Marca actualizada');
      } else {
        await createBrand(brandData);
        toast.success('Marca creada');
      }
      setShowBrandModal(false);
      setBrandName('');
      setBrandLogoUrl('');
      setEditingBrand(null);
      loadData();
    } catch (error: any) {
      toast.error(error?.message || 'Error al guardar marca');
    }
  };

  const handleDeleteBrand = async (brand: Brand) => {
    if (!confirm(`¿Eliminar la marca "${brand.nombre}"?`)) return;

    try {
      await deleteBrand(brand.id);
      toast.success('Marca eliminada');
      loadData();
    } catch (error) {
      toast.error('Error al eliminar marca');
    }
  };

  const handleGoalChange = (userId: string, brandId: string, value: number) => {
    setGoalsForm(prev => ({
      ...prev,
      [userId]: {
        ...prev[userId],
        [brandId]: value,
      },
    }));
  };

  const handleSaveGoals = async () => {
    setSaving(true);
    try {
      const goalsToSave: { user_profile_id: string; brand_id: string; anio: number; mes: number; meta_cantidad: number; meta_valor: number }[] = [];

      Object.entries(goalsForm).forEach(([userId, brandGoals]) => {
        Object.entries(brandGoals).forEach(([brandId, valor]) => {
          if (valor > 0) {
            goalsToSave.push({
              user_profile_id: userId,
              brand_id: brandId,
              anio,
              mes,
              meta_cantidad: 0,
              meta_valor: valor,
            });
          }
        });
      });

      await bulkUpsertSalesGoals(goalsToSave);
      toast.success('Metas guardadas exitosamente');
      loadData();
    } catch (error) {
      console.error('Error guardando metas:', error);
      toast.error('Error al guardar metas');
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-EC', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  if (!isSupervisor) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/supervisores">
            <Button variant="ghost" size="sm" icon={<ArrowLeft className="h-4 w-4" />}>
              Volver
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Target className="h-6 w-6 text-emerald-600" />
              Metas de Ventas
            </h1>
            <p className="text-gray-500 dark:text-gray-400">
              Asigna metas mensuales por vendedor y marca
            </p>
          </div>
        </div>

        {/* Selector de mes */}
        <div className="flex items-center gap-2">
          <button
            onClick={goToPreviousMonth}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-700 transition-colors"
          >
            <ChevronLeft className="h-5 w-5 text-gray-500" />
          </button>
          <span className="text-lg font-semibold text-gray-700 dark:text-gray-300 min-w-[150px] text-center capitalize">
            {format(selectedDate, 'MMMM yyyy', { locale: es })}
          </span>
          <button
            onClick={goToNextMonth}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-700 transition-colors"
          >
            <ChevronRight className="h-5 w-5 text-gray-500" />
          </button>
        </div>
      </div>

      {/* Gestión de Marcas */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Package className="h-5 w-5 text-indigo-500" />
            Marcas
          </h2>
          <Button
            size="sm"
            icon={<Plus className="h-4 w-4" />}
            onClick={() => {
              setEditingBrand(null);
              setBrandName('');
              setBrandLogoUrl('');
              setShowBrandModal(true);
            }}
          >
            Nueva Marca
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          {allBrands.map(brand => (
            <div
              key={brand.id}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${
                brand.activo
                  ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800'
                  : 'bg-gray-100 border-gray-200 dark:bg-dark-700 dark:border-dark-600 opacity-50'
              }`}
            >
              {brand.logo_url && (
                <img src={brand.logo_url} alt={brand.nombre} className="h-5 w-5 object-contain rounded" />
              )}
              <span className={`font-medium ${brand.activo ? 'text-emerald-700 dark:text-emerald-300' : 'text-gray-500'}`}>
                {brand.nombre}
              </span>
              <button
                onClick={() => {
                  setEditingBrand(brand);
                  setBrandName(brand.nombre);
                  setBrandLogoUrl(brand.logo_url || '');
                  setShowBrandModal(true);
                }}
                className="p-1 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 rounded transition-colors"
              >
                <Edit className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              </button>
              {brand.activo && (
                <button
                  onClick={() => handleDeleteBrand(brand)}
                  className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5 text-red-500" />
                </button>
              )}
            </div>
          ))}
          {allBrands.length === 0 && (
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              No hay marcas. Crea una para comenzar a asignar metas.
            </p>
          )}
        </div>
      </Card>

      {/* Tabla de Metas */}
      {brands.length > 0 && users.length > 0 && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Users className="h-5 w-5 text-indigo-500" />
              Metas por Vendedor
            </h2>
            <Button
              icon={<Save className="h-4 w-4" />}
              onClick={handleSaveGoals}
              loading={saving}
            >
              Guardar Cambios
            </Button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-dark-600">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Vendedor
                    </th>
                    {brands.map(brand => (
                      <th key={brand.id} className="text-center py-3 px-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
                        <div className="flex flex-col items-center gap-1">
                          {brand.logo_url && (
                            <img src={brand.logo_url} alt={brand.nombre} className="h-8 w-auto object-contain" />
                          )}
                          <span>{brand.nombre}</span>
                        </div>
                      </th>
                    ))}
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(user => {
                    const userTotal = brands.reduce((sum, brand) => {
                      return sum + (goalsForm[user.id]?.[brand.id] || 0);
                    }, 0);

                    return (
                      <tr key={user.id} className="border-b border-gray-100 dark:border-dark-700 hover:bg-gray-50 dark:hover:bg-dark-800">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center">
                              <span className="text-white font-semibold text-sm">
                                {user.nombre_completo?.charAt(0) || '?'}
                              </span>
                            </div>
                            <div>
                              <p className="font-medium text-gray-900 dark:text-white text-sm">
                                {user.nombre_completo}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                {user.rol === 'supervisor_vendedor' ? 'Sup.+Vend.' : 'Vendedor'}
                              </p>
                            </div>
                          </div>
                        </td>
                        {brands.map(brand => (
                          <td key={`${user.id}-${brand.id}`} className="py-2 px-2">
                            <input
                              type="number"
                              min="0"
                              step="100"
                              value={goalsForm[user.id]?.[brand.id] || ''}
                              onChange={(e) => handleGoalChange(user.id, brand.id, parseFloat(e.target.value) || 0)}
                              className="w-24 px-2 py-1.5 text-sm text-center border border-gray-200 dark:border-dark-600 rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-dark-700 dark:text-white"
                              placeholder="$0"
                            />
                          </td>
                        ))}
                        <td className="py-3 px-4 text-right">
                          <Badge variant="green" className="text-sm font-semibold">
                            {formatCurrency(userTotal)}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50 dark:bg-dark-800 font-semibold">
                    <td className="py-3 px-4 text-gray-700 dark:text-gray-300">
                      Total General
                    </td>
                    {brands.map(brand => {
                      const brandTotal = users.reduce((sum, user) => {
                        return sum + (goalsForm[user.id]?.[brand.id] || 0);
                      }, 0);
                      return (
                        <td key={`total-${brand.id}`} className="py-3 px-2 text-center text-emerald-600 dark:text-emerald-400 font-semibold">
                          {formatCurrency(brandTotal)}
                        </td>
                      );
                    })}
                    <td className="py-3 px-4 text-right">
                      <span className="text-lg text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(
                          users.reduce((total, user) => {
                            return total + brands.reduce((sum, brand) => {
                              return sum + (goalsForm[user.id]?.[brand.id] || 0);
                            }, 0);
                          }, 0)
                        )}
                      </span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </Card>
      )}

      {brands.length === 0 && !loading && (
        <Card className="text-center py-12">
          <Target className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400">
            Crea al menos una marca para poder asignar metas
          </p>
        </Card>
      )}

      {/* Modal de Marca */}
      <Modal
        isOpen={showBrandModal}
        onClose={() => {
          setShowBrandModal(false);
          setBrandName('');
          setBrandLogoUrl('');
          setEditingBrand(null);
        }}
        title={editingBrand ? 'Editar Marca' : 'Nueva Marca'}
        size="sm"
      >
        <div className="p-6 space-y-4">
          <Input
            label="Nombre de la marca"
            value={brandName}
            onChange={(e) => setBrandName(e.target.value)}
            placeholder="Ej: Schwarzkopf"
            autoFocus
          />
          <Input
            label="URL del logo (opcional)"
            value={brandLogoUrl}
            onChange={(e) => setBrandLogoUrl(e.target.value)}
            placeholder="https://ejemplo.com/logo.png"
          />
          {brandLogoUrl && (
            <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-dark-700 rounded-lg">
              <img
                src={brandLogoUrl}
                alt="Vista previa"
                className="h-10 w-auto object-contain"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
              <span className="text-xs text-gray-500 dark:text-gray-400">Vista previa del logo</span>
            </div>
          )}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-dark-600">
            <Button variant="secondary" onClick={() => setShowBrandModal(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveBrand}>
              {editingBrand ? 'Actualizar' : 'Crear'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

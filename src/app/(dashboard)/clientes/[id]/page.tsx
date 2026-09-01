'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Phone,
  Mail,
  MapPin,
  Edit,
  Trash2,
  Calendar,
  Clock,
  Building,
  UserPlus,
  UserX,
  CreditCard,
  Star,
  Tag,
  Plus,
  IdCard,
  Cake,
  Hash,
  User,
} from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import { getCustomer, deleteCustomer, type Customer } from '@/lib/services/customers';
import { getCustomerVisits, type Visit } from '@/lib/services/visits';
import { getCurrentUserProfile } from '@/lib/auth/getCurrentUserId';
import {
  formatDate,
  formatDateTime,
  formatCurrency,
  visitStatusLabels,
  formaPagoLabels,
  calidadPagoLabels,
  calidadPagoColors,
  cn,
} from '@/lib/utils';
import toast from 'react-hot-toast';

// Helper para obtener el estado simplificado
const getEstadoCliente = (customer: Customer) => {
  if (customer.etapa_embudo === 'perdido') {
    return { label: 'Perdido', variant: 'red' as const, icon: UserX };
  }
  if (customer.tipo === 'cliente' || customer.etapa_embudo === 'ganado') {
    return { label: 'Cliente', variant: 'green' as const, icon: Building };
  }
  return { label: 'Prospecto', variant: 'blue' as const, icon: UserPlus };
};

export default function ClienteDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const customerId = params.id as string;
  const currentProfile = getCurrentUserProfile();
  // visit.user_id puede ser el id de perfil o el user_id (auth); consideramos ambos como "propios".
  const myIds = [currentProfile?.id, currentProfile?.user_id].filter(Boolean) as string[];
  const isOwnVisit = (v: Visit) => myIds.includes(v.user_id);

  // ¿Hay visitas de más de un vendedor? (cliente compartido)
  const vendorIds = Array.from(new Set(visits.map((v) => v.user_id).filter(Boolean)));
  const isSharedCustomer = vendorIds.length > 1;

  useEffect(() => {
    loadData();
  }, [customerId]);

  const loadData = async () => {
    try {
      const [customerData, visitsData] = await Promise.all([
        getCustomer(customerId),
        getCustomerVisits(customerId),
      ]);
      setCustomer(customerData);
      setVisits(visitsData);
    } catch (error) {
      console.error('Error cargando cliente:', error);
      toast.error('Error al cargar el cliente');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteCustomer(customerId);
      toast.success('Cliente eliminado');
      router.push('/clientes');
    } catch (error) {
      console.error('Error eliminando:', error);
      toast.error('Error al eliminar el cliente');
    } finally {
      setDeleting(false);
      setShowDeleteModal(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500 dark:text-gray-300">Cargando cliente...</div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl text-gray-900 dark:text-white">Cliente no encontrado</h2>
        <Link href="/clientes">
          <Button variant="secondary" className="mt-4">
            Volver a Clientes
          </Button>
        </Link>
      </div>
    );
  }

  const estadoInfo = getEstadoCliente(customer);
  const IconoEstado = estadoInfo.icon;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <Link href="/clientes">
            <Button variant="ghost" size="sm" icon={<ArrowLeft className="h-4 w-4" />}>
              <span className="hidden sm:inline">Volver</span>
            </Button>
          </Link>
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={cn(
                'p-2.5 sm:p-3 rounded-xl flex-shrink-0',
                estadoInfo.variant === 'green' ? 'bg-emerald-50 dark:bg-emerald-900/30' :
                estadoInfo.variant === 'red' ? 'bg-red-50 dark:bg-red-900/30' : 'bg-blue-50 dark:bg-blue-900/30'
              )}
            >
              <IconoEstado className={cn(
                'h-5 w-5 sm:h-6 sm:w-6',
                estadoInfo.variant === 'green' ? 'text-emerald-600 dark:text-emerald-400' :
                estadoInfo.variant === 'red' ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'
              )} />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white break-words">{customer.nombre}</h1>
              <Badge variant={estadoInfo.variant}>
                {estadoInfo.label}
              </Badge>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href={`/calendario/nueva?customer=${customerId}`} className="w-full sm:w-auto">
            <Button icon={<Calendar className="h-4 w-4" />} className="w-full sm:w-auto justify-center">
              Programar Visita
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Información del Cliente */}
        <div className="lg:col-span-1 space-y-4">
          {/* Información de Contacto */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">Información</h2>
              <div className="flex gap-2">
                <Link href={`/clientes/${customerId}/editar`}>
                  <Button variant="ghost" size="sm" icon={<Edit className="h-4 w-4" />} />
                </Link>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<Trash2 className="h-4 w-4 text-red-500" />}
                  onClick={() => setShowDeleteModal(true)}
                />
              </div>
            </div>

            <div className="space-y-4">
              {customer.telefono ? (
                <div className="flex items-center gap-3">
                  <Phone className="h-5 w-5 text-indigo-500 dark:text-indigo-400 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs text-gray-400 dark:text-gray-500">Teléfono</p>
                    <a
                      href={`tel:${customer.telefono}`}
                      className="text-gray-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 font-medium"
                    >
                      {customer.telefono}
                    </a>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 text-gray-300 dark:text-gray-600">
                  <Phone className="h-5 w-5" />
                  <span className="text-sm">Sin teléfono</span>
                </div>
              )}

              {customer.email ? (
                <div className="flex items-center gap-3">
                  <Mail className="h-5 w-5 text-indigo-500 dark:text-indigo-400 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs text-gray-400 dark:text-gray-500">Email</p>
                    <a
                      href={`mailto:${customer.email}`}
                      className="text-gray-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 break-all"
                    >
                      {customer.email}
                    </a>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 text-gray-300 dark:text-gray-600">
                  <Mail className="h-5 w-5" />
                  <span className="text-sm">Sin email</span>
                </div>
              )}

              {customer.direccion ? (
                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-indigo-500 dark:text-indigo-400 mt-0.5 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs text-gray-400 dark:text-gray-500">Dirección</p>
                    <p className="text-gray-900 dark:text-white break-words">{customer.direccion}</p>
                    {(customer.zona || customer.ciudad) && (
                      <p className="text-sm text-gray-500 dark:text-gray-300">
                        {[customer.zona, customer.ciudad].filter(Boolean).join(', ')}
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 text-gray-300 dark:text-gray-600">
                  <MapPin className="h-5 w-5" />
                  <span className="text-sm">Sin dirección</span>
                </div>
              )}
            </div>

            {customer.notas && (
              <div className="mt-4 pt-4 border-t border-gray-100 dark:border-dark-500">
                <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">Notas</p>
                <p className="text-sm text-gray-600 dark:text-gray-200 whitespace-pre-wrap bg-gray-50 dark:bg-dark-800 p-3 rounded-lg">
                  {customer.notas}
                </p>
              </div>
            )}
          </Card>

          {/* Perfil Comercial */}
          <Card>
            <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-indigo-500 dark:text-indigo-400" />
              Perfil Comercial
            </h2>

            <div className="space-y-4">
              {/* Forma de Pago */}
              <div className="flex items-center gap-3">
                <CreditCard className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                <div className="flex-1">
                  <p className="text-xs text-gray-400 dark:text-gray-500">Forma de Pago</p>
                  {customer.forma_pago ? (
                    <Badge variant="blue">
                      {formaPagoLabels[customer.forma_pago] || customer.forma_pago}
                    </Badge>
                  ) : (
                    <span className="text-sm text-gray-400 dark:text-gray-500">Sin especificar</span>
                  )}
                </div>
              </div>

              {/* Calidad de Pago */}
              <div className="flex items-center gap-3">
                <Star className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                <div className="flex-1">
                  <p className="text-xs text-gray-400 dark:text-gray-500">Calidad de Pago</p>
                  {customer.calidad_pago ? (
                    <Badge 
                      variant={
                        customer.calidad_pago === 'buena' ? 'green' :
                        customer.calidad_pago === 'regular' ? 'yellow' : 'red'
                      }
                    >
                      {calidadPagoLabels[customer.calidad_pago] || customer.calidad_pago}
                    </Badge>
                  ) : (
                    <span className="text-sm text-gray-400 dark:text-gray-500">Sin especificar</span>
                  )}
                </div>
              </div>

              {/* Categoría de Compra */}
              <div className="flex items-center gap-3">
                <Tag className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                <div className="flex-1">
                  <p className="text-xs text-gray-400 dark:text-gray-500">Categoría de Compra</p>
                  {customer.categoria_compra ? (
                    <Badge variant="purple">
                      {customer.categoria_compra}
                    </Badge>
                  ) : (
                    <span className="text-sm text-gray-400 dark:text-gray-500">Sin especificar</span>
                  )}
                </div>
              </div>

              {/* Etiquetas generales */}
              {customer.etiquetas && customer.etiquetas.length > 0 && (
                <div className="pt-3 border-t border-gray-100 dark:border-dark-500">
                  <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">Etiquetas</p>
                  <div className="flex flex-wrap gap-2">
                    {customer.etiquetas.map((tag) => (
                      <Badge key={tag} variant="gray">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Datos Fiscales / Identificación */}
          {(customer.num_identificacion || customer.codigo_cliente_ventas || customer.fecha_nacimiento) && (
            <Card>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <IdCard className="h-5 w-5 text-indigo-500" />
                Identificación
              </h2>

              <div className="space-y-4">
                {customer.num_identificacion && (
                  <div className="flex items-center gap-3">
                    <IdCard className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                    <div className="flex-1">
                      <p className="text-xs text-gray-400 dark:text-gray-500">
                        {customer.tipo_identificacion === 'R' ? 'RUC' : customer.tipo_identificacion === 'C' ? 'Cédula' : 'Identificación'}
                      </p>
                      <p className="text-sm font-medium text-gray-900 dark:text-white font-mono">
                        {customer.num_identificacion}
                      </p>
                    </div>
                  </div>
                )}

                {customer.fecha_nacimiento && (
                  <div className="flex items-center gap-3">
                    <Cake className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                    <div className="flex-1">
                      <p className="text-xs text-gray-400 dark:text-gray-500">Fecha de Nacimiento</p>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {formatDate(customer.fecha_nacimiento)}
                      </p>
                    </div>
                  </div>
                )}

                {customer.codigo_cliente_ventas && (
                  <div className="flex items-center gap-3">
                    <Hash className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                    <div className="flex-1">
                      <p className="text-xs text-gray-400 dark:text-gray-500">Código Sistema Ventas</p>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {customer.codigo_cliente_ventas}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* Stats */}
          <Card>
            <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-4">Resumen</h3>
            <div className="text-center p-3 rounded-lg bg-gray-50 dark:bg-dark-800">
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{visits.length}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Visitas</p>
            </div>
          </Card>
        </div>

        {/* Timeline */}
        <div className="lg:col-span-2 space-y-6">
          {/* Visitas */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">
                Visitas
                <Badge variant="blue" className="ml-2">
                  {visits.length}
                </Badge>
                {isSharedCustomer && (
                  <Badge variant="purple" className="ml-2">
                    {vendorIds.length} vendedores
                  </Badge>
                )}
              </h2>
              <Link href={`/calendario/nueva?customer=${customerId}`}>
                <Button variant="ghost" size="sm" icon={<Plus className="h-4 w-4" />}>
                  Nueva
                </Button>
              </Link>
            </div>

            {visits.length === 0 ? (
              <p className="text-center text-gray-500 dark:text-gray-300 py-8">
                No hay visitas registradas
              </p>
            ) : (
              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                {visits.map((visit) => (
                  <Link
                    key={visit.id}
                    href={`/calendario/${visit.id}`}
                    className="block p-3 rounded-lg bg-gray-50 dark:bg-dark-800 hover:bg-gray-100 dark:hover:bg-dark-600 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex-shrink-0">
                          <Calendar className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 dark:text-white">
                            {formatDateTime(visit.scheduled_at)}
                          </p>
                          {visit.creator?.nombre_completo && (
                            <p className="mt-0.5 flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                              <User className="h-3 w-3 flex-shrink-0" />
                              <span className="truncate">{visit.creator.nombre_completo}</span>
                              {!isOwnVisit(visit) && (
                                <Badge variant="gray" className="ml-1">Otro vendedor</Badge>
                              )}
                            </p>
                          )}
                          {visit.objetivo && (
                            <p className="text-sm text-gray-500 dark:text-gray-300 mt-1 break-words">
                              {visit.objetivo}
                            </p>
                          )}
                          {visit.observaciones && (
                            <p className="text-sm text-gray-400 dark:text-gray-400 mt-1 italic break-words">
                              "{visit.observaciones}"
                            </p>
                          )}
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
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </Card>

        </div>
      </div>

      {/* Delete Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Eliminar Cliente"
        size="sm"
      >
        <div className="p-4 sm:p-6">
          <p className="text-gray-500 dark:text-gray-300 mb-6">
            ¿Estás segura de eliminar a <strong className="text-gray-900 dark:text-white">{customer.nombre}</strong>?
            Esta acción no se puede deshacer.
          </p>
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
            <Button variant="secondary" onClick={() => setShowDeleteModal(false)} className="w-full sm:w-auto">
              Cancelar
            </Button>
            <Button variant="danger" onClick={handleDelete} loading={deleting} className="w-full sm:w-auto">
              Eliminar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

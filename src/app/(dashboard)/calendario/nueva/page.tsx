'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Search, Loader2 } from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Textarea from '@/components/ui/Textarea';
import VoiceDictate from '@/components/ui/VoiceDictate';
import { getCustomers, type Customer } from '@/lib/services/customers';
import { createVisit } from '@/lib/services/visits';
import { isDateBlocked } from '@/lib/services/blockedDays';
import { isUserOnVacation } from '@/lib/services/vacations';
import { getStrategicObjectivesForSelection } from '@/lib/services/activities';
import { searchCustomers } from '@/lib/search';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import type { VisitInsert, Activity } from '@/types/database';
import { useAuth } from '@/contexts/AuthContext';

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
    </div>
  );
}

export default function NuevaVisitaPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <NuevaVisitaContent />
    </Suspense>
  );
}

function NuevaVisitaContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { userProfile } = useAuth();
  const preselectedCustomerId = searchParams.get('customer');
  const preselectedDate = searchParams.get('date');

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [strategicObjectives, setStrategicObjectives] = useState<Pick<Activity, 'id' | 'titulo' | 'tipo' | 'fecha_inicio' | 'estado'>[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(true);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState<VisitInsert>({
    customer_id: preselectedCustomerId || '',
    scheduled_at: preselectedDate
      ? format(new Date(preselectedDate), "yyyy-MM-dd'T'HH:mm")
      : format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    status: 'programada',
    objetivo: '',
    location_text: '',
    objetivo_estrategico_id: '',
  });

  useEffect(() => {
    // Reintentar carga si el perfil no está listo aún
    let retries = 0;
    const tryLoad = async () => {
      try {
        const data = await getCustomers();
        if (data.length > 0 || retries >= 3) {
          setCustomers(data);
          setLoadingCustomers(false);
        } else {
          retries++;
          setTimeout(tryLoad, 500);
        }
      } catch (error) {
        console.error('Error cargando clientes:', error);
        if (retries < 3) {
          retries++;
          setTimeout(tryLoad, 500);
        } else {
          setLoadingCustomers(false);
        }
      }
    };
    tryLoad();
    loadStrategicObjectives();
  }, []);

  const loadStrategicObjectives = async () => {
    try {
      const data = await getStrategicObjectivesForSelection();
      setStrategicObjectives(data);
    } catch (error) {
      console.error('Error cargando objetivos estratégicos:', error);
    }
  };

  useEffect(() => {
    if (preselectedCustomerId) {
      const customer = customers.find((c) => c.id === preselectedCustomerId);
      if (customer) {
        setFormData((prev) => ({
          ...prev,
          location_text: customer.direccion || '',
        }));
      }
    }
  }, [preselectedCustomerId, customers]);

  // Búsqueda robusta de clientes (ignora tildes, busca en cualquier orden)
  const filteredCustomers = searchTerm.trim()
    ? searchCustomers(customers, searchTerm)
    : customers;

  const selectedCustomer = customers.find((c) => c.id === formData.customer_id);

  const handleCustomerSelect = (customerId: string) => {
    const customer = customers.find((c) => c.id === customerId);
    setFormData({
      ...formData,
      customer_id: customerId,
      location_text: customer?.direccion || formData.location_text,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.customer_id) {
      toast.error('Selecciona un cliente');
      return;
    }

    if (!formData.scheduled_at) {
      toast.error('La fecha y hora son obligatorias');
      return;
    }

    const scheduledDate = new Date(formData.scheduled_at);
    try {
      const blocked = await isDateBlocked(scheduledDate);
      if (blocked) {
        toast.error('No se puede programar en un día no laborable. Elige otra fecha.');
        return;
      }
      if (userProfile?.id) {
        const onVacation = await isUserOnVacation(userProfile.id, scheduledDate);
        if (onVacation) {
          toast.error('Tienes vacaciones aprobadas ese día. No se puede programar.');
          return;
        }
      }
    } catch {
      // Si falla la consulta, permitir continuar
    }

    setLoading(true);

    try {
      await createVisit({
        ...formData,
        scheduled_at: new Date(formData.scheduled_at).toISOString(),
      });

      toast.success('Visita programada exitosamente');
      router.push('/calendario');
    } catch (error) {
      console.error('Error creando visita:', error);
      toast.error('Error al programar la visita');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/calendario">
          <Button variant="ghost" size="sm" icon={<ArrowLeft className="h-4 w-4" />}>
            Volver
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Nueva Visita</h1>
          <p className="text-gray-500">Programa una visita a un cliente</p>
        </div>
      </div>

      {/* Form */}
      <Card>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Cliente */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">
              Cliente
            </h3>
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
                  onClick={() => setFormData({ ...formData, customer_id: '' })}
                >
                  Cambiar
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <Input
                  placeholder="Buscar cliente por nombre o teléfono..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  icon={<Search className="h-4 w-4" />}
                />
                <div className="max-h-[200px] overflow-y-auto space-y-2">
                  {filteredCustomers.slice(0, 10).map((customer) => (
                    <button
                      key={customer.id}
                      type="button"
                      onClick={() => handleCustomerSelect(customer.id)}
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
                  {filteredCustomers.length === 0 && (
                    loadingCustomers ? (
                      <div className="flex items-center justify-center gap-2 py-4 text-gray-500">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Cargando clientes...</span>
                      </div>
                    ) : (
                      <p className="text-center text-gray-500 py-4">
                        No se encontraron clientes
                      </p>
                    )
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Programación */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">
              Programación
            </h3>
            <Input
              label="Fecha y Hora *"
              type="datetime-local"
              value={formData.scheduled_at}
              onChange={(e) => setFormData({ ...formData, scheduled_at: e.target.value })}
              required
            />
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-200">Objetivo de la Visita</label>
                <VoiceDictate size="sm" onTranscript={(t) => setFormData(prev => ({ ...prev, objetivo: (prev.objetivo || '') + (prev.objetivo ? ' ' : '') + t }))} />
              </div>
              <Textarea
                value={formData.objetivo || ''}
                onChange={(e) => setFormData({ ...formData, objetivo: e.target.value })}
                placeholder="¿Cuál es el propósito de esta visita?"
                rows={3}
              />
            </div>
            <Input
              label="Ubicación / Dirección"
              value={formData.location_text || ''}
              onChange={(e) => setFormData({ ...formData, location_text: e.target.value })}
              placeholder="Dirección o punto de referencia"
            />
          </div>

          {/* Vincular a Objetivo Estratégico */}
          <div className="bg-indigo-50 rounded-xl p-4 space-y-3">
            <h4 className="text-sm font-semibold text-indigo-700">
              Vincular a Objetivo Estratégico (opcional)
            </h4>
            {strategicObjectives.length > 0 ? (
              <>
                <select
                  value={formData.objetivo_estrategico_id || ''}
                  onChange={(e) => setFormData({ ...formData, objetivo_estrategico_id: e.target.value || null })}
                  className="w-full px-4 py-2.5 border border-indigo-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors bg-white"
                >
                  <option value="">Sin vincular</option>
                  {strategicObjectives.map((obj) => (
                    <option key={obj.id} value={obj.id}>
                      {obj.titulo} ({obj.tipo === 'reunion' ? 'Reunión' : obj.tipo === 'capacitacion' ? 'Capacitación' : 'Seguimiento'})
                    </option>
                  ))}
                </select>
                <p className="text-xs text-indigo-600">
                  Si vinculas esta visita a un objetivo estratégico, el supervisor podrá verla al consultar ese objetivo.
                </p>
              </>
            ) : (
              <p className="text-sm text-indigo-500">No hay objetivos estratégicos activos disponibles.</p>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-3 pt-4 border-t border-gray-200">
            <Link href="/calendario">
              <Button variant="secondary">Cancelar</Button>
            </Link>
            <Button type="submit" loading={loading}>
              Programar Visita
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

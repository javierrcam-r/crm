'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Search } from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Textarea from '@/components/ui/Textarea';
import { getCustomers, type Customer } from '@/lib/services/customers';
import { createVisit } from '@/lib/services/visits';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import type { VisitInsert } from '@/types/database';

export default function NuevaVisitaPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedCustomerId = searchParams.get('customer');
  const preselectedDate = searchParams.get('date');

  const [customers, setCustomers] = useState<Customer[]>([]);
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
  });

  useEffect(() => {
    loadCustomers();
  }, []);

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

  const loadCustomers = async () => {
    try {
      const data = await getCustomers();
      setCustomers(data);
    } catch (error) {
      console.error('Error cargando clientes:', error);
    }
  };

  const filteredCustomers = customers.filter(
    (c) =>
      c.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.telefono?.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
                    <p className="text-center text-gray-500 py-4">
                      No se encontraron clientes
                    </p>
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
            <Textarea
              label="Objetivo de la Visita"
              value={formData.objetivo || ''}
              onChange={(e) => setFormData({ ...formData, objetivo: e.target.value })}
              placeholder="¿Cuál es el propósito de esta visita?"
              rows={3}
            />
            <Input
              label="Ubicación / Dirección"
              value={formData.location_text || ''}
              onChange={(e) => setFormData({ ...formData, location_text: e.target.value })}
              placeholder="Dirección o punto de referencia"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
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

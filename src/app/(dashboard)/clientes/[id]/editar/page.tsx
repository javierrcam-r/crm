'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Textarea from '@/components/ui/Textarea';
import { getCustomer, updateCustomer, type Customer } from '@/lib/services/customers';
import toast from 'react-hot-toast';
import type { CustomerUpdate } from '@/types/database';

export default function EditarClientePage() {
  const params = useParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<CustomerUpdate>({
    nombre: '',
    tipo: 'prospecto',
    etapa_embudo: 'nuevo',
    telefono: '',
    email: '',
    direccion: '',
    zona: '',
    ciudad: '',
    notas: '',
    etiquetas: [],
  });
  const [estado, setEstado] = useState('prospecto');
  const [etiquetasText, setEtiquetasText] = useState('');

  const customerId = params.id as string;

  useEffect(() => {
    loadCustomer();
  }, [customerId]);

  const loadCustomer = async () => {
    try {
      const customer = await getCustomer(customerId);
      
      // Determinar el estado basado en tipo y etapa_embudo
      let estadoActual = 'prospecto';
      if (customer.etapa_embudo === 'perdido') {
        estadoActual = 'perdido';
      } else if (customer.tipo === 'cliente' || customer.etapa_embudo === 'ganado') {
        estadoActual = 'cliente';
      }
      
      setEstado(estadoActual);
      setFormData({
        nombre: customer.nombre,
        tipo: customer.tipo,
        etapa_embudo: customer.etapa_embudo,
        telefono: customer.telefono || '',
        email: customer.email || '',
        direccion: customer.direccion || '',
        zona: customer.zona || '',
        ciudad: customer.ciudad || '',
        notas: customer.notas || '',
        etiquetas: customer.etiquetas || [],
      });
      setEtiquetasText(customer.etiquetas?.join(', ') || '');
    } catch (error) {
      console.error('Error cargando cliente:', error);
      toast.error('Error al cargar el cliente');
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

    setSaving(true);

    try {
      const etiquetas = etiquetasText
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      // Mapear el estado a tipo y etapa_embudo para compatibilidad con la BD
      let tipo: 'cliente' | 'prospecto' = 'prospecto';
      let etapa_embudo: CustomerUpdate['etapa_embudo'] = 'nuevo';
      
      if (estado === 'cliente') {
        tipo = 'cliente';
        etapa_embudo = 'ganado';
      } else if (estado === 'perdido') {
        tipo = 'prospecto';
        etapa_embudo = 'perdido';
      }

      await updateCustomer(customerId, {
        ...formData,
        tipo,
        etapa_embudo,
        etiquetas,
      });

      toast.success('Cliente actualizado');
      router.push(`/clientes/${customerId}`);
    } catch (error) {
      console.error('Error actualizando cliente:', error);
      toast.error('Error al actualizar el cliente');
    } finally {
      setSaving(false);
    }
  };

  const estadoOptions = [
    { value: 'prospecto', label: 'Prospecto' },
    { value: 'cliente', label: 'Cliente' },
    { value: 'perdido', label: 'Perdido' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Cargando cliente...</div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href={`/clientes/${customerId}`}>
          <Button variant="ghost" size="sm" icon={<ArrowLeft className="h-4 w-4" />}>
            Volver
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Editar Cliente</h1>
          <p className="text-gray-500">Modifica los datos del cliente</p>
        </div>
      </div>

      {/* Form */}
      <Card>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Datos básicos */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">
              Datos Básicos
            </h3>
            <Input
              label="Nombre *"
              value={formData.nombre || ''}
              onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
              placeholder="Nombre del cliente o empresa"
              required
            />
            <Select
              label="Estado"
              options={estadoOptions}
              value={estado}
              onChange={(e) => setEstado(e.target.value)}
            />
          </div>

          {/* Contacto */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">
              Información de Contacto
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Teléfono"
                value={formData.telefono || ''}
                onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                placeholder="+595 XXX XXX XXX"
              />
              <Input
                label="Email"
                type="email"
                value={formData.email || ''}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="correo@ejemplo.com"
              />
            </div>
          </div>

          {/* Ubicación */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">
              Ubicación
            </h3>
            <Input
              label="Dirección"
              value={formData.direccion || ''}
              onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
              placeholder="Calle, número, referencias"
            />
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Zona"
                value={formData.zona || ''}
                onChange={(e) => setFormData({ ...formData, zona: e.target.value })}
                placeholder="Barrio o zona"
              />
              <Input
                label="Ciudad"
                value={formData.ciudad || ''}
                onChange={(e) => setFormData({ ...formData, ciudad: e.target.value })}
                placeholder="Ciudad"
              />
            </div>
          </div>

          {/* Adicional */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">
              Información Adicional
            </h3>
            <Input
              label="Etiquetas"
              value={etiquetasText}
              onChange={(e) => setEtiquetasText(e.target.value)}
              placeholder="farmacia, mayorista, zona norte (separadas por coma)"
            />
            <Textarea
              label="Notas"
              value={formData.notas || ''}
              onChange={(e) => setFormData({ ...formData, notas: e.target.value })}
              placeholder="Notas adicionales sobre el cliente..."
              rows={4}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <Link href={`/clientes/${customerId}`}>
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

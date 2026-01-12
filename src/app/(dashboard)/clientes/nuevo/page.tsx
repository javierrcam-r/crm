'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CreditCard, Tag, MapPin } from 'lucide-react';
import Link from 'next/link';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Textarea from '@/components/ui/Textarea';
import { createCustomer } from '@/lib/services/customers';
import toast from 'react-hot-toast';
import type { CustomerInsert, FormaPago, CalidadPago } from '@/types/database';

type EstadoCliente = 'prospecto' | 'cliente' | 'perdido';

export default function NuevoClientePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [estadoCliente, setEstadoCliente] = useState<EstadoCliente>('prospecto');
  const [formData, setFormData] = useState<Omit<CustomerInsert, 'tipo' | 'etapa_embudo'>>({
    nombre: '',
    telefono: '',
    email: '',
    direccion: '',
    zona: '',
    ciudad: '',
    notas: '',
    etiquetas: [],
    forma_pago: null,
    calidad_pago: null,
    categoria_compra: '',
    latitud: null,
    longitud: null,
  });
  const [etiquetasText, setEtiquetasText] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.nombre.trim()) {
      toast.error('El nombre es obligatorio');
      return;
    }

    setLoading(true);

    try {
      const etiquetas = etiquetasText
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      // Mapear el estado seleccionado a tipo y etapa_embudo
      let tipo: 'cliente' | 'prospecto' = 'prospecto';
      let etapa_embudo: CustomerInsert['etapa_embudo'] = 'nuevo';
      
      if (estadoCliente === 'cliente') {
        tipo = 'cliente';
        etapa_embudo = 'ganado';
      } else if (estadoCliente === 'perdido') {
        tipo = 'prospecto';
        etapa_embudo = 'perdido';
      }

      await createCustomer({
        ...formData,
        tipo,
        etapa_embudo,
        etiquetas,
        forma_pago: formData.forma_pago || null,
        calidad_pago: formData.calidad_pago || null,
        categoria_compra: formData.categoria_compra || null,
        latitud: formData.latitud || null,
        longitud: formData.longitud || null,
      });

      toast.success('Cliente creado exitosamente');
      router.push('/clientes');
    } catch (error) {
      console.error('Error creando cliente:', error);
      toast.error('Error al crear el cliente');
    } finally {
      setLoading(false);
    }
  };

  const estadoOptions = [
    { value: 'prospecto', label: 'Prospecto' },
    { value: 'cliente', label: 'Cliente' },
    { value: 'perdido', label: 'Perdido' },
  ];

  const formaPagoOptions = [
    { value: '', label: 'Sin especificar' },
    { value: 'contado', label: 'Contado' },
    { value: 'cheque', label: 'Cheque' },
    { value: 'plazos_cortos', label: 'Plazos cortos (hasta 30 días)' },
    { value: 'plazos_medios', label: 'Plazos medios (30-60 días)' },
    { value: 'plazos_largos', label: 'Plazos largos (+60 días)' },
  ];

  const calidadPagoOptions = [
    { value: '', label: 'Sin especificar' },
    { value: 'buena', label: 'Buena paga' },
    { value: 'regular', label: 'Regular' },
    { value: 'mala', label: 'Mala paga' },
  ];

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/clientes">
          <Button variant="ghost" size="sm" icon={<ArrowLeft className="h-4 w-4" />}>
            Volver
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Nuevo Cliente</h1>
          <p className="text-gray-500">Agrega un nuevo cliente o prospecto</p>
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
              value={formData.nombre}
              onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
              placeholder="Nombre del cliente o empresa"
              required
            />
            <Select
              label="Estado"
              options={estadoOptions}
              value={estadoCliente}
              onChange={(e) => setEstadoCliente(e.target.value as EstadoCliente)}
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
            <h3 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2 flex items-center gap-2">
              <MapPin className="h-5 w-5 text-indigo-500" />
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
            
            {/* Coordenadas para el mapa */}
            <div className="p-4 bg-indigo-50/50 rounded-xl border border-indigo-100">
              <p className="text-sm font-medium text-indigo-900 mb-3">
                📍 Coordenadas para el Mapa de Visitas
              </p>
              <p className="text-xs text-indigo-700 mb-3">
                Puedes obtener las coordenadas buscando la dirección en{' '}
                <a 
                  href="https://www.google.com/maps" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="underline hover:text-indigo-900"
                >
                  Google Maps
                </a>
                {' '}y haciendo clic derecho en la ubicación.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Latitud"
                  type="number"
                  step="any"
                  value={formData.latitud || ''}
                  onChange={(e) => setFormData({ ...formData, latitud: e.target.value ? parseFloat(e.target.value) : null })}
                  placeholder="-25.2867"
                />
                <Input
                  label="Longitud"
                  type="number"
                  step="any"
                  value={formData.longitud || ''}
                  onChange={(e) => setFormData({ ...formData, longitud: e.target.value ? parseFloat(e.target.value) : null })}
                  placeholder="-57.6470"
                />
              </div>
            </div>
          </div>

          {/* Información Comercial */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2 flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-indigo-500" />
              Información Comercial
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select
                label="Forma de Pago"
                options={formaPagoOptions}
                value={formData.forma_pago || ''}
                onChange={(e) => setFormData({ ...formData, forma_pago: (e.target.value || null) as FormaPago | null })}
              />
              <Select
                label="Calidad de Pago"
                options={calidadPagoOptions}
                value={formData.calidad_pago || ''}
                onChange={(e) => setFormData({ ...formData, calidad_pago: (e.target.value || null) as CalidadPago | null })}
              />
            </div>
            <Input
              label="Categoría de Compra Principal"
              value={formData.categoria_compra || ''}
              onChange={(e) => setFormData({ ...formData, categoria_compra: e.target.value })}
              placeholder="Ej: Cosmética, Farmacia, Limpieza..."
              icon={<Tag className="h-4 w-4" />}
            />
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
            <Link href="/clientes">
              <Button variant="secondary">Cancelar</Button>
            </Link>
            <Button type="submit" loading={loading}>
              Guardar Cliente
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, CreditCard, Tag, MapPin, Link2, CheckCircle, ExternalLink } from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Textarea from '@/components/ui/Textarea';
import { getCustomer, updateCustomer, type Customer } from '@/lib/services/customers';
import toast from 'react-hot-toast';
import type { CustomerUpdate, FormaPago, CalidadPago } from '@/types/database';
import { extractCoordsFromGoogleMapsUrl, generateGoogleMapsUrl } from '@/lib/utils';
import { reverseGeocode, resolveGoogleMapsUrl } from '@/lib/geocode';

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
    forma_pago: null,
    calidad_pago: null,
    categoria_compra: '',
    latitud: null,
    longitud: null,
  });
  const [estado, setEstado] = useState('prospecto');
  const [etiquetasText, setEtiquetasText] = useState('');
  const [mapsLink, setMapsLink] = useState('');
  const [coordsExtracted, setCoordsExtracted] = useState(false);

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
        forma_pago: customer.forma_pago,
        calidad_pago: customer.calidad_pago,
        categoria_compra: customer.categoria_compra || '',
        latitud: customer.latitud,
        longitud: customer.longitud,
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
        forma_pago: formData.forma_pago || null,
        calidad_pago: formData.calidad_pago || null,
        categoria_compra: formData.categoria_compra || null,
        latitud: formData.latitud || null,
        longitud: formData.longitud || null,
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

  const [loadingLocation, setLoadingLocation] = useState(false);

  // Función para extraer coordenadas del link de Google Maps (soporta enlaces cortos)
  const handleMapsLinkChange = async (link: string) => {
    setMapsLink(link);
    setCoordsExtracted(false);
    
    if (!link.trim()) return;
    
    // Si es un enlace corto, mostrar loading
    const isShortUrl = link.includes('goo.gl') || link.includes('maps.app.goo.gl');
    if (isShortUrl) {
      setLoadingLocation(true);
    }
    
    try {
      // Usar resolveGoogleMapsUrl que maneja enlaces largos y cortos
      const coords = await resolveGoogleMapsUrl(link);
      
      if (coords) {
        setFormData(prev => ({
          ...prev,
          latitud: coords.lat,
          longitud: coords.lng
        }));
        setCoordsExtracted(true);
        
        // Obtener dirección automáticamente
        const geoResult = await reverseGeocode(coords.lat, coords.lng);
        if (geoResult) {
          setFormData(prev => ({
            ...prev,
            direccion: geoResult.direccion || prev.direccion,
            zona: geoResult.zona || prev.zona,
            ciudad: geoResult.ciudad || prev.ciudad,
          }));
          toast.success('Ubicación y dirección detectadas');
        }
      } else if (isShortUrl) {
        // Si es enlace corto y no se pudo resolver, dar instrucciones
        toast.error('Abre el enlace en tu navegador y copia la URL completa de la barra de direcciones', {
          duration: 5000,
        });
      }
    } catch (error) {
      console.error('Error obteniendo ubicación:', error);
      if (isShortUrl) {
        toast.error('Abre el enlace en tu navegador y copia la URL completa', { duration: 5000 });
      } else {
        toast.error('No se pudo obtener la ubicación');
      }
    } finally {
      setLoadingLocation(false);
    }
  };

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
              <p className="text-sm font-medium text-indigo-900 mb-2 flex items-center gap-2">
                <Link2 className="h-4 w-4" />
                Ubicación en el Mapa
              </p>
              <p className="text-xs text-indigo-700 mb-2">
                Pega el link de Google Maps para extraer automáticamente las coordenadas.
              </p>
              <p className="text-xs text-indigo-600 mb-3 bg-indigo-100 p-2 rounded-lg">
                💡 <strong>Tip:</strong> Si usas un enlace corto (maps.app.goo.gl), ábrelo primero en tu navegador y copia la URL completa de la barra de direcciones.
              </p>
              
              {/* Campo para pegar link de Google Maps */}
              <div className="mb-3">
                <label className="block text-xs font-medium text-indigo-800 mb-1.5">
                  Link de Google Maps
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={mapsLink}
                    onChange={(e) => handleMapsLinkChange(e.target.value)}
                    placeholder="Pega aquí el link de Google Maps (o enlace compartido)..."
                    disabled={loadingLocation}
                    className={`w-full px-3 py-2.5 pr-10 text-sm bg-white border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
                      coordsExtracted 
                        ? 'border-emerald-300 focus:ring-emerald-200' 
                        : 'border-indigo-200 focus:ring-indigo-200'
                    } ${loadingLocation ? 'opacity-70' : ''}`}
                  />
                  {loadingLocation && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <div className="animate-spin h-5 w-5 border-2 border-indigo-300 border-t-indigo-600 rounded-full"></div>
                    </div>
                  )}
                  {coordsExtracted && !loadingLocation && (
                    <CheckCircle className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-emerald-500" />
                  )}
                </div>
                {mapsLink && !coordsExtracted && !loadingLocation && (
                  <p className="text-xs text-amber-600 mt-1">
                    No se pudieron extraer coordenadas. Intenta con otro formato de link.
                  </p>
                )}
                {loadingLocation && (
                  <p className="text-xs text-indigo-600 mt-1">
                    Resolviendo enlace compartido...
                  </p>
                )}
              </div>

              {/* Mostrar coordenadas extraídas */}
              {(formData.latitud && formData.longitud) && (
                <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-indigo-100">
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">Coordenadas detectadas</p>
                    <p className="text-sm font-medium text-gray-900">
                      {formData.latitud?.toFixed(6)}, {formData.longitud?.toFixed(6)}
                    </p>
                  </div>
                  <a
                    href={generateGoogleMapsUrl(formData.latitud, formData.longitud)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition-colors"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Ver en Maps
                  </a>
                </div>
              )}
              
              {/* Campos ocultos para edición manual avanzada */}
              <details className="mt-3">
                <summary className="text-xs text-indigo-600 cursor-pointer hover:text-indigo-800">
                  Editar coordenadas manualmente
                </summary>
                <div className="grid grid-cols-2 gap-3 mt-2">
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
              </details>
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

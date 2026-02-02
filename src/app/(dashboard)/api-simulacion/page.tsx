'use client';

import { useState, useEffect } from 'react';
import { 
  Plus, 
  Database, 
  Copy, 
  ExternalLink, 
  Trash2, 
  RefreshCw,
  Code,
  Check,
  Play,
  Pause,
  Clock
} from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import Badge from '@/components/ui/Badge';
import {
  getApiSimulations,
  createApiSimulation,
  updateApiSimulation,
  deleteApiSimulation,
  regenerateMockData,
  type ApiSimulation,
  type ApiSimulationInsert
} from '@/lib/services/apiSimulations';
import toast from 'react-hot-toast';

const exampleSchemas = [
  {
    name: 'Usuario',
    schema: {
      id: 'uuid',
      nombre: 'string',
      email: 'email',
      telefono: 'phone',
      activo: 'boolean',
      created_at: 'datetime'
    }
  },
  {
    name: 'Producto',
    schema: {
      id: 'uuid',
      sku: 'string',
      nombre: 'string',
      descripcion: 'string',
      precio: 'currency',
      stock: 'number',
      activo: 'boolean'
    }
  },
  {
    name: 'Pedido',
    schema: {
      id: 'uuid',
      numero: 'string',
      cliente: 'string',
      total: 'currency',
      estado: 'status',
      fecha: 'datetime',
      items: {
        type: 'array',
        count: 3,
        items: {
          producto: 'string',
          cantidad: 'number',
          precio: 'currency'
        }
      }
    }
  },
  {
    name: 'Respuesta API Externa',
    schema: {
      success: 'boolean',
      data: {
        id: 'uuid',
        message: 'string',
        timestamp: 'datetime'
      },
      meta: {
        version: 'string',
        request_id: 'uuid'
      }
    }
  }
];

export default function ApiSimulacionPage() {
  const [simulations, setSimulations] = useState<ApiSimulation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [selectedSimulation, setSelectedSimulation] = useState<ApiSimulation | null>(null);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  
  // Form state
  const [formData, setFormData] = useState<ApiSimulationInsert>({
    nombre: '',
    descripcion: '',
    slug: '',
    response_schema: {},
    delay_ms: 0
  });
  const [schemaText, setSchemaText] = useState('{\n  \n}');
  const [schemaError, setSchemaError] = useState<string | null>(null);
  
  useEffect(() => {
    loadData();
  }, []);
  
  async function loadData() {
    try {
      setLoading(true);
      const data = await getApiSimulations();
      setSimulations(data);
    } catch (error) {
      console.error('Error loading simulations:', error);
      toast.error('Error al cargar las simulaciones');
    } finally {
      setLoading(false);
    }
  }
  
  function generateSlug(name: string): string {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }
  
  function handleNameChange(name: string) {
    setFormData(prev => ({
      ...prev,
      nombre: name,
      slug: generateSlug(name)
    }));
  }
  
  function handleSchemaChange(text: string) {
    setSchemaText(text);
    setSchemaError(null);
    
    try {
      const parsed = JSON.parse(text);
      setFormData(prev => ({ ...prev, response_schema: parsed }));
    } catch (e) {
      setSchemaError('JSON inválido');
    }
  }
  
  function loadExampleSchema(example: typeof exampleSchemas[0]) {
    const text = JSON.stringify(example.schema, null, 2);
    setSchemaText(text);
    setFormData(prev => ({ 
      ...prev, 
      nombre: prev.nombre || `API ${example.name}`,
      slug: prev.slug || generateSlug(`api-${example.name}`),
      response_schema: example.schema 
    }));
    setSchemaError(null);
  }
  
  async function handleCreate() {
    if (!formData.nombre || !formData.slug) {
      toast.error('Nombre y slug son requeridos');
      return;
    }
    
    if (schemaError || Object.keys(formData.response_schema).length === 0) {
      toast.error('El schema debe ser un JSON válido');
      return;
    }
    
    try {
      await createApiSimulation(formData);
      toast.success('API Simulación creada');
      setShowCreateModal(false);
      resetForm();
      loadData();
    } catch (error: any) {
      console.error('Error creating simulation:', error);
      toast.error(error?.message || 'Error al crear la simulación');
    }
  }
  
  async function handleDelete(id: string) {
    if (!confirm('¿Estás seguro de eliminar esta API simulación?')) return;
    
    try {
      await deleteApiSimulation(id);
      toast.success('API eliminada');
      loadData();
    } catch (error) {
      toast.error('Error al eliminar');
    }
  }
  
  async function handleRegenerate(id: string) {
    try {
      await regenerateMockData(id);
      toast.success('Datos regenerados');
      loadData();
    } catch (error) {
      toast.error('Error al regenerar datos');
    }
  }
  
  async function handleToggleActive(simulation: ApiSimulation) {
    try {
      await updateApiSimulation(simulation.id, { activo: !simulation.activo });
      toast.success(simulation.activo ? 'API desactivada' : 'API activada');
      loadData();
    } catch (error) {
      toast.error('Error al cambiar estado');
    }
  }
  
  function copyUrl(slug: string) {
    const url = `${window.location.origin}/api/mock/${slug}`;
    navigator.clipboard.writeText(url);
    setCopiedUrl(slug);
    toast.success('URL copiada');
    setTimeout(() => setCopiedUrl(null), 2000);
  }
  
  function openPreview(simulation: ApiSimulation) {
    setSelectedSimulation(simulation);
    setShowPreviewModal(true);
  }
  
  function resetForm() {
    setFormData({
      nombre: '',
      descripcion: '',
      slug: '',
      response_schema: {},
      delay_ms: 0
    });
    setSchemaText('{\n  \n}');
    setSchemaError(null);
  }
  
  function getApiUrl(slug: string): string {
    if (typeof window !== 'undefined') {
      return `${window.location.origin}/api/mock/${slug}`;
    }
    return `/api/mock/${slug}`;
  }
  
  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }
  
  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Database className="h-7 w-7 text-indigo-600" />
            API Simulación
          </h1>
          <p className="text-gray-500 mt-1">Crea APIs mock con datos simulados para desarrollo y pruebas</p>
        </div>
        
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nueva API
        </Button>
      </div>
      
      {/* Info */}
      <Card className="bg-gradient-to-r from-indigo-50 to-purple-50 border-indigo-100">
        <div className="flex items-start gap-3">
          <Code className="h-5 w-5 text-indigo-600 mt-0.5" />
          <div>
            <p className="text-sm text-indigo-800">
              <strong>¿Cómo funciona?</strong> Define la estructura JSON de la respuesta, 
              el sistema genera datos automáticamente y te da un endpoint que puedes usar 
              como si fuera una API real.
            </p>
            <p className="text-xs text-indigo-600 mt-1">
              Ejemplo: <code className="bg-white px-1 rounded">GET /api/mock/mi-api</code> → Devuelve datos simulados
            </p>
          </div>
        </div>
      </Card>
      
      {/* Lista de APIs */}
      {simulations.length === 0 ? (
        <Card className="text-center py-12">
          <Database className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No hay APIs simuladas</h3>
          <p className="text-gray-500 mb-4">Crea tu primera API de simulación</p>
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Crear API
          </Button>
        </Card>
      ) : (
        <div className="grid gap-4">
          {simulations.map(simulation => (
            <Card key={simulation.id} className={!simulation.activo ? 'opacity-60' : ''}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-gray-900">{simulation.nombre}</h3>
                    <Badge variant={simulation.activo ? 'green' : 'gray'}>
                      {simulation.activo ? 'Activo' : 'Inactivo'}
                    </Badge>
                    {simulation.delay_ms > 0 && (
                      <Badge variant="yellow" className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {simulation.delay_ms}ms
                      </Badge>
                    )}
                  </div>
                  
                  {simulation.descripcion && (
                    <p className="text-sm text-gray-500 mb-2">{simulation.descripcion}</p>
                  )}
                  
                  <div className="flex items-center gap-2 bg-gray-50 rounded-lg p-2">
                    <code className="text-sm text-indigo-600 flex-1 truncate">
                      {getApiUrl(simulation.slug)}
                    </code>
                    <button
                      onClick={() => copyUrl(simulation.slug)}
                      className="p-1.5 hover:bg-gray-200 rounded transition-colors"
                      title="Copiar URL"
                    >
                      {copiedUrl === simulation.slug ? (
                        <Check className="h-4 w-4 text-green-600" />
                      ) : (
                        <Copy className="h-4 w-4 text-gray-500" />
                      )}
                    </button>
                    <a
                      href={getApiUrl(simulation.slug)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 hover:bg-gray-200 rounded transition-colors"
                      title="Abrir en nueva pestaña"
                    >
                      <ExternalLink className="h-4 w-4 text-gray-500" />
                    </a>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openPreview(simulation)}
                    title="Ver datos"
                  >
                    <Code className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRegenerate(simulation.id)}
                    title="Regenerar datos"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleToggleActive(simulation)}
                    title={simulation.activo ? 'Desactivar' : 'Activar'}
                  >
                    {simulation.activo ? (
                      <Pause className="h-4 w-4 text-amber-600" />
                    ) : (
                      <Play className="h-4 w-4 text-green-600" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(simulation.id)}
                    title="Eliminar"
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
      
      {/* Modal Crear */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => { setShowCreateModal(false); resetForm(); }}
        title="Nueva API Simulación"
        size="lg"
      >
        <div className="space-y-4">
          <Input
            label="Nombre *"
            value={formData.nombre}
            onChange={e => handleNameChange(e.target.value)}
            placeholder="Ej: API Inventario"
          />
          
          <Input
            label="Slug (URL) *"
            value={formData.slug}
            onChange={e => setFormData(prev => ({ ...prev, slug: e.target.value }))}
            placeholder="api-inventario"
          />
          <p className="text-xs text-gray-500 -mt-2">
            URL: <code>/api/mock/{formData.slug || 'slug'}</code>
          </p>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
            <textarea
              value={formData.descripcion || ''}
              onChange={e => setFormData(prev => ({ ...prev, descripcion: e.target.value }))}
              rows={2}
              className="w-full px-3 py-2 border rounded-lg text-sm"
              placeholder="Descripción opcional..."
            />
          </div>
          
          <Input
            label="Delay (ms)"
            type="number"
            value={formData.delay_ms || 0}
            onChange={e => setFormData(prev => ({ ...prev, delay_ms: parseInt(e.target.value) || 0 }))}
            placeholder="0"
          />
          <p className="text-xs text-gray-500 -mt-2">Simular latencia de red</p>
          
          {/* Ejemplos */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Plantillas de ejemplo:
            </label>
            <div className="flex flex-wrap gap-2">
              {exampleSchemas.map(example => (
                <button
                  key={example.name}
                  onClick={() => loadExampleSchema(example)}
                  className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm transition-colors"
                >
                  {example.name}
                </button>
              ))}
            </div>
          </div>
          
          {/* Editor de Schema */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Estructura de respuesta (JSON) *
            </label>
            <textarea
              value={schemaText}
              onChange={e => handleSchemaChange(e.target.value)}
              rows={12}
              className={`w-full px-3 py-2 border rounded-lg font-mono text-sm ${
                schemaError ? 'border-red-300 bg-red-50' : 'border-gray-300'
              }`}
              placeholder='{"campo": "tipo"}'
            />
            {schemaError && (
              <p className="text-xs text-red-600 mt-1">{schemaError}</p>
            )}
            <div className="text-xs text-gray-500 mt-2 space-y-1">
              <p><strong>Tipos disponibles:</strong></p>
              <p>string, number, boolean, date, datetime, uuid, email, phone, currency, status</p>
              <p>Para arrays: <code>{`{"items": {"type": "array", "items": {...}}}`}</code></p>
            </div>
          </div>
          
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="secondary" onClick={() => { setShowCreateModal(false); resetForm(); }}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={!!schemaError}>
              Crear API
            </Button>
          </div>
        </div>
      </Modal>
      
      {/* Modal Preview */}
      <Modal
        isOpen={showPreviewModal}
        onClose={() => { setShowPreviewModal(false); setSelectedSimulation(null); }}
        title={`Datos de: ${selectedSimulation?.nombre}`}
        size="lg"
      >
        {selectedSimulation && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Schema</label>
              <pre className="bg-gray-50 p-3 rounded-lg text-xs overflow-auto max-h-48 border">
                {JSON.stringify(selectedSimulation.response_schema, null, 2)}
              </pre>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Datos Generados</label>
              <pre className="bg-indigo-50 p-3 rounded-lg text-xs overflow-auto max-h-64 border border-indigo-100">
                {JSON.stringify(selectedSimulation.mock_data, null, 2)}
              </pre>
            </div>
            
            <div className="flex justify-between pt-4 border-t">
              <Button
                variant="secondary"
                onClick={() => handleRegenerate(selectedSimulation.id)}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Regenerar Datos
              </Button>
              <Button variant="secondary" onClick={() => setShowPreviewModal(false)}>
                Cerrar
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

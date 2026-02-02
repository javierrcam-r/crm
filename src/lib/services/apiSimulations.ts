// =====================================================
// SERVICIO: API Simulaciones
// =====================================================

import { getSupabaseClient } from '@/lib/supabase/client';
import { getCurrentUserProfile } from '@/lib/auth/getCurrentUserId';

export interface ApiSimulation {
  id: string;
  created_by_user_id: string;
  nombre: string;
  descripcion: string | null;
  slug: string;
  response_schema: Record<string, any>;
  mock_data: Record<string, any> | null;
  activo: boolean;
  delay_ms: number;
  created_at: string;
  updated_at: string;
}

export interface ApiSimulationInsert {
  nombre: string;
  descripcion?: string | null;
  slug: string;
  response_schema: Record<string, any>;
  mock_data?: Record<string, any> | null;
  activo?: boolean;
  delay_ms?: number;
}

// =====================================================
// CRUD
// =====================================================

export async function getApiSimulations(): Promise<ApiSimulation[]> {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('api_simulations')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('Error fetching API simulations:', error);
    throw error;
  }
  
  return (data || []) as ApiSimulation[];
}

export async function getApiSimulationById(id: string): Promise<ApiSimulation | null> {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('api_simulations')
    .select('*')
    .eq('id', id)
    .single();
  
  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  
  return data as ApiSimulation;
}

export async function getApiSimulationBySlug(slug: string): Promise<ApiSimulation | null> {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('api_simulations')
    .select('*')
    .eq('slug', slug)
    .eq('activo', true)
    .single();
  
  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  
  return data as ApiSimulation;
}

export async function createApiSimulation(simulation: ApiSimulationInsert): Promise<ApiSimulation> {
  const supabase = getSupabaseClient();
  const userProfile = getCurrentUserProfile();
  
  if (!userProfile?.id) {
    throw new Error('No se encontró el usuario actual');
  }
  
  // Generar mock_data basado en el schema
  const mockData = generateMockData(simulation.response_schema);
  
  const { data, error } = await supabase
    .from('api_simulations')
    .insert({
      ...simulation,
      created_by_user_id: userProfile.id,
      mock_data: mockData
    })
    .select()
    .single();
  
  if (error) {
    console.error('Error creating API simulation:', error);
    throw error;
  }
  
  return data as ApiSimulation;
}

export async function updateApiSimulation(id: string, updates: Partial<ApiSimulationInsert>): Promise<ApiSimulation> {
  const supabase = getSupabaseClient();
  
  // Si se actualiza el schema, regenerar los datos
  let updateData: any = { ...updates };
  if (updates.response_schema) {
    updateData.mock_data = generateMockData(updates.response_schema);
  }
  
  const { data, error } = await supabase
    .from('api_simulations')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();
  
  if (error) {
    console.error('Error updating API simulation:', error);
    throw error;
  }
  
  return data as ApiSimulation;
}

export async function deleteApiSimulation(id: string): Promise<void> {
  const supabase = getSupabaseClient();
  
  const { error } = await supabase
    .from('api_simulations')
    .delete()
    .eq('id', id);
  
  if (error) {
    console.error('Error deleting API simulation:', error);
    throw error;
  }
}

export async function regenerateMockData(id: string): Promise<ApiSimulation> {
  const supabase = getSupabaseClient();
  
  // Obtener el schema actual
  const simulation = await getApiSimulationById(id);
  if (!simulation) {
    throw new Error('Simulación no encontrada');
  }
  
  // Regenerar datos
  const mockData = generateMockData(simulation.response_schema);
  
  const { data, error } = await supabase
    .from('api_simulations')
    .update({ mock_data: mockData })
    .eq('id', id)
    .select()
    .single();
  
  if (error) {
    console.error('Error regenerating mock data:', error);
    throw error;
  }
  
  return data as ApiSimulation;
}

// =====================================================
// GENERADOR DE DATOS MOCK
// =====================================================

function generateMockData(schema: Record<string, any>): Record<string, any> {
  if (!schema || typeof schema !== 'object') {
    return {};
  }
  
  const result: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(schema)) {
    result[key] = generateValueForType(value, key);
  }
  
  return result;
}

function generateValueForType(typeSpec: any, fieldName: string): any {
  // Si es un string, es el tipo directo
  if (typeof typeSpec === 'string') {
    return generateValue(typeSpec, fieldName);
  }
  
  // Si es un objeto con 'type'
  if (typeSpec && typeof typeSpec === 'object') {
    if (typeSpec.type === 'array' && typeSpec.items) {
      // Generar array con 1-5 items
      const count = typeSpec.count || Math.floor(Math.random() * 5) + 1;
      const items: any[] = [];
      for (let i = 0; i < count; i++) {
        if (typeof typeSpec.items === 'object' && !typeSpec.items.type) {
          items.push(generateMockData(typeSpec.items));
        } else {
          items.push(generateValueForType(typeSpec.items, fieldName));
        }
      }
      return items;
    }
    
    if (typeSpec.type === 'object' && typeSpec.properties) {
      return generateMockData(typeSpec.properties);
    }
    
    if (typeSpec.type) {
      return generateValue(typeSpec.type, fieldName, typeSpec);
    }
    
    // Es un objeto sin type, generar recursivamente
    return generateMockData(typeSpec);
  }
  
  return null;
}

function generateValue(type: string, fieldName: string, options?: any): any {
  const nameLower = fieldName.toLowerCase();
  
  switch (type.toLowerCase()) {
    case 'string':
    case 'text':
      // Inferir por nombre del campo
      if (nameLower.includes('email')) return `usuario${Math.floor(Math.random() * 1000)}@ejemplo.com`;
      if (nameLower.includes('nombre') || nameLower.includes('name')) return getRandomName();
      if (nameLower.includes('telefono') || nameLower.includes('phone')) return `+593 9${Math.floor(Math.random() * 100000000).toString().padStart(8, '0')}`;
      if (nameLower.includes('direccion') || nameLower.includes('address')) return getRandomAddress();
      if (nameLower.includes('ciudad') || nameLower.includes('city')) return getRandomCity();
      if (nameLower.includes('descripcion') || nameLower.includes('description')) return getRandomDescription();
      if (nameLower.includes('url') || nameLower.includes('link')) return `https://ejemplo.com/${Math.random().toString(36).slice(2, 8)}`;
      if (nameLower.includes('sku') || nameLower.includes('codigo') || nameLower.includes('code')) return `SKU-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
      return `Texto ${Math.floor(Math.random() * 1000)}`;
    
    case 'number':
    case 'integer':
    case 'int':
      const min = options?.min ?? 1;
      const max = options?.max ?? 1000;
      return Math.floor(Math.random() * (max - min + 1)) + min;
    
    case 'float':
    case 'decimal':
    case 'double':
      const minF = options?.min ?? 0;
      const maxF = options?.max ?? 1000;
      return parseFloat((Math.random() * (maxF - minF) + minF).toFixed(2));
    
    case 'boolean':
    case 'bool':
      return Math.random() > 0.5;
    
    case 'date':
      const date = new Date();
      date.setDate(date.getDate() + Math.floor(Math.random() * 30) - 15);
      return date.toISOString().split('T')[0];
    
    case 'datetime':
    case 'timestamp':
      const dt = new Date();
      dt.setDate(dt.getDate() + Math.floor(Math.random() * 30) - 15);
      return dt.toISOString();
    
    case 'uuid':
    case 'id':
      return crypto.randomUUID();
    
    case 'email':
      return `usuario${Math.floor(Math.random() * 1000)}@ejemplo.com`;
    
    case 'phone':
      return `+593 9${Math.floor(Math.random() * 100000000).toString().padStart(8, '0')}`;
    
    case 'currency':
    case 'price':
    case 'money':
      return parseFloat((Math.random() * 500 + 10).toFixed(2));
    
    case 'percentage':
    case 'percent':
      return parseFloat((Math.random() * 100).toFixed(1));
    
    case 'status':
      const statuses = ['activo', 'inactivo', 'pendiente', 'completado', 'cancelado'];
      return statuses[Math.floor(Math.random() * statuses.length)];
    
    case 'enum':
      if (options?.values && Array.isArray(options.values)) {
        return options.values[Math.floor(Math.random() * options.values.length)];
      }
      return 'valor1';
    
    default:
      return `${type}_${Math.floor(Math.random() * 100)}`;
  }
}

// Datos de ejemplo para generar
function getRandomName(): string {
  const nombres = ['María García', 'Juan Pérez', 'Ana López', 'Carlos Rodríguez', 'Laura Martínez', 'Pedro Sánchez', 'Carmen Torres', 'Miguel Díaz'];
  return nombres[Math.floor(Math.random() * nombres.length)];
}

function getRandomAddress(): string {
  const calles = ['Av. Principal', 'Calle 10', 'Av. Libertad', 'Jr. Los Pinos', 'Calle Comercio'];
  const nums = Math.floor(Math.random() * 500) + 100;
  return `${calles[Math.floor(Math.random() * calles.length)]} ${nums}`;
}

function getRandomCity(): string {
  const ciudades = ['Quito', 'Guayaquil', 'Cuenca', 'Ambato', 'Manta', 'Loja', 'Riobamba'];
  return ciudades[Math.floor(Math.random() * ciudades.length)];
}

function getRandomDescription(): string {
  const descripciones = [
    'Producto de alta calidad',
    'Servicio premium',
    'Excelente opción para el cliente',
    'Nueva versión mejorada',
    'Diseño moderno y funcional'
  ];
  return descripciones[Math.floor(Math.random() * descripciones.length)];
}

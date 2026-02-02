import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Crear cliente de Supabase para el servidor
function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key);
}

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const supabase = getSupabase();
    const { slug } = params;
    
    // Buscar la simulación por slug
    const { data: simulation, error } = await supabase
      .from('api_simulations')
      .select('*')
      .eq('slug', slug)
      .eq('activo', true)
      .single();
    
    if (error || !simulation) {
      return NextResponse.json(
        { error: 'API no encontrada', slug },
        { status: 404 }
      );
    }
    
    // Simular delay si está configurado
    if (simulation.delay_ms > 0) {
      await new Promise(resolve => setTimeout(resolve, simulation.delay_ms));
    }
    
    // Devolver los datos mock
    return NextResponse.json(simulation.mock_data, {
      status: 200,
      headers: {
        'X-Mock-API': 'true',
        'X-Mock-Name': simulation.nombre,
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      }
    });
    
  } catch (error: any) {
    console.error('Error en API mock:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor', message: error.message },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  // POST también devuelve los datos mock (para simular endpoints que reciben datos)
  return GET(request, { params });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }
  });
}

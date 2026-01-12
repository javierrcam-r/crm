import { NextRequest, NextResponse } from 'next/server';

/**
 * API Route para resolver enlaces cortos de Google Maps
 * Los enlaces como maps.app.goo.gl/xxx no se pueden resolver desde el cliente por CORS
 */
export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();
    
    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'URL requerida' }, { status: 400 });
    }

    // Verificar si es un enlace corto de Google Maps
    const isShortUrl = url.includes('goo.gl') || url.includes('maps.app.goo.gl');
    
    if (!isShortUrl) {
      return NextResponse.json({ error: 'No es un enlace corto de Google Maps' }, { status: 400 });
    }

    // Crear AbortController para timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 segundos

    try {
      // Seguir la redirección con timeout
      const response = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      });

      clearTimeout(timeoutId);

      const finalUrl = response.url;
      
      // Intentar extraer coordenadas de la URL final
      let coords = extractCoordsFromUrl(finalUrl);

      // Si no encontramos en la URL, buscar en el HTML
      if (!coords) {
        const html = await response.text();
        coords = extractCoordsFromHtml(html);
      }

      if (!coords) {
        return NextResponse.json({ 
          error: 'No se pudieron extraer coordenadas. Abre el enlace en el navegador y copia la URL completa.',
          resolvedUrl: finalUrl 
        }, { status: 400 });
      }

      return NextResponse.json({
        lat: coords.lat,
        lng: coords.lng,
        resolvedUrl: finalUrl,
      });

    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      
      if (fetchError.name === 'AbortError') {
        return NextResponse.json({ 
          error: 'Timeout: Abre el enlace en tu navegador y copia la URL completa de Google Maps.',
        }, { status: 408 });
      }
      
      throw fetchError;
    }

  } catch (error) {
    console.error('Error resolviendo URL:', error);
    return NextResponse.json({ 
      error: 'No se pudo resolver el enlace. Abre el enlace en tu navegador y copia la URL completa de la barra de direcciones.',
    }, { status: 500 });
  }
}

function extractCoordsFromUrl(url: string): { lat: number; lng: number } | null {
  // Decodificar URL si es necesario
  const decodedUrl = decodeURIComponent(url);
  
  const patterns = [
    /@(-?\d+\.?\d*),(-?\d+\.?\d*)/,                    // @lat,lng
    /[?&]q=(-?\d+\.?\d*),(-?\d+\.?\d*)/,              // ?q=lat,lng
    /!3d(-?\d+\.?\d*)!4d(-?\d+\.?\d*)/,               // !3d lat !4d lng
    /place\/[^/]+\/(-?\d+\.?\d*),(-?\d+\.?\d*)/,      // place/name/lat,lng
    /[?&]ll=(-?\d+\.?\d*),(-?\d+\.?\d*)/,             // ?ll=lat,lng
    /center=(-?\d+\.?\d*),(-?\d+\.?\d*)/,             // center=lat,lng
  ];

  for (const pattern of patterns) {
    const match = decodedUrl.match(pattern);
    if (match) {
      const lat = parseFloat(match[1]);
      const lng = parseFloat(match[2]);
      if (isValidCoord(lat, lng)) return { lat, lng };
    }
  }

  return null;
}

function extractCoordsFromHtml(html: string): { lat: number; lng: number } | null {
  const patterns = [
    /\\"lat\\":(-?\d+\.?\d*),\\"lng\\":(-?\d+\.?\d*)/,
    /"lat":(-?\d+\.?\d*),"lng":(-?\d+\.?\d*)/,
    /\[(-?\d+\.?\d*),\s*(-?\d+\.?\d*)\]/,
    /@(-?\d+\.?\d*),(-?\d+\.?\d*),\d+z/,
    /center=(-?\d+\.?\d*)%2C(-?\d+\.?\d*)/,
    /!3d(-?\d+\.?\d*)!4d(-?\d+\.?\d*)/,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) {
      const lat = parseFloat(match[1]);
      const lng = parseFloat(match[2]);
      if (isValidCoord(lat, lng)) return { lat, lng };
    }
  }

  return null;
}

function isValidCoord(lat: number, lng: number): boolean {
  return !isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

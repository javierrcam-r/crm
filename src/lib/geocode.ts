import { extractCoordsFromGoogleMapsUrl, type Coordinates } from './utils';

// =====================================================
// GEOCODIFICACIÓN INVERSA
// =====================================================

export interface GeocodeResult {
  direccion: string;
  zona?: string;
  ciudad?: string;
}

/**
 * Obtiene la dirección a partir de coordenadas usando Nominatim (OpenStreetMap)
 */
export async function reverseGeocode(lat: number, lng: number): Promise<GeocodeResult | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('HTTP error');
    const data = await response.json();
    
    if (data && data.address) {
      const address = data.address;
      let direccion = '';
      if (address.road) direccion += address.road;
      if (address.house_number) direccion += ' ' + address.house_number;
      if (address.suburb && !direccion.includes(address.suburb)) direccion += ', ' + address.suburb;
      if (address.city && !direccion.includes(address.city)) direccion += ', ' + address.city;
      if (address.country && !direccion.includes(address.country)) direccion += ', ' + address.country;

      return {
        direccion: direccion.trim() || data.display_name || '',
        zona: address.suburb || address.neighbourhood || address.hamlet,
        ciudad: address.city || address.town || address.village,
      };
    }
    return null;
  } catch (error) {
    console.error('Error en geocodificación inversa:', error);
    return null;
  }
}

/**
 * Resuelve una URL de Google Maps (incluyendo enlaces cortos) y extrae las coordenadas
 */
export async function resolveGoogleMapsUrl(url: string): Promise<Coordinates | null> {
  // Primero intentar extraer directamente
  const directCoords = extractCoordsFromGoogleMapsUrl(url);
  if (directCoords) return directCoords;

  // Si es un enlace corto, usar la API route para resolverlo
  const isShortUrl = url.includes('goo.gl') || url.includes('maps.app.goo.gl');
  if (isShortUrl) {
    try {
      const response = await fetch('/api/resolve-maps-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al resolver el enlace corto');
      }

      const data = await response.json();
      return { lat: data.lat, lng: data.lng };
    } catch (error) {
      console.error('Error resolviendo enlace corto:', error);
      throw error;
    }
  }
  return null;
}

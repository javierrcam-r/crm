import { format, formatDistanceToNow, isToday, isTomorrow, isYesterday, isPast } from 'date-fns';
import { es } from 'date-fns/locale';

// =====================================================
// FORMATEO DE FECHAS
// =====================================================

export function formatDate(date: string | Date, formatStr: string = 'dd/MM/yyyy') {
  return format(new Date(date), formatStr, { locale: es });
}

export function formatDateTime(date: string | Date) {
  return format(new Date(date), "dd/MM/yyyy 'a las' HH:mm", { locale: es });
}

export function formatTime(date: string | Date) {
  return format(new Date(date), 'HH:mm', { locale: es });
}

export function formatRelativeDate(date: string | Date) {
  const d = new Date(date);
  
  if (isToday(d)) return 'Hoy';
  if (isTomorrow(d)) return 'Mañana';
  if (isYesterday(d)) return 'Ayer';
  
  return formatDistanceToNow(d, { addSuffix: true, locale: es });
}

export function formatDateLabel(date: string | Date) {
  const d = new Date(date);
  
  if (isToday(d)) return `Hoy, ${formatTime(d)}`;
  if (isTomorrow(d)) return `Mañana, ${formatTime(d)}`;
  if (isYesterday(d)) return `Ayer, ${formatTime(d)}`;
  
  return formatDateTime(d);
}

export function isOverdue(date: string | Date) {
  return isPast(new Date(date));
}

// =====================================================
// FORMATEO DE MONEDA
// =====================================================

export function formatCurrency(amount: number, currency: string = 'PYG') {
  return new Intl.NumberFormat('es-PY', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatNumber(num: number) {
  return new Intl.NumberFormat('es-PY').format(num);
}

// =====================================================
// CLASES CSS
// =====================================================

type ClassValue = string | number | bigint | boolean | null | undefined;

export function cn(...classes: ClassValue[]) {
  return classes.filter((c): c is string => typeof c === 'string' && Boolean(c)).join(' ');
}

// =====================================================
// STATUS LABELS Y COLORES
// =====================================================

export const customerTypeLabels: Record<string, string> = {
  cliente: 'Cliente',
  prospecto: 'Prospecto',
};

export const funnelStageLabels: Record<string, string> = {
  nuevo: 'Nuevo',
  contactado: 'Contactado',
  interesado: 'Interesado',
  negociacion: 'En negociación',
  ganado: 'Ganado',
  perdido: 'Perdido',
};

export const visitStatusLabels: Record<string, string> = {
  programada: 'Programada',
  completada: 'Completada',
  cancelada: 'Cancelada',
  no_atendio: 'No atendió',
  reprogramada: 'Reprogramada',
};

export const orderStatusLabels: Record<string, string> = {
  borrador: 'Borrador',
  enviado: 'Enviado',
  confirmado: 'Confirmado',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
};

export const visitStatusColors: Record<string, string> = {
  programada: 'bg-blue-100 text-blue-800',
  completada: 'bg-green-100 text-green-800',
  cancelada: 'bg-gray-100 text-gray-800',
  no_atendio: 'bg-amber-100 text-amber-800',
  reprogramada: 'bg-purple-100 text-purple-800',
};

export const orderStatusColors: Record<string, string> = {
  borrador: 'bg-gray-100 text-gray-800',
  enviado: 'bg-blue-100 text-blue-800',
  confirmado: 'bg-indigo-100 text-indigo-800',
  entregado: 'bg-green-100 text-green-800',
  cancelado: 'bg-red-100 text-red-800',
};

export const funnelStageColors: Record<string, string> = {
  nuevo: 'bg-gray-100 text-gray-800',
  contactado: 'bg-blue-100 text-blue-800',
  interesado: 'bg-cyan-100 text-cyan-800',
  negociacion: 'bg-amber-100 text-amber-800',
  ganado: 'bg-green-100 text-green-800',
  perdido: 'bg-red-100 text-red-800',
};

export const formaPagoLabels: Record<string, string> = {
  contado: 'Contado',
  cheque: 'Cheque',
  plazos_cortos: 'Plazos cortos',
  plazos_medios: 'Plazos medios',
  plazos_largos: 'Plazos largos',
};

export const calidadPagoLabels: Record<string, string> = {
  buena: 'Buena paga',
  regular: 'Regular',
  mala: 'Mala paga',
};

export const calidadPagoColors: Record<string, string> = {
  buena: 'bg-green-100 text-green-800',
  regular: 'bg-amber-100 text-amber-800',
  mala: 'bg-red-100 text-red-800',
};

// =====================================================
// EXPORT CSV
// =====================================================

export function exportToCSV<T extends Record<string, unknown>>(
  data: T[],
  filename: string,
  headers?: { key: keyof T; label: string }[]
) {
  if (data.length === 0) return;

  const keys = headers ? headers.map(h => h.key) : Object.keys(data[0]) as (keyof T)[];
  const headerLabels = headers ? headers.map(h => h.label) : keys.map(String);

  const csvContent = [
    headerLabels.join(','),
    ...data.map(row =>
      keys.map(key => {
        const value = row[key];
        if (value === null || value === undefined) return '';
        const str = String(value);
        // Escapar comillas y envolver en comillas si contiene coma
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      }).join(',')
    ),
  ].join('\n');

  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}_${format(new Date(), 'yyyy-MM-dd')}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// =====================================================
// GOOGLE MAPS COORDINATES EXTRACTION
// =====================================================

export interface Coordinates {
  lat: number;
  lng: number;
}

/**
 * Extrae las coordenadas de un link de Google Maps
 * Soporta varios formatos:
 * - https://www.google.com/maps?q=-25.2867,-57.6473
 * - https://www.google.com/maps/place/.../@-25.2867,-57.6473,17z/...
 * - https://maps.google.com/?q=-25.2867,-57.6473
 * - https://www.google.com/maps/@-25.2867,-57.6473,17z
 * - Coordenadas directas: -25.2867,-57.6473
 */
export function extractCoordsFromGoogleMapsUrl(url: string): Coordinates | null {
  if (!url || typeof url !== 'string') return null;
  
  const trimmedUrl = url.trim();
  
  // Patrón para coordenadas directas (ej: -25.2867,-57.6473)
  const directPattern = /^(-?\d+\.?\d*),\s*(-?\d+\.?\d*)$/;
  const directMatch = trimmedUrl.match(directPattern);
  if (directMatch) {
    const lat = parseFloat(directMatch[1]);
    const lng = parseFloat(directMatch[2]);
    if (isValidCoordinate(lat, lng)) {
      return { lat, lng };
    }
  }
  
  // Patrón para URLs con @lat,lng,zoom
  const atPattern = /@(-?\d+\.?\d*),(-?\d+\.?\d*)/;
  const atMatch = trimmedUrl.match(atPattern);
  if (atMatch) {
    const lat = parseFloat(atMatch[1]);
    const lng = parseFloat(atMatch[2]);
    if (isValidCoordinate(lat, lng)) {
      return { lat, lng };
    }
  }
  
  // Patrón para URLs con ?q=lat,lng
  const qPattern = /[?&]q=(-?\d+\.?\d*),(-?\d+\.?\d*)/;
  const qMatch = trimmedUrl.match(qPattern);
  if (qMatch) {
    const lat = parseFloat(qMatch[1]);
    const lng = parseFloat(qMatch[2]);
    if (isValidCoordinate(lat, lng)) {
      return { lat, lng };
    }
  }
  
  // Patrón para URLs con !3d (latitud) y !4d (longitud)
  const dataPattern = /!3d(-?\d+\.?\d*)!4d(-?\d+\.?\d*)/;
  const dataMatch = trimmedUrl.match(dataPattern);
  if (dataMatch) {
    const lat = parseFloat(dataMatch[1]);
    const lng = parseFloat(dataMatch[2]);
    if (isValidCoordinate(lat, lng)) {
      return { lat, lng };
    }
  }
  
  // Patrón para place con coordenadas
  const placePattern = /place\/[^/]+\/(-?\d+\.?\d*),(-?\d+\.?\d*)/;
  const placeMatch = trimmedUrl.match(placePattern);
  if (placeMatch) {
    const lat = parseFloat(placeMatch[1]);
    const lng = parseFloat(placeMatch[2]);
    if (isValidCoordinate(lat, lng)) {
      return { lat, lng };
    }
  }
  
  return null;
}

/**
 * Valida que las coordenadas estén dentro de rangos válidos
 */
function isValidCoordinate(lat: number, lng: number): boolean {
  return (
    !isNaN(lat) && 
    !isNaN(lng) && 
    lat >= -90 && 
    lat <= 90 && 
    lng >= -180 && 
    lng <= 180
  );
}

/**
 * Genera un link de Google Maps a partir de coordenadas
 */
export function generateGoogleMapsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

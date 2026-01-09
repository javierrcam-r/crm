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

export function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(' ');
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


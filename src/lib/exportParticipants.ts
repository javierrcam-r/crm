import * as XLSX from 'xlsx';
import type { EventParticipant, Event } from '@/lib/services/events';

interface ExportOptions {
  event: Event;
  participants: EventParticipant[];
  getUserName?: (id: string) => string;
}

export function exportParticipantsToExcel({ event, participants, getUserName }: ExportOptions) {
  const rows = participants.map((p, i) => ({
    '#': i + 1,
    'Nombre': p.nombre,
    'Email': p.email || '',
    'Teléfono': p.telefono || '',
    'Empresa': p.empresa || '',
    'Categoría': p.categoria || '',
    'Asiento': p.numero_asiento || '',
    'Inscripción': formatInscripcion(p.estado_inscripcion),
    'Estado Pago': formatPago(p.estado_pago),
    'Monto Pagado': Number(p.monto_pagado) || 0,
    'Cupos Adicionales': p.cupos_adicionales || 0,
    'Asistencia': p.asistencia ? 'Sí' : 'No',
    'Certificado': p.certificado_emitido ? 'Sí' : 'No',
    'Registrado Por': p.registered_by && getUserName ? getUserName(p.registered_by) : '',
    'Notas': p.notas || '',
    'Fecha Registro': p.created_at ? new Date(p.created_at).toLocaleDateString('es-EC') : '',
  }));

  const ws = XLSX.utils.json_to_sheet(rows);

  const colWidths = [
    { wch: 4 },   // #
    { wch: 28 },  // Nombre
    { wch: 28 },  // Email
    { wch: 15 },  // Teléfono
    { wch: 22 },  // Empresa
    { wch: 16 },  // Categoría
    { wch: 10 },  // Asiento
    { wch: 14 },  // Inscripción
    { wch: 14 },  // Estado Pago
    { wch: 14 },  // Monto Pagado
    { wch: 8 },   // Cupos
    { wch: 10 },  // Asistencia
    { wch: 12 },  // Certificado
    { wch: 22 },  // Registrado Por
    { wch: 30 },  // Notas
    { wch: 14 },  // Fecha Registro
  ];
  ws['!cols'] = colWidths;

  const totalConfirmados = participants.filter(p => p.estado_inscripcion === 'confirmado').length;
  const totalPagados = participants.filter(p => p.estado_pago === 'pagado').length;
  const totalAsistieron = participants.filter(p => p.asistencia).length;
  const totalRecaudado = participants.reduce((s, p) => s + (Number(p.monto_pagado) || 0), 0);
  const totalCuposAdicionales = participants.reduce((s, p) => s + (p.cupos_adicionales || 0), 0);

  const summaryRows = [
    {},
    { '#': '', 'Nombre': 'RESUMEN', 'Email': '', 'Teléfono': '', 'Empresa': '', 'Categoría': '', 'Asiento': '', 'Inscripción': '', 'Estado Pago': '', 'Monto Pagado': '', 'Cupos Adicionales': '', 'Asistencia': '', 'Certificado': '', 'Registrado Por': '', 'Notas': '', 'Fecha Registro': '' },
    { '#': '', 'Nombre': 'Total Participantes', 'Email': String(participants.length) },
    { '#': '', 'Nombre': 'Confirmados', 'Email': String(totalConfirmados) },
    { '#': '', 'Nombre': 'Pagados', 'Email': String(totalPagados) },
    { '#': '', 'Nombre': 'Asistieron', 'Email': String(totalAsistieron) },
    { '#': '', 'Nombre': 'Total Recaudado', 'Email': `$${totalRecaudado.toLocaleString()}` },
    { '#': '', 'Nombre': 'Cupos Adicionales', 'Email': String(totalCuposAdicionales) },
  ];

  XLSX.utils.sheet_add_json(ws, summaryRows, { skipHeader: true, origin: -1 });

  const wb = XLSX.utils.book_new();
  const sheetName = (event.nombre || 'Participantes').substring(0, 31);
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  const safeName = (event.nombre || 'evento').replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ ]/g, '').trim().replace(/\s+/g, '_');
  const fileName = `Participantes_${safeName}_${new Date().toISOString().split('T')[0]}.xlsx`;

  XLSX.writeFile(wb, fileName);
}

function formatInscripcion(status: string): string {
  const map: Record<string, string> = {
    pre_inscrito: 'Pre-inscrito',
    confirmado: 'Confirmado',
    cancelado: 'Cancelado',
    lista_espera: 'Lista de espera',
  };
  return map[status] || status;
}

function formatPago(status: string): string {
  const map: Record<string, string> = {
    pendiente: 'Pendiente',
    parcial: 'Parcial',
    pagado: 'Pagado',
    reembolsado: 'Reembolsado',
    exento: 'Exento',
  };
  return map[status] || status;
}

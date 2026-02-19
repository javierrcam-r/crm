'use client';

import { useMemo, useState } from 'react';
import {
  BarChart3, DollarSign, Users, Calendar, TrendingUp,
  Target, Award, Percent, Hash, Filter,
} from 'lucide-react';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import { type Event, type EventExpense, type EventParticipant, type EventType, type EventStatus } from '@/lib/services/events';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const BRAND_COLORS: Record<string, string> = {
  'Schwarzkopf': 'bg-indigo-500',
  'Hipertín': 'bg-amber-500',
  'Keyra': 'bg-emerald-500',
  'Sutra': 'bg-rose-500',
  'Myrialis': 'bg-violet-500',
  'Sin Marca': 'bg-gray-400',
};

const TYPE_LABELS: Record<EventType, string> = {
  curso: 'Curso', taller: 'Taller', conferencia: 'Conferencia',
  evento_corporativo: 'Evento Corp.', seminario: 'Seminario', otro: 'Otro',
};

interface EventsDashboardProps {
  events: Event[];
  expenses: EventExpense[];
  participants: EventParticipant[];
}

export default function EventsDashboard({ events, expenses, participants }: EventsDashboardProps) {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [filterBrand, setFilterBrand] = useState('');
  const [filterType, setFilterType] = useState<EventType | ''>('');
  const [filterStatus, setFilterStatus] = useState<EventStatus | ''>('');

  const STATUS_LABELS: Record<EventStatus, string> = {
    planeado: 'Planeado', en_ejecucion: 'En Ejecución', finalizado: 'Finalizado', cancelado: 'Cancelado',
  };

  const filteredEvents = useMemo(() => {
    return events.filter(e => {
      if (dateFrom && new Date(e.fecha_inicio) < new Date(dateFrom)) return false;
      if (dateTo && new Date(e.fecha_inicio) > new Date(dateTo + 'T23:59:59')) return false;
      if (filterBrand && !(e.marcas || []).includes(filterBrand)) return false;
      if (filterType && e.tipo !== filterType) return false;
      if (filterStatus && e.estado !== filterStatus) return false;
      return true;
    });
  }, [events, dateFrom, dateTo, filterBrand, filterType, filterStatus]);

  const filteredEventIds = new Set(filteredEvents.map(e => e.id));
  const filteredExpenses = expenses.filter(e => filteredEventIds.has(e.event_id));
  const filteredParticipants = participants.filter(p => filteredEventIds.has(p.event_id));

  const allBrands = useMemo(() => {
    const brands = new Set<string>();
    events.forEach(e => (e.marcas || []).forEach(m => brands.add(m)));
    return Array.from(brands).sort();
  }, [events]);

  // ===== MÉTRICAS GENERALES =====
  const totalEvents = filteredEvents.length;
  const totalGasto = filteredExpenses.filter(e => e.estado !== 'cancelado').reduce((s, e) => s + Number(e.monto), 0);
  const totalPresupuesto = filteredEvents.reduce((s, e) => s + Number(e.presupuesto_total), 0);
  const totalParticipantes = filteredParticipants.length;
  const totalConfirmados = filteredParticipants.filter(p => p.estado_inscripcion === 'confirmado').length;
  const totalAsistieron = filteredParticipants.filter(p => p.asistencia).length;
  const totalPagado = filteredParticipants.reduce((s, p) => s + Number(p.monto_pagado), 0);
  const totalIngresos = totalPagado;
  const utilidadTotal = totalIngresos - totalGasto;
  const tasaAsistencia = totalConfirmados > 0 ? (totalAsistieron / totalConfirmados) * 100 : 0;
  const certificadosEmitidos = filteredParticipants.filter(p => p.certificado_emitido).length;
  const promedioPartPorEvento = totalEvents > 0 ? Math.round(totalParticipantes / totalEvents) : 0;

  // ===== POR MARCA =====
  const brandStats = useMemo(() => {
    const map = new Map<string, { events: number; gasto: number; presupuesto: number; participantes: number; confirmados: number; asistieron: number; ingresos: number }>();
    
    filteredEvents.forEach(event => {
      const brands = (event.marcas || []).length > 0 ? event.marcas : ['Sin Marca'];
      const eventExpenses = filteredExpenses.filter(e => e.event_id === event.id && e.estado !== 'cancelado');
      const eventParts = filteredParticipants.filter(p => p.event_id === event.id);
      const gastoEvento = eventExpenses.reduce((s, e) => s + Number(e.monto), 0);
      const ingresosEvento = eventParts.reduce((s, p) => s + Number(p.monto_pagado), 0);

      brands.forEach(brand => {
        const existing = map.get(brand) || { events: 0, gasto: 0, presupuesto: 0, participantes: 0, confirmados: 0, asistieron: 0, ingresos: 0 };
        existing.events += 1;
        existing.gasto += gastoEvento / brands.length;
        existing.presupuesto += Number(event.presupuesto_total) / brands.length;
        existing.participantes += eventParts.length;
        existing.confirmados += eventParts.filter(p => p.estado_inscripcion === 'confirmado').length;
        existing.asistieron += eventParts.filter(p => p.asistencia).length;
        existing.ingresos += ingresosEvento / brands.length;
        map.set(brand, existing);
      });
    });

    return Array.from(map.entries())
      .map(([brand, stats]) => ({ brand, ...stats }))
      .sort((a, b) => b.events - a.events);
  }, [filteredEvents, filteredExpenses, filteredParticipants]);

  // ===== POR TIPO =====
  const typeStats = useMemo(() => {
    const map = new Map<string, { events: number; gasto: number; participantes: number; confirmados: number; ingresos: number }>();
    
    filteredEvents.forEach(event => {
      const type = event.tipo;
      const eventExpenses = filteredExpenses.filter(e => e.event_id === event.id && e.estado !== 'cancelado');
      const eventParts = filteredParticipants.filter(p => p.event_id === event.id);
      
      const existing = map.get(type) || { events: 0, gasto: 0, participantes: 0, confirmados: 0, ingresos: 0 };
      existing.events += 1;
      existing.gasto += eventExpenses.reduce((s, e) => s + Number(e.monto), 0);
      existing.participantes += eventParts.length;
      existing.confirmados += eventParts.filter(p => p.estado_inscripcion === 'confirmado').length;
      existing.ingresos += eventParts.reduce((s, p) => s + Number(p.monto_pagado), 0);
      map.set(type, existing);
    });

    return Array.from(map.entries())
      .map(([type, stats]) => ({ type, label: TYPE_LABELS[type as EventType] || type, ...stats }))
      .sort((a, b) => b.events - a.events);
  }, [filteredEvents, filteredExpenses, filteredParticipants]);

  // ===== POR ESTADO =====
  const statusStats = useMemo(() => ({
    planeado: filteredEvents.filter(e => e.estado === 'planeado').length,
    en_ejecucion: filteredEvents.filter(e => e.estado === 'en_ejecucion').length,
    finalizado: filteredEvents.filter(e => e.estado === 'finalizado').length,
    cancelado: filteredEvents.filter(e => e.estado === 'cancelado').length,
  }), [filteredEvents]);

  // ===== TOP EVENTOS POR GASTO =====
  const topEventsBySpend = useMemo(() => {
    return filteredEvents.map(event => {
      const eventExp = filteredExpenses.filter(e => e.event_id === event.id && e.estado !== 'cancelado');
      const eventParts = filteredParticipants.filter(p => p.event_id === event.id);
      return {
        id: event.id,
        nombre: event.nombre,
        tipo: event.tipo,
        marcas: event.marcas || [],
        gasto: eventExp.reduce((s, e) => s + Number(e.monto), 0),
        presupuesto: Number(event.presupuesto_total),
        participantes: eventParts.length,
        confirmados: eventParts.filter(p => p.estado_inscripcion === 'confirmado').length,
        asistieron: eventParts.filter(p => p.asistencia).length,
        ingresos: eventParts.reduce((s, p) => s + Number(p.monto_pagado), 0),
        fecha: event.fecha_inicio,
      };
    }).sort((a, b) => b.gasto - a.gasto).slice(0, 10);
  }, [filteredEvents, filteredExpenses, filteredParticipants]);

  const maxBarValue = Math.max(...brandStats.map(b => b.events), 1);

  const clearFilters = () => {
    setDateFrom('');
    setDateTo('');
    setFilterBrand('');
    setFilterType('');
    setFilterStatus('');
  };

  const hasFilters = dateFrom || dateTo || filterBrand || filterType || filterStatus;

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <Card>
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center flex-wrap">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
            <Filter className="h-4 w-4" />
            Filtros:
          </div>
          <div className="flex flex-wrap gap-2 flex-1">
            <div className="flex items-center gap-1.5">
              <label className="text-xs text-gray-500 dark:text-gray-400">Desde:</label>
              <input
                type="date"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                className="px-2 py-1.5 border border-gray-200 dark:border-dark-500 rounded-lg text-sm bg-white dark:bg-dark-600 text-gray-900 dark:text-white"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <label className="text-xs text-gray-500 dark:text-gray-400">Hasta:</label>
              <input
                type="date"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                className="px-2 py-1.5 border border-gray-200 dark:border-dark-500 rounded-lg text-sm bg-white dark:bg-dark-600 text-gray-900 dark:text-white"
              />
            </div>
            <select
              value={filterBrand}
              onChange={e => setFilterBrand(e.target.value)}
              className="px-2 py-1.5 border border-gray-200 dark:border-dark-500 rounded-lg text-sm bg-white dark:bg-dark-600 text-gray-900 dark:text-white"
            >
              <option value="">Todas las marcas</option>
              {allBrands.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
            <select
              value={filterType}
              onChange={e => setFilterType(e.target.value as any)}
              className="px-2 py-1.5 border border-gray-200 dark:border-dark-500 rounded-lg text-sm bg-white dark:bg-dark-600 text-gray-900 dark:text-white"
            >
              <option value="">Todos los tipos</option>
              {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value as any)}
              className="px-2 py-1.5 border border-gray-200 dark:border-dark-500 rounded-lg text-sm bg-white dark:bg-dark-600 text-gray-900 dark:text-white"
            >
              <option value="">Todos los estados</option>
              {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            {hasFilters && (
              <button onClick={clearFilters} className="px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                Limpiar filtros
              </button>
            )}
          </div>
          <Badge variant="blue">{totalEvents} eventos</Badge>
        </div>
      </Card>

      {/* KPIs Principales */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card className="bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-800">
          <div className="p-3 text-center">
            <Hash className="h-5 w-5 text-indigo-600 dark:text-indigo-400 mx-auto mb-1" />
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalEvents}</p>
            <p className="text-[10px] font-medium text-indigo-600 dark:text-indigo-400 uppercase">Eventos</p>
          </div>
        </Card>
        <Card className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800">
          <div className="p-3 text-center">
            <DollarSign className="h-5 w-5 text-red-600 dark:text-red-400 mx-auto mb-1" />
            <p className="text-xl font-bold text-gray-900 dark:text-white">${totalGasto.toLocaleString()}</p>
            <p className="text-[10px] font-medium text-red-600 dark:text-red-400 uppercase">Gasto Total</p>
          </div>
        </Card>
        <Card className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800">
          <div className="p-3 text-center">
            <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400 mx-auto mb-1" />
            <p className="text-xl font-bold text-gray-900 dark:text-white">${totalIngresos.toLocaleString()}</p>
            <p className="text-[10px] font-medium text-green-600 dark:text-green-400 uppercase">Ingresos</p>
          </div>
        </Card>
        <Card className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800">
          <div className="p-3 text-center">
            <Users className="h-5 w-5 text-blue-600 dark:text-blue-400 mx-auto mb-1" />
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalParticipantes}</p>
            <p className="text-[10px] font-medium text-blue-600 dark:text-blue-400 uppercase">Inscritos</p>
          </div>
        </Card>
        <Card className="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800">
          <div className="p-3 text-center">
            <Percent className="h-5 w-5 text-amber-600 dark:text-amber-400 mx-auto mb-1" />
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{tasaAsistencia.toFixed(0)}%</p>
            <p className="text-[10px] font-medium text-amber-600 dark:text-amber-400 uppercase">Asistencia</p>
          </div>
        </Card>
        <Card className={`border ${utilidadTotal >= 0 ? 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800' : 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800'}`}>
          <div className="p-3 text-center">
            <Target className="h-5 w-5 mx-auto mb-1" />
            <p className={`text-xl font-bold ${utilidadTotal >= 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'}`}>
              ${Math.abs(utilidadTotal).toLocaleString()}
            </p>
            <p className="text-[10px] font-medium uppercase">{utilidadTotal >= 0 ? 'Utilidad' : 'Pérdida'}</p>
          </div>
        </Card>
      </div>

      {/* Segunda fila KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <div className="p-3 flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/40 rounded-lg">
              <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-lg font-bold text-gray-900 dark:text-white">{totalConfirmados}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Confirmados</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="p-3 flex items-center gap-3">
            <div className="p-2 bg-green-100 dark:bg-green-900/40 rounded-lg">
              <Users className="h-4 w-4 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-lg font-bold text-gray-900 dark:text-white">{totalAsistieron}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Asistieron</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="p-3 flex items-center gap-3">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/40 rounded-lg">
              <Award className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-lg font-bold text-gray-900 dark:text-white">{certificadosEmitidos}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Certificados</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="p-3 flex items-center gap-3">
            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/40 rounded-lg">
              <BarChart3 className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <p className="text-lg font-bold text-gray-900 dark:text-white">{promedioPartPorEvento}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Prom. por evento</p>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Eventos por Marca */}
        <Card>
          <div className="p-4">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              Eventos por Marca
            </h3>
            {brandStats.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">Sin datos</p>
            ) : (
              <div className="space-y-3">
                {brandStats.map(b => (
                  <div key={b.brand}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="font-medium text-gray-700 dark:text-gray-200">{b.brand}</span>
                      <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                        <span>{b.events} evento{b.events !== 1 ? 's' : ''}</span>
                        <span className="font-semibold text-gray-900 dark:text-white">${Math.round(b.gasto).toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="w-full bg-gray-100 dark:bg-dark-600 rounded-full h-3">
                      <div
                        className={`h-3 rounded-full transition-all ${BRAND_COLORS[b.brand] || 'bg-gray-400'}`}
                        style={{ width: `${(b.events / maxBarValue) * 100}%` }}
                      />
                    </div>
                    <div className="flex gap-4 mt-1 text-[10px] text-gray-400 dark:text-gray-500">
                      <span>{b.participantes} inscritos</span>
                      <span>{b.confirmados} confirmados</span>
                      <span>{b.asistieron} asistieron</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* Eventos por Tipo */}
        <Card>
          <div className="p-4">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Calendar className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              Eventos por Tipo
            </h3>
            {typeStats.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">Sin datos</p>
            ) : (
              <div className="space-y-3">
                {typeStats.map(t => {
                  const maxType = Math.max(...typeStats.map(ts => ts.events), 1);
                  return (
                    <div key={t.type}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="font-medium text-gray-700 dark:text-gray-200">{t.label}</span>
                        <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                          <span>{t.events} evento{t.events !== 1 ? 's' : ''}</span>
                          <span className="font-semibold text-gray-900 dark:text-white">${Math.round(t.gasto).toLocaleString()}</span>
                        </div>
                      </div>
                      <div className="w-full bg-gray-100 dark:bg-dark-600 rounded-full h-3">
                        <div
                          className="h-3 rounded-full bg-purple-500 transition-all"
                          style={{ width: `${(t.events / maxType) * 100}%` }}
                        />
                      </div>
                      <div className="flex gap-4 mt-1 text-[10px] text-gray-400 dark:text-gray-500">
                        <span>{t.participantes} inscritos</span>
                        <span>{t.confirmados} confirmados</span>
                        <span>Ingresos: ${Math.round(t.ingresos).toLocaleString()}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Estado de eventos + Presupuesto vs Gasto */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <div className="p-4">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Estado de Eventos</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-xl text-center">
                <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{statusStats.planeado}</p>
                <p className="text-xs text-blue-600 dark:text-blue-400">Planeados</p>
              </div>
              <div className="p-3 bg-amber-50 dark:bg-amber-900/30 rounded-xl text-center">
                <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">{statusStats.en_ejecucion}</p>
                <p className="text-xs text-amber-600 dark:text-amber-400">En Ejecución</p>
              </div>
              <div className="p-3 bg-green-50 dark:bg-green-900/30 rounded-xl text-center">
                <p className="text-2xl font-bold text-green-700 dark:text-green-300">{statusStats.finalizado}</p>
                <p className="text-xs text-green-600 dark:text-green-400">Finalizados</p>
              </div>
              <div className="p-3 bg-red-50 dark:bg-red-900/30 rounded-xl text-center">
                <p className="text-2xl font-bold text-red-700 dark:text-red-300">{statusStats.cancelado}</p>
                <p className="text-xs text-red-600 dark:text-red-400">Cancelados</p>
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-4">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Presupuesto vs Gasto</h3>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600 dark:text-gray-300">Presupuesto total</span>
                  <span className="font-bold text-gray-900 dark:text-white">${totalPresupuesto.toLocaleString()}</span>
                </div>
                <div className="w-full bg-gray-100 dark:bg-dark-600 rounded-full h-4">
                  <div className="h-4 rounded-full bg-indigo-500" style={{ width: '100%' }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600 dark:text-gray-300">Gasto ejecutado</span>
                  <span className={`font-bold ${totalGasto > totalPresupuesto ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>
                    ${totalGasto.toLocaleString()}
                  </span>
                </div>
                <div className="w-full bg-gray-100 dark:bg-dark-600 rounded-full h-4">
                  <div
                    className={`h-4 rounded-full transition-all ${totalGasto > totalPresupuesto ? 'bg-red-500' : totalGasto > totalPresupuesto * 0.8 ? 'bg-amber-500' : 'bg-green-500'}`}
                    style={{ width: `${totalPresupuesto > 0 ? Math.min((totalGasto / totalPresupuesto) * 100, 100) : 0}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {totalPresupuesto > 0 ? ((totalGasto / totalPresupuesto) * 100).toFixed(1) : 0}% ejecutado
                </p>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Top Eventos por Gasto */}
      <Card>
        <div className="p-4">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-rose-600 dark:text-rose-400" />
            Top Eventos por Inversión
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-dark-500">
                  <th className="text-left py-2 px-3 text-gray-500 dark:text-gray-400 font-medium">Evento</th>
                  <th className="text-center py-2 px-3 text-gray-500 dark:text-gray-400 font-medium hidden sm:table-cell">Tipo</th>
                  <th className="text-center py-2 px-3 text-gray-500 dark:text-gray-400 font-medium hidden md:table-cell">Marca</th>
                  <th className="text-right py-2 px-3 text-gray-500 dark:text-gray-400 font-medium">Gasto</th>
                  <th className="text-right py-2 px-3 text-gray-500 dark:text-gray-400 font-medium hidden sm:table-cell">Ingresos</th>
                  <th className="text-center py-2 px-3 text-gray-500 dark:text-gray-400 font-medium">Inscritos</th>
                  <th className="text-center py-2 px-3 text-gray-500 dark:text-gray-400 font-medium hidden sm:table-cell">Asistieron</th>
                  <th className="text-left py-2 px-3 text-gray-500 dark:text-gray-400 font-medium hidden lg:table-cell">Fecha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-dark-600">
                {topEventsBySpend.map(ev => (
                  <tr key={ev.id} className="hover:bg-gray-50 dark:hover:bg-dark-700">
                    <td className="py-2.5 px-3">
                      <p className="font-medium text-gray-900 dark:text-white truncate max-w-[200px]">{ev.nombre}</p>
                    </td>
                    <td className="py-2.5 px-3 text-center hidden sm:table-cell">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-dark-500 text-gray-600 dark:text-gray-300">
                        {TYPE_LABELS[ev.tipo] || ev.tipo}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center hidden md:table-cell">
                      <div className="flex flex-wrap gap-1 justify-center">
                        {ev.marcas.length > 0 ? ev.marcas.map(m => (
                          <span key={m} className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">{m}</span>
                        )) : <span className="text-gray-400">—</span>}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-right font-semibold text-gray-900 dark:text-white">${ev.gasto.toLocaleString()}</td>
                    <td className="py-2.5 px-3 text-right font-semibold text-green-700 dark:text-green-300 hidden sm:table-cell">${ev.ingresos.toLocaleString()}</td>
                    <td className="py-2.5 px-3 text-center text-gray-700 dark:text-gray-300">{ev.participantes}</td>
                    <td className="py-2.5 px-3 text-center text-gray-700 dark:text-gray-300 hidden sm:table-cell">{ev.asistieron}</td>
                    <td className="py-2.5 px-3 text-xs text-gray-500 dark:text-gray-400 hidden lg:table-cell">
                      {format(new Date(ev.fecha), 'd MMM yy', { locale: es })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {topEventsBySpend.length === 0 && (
              <p className="text-center text-gray-500 dark:text-gray-400 py-8">Sin eventos para mostrar</p>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}

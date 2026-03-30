'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Plus, Calendar, Users, DollarSign, Target, Search, Filter,
  TrendingUp, Clock, CheckCircle, AlertTriangle, BarChart3,
  MapPin, Video, Globe, LayoutGrid, CalendarDays, PieChart,
} from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import EventCalendar from '@/components/events/EventCalendar';
import EventsDashboard from '@/components/events/EventsDashboard';
import { useAuth } from '@/contexts/AuthContext';
import { getEvents, getVendorEvents, getAllEventExpenses, getAllEventParticipants, type Event, type EventStatus, type EventType, type EventExpense, type EventParticipant } from '@/lib/services/events';
import { fuzzySearch } from '@/lib/search';
import VoiceSearch from '@/components/ui/VoiceSearch';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useRouter } from 'next/navigation';

const statusConfig: Record<EventStatus, { label: string; color: string; bg: string }> = {
  planeado: { label: 'Planeado', color: 'text-blue-700 dark:text-blue-300', bg: 'bg-blue-100 dark:bg-blue-900/40' },
  en_ejecucion: { label: 'En Ejecución', color: 'text-amber-700 dark:text-amber-300', bg: 'bg-amber-100 dark:bg-amber-900/40' },
  finalizado: { label: 'Finalizado', color: 'text-green-700 dark:text-green-300', bg: 'bg-green-100 dark:bg-green-900/40' },
  cancelado: { label: 'Cancelado', color: 'text-red-700 dark:text-red-300', bg: 'bg-red-100 dark:bg-red-900/40' },
};

const typeLabels: Record<EventType, string> = {
  curso: 'Curso', taller: 'Taller', conferencia: 'Conferencia',
  evento_corporativo: 'Evento Corp.', seminario: 'Seminario', otro: 'Otro',
};

const modalityIcons: Record<string, any> = {
  presencial: MapPin, virtual: Video, hibrido: Globe,
};

export default function EventosPage() {
  const { userProfile } = useAuth();
  const router = useRouter();
  const [events, setEvents] = useState<Event[]>([]);
  const [allExpenses, setAllExpenses] = useState<EventExpense[]>([]);
  const [allParticipants, setAllParticipants] = useState<EventParticipant[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<EventStatus | ''>('');
  const [filterType, setFilterType] = useState<EventType | ''>('');
  const [viewMode, setViewMode] = useState<'list' | 'calendar' | 'resumen'>('list');

  const isSupervisor = userProfile?.rol === 'admin' || userProfile?.rol === 'supervisor' || userProfile?.rol === 'supervisor_nivel1' || userProfile?.rol === 'supervisor_vendedor';
  const isVendor = userProfile?.rol === 'vendedor' || userProfile?.rol === 'marketing' || userProfile?.rol === 'tecnico' || userProfile?.rol === 'event_assistant';
  const canView = isSupervisor || isVendor;

  useEffect(() => {
    if (canView && userProfile) loadEvents();
  }, [canView, userProfile]);

  const loadEvents = async () => {
    try {
      if (isSupervisor) {
        const [data, expenses, participants] = await Promise.all([
          getEvents(),
          getAllEventExpenses().catch(() => []),
          getAllEventParticipants().catch(() => []),
        ]);
        setEvents(data);
        setAllExpenses(expenses);
        setAllParticipants(participants);
      } else if (isVendor && userProfile) {
        const data = await getVendorEvents(userProfile.id);
        setEvents(data);
      }
    } catch (e) {
      console.error('Error loading events:', e);
    } finally {
      setLoading(false);
    }
  };

  const filtered = events.filter(e => {
    const matchSearch = !searchTerm || fuzzySearch(searchTerm, e.nombre) > 0;
    const matchStatus = !filterStatus || e.estado === filterStatus;
    const matchType = !filterType || e.tipo === filterType;
    return matchSearch && matchStatus && matchType;
  });

  const handleEventClick = (event: Event) => {
    router.push(isSupervisor ? `/eventos/${event.id}` : `/eventos/${event.id}/vendedor`);
  };

  const stats = {
    total: events.length,
    planeados: events.filter(e => e.estado === 'planeado').length,
    enEjecucion: events.filter(e => e.estado === 'en_ejecucion').length,
    finalizados: events.filter(e => e.estado === 'finalizado').length,
    presupuestoTotal: events.reduce((s, e) => s + Number(e.presupuesto_total), 0),
  };

  if (!canView) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md text-center p-8">
          <BarChart3 className="h-12 w-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Acceso Denegado</h2>
          <p className="text-gray-600 dark:text-gray-300">Solo supervisores pueden acceder a este módulo.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Calendar className="h-6 w-6 sm:h-7 sm:w-7 text-indigo-600 dark:text-indigo-400" />
            <span className="hidden sm:inline">Gestión de Eventos</span>
            <span className="sm:hidden">Eventos</span>
          </h1>
          <p className="text-gray-500 dark:text-gray-300 mt-1">{isSupervisor ? 'Planifica, ejecuta y monitorea eventos con control financiero' : 'Eventos en los que participas'}</p>
        </div>
        {isSupervisor && (
          <Link href="/eventos/nuevo">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Evento
            </Button>
          </Link>
        )}
      </div>

      {/* Stats */}
      <div className={`grid gap-4 ${isSupervisor ? 'grid-cols-2 sm:grid-cols-5' : 'grid-cols-3'}`}>
        <Card className="bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-800">
          <div className="p-4">
            <p className="text-xs font-medium text-indigo-600 dark:text-indigo-400 uppercase">Total</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{stats.total}</p>
          </div>
        </Card>
        {isSupervisor && (
          <Card className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800">
            <div className="p-4">
              <p className="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase">Planeados</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{stats.planeados}</p>
            </div>
          </Card>
        )}
        <Card className="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800">
          <div className="p-4">
            <p className="text-xs font-medium text-amber-600 dark:text-amber-400 uppercase">En Ejecución</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{stats.enEjecucion}</p>
          </div>
        </Card>
        <Card className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800">
          <div className="p-4">
            <p className="text-xs font-medium text-green-600 dark:text-green-400 uppercase">Finalizados</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{stats.finalizados}</p>
          </div>
        </Card>
        {isSupervisor && (
          <Card className="bg-purple-50 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-800">
            <div className="p-4">
              <p className="text-xs font-medium text-purple-600 dark:text-purple-400 uppercase">Presupuesto</p>
              <p className="text-lg font-bold text-gray-900 dark:text-white mt-1">${stats.presupuestoTotal.toLocaleString()}</p>
            </div>
          </Card>
        )}
      </div>

      {/* Filters */}
      <Card>
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <div className="relative flex-1 flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-400" />
              <input
                type="text"
                placeholder="Buscar evento..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 border border-gray-200 dark:border-dark-500 rounded-xl text-sm bg-white dark:bg-dark-600 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <VoiceSearch onResult={(text) => setSearchTerm(text)} />
          </div>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)} className="px-3 py-2.5 border border-gray-200 dark:border-dark-500 rounded-xl text-sm bg-white dark:bg-dark-600 text-gray-900 dark:text-white">
            <option value="">Todos los estados</option>
            {Object.entries(statusConfig).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <select value={filterType} onChange={e => setFilterType(e.target.value as any)} className="px-3 py-2.5 border border-gray-200 dark:border-dark-500 rounded-xl text-sm bg-white dark:bg-dark-600 text-gray-900 dark:text-white">
            <option value="">Todos los tipos</option>
            {Object.entries(typeLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <Badge variant="blue">{filtered.length} eventos</Badge>
          
          {/* View Toggle */}
          <div className="flex items-center bg-gray-100 dark:bg-dark-500 rounded-xl p-1">
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-lg transition-colors ${
                viewMode === 'list' 
                  ? 'bg-white dark:bg-dark-600 text-indigo-600 dark:text-indigo-400 shadow-sm' 
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
              title="Vista de lista"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              className={`p-2 rounded-lg transition-colors ${
                viewMode === 'calendar' 
                  ? 'bg-white dark:bg-dark-600 text-indigo-600 dark:text-indigo-400 shadow-sm' 
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
              title="Vista de calendario"
            >
              <CalendarDays className="h-4 w-4" />
            </button>
            {isSupervisor && (
              <button
                onClick={() => setViewMode('resumen')}
                className={`p-2 rounded-lg transition-colors ${
                  viewMode === 'resumen' 
                    ? 'bg-white dark:bg-dark-600 text-indigo-600 dark:text-indigo-400 shadow-sm' 
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                }`}
                title="Dashboard / Resumen"
              >
                <PieChart className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </Card>

      {/* Events Content */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 dark:border-indigo-400" />
        </div>
      ) : viewMode === 'resumen' && isSupervisor ? (
        <EventsDashboard events={events} expenses={allExpenses} participants={allParticipants} />
      ) : filtered.length === 0 ? (
        <Card className="text-center py-16">
          <Calendar className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No hay eventos</h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4">{isSupervisor ? 'Crea tu primer evento para empezar' : 'No tienes eventos asignados'}</p>
          {isSupervisor && <Link href="/eventos/nuevo"><Button><Plus className="h-4 w-4 mr-2" />Crear Evento</Button></Link>}
        </Card>
      ) : viewMode === 'calendar' ? (
        /* Calendar View */
        <EventCalendar events={filtered} onEventClick={handleEventClick} />
      ) : (
        /* List/Grid View */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(event => {
            const ModalIcon = modalityIcons[event.modalidad] || Globe;
            const sc = statusConfig[event.estado];
            return (
              <Link key={event.id} href={isSupervisor ? `/eventos/${event.id}` : `/eventos/${event.id}/vendedor`}>
                <Card className={`hover:shadow-lg transition-shadow cursor-pointer h-full border-l-4 ${event.estado === 'en_ejecucion' ? 'border-l-amber-500' : event.estado === 'finalizado' ? 'border-l-green-500' : event.estado === 'cancelado' ? 'border-l-red-500' : 'border-l-indigo-500'}`}>
                  <div className="p-5 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 dark:text-white text-lg line-clamp-1">{event.nombre}</h3>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${sc.bg} ${sc.color} font-medium`}>{sc.label}</span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-dark-500 text-gray-600 dark:text-gray-300">{typeLabels[event.tipo]}</span>
                        </div>
                      </div>
                      <ModalIcon className="h-5 w-5 text-gray-400 dark:text-gray-400 flex-shrink-0" />
                    </div>
                    
                    {event.objetivo && <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2">{event.objetivo}</p>}
                    
                    {(event as any).marcas && (event as any).marcas.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {(event as any).marcas.map((m: string) => (
                          <span key={m} className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">{m}</span>
                        ))}
                      </div>
                    )}
                    
                    <div className="flex flex-col gap-2 text-xs text-gray-500 dark:text-gray-400 pt-2 border-t border-gray-100 dark:border-dark-500">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5 text-green-500 dark:text-green-400" />
                        <span className="font-medium text-gray-600 dark:text-gray-300">Inicio:</span>
                        {format(new Date(event.fecha_inicio), "d MMM yyyy, HH:mm", { locale: es })}
                      </div>
                      {event.fecha_fin && (
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5 text-red-500 dark:text-red-400" />
                          <span className="font-medium text-gray-600 dark:text-gray-300">Fin:</span>
                          {format(new Date(event.fecha_fin), "d MMM yyyy, HH:mm", { locale: es })}
                        </div>
                      )}
                      <div className="flex items-center gap-4 mt-1">
                        {event.cupo_maximo > 0 && (
                          <span className="flex items-center gap-1">
                            <Users className="h-3.5 w-3.5" />
                            Cupo: {event.cupo_maximo}
                          </span>
                        )}
                        {isSupervisor && Number(event.presupuesto_total) > 0 && (
                          <span className="flex items-center gap-1">
                            <DollarSign className="h-3.5 w-3.5" />
                            ${Number(event.presupuesto_total).toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

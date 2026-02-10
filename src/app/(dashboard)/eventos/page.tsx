'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Plus, Calendar, Users, DollarSign, Target, Search, Filter,
  TrendingUp, Clock, CheckCircle, AlertTriangle, BarChart3,
  MapPin, Video, Globe,
} from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { useAuth } from '@/contexts/AuthContext';
import { getEvents, getVendorEvents, type Event, type EventStatus, type EventType } from '@/lib/services/events';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const statusConfig: Record<EventStatus, { label: string; color: string; bg: string }> = {
  planeado: { label: 'Planeado', color: 'text-blue-700', bg: 'bg-blue-100' },
  en_ejecucion: { label: 'En Ejecución', color: 'text-amber-700', bg: 'bg-amber-100' },
  finalizado: { label: 'Finalizado', color: 'text-green-700', bg: 'bg-green-100' },
  cancelado: { label: 'Cancelado', color: 'text-red-700', bg: 'bg-red-100' },
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
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<EventStatus | ''>('');
  const [filterType, setFilterType] = useState<EventType | ''>('');

  const isSupervisor = userProfile?.rol === 'admin' || userProfile?.rol === 'supervisor' || userProfile?.rol === 'supervisor_nivel1' || userProfile?.rol === 'supervisor_vendedor';
  const isVendor = userProfile?.rol === 'vendedor';
  const canView = isSupervisor || isVendor;

  useEffect(() => {
    if (canView && userProfile) loadEvents();
  }, [canView, userProfile]);

  const loadEvents = async () => {
    try {
      if (isSupervisor) {
        const data = await getEvents();
        setEvents(data);
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
    const matchSearch = !searchTerm || e.nombre.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = !filterStatus || e.estado === filterStatus;
    const matchType = !filterType || e.tipo === filterType;
    return matchSearch && matchStatus && matchType;
  });

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
          <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Acceso Denegado</h2>
          <p className="text-gray-600">Solo supervisores pueden acceder a este módulo.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Calendar className="h-7 w-7 text-indigo-600" />
            Gestión de Eventos
          </h1>
          <p className="text-gray-500 mt-1">{isSupervisor ? 'Planifica, ejecuta y monitorea eventos con control financiero' : 'Eventos en los que participas'}</p>
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
        <Card className="bg-indigo-50 border border-indigo-200">
          <div className="p-4">
            <p className="text-xs font-medium text-indigo-600 uppercase">Total</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</p>
          </div>
        </Card>
        {isSupervisor && (
          <Card className="bg-blue-50 border border-blue-200">
            <div className="p-4">
              <p className="text-xs font-medium text-blue-600 uppercase">Planeados</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats.planeados}</p>
            </div>
          </Card>
        )}
        <Card className="bg-amber-50 border border-amber-200">
          <div className="p-4">
            <p className="text-xs font-medium text-amber-600 uppercase">En Ejecución</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{stats.enEjecucion}</p>
          </div>
        </Card>
        <Card className="bg-green-50 border border-green-200">
          <div className="p-4">
            <p className="text-xs font-medium text-green-600 uppercase">Finalizados</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{stats.finalizados}</p>
          </div>
        </Card>
        {isSupervisor && (
          <Card className="bg-purple-50 border border-purple-200">
            <div className="p-4">
              <p className="text-xs font-medium text-purple-600 uppercase">Presupuesto</p>
              <p className="text-lg font-bold text-gray-900 mt-1">${stats.presupuestoTotal.toLocaleString()}</p>
            </div>
          </Card>
        )}
      </div>

      {/* Filters */}
      <Card>
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar evento..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)} className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white">
            <option value="">Todos los estados</option>
            {Object.entries(statusConfig).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <select value={filterType} onChange={e => setFilterType(e.target.value as any)} className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white">
            <option value="">Todos los tipos</option>
            {Object.entries(typeLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <Badge variant="blue">{filtered.length} eventos</Badge>
        </div>
      </Card>

      {/* Events Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="text-center py-16">
          <Calendar className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No hay eventos</h3>
          <p className="text-gray-500 mb-4">{isSupervisor ? 'Crea tu primer evento para empezar' : 'No tienes eventos asignados'}</p>
          {isSupervisor && <Link href="/eventos/nuevo"><Button><Plus className="h-4 w-4 mr-2" />Crear Evento</Button></Link>}
        </Card>
      ) : (
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
                        <h3 className="font-semibold text-gray-900 text-lg line-clamp-1">{event.nombre}</h3>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${sc.bg} ${sc.color} font-medium`}>{sc.label}</span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{typeLabels[event.tipo]}</span>
                        </div>
                      </div>
                      <ModalIcon className="h-5 w-5 text-gray-400 flex-shrink-0" />
                    </div>
                    
                    {event.objetivo && <p className="text-sm text-gray-600 line-clamp-2">{event.objetivo}</p>}
                    
                    <div className="flex items-center gap-4 text-xs text-gray-500 pt-2 border-t border-gray-100">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {format(new Date(event.fecha_inicio), "d MMM yyyy", { locale: es })}
                      </span>
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
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

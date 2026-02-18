'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Clock,
  Phone,
  Navigation,
  CheckCircle,
  AlertTriangle,
  List,
  Map,
} from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { getVisitsByDate, type Visit } from '@/lib/services/visits';
import { formatTime, visitStatusLabels } from '@/lib/utils';
import { format, addDays, subDays, isToday } from 'date-fns';
import { es } from 'date-fns/locale';

// Importar el mapa dinámicamente para evitar SSR
const MapView = dynamic(() => import('@/components/ui/MapView'), {
  ssr: false,
  loading: () => (
    <div className="h-[300px] md:h-[500px] bg-gray-100 dark:bg-dark-600 rounded-xl flex items-center justify-center">
      <div className="text-gray-400 dark:text-gray-300">Cargando mapa...</div>
    </div>
  ),
});

interface MapMarker {
  id: string;
  position: [number, number];
  title: string;
  subtitle?: string;
  time?: string;
  order: number;
  isCompleted?: boolean;
}

export default function MapaVisitasPage() {
  // Inicializar con la fecha de hoy a mediodía para evitar problemas de zona horaria
  const [selectedDate, setSelectedDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0);
  });
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const [markers, setMarkers] = useState<MapMarker[]>([]);
  const [mobileView, setMobileView] = useState<'map' | 'list'>('map');

  useEffect(() => {
    loadVisits();
  }, [selectedDate]);

  const loadVisits = async () => {
    setLoading(true);
    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const data = await getVisitsByDate(dateStr);
      
      // Ordenar por hora
      const sortedVisits = data.sort((a, b) => 
        new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
      );
      
      setVisits(sortedVisits);
      
      // Crear marcadores para el mapa
      const mapMarkers: MapMarker[] = sortedVisits
        .filter(v => v.customer?.latitud && v.customer?.longitud)
        .map((visit, index) => ({
          id: visit.id,
          position: [visit.customer!.latitud!, visit.customer!.longitud!] as [number, number],
          title: visit.customer?.nombre || 'Cliente',
          subtitle: visit.customer?.direccion || '',
          time: formatTime(visit.scheduled_at),
          order: index + 1,
          isCompleted: visit.status === 'completada',
        }));
      
      setMarkers(mapMarkers);
    } catch (error) {
      console.error('Error cargando visitas:', error);
    } finally {
      setLoading(false);
    }
  };

  const goToPreviousDay = () => {
    const prev = subDays(selectedDate, 1);
    setSelectedDate(new Date(prev.getFullYear(), prev.getMonth(), prev.getDate(), 12, 0, 0));
  };
  const goToNextDay = () => {
    const next = addDays(selectedDate, 1);
    setSelectedDate(new Date(next.getFullYear(), next.getMonth(), next.getDate(), 12, 0, 0));
  };
  const goToToday = () => {
    const now = new Date();
    setSelectedDate(new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0));
  };

  const visitsWithoutLocation = visits.filter(v => !v.customer?.latitud || !v.customer?.longitud);

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg md:text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <MapPin className="h-5 w-5 md:h-6 md:w-6 text-indigo-500 dark:text-indigo-400" />
              <span className="hidden sm:inline">Mapa de Visitas</span>
              <span className="sm:hidden">Mapa</span>
            </h1>
            <p className="text-gray-500 dark:text-gray-300 text-xs md:text-sm mt-0.5">
              {isToday(selectedDate) 
                ? 'Visitas de hoy' 
                : format(selectedDate, "EEE d MMM", { locale: es })
              }
            </p>
          </div>
          
          {/* Toggle móvil Mapa/Lista */}
          <div className="flex lg:hidden bg-gray-100 dark:bg-dark-600 rounded-xl p-1">
            <button
              onClick={() => setMobileView('map')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                mobileView === 'map' 
                  ? 'bg-white dark:bg-dark-500 text-indigo-600 dark:text-indigo-400 shadow-sm' 
                  : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              <Map className="h-4 w-4" />
              <span className="hidden xs:inline">Mapa</span>
            </button>
            <button
              onClick={() => setMobileView('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                mobileView === 'list' 
                  ? 'bg-white dark:bg-dark-500 text-indigo-600 dark:text-indigo-400 shadow-sm' 
                  : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              <List className="h-4 w-4" />
              <span className="hidden xs:inline">Lista</span>
              {visits.length > 0 && (
                <span className="bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 text-xs px-1.5 py-0.5 rounded-full">
                  {visits.length}
                </span>
              )}
            </button>
          </div>
        </div>
        
        {/* Selector de fecha - mejorado para móvil */}
        <div className="flex items-center justify-center gap-1 sm:gap-2 bg-white dark:bg-dark-700 rounded-xl p-2 shadow-sm border border-gray-100 dark:border-dark-500">
          <button
            onClick={goToPreviousDay}
            className="p-2 hover:bg-gray-100 dark:hover:bg-dark-600 rounded-lg transition-colors touch-manipulation"
          >
            <ChevronLeft className="h-5 w-5 text-gray-600 dark:text-gray-300" />
          </button>
          
          <input
            type="date"
            value={format(selectedDate, 'yyyy-MM-dd')}
            onChange={(e) => {
              if (e.target.value) {
                const [year, month, day] = e.target.value.split('-').map(Number);
                setSelectedDate(new Date(year, month - 1, day, 12, 0, 0));
              }
            }}
            className="flex-1 max-w-[160px] px-3 py-2 text-sm font-medium text-gray-700 dark:text-white bg-gray-50 dark:bg-dark-600 border-0 rounded-lg text-center cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-200"
          />
          
          <button
            onClick={goToToday}
            className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors touch-manipulation ${
              isToday(selectedDate)
                ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300'
                : 'bg-gray-50 dark:bg-dark-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-500'
            }`}
          >
            Hoy
          </button>
          
          <button
            onClick={goToNextDay}
            className="p-2 hover:bg-gray-100 dark:hover:bg-dark-600 rounded-lg transition-colors touch-manipulation"
          >
            <ChevronRight className="h-5 w-5 text-gray-600 dark:text-gray-300" />
          </button>
        </div>
      </div>

      {/* Contenido principal */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        {/* Mapa */}
        <div className={`lg:col-span-2 ${mobileView === 'list' ? 'hidden lg:block' : ''}`}>
          <Card padding="none" className="overflow-hidden">
            {loading ? (
              <div className="h-[300px] md:h-[500px] flex items-center justify-center bg-gray-50 dark:bg-dark-600">
                <div className="flex flex-col items-center gap-2">
                  <div className="animate-spin h-8 w-8 border-4 border-indigo-200 dark:border-indigo-800 border-t-indigo-500 rounded-full"></div>
                  <span className="text-gray-400 dark:text-gray-300 text-sm">Cargando visitas...</span>
                </div>
              </div>
            ) : markers.length === 0 ? (
              <div className="h-[300px] md:h-[500px] flex flex-col items-center justify-center bg-gray-50 dark:bg-dark-600 px-4">
                <MapPin className="h-10 w-10 md:h-12 md:w-12 text-gray-300 dark:text-gray-500 mb-3" />
                <p className="text-gray-500 dark:text-gray-300 text-center text-sm md:text-base">
                  {visits.length === 0 
                    ? 'No hay visitas programadas'
                    : 'Las visitas no tienen ubicación'}
                </p>
                {visits.length === 0 && (
                  <Link href="/calendario/nueva">
                    <Button variant="ghost" size="sm" className="mt-3">
                      Programar visita
                    </Button>
                  </Link>
                )}
              </div>
            ) : (
              <MapView 
                markers={markers} 
                showRoute={true}
                className="h-[300px] md:h-[500px]"
              />
            )}
          </Card>
          
          {/* Leyenda - más compacta en móvil */}
          {markers.length > 0 && (
            <div className="mt-2 md:mt-3 flex flex-wrap items-center justify-center md:justify-start gap-3 md:gap-4 text-xs md:text-sm text-gray-500 dark:text-gray-400">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 md:w-4 md:h-4 rounded-full bg-indigo-500"></div>
                <span>Pendiente</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 md:w-4 md:h-4 rounded-full bg-emerald-500"></div>
                <span>Completada</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-6 md:w-8 border-t-2 border-dashed border-indigo-400"></div>
                <span>Ruta</span>
              </div>
            </div>
          )}
        </div>

        {/* Lista de Visitas */}
        <div className={`lg:col-span-1 space-y-4 ${mobileView === 'map' ? 'hidden lg:block' : ''}`}>
          <Card padding="sm" className="md:p-6">
            <h2 className="text-base md:text-lg font-semibold text-gray-900 dark:text-white mb-3 md:mb-4 flex items-center gap-2">
              <Calendar className="h-4 w-4 md:h-5 md:w-5 text-indigo-500 dark:text-indigo-400" />
              Recorrido
              <Badge variant="blue">{visits.length}</Badge>
            </h2>

            {visits.length === 0 ? (
              <div className="text-center py-6 md:py-8">
                <Calendar className="h-8 w-8 md:h-10 md:w-10 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                <p className="text-sm text-gray-500 dark:text-gray-400">Sin visitas</p>
              </div>
            ) : (
              <div className="space-y-2 md:space-y-3 max-h-[60vh] lg:max-h-[450px] overflow-y-auto">
                {visits.map((visit, index) => {
                  const hasLocation = visit.customer?.latitud && visit.customer?.longitud;
                  
                  return (
                    <div
                      key={visit.id}
                      className="p-2.5 md:p-3 rounded-xl bg-gray-50 dark:bg-dark-600 border border-transparent hover:border-gray-200 dark:hover:border-dark-500 transition-colors"
                    >
                      <Link href={`/calendario/${visit.id}`} className="block">
                        <div className="flex items-start gap-2 md:gap-3">
                          {/* Número de orden */}
                          <div className={`
                            flex items-center justify-center w-7 h-7 md:w-8 md:h-8 rounded-full text-xs md:text-sm font-bold shrink-0
                            ${visit.status === 'completada' 
                              ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300' 
                              : 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300'}
                          `}>
                            {visit.status === 'completada' ? (
                              <CheckCircle className="h-4 w-4 md:h-5 md:w-5" />
                            ) : (
                              index + 1
                            )}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <span className="font-medium text-gray-900 dark:text-white text-sm truncate">
                                {visit.customer?.nombre || 'Cliente'}
                              </span>
                              {!hasLocation && (
                                <AlertTriangle className="h-3.5 w-3.5 text-amber-500 dark:text-amber-400 shrink-0" />
                              )}
                            </div>
                            
                            <div className="flex items-center gap-1.5 text-xs md:text-sm text-indigo-600 dark:text-indigo-400 font-medium">
                              <Clock className="h-3 w-3 md:h-3.5 md:w-3.5" />
                              {formatTime(visit.scheduled_at)}
                            </div>
                          </div>
                          
                          <Badge
                            variant={
                              visit.status === 'completada' ? 'green' :
                              visit.status === 'programada' ? 'blue' :
                              visit.status === 'cancelada' ? 'gray' : 'yellow'
                            }
                          >
                            <span className="hidden sm:inline">{visitStatusLabels[visit.status]}</span>
                            <span className="sm:hidden">
                              {visit.status === 'completada' ? '✓' : 
                               visit.status === 'programada' ? '◦' : '×'}
                            </span>
                          </Badge>
                        </div>
                      </Link>
                      
                      {/* Botones de acción - más grandes para touch */}
                      <div className="flex gap-2 mt-2">
                        {visit.customer?.telefono && (
                          <a
                            href={`tel:${visit.customer.telefono}`}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 px-2 bg-gray-100 dark:bg-dark-500 hover:bg-gray-200 dark:hover:bg-dark-400 text-gray-700 dark:text-gray-200 text-xs font-medium rounded-lg transition-colors touch-manipulation"
                          >
                            <Phone className="h-3.5 w-3.5" />
                            <span className="hidden xs:inline">Llamar</span>
                          </a>
                        )}
                        {hasLocation && (
                          <a
                            href={`https://www.google.com/maps/dir/?api=1&destination=${visit.customer!.latitud},${visit.customer!.longitud}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 px-2 bg-indigo-50 dark:bg-indigo-900/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 text-xs font-medium rounded-lg transition-colors touch-manipulation"
                          >
                            <Navigation className="h-3.5 w-3.5" />
                            <span className="hidden xs:inline">Navegar</span>
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Visitas sin ubicación - más compacto */}
          {visitsWithoutLocation.length > 0 && (
            <Card padding="sm" className="border-amber-200 dark:border-amber-800 bg-amber-50/30 dark:bg-amber-900/20">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <h3 className="font-medium text-gray-900 dark:text-white text-sm">Sin ubicación</h3>
                <Badge variant="yellow">{visitsWithoutLocation.length}</Badge>
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-300 mb-2">
                Configura las coordenadas para verlas en el mapa.
              </p>
              <div className="space-y-1.5">
                {visitsWithoutLocation.slice(0, 3).map((visit) => (
                  <Link
                    key={visit.id}
                    href={`/clientes/${visit.customer_id}/editar`}
                    className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-dark-600 hover:bg-gray-50 dark:hover:bg-dark-500 text-xs touch-manipulation"
                  >
                    <span className="text-gray-700 dark:text-gray-200 truncate">{visit.customer?.nombre}</span>
                    <span className="text-indigo-600 dark:text-indigo-400 shrink-0 ml-2">Configurar →</span>
                  </Link>
                ))}
                {visitsWithoutLocation.length > 3 && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 text-center py-1">
                    +{visitsWithoutLocation.length - 3} más
                  </p>
                )}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

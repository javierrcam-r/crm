'use client';

import { useEffect, useRef } from 'react';

interface MapMarker {
  id: string;
  position: [number, number];
  title: string;
  subtitle?: string;
  time?: string;
  order: number;
  isCompleted?: boolean;
}

interface MapViewProps {
  markers: MapMarker[];
  center?: [number, number];
  zoom?: number;
  showRoute?: boolean;
  className?: string;
}

export default function MapView({ 
  markers, 
  center = [-25.2637, -57.5759], // Asunción, Paraguay por defecto
  zoom = 13,
  showRoute = true,
  className = ''
}: MapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<MapMarker[]>(markers);

  // Actualizar referencia de markers
  markersRef.current = markers;

  useEffect(() => {
    // Solo ejecutar en el cliente
    if (typeof window === 'undefined') return;

    let isMounted = true;

    const initMap = async () => {
      try {
        // Importar Leaflet dinámicamente
        const L = (await import('leaflet')).default;
        
        // Importar CSS si no está cargado
        if (!document.querySelector('link[href*="leaflet"]')) {
          const link = document.createElement('link');
          link.rel = 'stylesheet';
          link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
          link.crossOrigin = '';
          document.head.appendChild(link);
          // Esperar a que el CSS cargue
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        if (!mapRef.current || !isMounted) return;

        // Si ya hay un mapa, actualizar marcadores
        if (mapInstanceRef.current) {
          updateMarkersOnMap(L, mapInstanceRef.current);
          return;
        }

        // Crear el mapa
        const map = L.map(mapRef.current, {
          center: center,
          zoom: zoom,
          scrollWheelZoom: true
        });
        
        // Agregar capa de tiles
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          maxZoom: 19
        }).addTo(map);

        mapInstanceRef.current = map;

        // Agregar marcadores
        addMarkersToMap(L, map);

      } catch (err) {
        console.error('Error inicializando mapa:', err);
      }
    };

    const updateMarkersOnMap = async (L: any, map: any) => {
      // Limpiar marcadores y polylines existentes
      map.eachLayer((layer: any) => {
        if (layer instanceof L.Marker || layer instanceof L.Polyline) {
          map.removeLayer(layer);
        }
      });
      addMarkersToMap(L, map);
    };

    const addMarkersToMap = (L: any, map: any) => {
      const currentMarkers = markersRef.current;
      
      // Función para crear icono numerado
      const createNumberedIcon = (number: number, isCompleted: boolean = false) => {
        const color = isCompleted ? '#10b981' : '#6366f1';
        const svg = `
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 44" width="32" height="44">
            <path fill="${color}" d="M16 0C7.163 0 0 7.163 0 16c0 12 16 28 16 28s16-16 16-28C32 7.163 24.837 0 16 0z"/>
            <circle cx="16" cy="14" r="10" fill="white"/>
            <text x="16" y="18" text-anchor="middle" font-size="12" font-weight="bold" fill="${color}">${number}</text>
          </svg>
        `;
        return L.divIcon({
          html: svg,
          className: 'custom-marker',
          iconSize: [32, 44],
          iconAnchor: [16, 44],
          popupAnchor: [0, -44],
        });
      };

      // Agregar marcadores
      const bounds: [number, number][] = [];
      
      currentMarkers.forEach((marker) => {
        const icon = createNumberedIcon(marker.order, marker.isCompleted);
        const leafletMarker = L.marker(marker.position, { icon }).addTo(map);
        
        // Popup
        const popupContent = `
          <div style="min-width: 150px; font-family: system-ui, sans-serif;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
              <span style="display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; border-radius: 50%; background: #eef2ff; color: #4338ca; font-size: 12px; font-weight: bold;">
                ${marker.order}
              </span>
              <span style="font-weight: 600; color: #111827;">${marker.title}</span>
            </div>
            ${marker.time ? `<p style="font-size: 14px; color: #4f46e5; font-weight: 500; margin: 4px 0;">${marker.time}</p>` : ''}
            ${marker.subtitle ? `<p style="font-size: 14px; color: #6b7280; margin: 4px 0;">${marker.subtitle}</p>` : ''}
          </div>
        `;
        leafletMarker.bindPopup(popupContent);
        
        bounds.push(marker.position);
      });

      // Dibujar ruta si hay más de un marcador
      if (showRoute && currentMarkers.length > 1) {
        const sortedPositions = [...currentMarkers]
          .sort((a, b) => a.order - b.order)
          .map(m => m.position);
        
        L.polyline(sortedPositions, {
          color: '#6366f1',
          weight: 3,
          opacity: 0.7,
          dashArray: '10, 10'
        }).addTo(map);
      }

      // Ajustar vista a los marcadores
      if (bounds.length > 0) {
        const latLngBounds = L.latLngBounds(bounds);
        map.fitBounds(latLngBounds, { padding: [50, 50] });
      }
    };

    initMap();

    // Cleanup
    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [markers, center, zoom, showRoute]);

  return (
    <div 
      ref={mapRef} 
      className={`rounded-xl overflow-hidden ${className}`}
      style={{ height: '500px', width: '100%', minHeight: '400px', background: '#f3f4f6' }}
    />
  );
}

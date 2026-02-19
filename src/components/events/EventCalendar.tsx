'use client';

import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, isToday, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import Card from '@/components/ui/Card';
import { type Event, type EventStatus } from '@/lib/services/events';

interface EventCalendarProps {
  events: Event[];
  onEventClick?: (event: Event) => void;
}

const statusColors: Record<EventStatus, string> = {
  planeado: 'bg-blue-500 dark:bg-blue-600',
  en_ejecucion: 'bg-amber-500 dark:bg-amber-600',
  finalizado: 'bg-green-500 dark:bg-green-600',
  cancelado: 'bg-red-400 dark:bg-red-600',
};

const statusBorderColors: Record<EventStatus, string> = {
  planeado: 'border-blue-500',
  en_ejecucion: 'border-amber-500',
  finalizado: 'border-green-500',
  cancelado: 'border-red-400',
};

export default function EventCalendar({ events, onEventClick }: EventCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const startDayOfWeek = monthStart.getDay();
  const paddingDays = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;

  const eventsByDate = useMemo(() => {
    const map = new Map<string, Event[]>();
    events.forEach(event => {
      const dateKey = event.fecha_fin 
        ? format(parseISO(event.fecha_fin), 'yyyy-MM-dd')
        : format(parseISO(event.fecha_inicio), 'yyyy-MM-dd');
      
      if (!map.has(dateKey)) {
        map.set(dateKey, []);
      }
      map.get(dateKey)!.push(event);
    });
    return map;
  }, [events]);

  const goToPrevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const goToNextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const goToToday = () => setCurrentDate(new Date());

  const weekDays = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

  return (
    <Card>
      <div className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {format(currentDate, 'MMMM yyyy', { locale: es })}
            </h3>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={goToToday}
              className="px-2 py-1 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors"
            >
              Hoy
            </button>
            <button
              onClick={goToPrevMonth}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-dark-500 rounded-lg transition-colors"
            >
              <ChevronLeft className="h-4 w-4 text-gray-600 dark:text-gray-300" />
            </button>
            <button
              onClick={goToNextMonth}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-dark-500 rounded-lg transition-colors"
            >
              <ChevronRight className="h-4 w-4 text-gray-600 dark:text-gray-300" />
            </button>
          </div>
        </div>

        {/* Week days header */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {weekDays.map(day => (
            <div key={day} className="text-center text-xs font-medium text-gray-500 dark:text-gray-400 py-2">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1">
          {/* Empty cells for padding */}
          {Array.from({ length: paddingDays }).map((_, i) => (
            <div key={`pad-${i}`} className="min-h-[80px] p-1 bg-gray-50/50 dark:bg-dark-700/30 rounded-lg" />
          ))}
          
          {/* Days */}
          {daysInMonth.map(day => {
            const dateKey = format(day, 'yyyy-MM-dd');
            const dayEvents = eventsByDate.get(dateKey) || [];
            const isCurrentDay = isToday(day);
            const isWeekend = day.getDay() === 0 || day.getDay() === 6;

            return (
              <div
                key={dateKey}
                className={`min-h-[80px] p-1 rounded-lg border transition-colors ${
                  isCurrentDay 
                    ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-300 dark:border-indigo-700' 
                    : isWeekend
                    ? 'bg-gray-50 dark:bg-dark-700/50 border-transparent'
                    : 'bg-white dark:bg-dark-600 border-gray-100 dark:border-dark-500'
                }`}
              >
                <div className={`text-xs font-medium mb-1 ${
                  isCurrentDay 
                    ? 'text-indigo-600 dark:text-indigo-400' 
                    : 'text-gray-600 dark:text-gray-300'
                }`}>
                  {format(day, 'd')}
                </div>
                
                <div className="space-y-0.5 overflow-hidden">
                  {dayEvents.slice(0, 3).map(event => (
                    <button
                      key={event.id}
                      onClick={() => onEventClick?.(event)}
                      className={`w-full text-left px-1.5 py-0.5 text-[10px] font-medium text-white rounded truncate hover:opacity-80 transition-opacity ${statusColors[event.estado]}`}
                      title={event.nombre}
                    >
                      {event.nombre}
                    </button>
                  ))}
                  {dayEvents.length > 3 && (
                    <div className="text-[10px] text-gray-500 dark:text-gray-400 px-1">
                      +{dayEvents.length - 3} más
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-3 mt-4 pt-3 border-t border-gray-100 dark:border-dark-500">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
            <span className="text-xs text-gray-600 dark:text-gray-300">Planeado</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            <span className="text-xs text-gray-600 dark:text-gray-300">En Ejecución</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
            <span className="text-xs text-gray-600 dark:text-gray-300">Finalizado</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
            <span className="text-xs text-gray-600 dark:text-gray-300">Cancelado</span>
          </div>
        </div>
      </div>
    </Card>
  );
}

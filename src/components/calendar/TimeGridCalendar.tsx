'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import { format, isSameDay, isToday } from 'date-fns';
import { es } from 'date-fns/locale';

// =====================================================
// Rejilla horaria (vista Día / Semana) con mover + estirar
// =====================================================

export type GridItemKind = 'visit' | 'activity';
export type GridColor = 'indigo' | 'purple' | 'blue' | 'gray' | 'amber' | 'rose' | 'teal';

export interface GridItem {
  kind: GridItemKind;
  id: string;
  title: string;
  subtitle?: string;
  icon?: string;
  start: string; // ISO
  end: string;   // ISO
  color: GridColor;
  movable: boolean;
  resizable: boolean;
  ownerId?: string | null;
}

interface TimeGridCalendarProps {
  days: Date[];
  items: GridItem[];
  startHour?: number;
  endHour?: number;
  hourHeight?: number;
  isDayBlocked?: (d: Date) => boolean;
  onItemClick?: (item: GridItem) => void;
  // Devuelve { ok, error? }. Si !ok, la vista se revierte.
  onCommit: (item: GridItem, newStart: Date, newEnd: Date) => Promise<{ ok: boolean; error?: string }>;
}

const SNAP_MIN = 15;
const MIN_DUR = 15;
const DRAG_THRESHOLD = 5;

const COLOR_CLASSES: Record<GridColor, string> = {
  indigo: 'bg-indigo-100 dark:bg-indigo-900/50 border-indigo-500 text-indigo-800 dark:text-indigo-100',
  purple: 'bg-purple-100 dark:bg-purple-900/50 border-purple-500 text-purple-800 dark:text-purple-100',
  blue: 'bg-blue-100 dark:bg-blue-900/50 border-blue-500 text-blue-800 dark:text-blue-100',
  gray: 'bg-gray-100 dark:bg-gray-700/60 border-gray-400 text-gray-700 dark:text-gray-200',
  amber: 'bg-amber-100 dark:bg-amber-900/50 border-amber-500 text-amber-800 dark:text-amber-100',
  rose: 'bg-rose-100 dark:bg-rose-900/50 border-rose-500 text-rose-800 dark:text-rose-100',
  teal: 'bg-teal-100 dark:bg-teal-900/50 border-teal-500 text-teal-800 dark:text-teal-100',
};

const pad = (n: number) => String(n).padStart(2, '0');
const fmtMin = (min: number) => `${pad(Math.floor(min / 60))}:${pad(Math.round(min % 60))}`;
const snap = (min: number) => Math.round(min / SNAP_MIN) * SNAP_MIN;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

// Minutos desde medianoche (hora local) de una fecha ISO.
const minutesOfDay = (iso: string) => {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
};

interface Gesture {
  mode: 'move' | 'resize';
  item: GridItem;
  origDayIndex: number;
  origStartMin: number;
  origDurMin: number;
  startX: number;
  startY: number;
  activated: boolean;
}

interface Preview {
  itemId: string;
  dayIndex: number;
  startMin: number;
  durMin: number;
  valid: boolean;
  mode: 'move' | 'resize';
}

interface PositionedItem {
  item: GridItem;
  startMin: number;
  durMin: number;
  col: number;
  cols: number;
}

// Distribuye en columnas paralelas los items que se solapan dentro de un día.
function layoutDay(items: { item: GridItem; startMin: number; durMin: number }[]): PositionedItem[] {
  const sorted = [...items].sort((a, b) => a.startMin - b.startMin || a.durMin - b.durMin);
  const result: PositionedItem[] = [];
  let cluster: typeof sorted = [];
  let clusterEnd = -1;

  const flush = () => {
    if (!cluster.length) return;
    const colEnds: number[] = [];
    const assigned = cluster.map((c) => {
      let col = colEnds.findIndex((end) => end <= c.startMin);
      if (col === -1) { col = colEnds.length; colEnds.push(0); }
      colEnds[col] = c.startMin + c.durMin;
      return { c, col };
    });
    const cols = colEnds.length;
    for (const { c, col } of assigned) {
      result.push({ item: c.item, startMin: c.startMin, durMin: c.durMin, col, cols });
    }
    cluster = [];
    clusterEnd = -1;
  };

  for (const s of sorted) {
    if (cluster.length && s.startMin >= clusterEnd) flush();
    cluster.push(s);
    clusterEnd = Math.max(clusterEnd, s.startMin + s.durMin);
  }
  flush();
  return result;
}

export default function TimeGridCalendar({
  days,
  items,
  startHour = 5,
  endHour = 23,
  hourHeight = 56,
  isDayBlocked,
  onItemClick,
  onCommit,
}: TimeGridCalendarProps) {
  const rangeStartMin = startHour * 60;
  const rangeEndMin = endHour * 60;
  const gridHeight = (endHour - startHour) * hourHeight;
  const hours = Array.from({ length: endHour - startHour + 1 }, (_, i) => startHour + i);

  const columnsRef = useRef<HTMLDivElement>(null);
  const gestureRef = useRef<Gesture | null>(null);
  const previewRef = useRef<Preview | null>(null);
  const [preview, setPreviewState] = useState<Preview | null>(null);
  const [committing, setCommitting] = useState(false);

  const setPreview = (p: Preview | null) => {
    previewRef.current = p;
    setPreviewState(p);
  };

  const minToTop = (min: number) => ((min - rangeStartMin) / 60) * hourHeight;
  const durToHeight = (dur: number) => Math.max((dur / 60) * hourHeight, 20);

  // Scroll inicial a las 7:00 aprox.
  useLayoutEffect(() => {
    const el = columnsRef.current?.parentElement?.parentElement;
    if (el) el.scrollTop = ((8 - startHour) / (endHour - startHour)) * gridHeight - 40;
  }, [startHour, endHour, gridHeight]);

  const endGesture = () => {
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
  };

  function onPointerMove(e: PointerEvent) {
    const g = gestureRef.current;
    if (!g) return;
    const dx = e.clientX - g.startX;
    const dy = e.clientY - g.startY;
    // Elementos no movibles: solo permiten clic, nunca arrastre.
    if (g.mode === 'move' && !g.item.movable) return;
    if (!g.activated) {
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      g.activated = true;
      document.body.style.userSelect = 'none';
      document.body.style.cursor = g.mode === 'resize' ? 'ns-resize' : 'grabbing';
    }
    const deltaMin = (dy / hourHeight) * 60;

    if (g.mode === 'move') {
      let dayIndex = g.origDayIndex;
      if (days.length > 1 && columnsRef.current) {
        const rect = columnsRef.current.getBoundingClientRect();
        const colW = rect.width / days.length;
        dayIndex = clamp(Math.floor((e.clientX - rect.left) / colW), 0, days.length - 1);
      }
      let startMin = snap(g.origStartMin + deltaMin);
      startMin = clamp(startMin, rangeStartMin, rangeEndMin - g.origDurMin);
      const blocked = isDayBlocked ? isDayBlocked(days[dayIndex]) : false;
      setPreview({ itemId: g.item.id, dayIndex, startMin, durMin: g.origDurMin, valid: !blocked, mode: 'move' });
    } else {
      let durMin = snap(g.origDurMin + deltaMin);
      durMin = Math.max(MIN_DUR, durMin);
      const overflow = g.origStartMin + durMin > rangeEndMin;
      if (overflow) durMin = rangeEndMin - g.origStartMin;
      setPreview({ itemId: g.item.id, dayIndex: g.origDayIndex, startMin: g.origStartMin, durMin, valid: !overflow || durMin >= MIN_DUR, mode: 'resize' });
    }
  }

  async function onPointerUp() {
    const g = gestureRef.current;
    gestureRef.current = null;
    endGesture();
    if (!g) return;

    if (!g.activated) {
      setPreview(null);
      onItemClick?.(g.item);
      return;
    }

    const p = previewRef.current;
    setPreview(null);
    if (!p || !p.valid) return;

    const day = days[p.dayIndex];
    const newStart = new Date(day.getFullYear(), day.getMonth(), day.getDate(), Math.floor(p.startMin / 60), p.startMin % 60, 0, 0);
    const newEnd = new Date(newStart.getTime() + p.durMin * 60000);

    // Sin cambios reales
    const sameStart = newStart.getTime() === new Date(g.item.start).getTime();
    const sameEnd = newEnd.getTime() === new Date(g.item.end).getTime();
    if (sameStart && sameEnd) return;

    setCommitting(true);
    try {
      await onCommit(g.item, newStart, newEnd);
    } finally {
      setCommitting(false);
    }
  }

  const startGesture = (e: React.PointerEvent, mode: 'move' | 'resize', item: GridItem, dayIndex: number) => {
    if (mode === 'resize' && !item.resizable) return;
    if (committing) return;
    e.stopPropagation();
    const origStartMin = clamp(minutesOfDay(item.start), rangeStartMin, rangeEndMin - MIN_DUR);
    const durFromData = Math.round((new Date(item.end).getTime() - new Date(item.start).getTime()) / 60000);
    const origDurMin = clamp(durFromData || 60, MIN_DUR, rangeEndMin - origStartMin);
    gestureRef.current = { mode, item, origDayIndex: dayIndex, origStartMin, origDurMin, startX: e.clientX, startY: e.clientY, activated: false };
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  return (
    <div className="w-full overflow-auto" style={{ maxHeight: '72vh' }}>
      <div className="flex min-w-[560px]">
        {/* Gutter de horas */}
        <div className="w-12 sm:w-14 flex-shrink-0 select-none">
          <div className="h-10 border-b border-gray-200 dark:border-dark-500" />
          <div className="relative" style={{ height: gridHeight }}>
            {hours.map((h, i) => (
              <div
                key={h}
                className="absolute right-1 -translate-y-1/2 text-[10px] sm:text-xs text-gray-400 dark:text-gray-500"
                style={{ top: i * hourHeight }}
              >
                {pad(h)}:00
              </div>
            ))}
          </div>
        </div>

        {/* Columnas de días */}
        <div ref={columnsRef} className="grid flex-1" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}>
          {days.map((day, dayIndex) => {
            const today = isToday(day);
            const blocked = isDayBlocked ? isDayBlocked(day) : false;
            const isDropTarget = preview?.mode === 'move' && preview.dayIndex === dayIndex;

            const dayItemsRaw = items
              .filter((it) => isSameDay(new Date(it.start), day))
              .map((it) => ({ item: it, startMin: clamp(minutesOfDay(it.start), rangeStartMin, rangeEndMin), durMin: Math.max(MIN_DUR, Math.round((new Date(it.end).getTime() - new Date(it.start).getTime()) / 60000) || 60) }));
            const positioned = layoutDay(dayItemsRaw);

            return (
              <div key={dayIndex} className="border-l border-gray-200 dark:border-dark-500 min-w-0">
                {/* Cabecera del día */}
                <div className={`h-10 flex flex-col items-center justify-center border-b border-gray-200 dark:border-dark-500 ${today ? 'bg-indigo-50 dark:bg-indigo-900/30' : ''}`}>
                  <span className="text-[10px] uppercase text-gray-400 dark:text-gray-500 leading-none">{format(day, 'EEE', { locale: es })}</span>
                  <span className={`text-sm font-bold leading-tight ${today ? 'text-indigo-600 dark:text-indigo-300' : 'text-gray-800 dark:text-gray-200'}`}>{format(day, 'd')}</span>
                </div>

                {/* Cuerpo con líneas horarias */}
                <div
                  className={`relative ${blocked ? 'bg-amber-50/40 dark:bg-amber-900/10' : ''} ${isDropTarget ? 'bg-indigo-50/60 dark:bg-indigo-900/20' : ''}`}
                  style={{ height: gridHeight }}
                >
                  {hours.slice(0, -1).map((h, i) => (
                    <div key={h} className="absolute left-0 right-0 border-b border-gray-100 dark:border-dark-600" style={{ top: (i + 1) * hourHeight }} />
                  ))}

                  {/* Bloques del día */}
                  {positioned.map(({ item, startMin, durMin, col, cols }) => {
                    const isPreviewItem = preview?.itemId === item.id;
                    if (isPreviewItem) return null; // se dibuja como preview
                    const widthPct = 100 / cols;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onPointerDown={(e) => startGesture(e, 'move', item, dayIndex)}
                        className={`absolute rounded-md border-l-4 px-1.5 py-0.5 text-left overflow-hidden shadow-sm ${COLOR_CLASSES[item.color]} ${item.movable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}`}
                        style={{ top: minToTop(startMin) + 1, height: durToHeight(durMin) - 2, left: `calc(${col * widthPct}% + 2px)`, width: `calc(${widthPct}% - 4px)`, touchAction: 'none' }}
                        title={item.title}
                      >
                        <div className="text-[10px] font-semibold leading-tight truncate">
                          {item.icon ? `${item.icon} ` : ''}{fmtMin(startMin)}
                        </div>
                        <div className="text-[11px] font-medium leading-tight truncate">{item.title}</div>
                        {item.subtitle && durMin >= 45 && (
                          <div className="text-[9px] opacity-70 leading-tight truncate">{item.subtitle}</div>
                        )}
                        {item.resizable && (
                          <span
                            onPointerDown={(e) => startGesture(e, 'resize', item, dayIndex)}
                            className="absolute bottom-0 left-0 right-0 h-3.5 cursor-ns-resize flex items-end justify-center"
                            style={{ touchAction: 'none' }}
                          >
                            <span className="mb-0.5 h-1 w-6 rounded-full bg-current opacity-40" />
                          </span>
                        )}
                      </button>
                    );
                  })}

                  {/* Preview fantasma */}
                  {preview && preview.dayIndex === dayIndex && (() => {
                    const item = items.find((it) => it.id === preview.itemId);
                    if (!item) return null;
                    const top = minToTop(preview.startMin);
                    const height = durToHeight(preview.durMin);
                    return (
                      <>
                        <div className="absolute left-0 right-0 border-t-2 border-dashed border-indigo-500 z-20 pointer-events-none" style={{ top }} />
                        <div
                          className={`absolute rounded-md border-l-4 px-1.5 py-0.5 z-20 pointer-events-none shadow-lg ring-2 ${preview.valid ? 'ring-indigo-400' : 'ring-red-400'} ${preview.valid ? COLOR_CLASSES[item.color] : 'bg-red-100 dark:bg-red-900/50 border-red-500 text-red-800 dark:text-red-100'}`}
                          style={{ top: top + 1, height: height - 2, left: '2px', right: '2px' }}
                        >
                          <div className="text-[10px] font-bold leading-tight">
                            {fmtMin(preview.startMin)}–{fmtMin(preview.startMin + preview.durMin)}
                          </div>
                          <div className="text-[11px] font-medium leading-tight truncate">{item.title}</div>
                          {preview.mode === 'resize' && (
                            <div className="text-[9px] leading-tight">{preview.durMin} min</div>
                          )}
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

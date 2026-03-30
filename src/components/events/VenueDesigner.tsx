'use client';

import { useState, useCallback, useEffect, useRef, useMemo, type PointerEvent as RPointerEvent, type WheelEvent as RWheelEvent } from 'react';
import {
  DndContext, DragEndEvent, DragStartEvent, DragOverlay,
  useSensor, useSensors, PointerSensor, closestCenter,
  useDroppable, useDraggable,
} from '@dnd-kit/core';
import {
  Save, Trash2, GripVertical, Users, LayoutGrid, RotateCw,
  ZoomIn, ZoomOut, Maximize2, Copy, Lock, Unlock, ChevronRight,
  Theater, Circle, RectangleHorizontal, Grid3X3, MapPin, Square, Type, X,
  MousePointer2, Move,
} from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import toast from 'react-hot-toast';
import type { Event, EventParticipant, VenueLayout, VenueElement, VenueElementType } from '@/lib/services/events';
import { fuzzySearch } from '@/lib/search';
import { getEventVenueLayout, upsertEventVenueLayout, assignSeatToParticipant } from '@/lib/services/events';
import SeatPickerModal from './SeatPickerModal';

// ═══════════════════════════════════════════════════════════════
//  CONSTANTS
// ═══════════════════════════════════════════════════════════════
const M2PX = 50;
const GRID_M = 1;
const SEAT_R_M = 0.22;
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 3;
const CANVAS_W_M = 40;
const CANVAS_H_M = 25;

function uid() { return crypto.randomUUID().slice(0, 8); }
function snap(v: number, grid: number) { return Math.round(v / grid) * grid; }
function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }
function rad(deg: number) { return (deg * Math.PI) / 180; }

// ═══════════════════════════════════════════════════════════════
//  SEAT HELPERS
// ═══════════════════════════════════════════════════════════════
function seatId(prefix: string, row: number, col: number) {
  return `${prefix}-${String.fromCharCode(65 + row)}${col + 1}`;
}

function seatsForElement(el: VenueElement): { id: string; dx: number; dy: number }[] {
  const prefix = el.seatPrefix || el.label.slice(0, 2).toUpperCase();
  const out: { id: string; dx: number; dy: number }[] = [];

  if (el.type === 'round_table') {
    const n = el.seats || 8;
    const r = Math.max(el.w, el.h) / 2 + 0.15;
    for (let i = 0; i < n; i++) {
      const a = (2 * Math.PI * i) / n - Math.PI / 2;
      out.push({ id: `${prefix}-${i + 1}`, dx: Math.cos(a) * r, dy: Math.sin(a) * r });
    }
  } else if (el.type === 'rect_table') {
    const perSide = el.seats || 3;
    const gap = el.w / (perSide + 1);
    for (let i = 0; i < perSide; i++) {
      out.push({ id: `${prefix}-A${i + 1}`, dx: gap * (i + 1) - el.w / 2, dy: -el.h / 2 - 0.35 });
      out.push({ id: `${prefix}-B${i + 1}`, dx: gap * (i + 1) - el.w / 2, dy: el.h / 2 + 0.35 });
    }
  } else if (el.type === 'seat_block') {
    const rows = el.rows || 3;
    const cols = el.cols || 8;
    const sp = SEAT_R_M * 2 + 0.08;
    const offX = ((cols - 1) * sp) / 2;
    const offY = ((rows - 1) * sp) / 2;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        out.push({ id: seatId(prefix, r, c), dx: c * sp - offX, dy: r * sp - offY });
      }
    }
  } else if (el.type === 'booth') {
    out.push({ id: `${prefix}-1`, dx: 0, dy: 0 });
  }
  return out;
}

function allSeatIds(el: VenueElement): string[] {
  return seatsForElement(el).map(s => s.id);
}

// ═══════════════════════════════════════════════════════════════
//  ELEMENT DEFAULTS
// ═══════════════════════════════════════════════════════════════
const DEFAULTS: Record<VenueElementType, Partial<VenueElement>> = {
  stage:       { w: 8, h: 3, color: '#374151', label: 'ESCENARIO' },
  round_table: { w: 1.5, h: 1.5, seats: 8, color: '#7c3aed', label: 'Mesa' },
  rect_table:  { w: 2.4, h: 0.9, seats: 3, color: '#2563eb', label: 'Mesa' },
  seat_block:  { w: 4, h: 2, rows: 4, cols: 10, color: '#6366f1', label: 'Sección' },
  booth:       { w: 1.2, h: 1.2, color: '#059669', label: 'Puesto' },
  area:        { w: 5, h: 5, color: '#d97706', label: 'Zona' },
  label:       { w: 3, h: 0.8, color: '#6b7280', label: 'Texto' },
};

function newElement(type: VenueElementType, x: number, y: number, idx: number): VenueElement {
  const d = DEFAULTS[type];
  const labelNum = type === 'stage' || type === 'label' || type === 'area' ? '' : ` ${idx + 1}`;
  return {
    id: uid(), type, x, y, rotation: 0,
    label: `${d.label}${labelNum}`,
    w: d.w!, h: d.h!,
    color: d.color!,
    seats: d.seats,
    rows: d.rows,
    cols: d.cols,
    seatPrefix: '',
  };
}

// ═══════════════════════════════════════════════════════════════
//  TOOL PALETTE definitions
// ═══════════════════════════════════════════════════════════════
const TOOLS: { type: VenueElementType; icon: typeof Theater; tip: string }[] = [
  { type: 'stage', icon: Theater, tip: 'Escenario' },
  { type: 'round_table', icon: Circle, tip: 'Mesa redonda' },
  { type: 'rect_table', icon: RectangleHorizontal, tip: 'Mesa rectangular' },
  { type: 'seat_block', icon: Grid3X3, tip: 'Bloque de asientos' },
  { type: 'booth', icon: MapPin, tip: 'Puesto / Stand' },
  { type: 'area', icon: Square, tip: 'Zona / Área' },
  { type: 'label', icon: Type, tip: 'Etiqueta' },
];

const COLORS = ['#6366f1', '#7c3aed', '#2563eb', '#059669', '#d97706', '#ec4899', '#ef4444', '#374151', '#d4a843', '#06b6d4'];

// ═══════════════════════════════════════════════════════════════
//  DROPPABLE SEAT DOT
// ═══════════════════════════════════════════════════════════════
function SeatDot({ seatId: sid, dx, dy, occupant, color, onRemove }: {
  seatId: string; dx: number; dy: number;
  occupant: EventParticipant | null; color: string; onRemove: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `seat-${sid}`, data: { type: 'seat', seatId: sid } });
  const r = SEAT_R_M * M2PX;
  return (
    <div
      ref={setNodeRef}
      title={occupant ? `${occupant.nombre} — ${sid}` : sid}
      className="absolute flex items-center justify-center rounded-full transition-all"
      style={{
        width: r * 2, height: r * 2,
        left: dx * M2PX - r, top: dy * M2PX - r,
        background: occupant ? color : '#e5e7eb',
        border: isOver ? '3px solid #818cf8' : occupant ? '2px solid rgba(255,255,255,0.4)' : '2px solid #d1d5db',
        transform: isOver ? 'scale(1.25)' : 'scale(1)',
        zIndex: isOver ? 20 : 1,
        cursor: occupant ? 'pointer' : 'default',
      }}
      onClick={(e) => { if (occupant) { e.stopPropagation(); onRemove(); } }}
    >
      <span className="text-[6px] font-bold select-none pointer-events-none"
        style={{ color: occupant ? '#fff' : '#9ca3af' }}>
        {occupant ? occupant.nombre.slice(0, 2).toUpperCase() : sid.split('-').pop()}
      </span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  DRAGGABLE PARTICIPANT CHIP
// ═══════════════════════════════════════════════════════════════
function ParticipantChip({ p, isAssigned, catColor, onClickAssign }: {
  p: EventParticipant; isAssigned: boolean; catColor?: string | null; onClickAssign?: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `participant-${p.id}`, data: { type: 'participant', participant: p },
  });
  return (
    <div ref={setNodeRef} {...listeners} {...attributes}
      className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] cursor-grab active:cursor-grabbing select-none transition-all
        ${isDragging ? 'opacity-30' : ''}
        ${isAssigned
          ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300'
          : 'bg-white dark:bg-dark-600 border border-gray-200 dark:border-dark-400 text-gray-700 dark:text-gray-300 hover:border-indigo-300'}`}>
      <GripVertical className="h-3 w-3 text-gray-400 flex-shrink-0" />
      {p.categoria && catColor && (
        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: catColor }} title={p.categoria} />
      )}
      <span className="truncate flex-1">{p.nombre}</span>
      {p.categoria && (
        <span className="text-[8px] px-1 py-0.5 rounded font-medium flex-shrink-0 truncate max-w-[50px]"
          style={{ background: `${catColor || '#0d9488'}20`, color: catColor || '#0d9488' }}>
          {p.categoria}
        </span>
      )}
      {isAssigned && <span className="text-[8px] font-bold text-green-600 dark:text-green-400 flex-shrink-0">{p.numero_asiento}</span>}
      {onClickAssign && !isAssigned && (
        <button onClick={(e) => { e.stopPropagation(); e.preventDefault(); onClickAssign(); }}
          className="p-0.5 rounded hover:bg-indigo-100 dark:hover:bg-indigo-900/30 text-indigo-500 flex-shrink-0"
          title="Asignar asiento">
          <MapPin className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  ELEMENT RENDERER
// ═══════════════════════════════════════════════════════════════
function ElementVisual({ el, selected, seatMap, onRemoveSeat }: {
  el: VenueElement; selected: boolean;
  seatMap: Map<string, EventParticipant>;
  onRemoveSeat: (sid: string) => void;
}) {
  const wPx = el.w * M2PX;
  const hPx = el.h * M2PX;
  const seats = seatsForElement(el);
  const occupied = seats.filter(s => seatMap.has(s.id)).length;
  const hasSeat = seats.length > 0;

  const body = (() => {
    switch (el.type) {
      case 'stage':
        return (
          <div className="w-full h-full rounded-xl flex items-center justify-center"
            style={{ background: `${el.color}18`, border: `2px dashed ${el.color}60` }}>
            <span className="text-xs font-bold tracking-[3px] uppercase" style={{ color: `${el.color}cc` }}>{el.label}</span>
          </div>
        );

      case 'round_table':
        return (
          <>
            <div className="absolute rounded-full" style={{
              width: el.w * M2PX, height: el.h * M2PX,
              left: '50%', top: '50%', transform: 'translate(-50%,-50%)',
              background: `${el.color}22`, border: `2px solid ${el.color}60`,
            }} />
            <span className="absolute text-[8px] font-bold text-center w-full"
              style={{ top: '50%', left: 0, transform: 'translateY(-50%)', color: el.color }}>
              {el.label}
            </span>
            {seats.map(s => (
              <SeatDot key={s.id} seatId={s.id}
                dx={s.dx + el.w / 2} dy={s.dy + el.h / 2}
                occupant={seatMap.get(s.id) || null} color={el.color}
                onRemove={() => onRemoveSeat(s.id)} />
            ))}
          </>
        );

      case 'rect_table':
        return (
          <>
            <div className="absolute rounded-lg" style={{
              width: el.w * M2PX, height: el.h * M2PX,
              left: '50%', top: '50%', transform: 'translate(-50%,-50%)',
              background: `${el.color}22`, border: `2px solid ${el.color}60`,
            }} />
            <span className="absolute text-[8px] font-bold text-center w-full"
              style={{ top: '50%', left: 0, transform: 'translateY(-50%)', color: el.color }}>
              {el.label}
            </span>
            {seats.map(s => (
              <SeatDot key={s.id} seatId={s.id}
                dx={s.dx + el.w / 2} dy={s.dy + el.h / 2}
                occupant={seatMap.get(s.id) || null} color={el.color}
                onRemove={() => onRemoveSeat(s.id)} />
            ))}
          </>
        );

      case 'seat_block':
        return (
          <>
            <div className="absolute inset-0 rounded-lg" style={{ border: `1.5px dashed ${el.color}40` }} />
            <span className="absolute -top-4 left-1 text-[9px] font-bold" style={{ color: el.color }}>
              {el.label} <span className="font-normal text-gray-400">({occupied}/{seats.length})</span>
            </span>
            {seats.map(s => (
              <SeatDot key={s.id} seatId={s.id}
                dx={s.dx + el.w / 2} dy={s.dy + el.h / 2}
                occupant={seatMap.get(s.id) || null} color={el.color}
                onRemove={() => onRemoveSeat(s.id)} />
            ))}
          </>
        );

      case 'booth':
        return (
          <>
            <div className="w-full h-full rounded-lg flex flex-col items-center justify-center gap-0.5"
              style={{ background: `${el.color}18`, border: `2px solid ${el.color}60` }}>
              <MapPin className="h-3 w-3" style={{ color: el.color }} />
              <span className="text-[7px] font-bold" style={{ color: el.color }}>{el.label}</span>
            </div>
            {seats.map(s => (
              <SeatDot key={s.id} seatId={s.id}
                dx={s.dx + el.w / 2} dy={s.dy + el.h / 2}
                occupant={seatMap.get(s.id) || null} color={el.color}
                onRemove={() => onRemoveSeat(s.id)} />
            ))}
          </>
        );

      case 'area':
        return (
          <div className="w-full h-full rounded-xl flex items-center justify-center"
            style={{ background: `${el.color}10`, border: `1.5px dashed ${el.color}50` }}>
            <span className="text-xs font-semibold" style={{ color: `${el.color}99` }}>{el.label}</span>
          </div>
        );

      case 'label':
        return (
          <div className="flex items-center h-full px-2">
            <span className="text-sm font-bold whitespace-nowrap" style={{ color: el.color }}>{el.label}</span>
          </div>
        );

      default: return null;
    }
  })();

  const totalW = wPx + (el.type === 'round_table' || el.type === 'rect_table' ? M2PX * 0.7 : 0);
  const totalH = hPx + (el.type === 'round_table' ? M2PX * 0.7 : el.type === 'rect_table' ? M2PX * 0.8 : 0);

  return (
    <div className="relative" style={{ width: totalW, height: totalH }}>
      {body}
      {selected && (
        <div className="absolute -inset-1 rounded-xl border-2 border-indigo-400 pointer-events-none"
          style={{ boxShadow: '0 0 0 3px rgba(99,102,241,0.15)' }} />
      )}
      {hasSeat && el.type !== 'seat_block' && (
        <span className="absolute -bottom-3.5 left-1/2 -translate-x-1/2 text-[8px] text-gray-400 whitespace-nowrap">
          {occupied}/{seats.length}
        </span>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  PROPERTIES PANEL
// ═══════════════════════════════════════════════════════════════
function PropsPanel({ el, onChange, onDelete, onDuplicate }: {
  el: VenueElement;
  onChange: (e: VenueElement) => void;
  onDelete: () => void;
  onDuplicate: () => void;
}) {
  const set = (patch: Partial<VenueElement>) => onChange({ ...el, ...patch });
  const typeNames: Record<VenueElementType, string> = {
    stage: 'Escenario', round_table: 'Mesa redonda', rect_table: 'Mesa rectangular',
    seat_block: 'Bloque de asientos', booth: 'Puesto / Stand', area: 'Zona', label: 'Etiqueta',
  };
  const hasSeatConfig = el.type === 'round_table' || el.type === 'rect_table';
  const hasGrid = el.type === 'seat_block';
  const hasSeatPrefix = hasSeatConfig || hasGrid || el.type === 'booth';

  return (
    <div className="space-y-3 text-xs">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-gray-600 dark:text-gray-300">{typeNames[el.type]}</span>
        <div className="flex gap-1">
          <button onClick={onDuplicate} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-dark-500 text-gray-400 hover:text-indigo-600" title="Duplicar"><Copy className="h-3.5 w-3.5" /></button>
          <button onClick={() => set({ locked: !el.locked })} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-dark-500 text-gray-400 hover:text-amber-600" title={el.locked ? 'Desbloquear' : 'Bloquear'}>
            {el.locked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
          </button>
          <button onClick={onDelete} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-dark-500 text-gray-400 hover:text-red-600" title="Eliminar"><Trash2 className="h-3.5 w-3.5" /></button>
        </div>
      </div>

      <Input label="Nombre" value={el.label} onChange={e => set({ label: e.target.value })} />

      <div className="grid grid-cols-2 gap-2">
        <Input label="Ancho (m)" type="number" step={0.1} min={0.3} value={el.w} onChange={e => set({ w: +e.target.value })} />
        <Input label="Alto (m)" type="number" step={0.1} min={0.3} value={el.h} onChange={e => set({ h: +e.target.value })} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Input label="X (m)" type="number" step={0.5} value={el.x} onChange={e => set({ x: +e.target.value })} />
        <Input label="Y (m)" type="number" step={0.5} value={el.y} onChange={e => set({ y: +e.target.value })} />
      </div>

      <div>
        <label className="block text-[11px] font-medium text-gray-600 dark:text-gray-400 mb-1">Rotación: {el.rotation}°</label>
        <div className="flex items-center gap-2">
          <input type="range" min={0} max={360} step={15} value={el.rotation} onChange={e => set({ rotation: +e.target.value })}
            className="flex-1 h-1.5 rounded-full appearance-none bg-gray-200 dark:bg-dark-500 accent-indigo-500" />
          <button onClick={() => set({ rotation: (el.rotation + 90) % 360 })} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-dark-500 text-gray-500">
            <RotateCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {hasSeatConfig && (
        <Input label={el.type === 'round_table' ? 'Asientos alrededor' : 'Asientos por lado'} type="number" min={2} max={20}
          value={el.seats || 8} onChange={e => set({ seats: +e.target.value })} />
      )}
      {hasGrid && (
        <div className="grid grid-cols-2 gap-2">
          <Input label="Filas" type="number" min={1} max={30} value={el.rows || 3} onChange={e => set({ rows: +e.target.value })} />
          <Input label="Columnas" type="number" min={1} max={40} value={el.cols || 8} onChange={e => set({ cols: +e.target.value })} />
        </div>
      )}
      {hasSeatPrefix && (
        <Input label="Prefijo asiento" placeholder="Ej: D, P, VIP" value={el.seatPrefix || ''} onChange={e => set({ seatPrefix: e.target.value.toUpperCase() })} />
      )}

      <div>
        <label className="block text-[11px] font-medium text-gray-600 dark:text-gray-400 mb-1">Color</label>
        <div className="flex gap-1.5 flex-wrap">
          {COLORS.map(c => (
            <button key={c} onClick={() => set({ color: c })}
              className={`w-6 h-6 rounded-md border-2 transition ${el.color === c ? 'border-gray-800 dark:border-white scale-110' : 'border-transparent hover:scale-105'}`}
              style={{ background: c }} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════
interface VenueDesignerProps {
  event: Event;
  participants: EventParticipant[];
  onParticipantsChange: () => void;
}

export default function VenueDesigner({ event, participants, onParticipantsChange }: VenueDesignerProps) {
  const [layout, setLayout] = useState<VenueLayout>({ elements: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(0.85);
  const [pan, setPan] = useState({ x: 20, y: 20 });
  const [draggingElId, setDraggingElId] = useState<string | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [draggedParticipant, setDraggedParticipant] = useState<EventParticipant | null>(null);
  const [search, setSearch] = useState('');
  const [sideTab, setSideTab] = useState<'tools' | 'props' | 'people'>('tools');
  const [snapGrid, setSnapGrid] = useState(true);
  const [catFilter, setCatFilter] = useState<string | null>(null);
  const [seatPickerParticipant, setSeatPickerParticipant] = useState<EventParticipant | null>(null);
  const [localParticipants, setLocalParticipants] = useState<EventParticipant[]>(participants);

  const canvasRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef({ elX: 0, elY: 0, mx: 0, my: 0 });
  const panStart = useRef({ px: 0, py: 0, mx: 0, my: 0 });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  useEffect(() => { setLocalParticipants(participants); }, [participants]);

  const seatMap = new Map<string, EventParticipant>();
  localParticipants.forEach(p => { if (p.numero_asiento) seatMap.set(p.numero_asiento, p); });

  const catColors = useMemo(() => {
    const m = new Map<string, string>();
    (event.categorias_participantes || []).forEach((c: any) => { if (c.color) m.set(c.nombre, c.color); });
    return m;
  }, [event.categorias_participantes]);
  const categories = useMemo(() => {
    const set = new Set<string>();
    localParticipants.forEach(p => { if (p.categoria) set.add(p.categoria); });
    return Array.from(set);
  }, [localParticipants]);

  const selectedEl = layout.elements.find(e => e.id === selectedId) || null;

  const totalSeats = layout.elements.reduce((n, el) => n + allSeatIds(el).length, 0);
  const occupiedSeats = localParticipants.filter(p => p.numero_asiento).length;
  const unassigned = localParticipants.filter(p => !p.numero_asiento);

  // ─── Load / Save ──────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const saved = await getEventVenueLayout(event.id);
        if (saved) setLayout(saved.layout);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, [event.id]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await upsertEventVenueLayout(event.id, layout);
      setDirty(false);
      toast.success('Diseño guardado');
    } catch { toast.error('Error al guardar'); }
    finally { setSaving(false); }
  }, [event.id, layout]);

  // ─── Element CRUD ─────────────────────────────────────────
  const mutLayout = useCallback((fn: (els: VenueElement[]) => VenueElement[]) => {
    setLayout(prev => ({ elements: fn(prev.elements) }));
    setDirty(true);
  }, []);

  const addElement = (type: VenueElementType) => {
    const count = layout.elements.filter(e => e.type === type).length;
    const cx = (-pan.x / zoom + 400) / M2PX;
    const cy = (-pan.y / zoom + 300) / M2PX;
    const el = newElement(type, snap(cx, 0.5), snap(cy, 0.5), count);
    mutLayout(els => [...els, el]);
    setSelectedId(el.id);
    setSideTab('props');
  };

  const updateElement = useCallback((updated: VenueElement) => {
    mutLayout(els => els.map(e => e.id === updated.id ? updated : e));
  }, [mutLayout]);

  const deleteElement = useCallback((id: string) => {
    mutLayout(els => els.filter(e => e.id !== id));
    if (selectedId === id) setSelectedId(null);
  }, [mutLayout, selectedId]);

  const duplicateElement = useCallback((id: string) => {
    const src = layout.elements.find(e => e.id === id);
    if (!src) return;
    const dup = { ...src, id: uid(), x: src.x + 1, y: src.y + 1, label: `${src.label} (copia)` };
    mutLayout(els => [...els, dup]);
    setSelectedId(dup.id);
  }, [layout.elements, mutLayout]);

  // ─── Canvas element dragging (native pointer) ─────────────
  const onElPointerDown = (e: RPointerEvent<HTMLDivElement>, elId: string) => {
    const el = layout.elements.find(v => v.id === elId);
    if (!el || el.locked) return;
    e.stopPropagation();
    e.preventDefault();
    setSelectedId(elId);
    setSideTab('props');
    setDraggingElId(elId);
    dragStart.current = { elX: el.x, elY: el.y, mx: e.clientX, my: e.clientY };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const onElPointerMove = (e: RPointerEvent<HTMLDivElement>) => {
    if (!draggingElId) return;
    const dx = (e.clientX - dragStart.current.mx) / (zoom * M2PX);
    const dy = (e.clientY - dragStart.current.my) / (zoom * M2PX);
    let nx = dragStart.current.elX + dx;
    let ny = dragStart.current.elY + dy;
    if (snapGrid) { nx = snap(nx, 0.5); ny = snap(ny, 0.5); }
    updateElement({ ...layout.elements.find(v => v.id === draggingElId)!, x: nx, y: ny });
  };

  const onElPointerUp = () => { setDraggingElId(null); };

  // ─── Canvas panning ───────────────────────────────────────
  const onCanvasPointerDown = (e: RPointerEvent<HTMLDivElement>) => {
    if (e.button === 1 || e.ctrlKey || e.metaKey) {
      setIsPanning(true);
      panStart.current = { px: pan.x, py: pan.y, mx: e.clientX, my: e.clientY };
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      return;
    }
    setSelectedId(null);
    setSideTab('tools');
  };

  const onCanvasPointerMove = (e: RPointerEvent<HTMLDivElement>) => {
    if (!isPanning) return;
    setPan({
      x: panStart.current.px + (e.clientX - panStart.current.mx),
      y: panStart.current.py + (e.clientY - panStart.current.my),
    });
  };

  const onCanvasPointerUp = () => { setIsPanning(false); };

  // ─── Zoom ─────────────────────────────────────────────────
  const onWheel = (e: RWheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    setZoom(z => clamp(z * factor, MIN_ZOOM, MAX_ZOOM));
  };

  const fitView = () => { setZoom(0.85); setPan({ x: 20, y: 20 }); };

  // ─── DnD handlers (participant → seat) ────────────────────
  const handleDragStart = (e: DragStartEvent) => {
    const d = e.active.data.current;
    if (d?.type === 'participant') setDraggedParticipant(d.participant);
  };

  const optimisticAssign = useCallback((participantId: string, seatId: string | null) => {
    setLocalParticipants(prev => prev.map(p =>
      p.id === participantId ? { ...p, numero_asiento: seatId } : p
    ));
  }, []);

  const handleDragEnd = async (e: DragEndEvent) => {
    setDraggedParticipant(null);
    const { active, over } = e;
    if (!over) return;
    const aData = active.data.current;
    const oData = over.data.current;
    if (aData?.type === 'participant' && oData?.type === 'seat') {
      const p = aData.participant as EventParticipant;
      const sid = oData.seatId as string;
      if (seatMap.has(sid)) { toast.error('Asiento ocupado'); return; }
      optimisticAssign(p.id, sid);
      toast.success(`${p.nombre} → ${sid}`);
      try {
        await assignSeatToParticipant(p.id, sid);
        onParticipantsChange();
      } catch {
        optimisticAssign(p.id, p.numero_asiento);
        toast.error('Error al asignar');
      }
    }
  };

  const handleRemoveSeat = async (sid: string) => {
    const p = seatMap.get(sid);
    if (!p) return;
    const prev = p.numero_asiento;
    optimisticAssign(p.id, null);
    toast.success(`${p.nombre} liberado`);
    try {
      await assignSeatToParticipant(p.id, null);
      onParticipantsChange();
    } catch {
      optimisticAssign(p.id, prev);
      toast.error('Error al liberar');
    }
  };

  // ─── Filter participants ──────────────────────────────────
  const filtered = localParticipants.filter(p => {
    if (catFilter && p.categoria !== catFilter) return false;
    if (search && fuzzySearch(search, p.nombre) === 0 && fuzzySearch(search, p.empresa || '') === 0) return false;
    return true;
  });

  if (loading) return <div className="flex items-center justify-center py-20 text-gray-400">Cargando diseño...</div>;

  // ─── Grid SVG ─────────────────────────────────────────────
  const gridLines: JSX.Element[] = [];
  for (let x = 0; x <= CANVAS_W_M; x += GRID_M) {
    const major = x % 5 === 0;
    gridLines.push(<line key={`gx${x}`} x1={x * M2PX} y1={0} x2={x * M2PX} y2={CANVAS_H_M * M2PX} stroke={major ? '#d1d5db' : '#f3f4f6'} strokeWidth={major ? 0.8 : 0.4} />);
    if (major) gridLines.push(<text key={`tx${x}`} x={x * M2PX + 2} y={12} fontSize={9} fill="#9ca3af">{x}m</text>);
  }
  for (let y = 0; y <= CANVAS_H_M; y += GRID_M) {
    const major = y % 5 === 0;
    gridLines.push(<line key={`gy${y}`} x1={0} y1={y * M2PX} x2={CANVAS_W_M * M2PX} y2={y * M2PX} stroke={major ? '#d1d5db' : '#f3f4f6'} strokeWidth={major ? 0.8 : 0.4} />);
    if (major && y > 0) gridLines.push(<text key={`ty${y}`} x={2} y={y * M2PX + 12} fontSize={9} fill="#9ca3af">{y}m</text>);
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex flex-col gap-3">
        {/* Top bar */}
        <Card padding="sm">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <div className="flex items-center gap-1 bg-gray-100 dark:bg-dark-600 rounded-lg p-0.5">
              <button onClick={() => setZoom(z => clamp(z * 0.8, MIN_ZOOM, MAX_ZOOM))} className="p-1.5 rounded hover:bg-white dark:hover:bg-dark-500"><ZoomOut className="h-3.5 w-3.5" /></button>
              <span className="w-10 text-center text-gray-600 dark:text-gray-400 font-medium">{Math.round(zoom * 100)}%</span>
              <button onClick={() => setZoom(z => clamp(z * 1.2, MIN_ZOOM, MAX_ZOOM))} className="p-1.5 rounded hover:bg-white dark:hover:bg-dark-500"><ZoomIn className="h-3.5 w-3.5" /></button>
              <button onClick={fitView} className="p-1.5 rounded hover:bg-white dark:hover:bg-dark-500" title="Ajustar vista"><Maximize2 className="h-3.5 w-3.5" /></button>
            </div>

            <button onClick={() => setSnapGrid(!snapGrid)}
              className={`px-2 py-1.5 rounded-lg text-[11px] font-medium transition ${snapGrid ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300' : 'bg-gray-100 dark:bg-dark-600 text-gray-500'}`}>
              Grilla {snapGrid ? 'ON' : 'OFF'}
            </button>

            <div className="flex-1" />

            <span className="text-gray-500"><strong className="text-gray-700 dark:text-gray-300">{occupiedSeats}</strong>/{totalSeats} asientos</span>
            <span className="text-gray-500"><strong className="text-gray-700 dark:text-gray-300">{unassigned.length}</strong> sin asignar</span>

            <Button size="sm" variant={dirty ? 'primary' : 'secondary'} icon={<Save className="h-3.5 w-3.5" />} loading={saving} onClick={handleSave} disabled={!dirty}>
              {dirty ? 'Guardar' : 'Guardado'}
            </Button>
          </div>
        </Card>

        <div className="flex gap-3" style={{ height: 'calc(100vh - 280px)', minHeight: '500px' }}>
          {/* ─── Canvas ──────────────────────────────────────── */}
          <div className="flex-1 min-w-0 rounded-2xl border border-gray-200 dark:border-dark-500 bg-white dark:bg-dark-700 overflow-hidden relative"
            ref={canvasRef}
            style={{ cursor: isPanning ? 'grabbing' : draggingElId ? 'move' : 'default' }}
            onPointerDown={onCanvasPointerDown}
            onPointerMove={(e) => { onCanvasPointerMove(e); onElPointerMove(e); }}
            onPointerUp={() => { onCanvasPointerUp(); onElPointerUp(); }}
            onWheel={onWheel}
          >
            <div style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: '0 0',
              width: CANVAS_W_M * M2PX,
              height: CANVAS_H_M * M2PX,
              position: 'relative',
            }}>
              <svg className="absolute inset-0 pointer-events-none" width={CANVAS_W_M * M2PX} height={CANVAS_H_M * M2PX}>
                {gridLines}
              </svg>

              {layout.elements.map(el => {
                const extraW = (el.type === 'round_table' || el.type === 'rect_table') ? 0.7 : 0;
                const extraH = el.type === 'round_table' ? 0.7 : el.type === 'rect_table' ? 0.8 : el.type === 'seat_block' ? 0.3 : 0;
                return (
                  <div
                    key={el.id}
                    className="absolute"
                    style={{
                      left: (el.x - extraW / 2) * M2PX,
                      top: (el.y - extraH / 2) * M2PX,
                      transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
                      transformOrigin: 'center center',
                      zIndex: el.id === selectedId ? 10 : 1,
                    }}
                    onPointerDown={e => onElPointerDown(e, el.id)}
                  >
                    <ElementVisual el={el} selected={el.id === selectedId} seatMap={seatMap} onRemoveSeat={handleRemoveSeat} />
                  </div>
                );
              })}
            </div>

            {layout.elements.length === 0 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 pointer-events-none">
                <LayoutGrid className="h-10 w-10 mb-2 opacity-30" />
                <p className="text-sm font-medium">Agrega elementos desde el panel lateral</p>
                <p className="text-xs mt-1">Ctrl+scroll para zoom · Ctrl+drag para mover</p>
              </div>
            )}
          </div>

          {/* ─── Side panel ──────────────────────────────────── */}
          <div className="w-64 flex-shrink-0 flex flex-col gap-2">
            <div className="flex bg-gray-100 dark:bg-dark-600 rounded-xl p-0.5 gap-0.5">
              {([['tools', 'Elementos', LayoutGrid], ['props', 'Propiedades', Move], ['people', 'Personas', Users]] as const).map(([id, label, Icon]) => (
                <button key={id} onClick={() => setSideTab(id)}
                  className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-medium transition
                    ${sideTab === id ? 'bg-white dark:bg-dark-700 text-indigo-700 dark:text-indigo-300 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                  <Icon className="h-3.5 w-3.5" />{label}
                </button>
              ))}
            </div>

            <Card padding="sm" className="flex-1 overflow-y-auto">
              {sideTab === 'tools' && (
                <div className="space-y-2">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Agregar al plano</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {TOOLS.map(t => {
                      const Icon = t.icon;
                      return (
                        <button key={t.type} onClick={() => addElement(t.type)}
                          className="flex flex-col items-center gap-1 p-3 rounded-xl border border-gray-200 dark:border-dark-400 hover:border-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/10 transition text-gray-600 dark:text-gray-400 hover:text-indigo-700">
                          <Icon className="h-5 w-5" />
                          <span className="text-[10px] font-medium">{t.tip}</span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="pt-2 text-[10px] text-gray-400 space-y-1">
                    <p><strong>Click</strong> en elemento para seleccionar</p>
                    <p><strong>Arrastrar</strong> para mover</p>
                    <p><strong>Ctrl+arrastrar</strong> para mover vista</p>
                    <p><strong>Scroll</strong> para zoom</p>
                  </div>
                </div>
              )}

              {sideTab === 'props' && (
                selectedEl
                  ? <PropsPanel el={selectedEl} onChange={updateElement} onDelete={() => deleteElement(selectedEl.id)} onDuplicate={() => duplicateElement(selectedEl.id)} />
                  : <div className="flex flex-col items-center justify-center py-10 text-gray-400 text-xs"><MousePointer2 className="h-8 w-8 mb-2 opacity-30" /><p>Selecciona un elemento</p></div>
              )}

              {sideTab === 'people' && (
                <div className="space-y-2">
                  <Input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} />
                  {categories.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      <button onClick={() => setCatFilter(null)}
                        className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium transition ${!catFilter ? 'bg-gray-800 text-white' : 'bg-gray-100 dark:bg-dark-500 text-gray-500 hover:bg-gray-200'}`}>
                        Todas
                      </button>
                      {categories.map(cat => (
                        <button key={cat} onClick={() => setCatFilter(catFilter === cat ? null : cat)}
                          className="text-[9px] px-1.5 py-0.5 rounded-full font-medium transition text-white"
                          style={{
                            background: catFilter === cat ? catColors.get(cat) || '#0d9488' : `${catColors.get(cat) || '#0d9488'}60`,
                            opacity: catFilter && catFilter !== cat ? 0.5 : 1,
                          }}>
                          {cat}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="space-y-1 max-h-[55vh] overflow-y-auto">
                    {filtered.filter(p => !p.numero_asiento).length > 0 && (
                      <>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-1">Sin asiento ({filtered.filter(p => !p.numero_asiento).length})</p>
                        {filtered.filter(p => !p.numero_asiento).map(p => (
                          <ParticipantChip key={p.id} p={p} isAssigned={false}
                            catColor={catColors.get(p.categoria || '') || null}
                            onClickAssign={() => setSeatPickerParticipant(p)} />
                        ))}
                      </>
                    )}
                    {filtered.filter(p => p.numero_asiento).length > 0 && (
                      <>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-2">Asignados ({filtered.filter(p => p.numero_asiento).length})</p>
                        {filtered.filter(p => p.numero_asiento).map(p => (
                          <ParticipantChip key={p.id} p={p} isAssigned
                            catColor={catColors.get(p.categoria || '') || null} />
                        ))}
                      </>
                    )}
                    {filtered.length === 0 && (
                      <p className="text-xs text-gray-400 text-center py-4">Sin resultados</p>
                    )}
                  </div>
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>

      <DragOverlay dropAnimation={null}>
        {draggedParticipant && (
          <div className="px-2 py-0.5 rounded bg-indigo-600/70 text-white text-[10px] font-medium shadow-lg backdrop-blur-sm whitespace-nowrap pointer-events-none"
            style={{ transform: 'translate(12px, -24px)' }}>
            {draggedParticipant.nombre}
          </div>
        )}
      </DragOverlay>

      <SeatPickerModal
        isOpen={!!seatPickerParticipant}
        onClose={() => setSeatPickerParticipant(null)}
        event={event}
        participant={seatPickerParticipant}
        participants={localParticipants}
        onAssigned={() => { onParticipantsChange(); setSeatPickerParticipant(null); }}
      />
    </DndContext>
  );
}

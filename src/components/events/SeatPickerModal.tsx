'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import toast from 'react-hot-toast';
import { X, Check, User, MapPin, ZoomIn, ZoomOut } from 'lucide-react';
import type { Event, EventParticipant, VenueLayout, VenueElement } from '@/lib/services/events';
import { getEventVenueLayout, assignSeatToParticipant } from '@/lib/services/events';

// Same M2PX as designer so positions match exactly
const BASE_M2PX = 50;
const SEAT_R_M = 0.22;

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
        const rowLetter = String.fromCharCode(65 + r);
        out.push({ id: `${prefix}-${rowLetter}${c + 1}`, dx: c * sp - offX, dy: r * sp - offY });
      }
    }
  } else if (el.type === 'booth') {
    out.push({ id: `${prefix}-1`, dx: 0, dy: 0 });
  }
  return out;
}

function elementBounds(el: VenueElement) {
  const seats = seatsForElement(el);
  const extra = el.type === 'round_table' || el.type === 'rect_table' ? 0.7 : el.type === 'seat_block' ? 0.3 : 0;
  let minX = el.x - extra / 2;
  let minY = el.y - extra / 2;
  let maxX = el.x + el.w + extra / 2;
  let maxY = el.y + el.h + extra / 2;
  for (const s of seats) {
    const sx = el.x + el.w / 2 + s.dx;
    const sy = el.y + el.h / 2 + s.dy;
    minX = Math.min(minX, sx - SEAT_R_M);
    minY = Math.min(minY, sy - SEAT_R_M);
    maxX = Math.max(maxX, sx + SEAT_R_M);
    maxY = Math.max(maxY, sy + SEAT_R_M);
  }
  return { minX, minY, maxX, maxY };
}

function seatColor(occ: EventParticipant | null | undefined, isMine: boolean, isSel: boolean) {
  if (isSel) return '#6366f1';
  if (isMine) return '#f59e0b';
  if (occ) return '#f87171';
  return '#22c55e';
}

interface SeatPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: Event;
  participant: EventParticipant | null;
  participants: EventParticipant[];
  onAssigned: () => void;
}

export default function SeatPickerModal({ isOpen, onClose, event, participant, participants, onAssigned }: SeatPickerModalProps) {
  const [layout, setLayout] = useState<VenueLayout | null>(null);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const [selectedSeat, setSelectedSeat] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);

  const seatMap = useMemo(() => {
    const m = new Map<string, EventParticipant>();
    participants.forEach(p => { if (p.numero_asiento) m.set(p.numero_asiento, p); });
    return m;
  }, [participants]);

  const catColors = useMemo(() => {
    const m = new Map<string, string>();
    (event.categorias_participantes || []).forEach((c: any) => { if (c.color) m.set(c.nombre, c.color); });
    return m;
  }, [event.categorias_participantes]);

  useEffect(() => {
    if (!isOpen) return;
    setSelectedSeat(null);
    setZoom(1);
    setLoading(true);
    getEventVenueLayout(event.id).then(r => {
      setLayout(r?.layout || null);
    }).catch(() => setLayout(null)).finally(() => setLoading(false));
  }, [isOpen, event.id]);

  // Compute bounding box and scale to fit
  const { canvasW, canvasH, offsetX, offsetY, scale } = useMemo(() => {
    if (!layout || layout.elements.length === 0) return { canvasW: 600, canvasH: 400, offsetX: 0, offsetY: 0, scale: 1 };
    let gMinX = Infinity, gMinY = Infinity, gMaxX = -Infinity, gMaxY = -Infinity;
    for (const el of layout.elements) {
      const b = elementBounds(el);
      gMinX = Math.min(gMinX, b.minX);
      gMinY = Math.min(gMinY, b.minY);
      gMaxX = Math.max(gMaxX, b.maxX);
      gMaxY = Math.max(gMaxY, b.maxY);
    }
    const pad = 1;
    gMinX -= pad; gMinY -= pad; gMaxX += pad; gMaxY += pad;
    const wM = gMaxX - gMinX;
    const hM = gMaxY - gMinY;
    const targetW = 700;
    const targetH = 450;
    const s = Math.min(targetW / (wM * BASE_M2PX), targetH / (hM * BASE_M2PX), 1.2);
    return {
      canvasW: wM * BASE_M2PX * s,
      canvasH: hM * BASE_M2PX * s,
      offsetX: -gMinX * BASE_M2PX * s,
      offsetY: -gMinY * BASE_M2PX * s,
      scale: s,
    };
  }, [layout]);

  const handleAssign = useCallback(async () => {
    if (!participant || !selectedSeat) return;
    setAssigning(true);
    try {
      await assignSeatToParticipant(participant.id, selectedSeat);
      toast.success(`${participant.nombre} → asiento ${selectedSeat}`);
      onAssigned();
      onClose();
    } catch { toast.error('Error al asignar asiento'); }
    finally { setAssigning(false); }
  }, [participant, selectedSeat, onAssigned, onClose]);

  const handleRemove = useCallback(async () => {
    if (!participant || !participant.numero_asiento) return;
    setAssigning(true);
    try {
      await assignSeatToParticipant(participant.id, null);
      toast.success('Asiento liberado');
      onAssigned();
      onClose();
    } catch { toast.error('Error al liberar asiento'); }
    finally { setAssigning(false); }
  }, [participant, onAssigned, onClose]);

  if (!isOpen || !participant) return null;

  const allElements = layout?.elements || [];
  const hasSeats = allElements.some(el => ['round_table', 'rect_table', 'seat_block', 'booth'].includes(el.type));
  const px = (m: number) => m * BASE_M2PX * scale;

  return (
    <Modal isOpen onClose={onClose} title="Seleccionar asiento" size="xl">
      <div className="space-y-3">
        {/* Participant info */}
        <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-dark-600">
          <div className="w-9 h-9 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center flex-shrink-0">
            <User className="h-4 w-4 text-indigo-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm text-gray-900 dark:text-white truncate">{participant.nombre}</p>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              {participant.categoria && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium text-white"
                  style={{ backgroundColor: catColors.get(participant.categoria) || '#0d9488' }}>
                  {participant.categoria}
                </span>
              )}
              {participant.empresa && <span className="text-xs text-gray-500">{participant.empresa}</span>}
              {participant.numero_asiento && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-bold">
                  Actual: {participant.numero_asiento}
                </span>
              )}
            </div>
          </div>
          {participant.numero_asiento && (
            <Button size="sm" variant="ghost" onClick={handleRemove} loading={assigning}>
              <X className="h-3.5 w-3.5 mr-1" /> Liberar
            </Button>
          )}
        </div>

        {/* Legend + zoom */}
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-3 text-[11px] text-gray-500">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-500" /> Disponible</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-400" /> Ocupado</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-indigo-500 ring-2 ring-indigo-300" /> Seleccionado</span>
            {participant.numero_asiento && <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-amber-400" /> Tu asiento</span>}
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setZoom(z => Math.max(0.5, z - 0.15))} className="p-1 rounded hover:bg-gray-100"><ZoomOut className="h-3.5 w-3.5 text-gray-500" /></button>
            <span className="text-[10px] text-gray-400 w-8 text-center">{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom(z => Math.min(2.5, z + 0.15))} className="p-1 rounded hover:bg-gray-100"><ZoomIn className="h-3.5 w-3.5 text-gray-500" /></button>
          </div>
        </div>

        {/* Full 2D map */}
        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-400 text-sm">Cargando mapa...</div>
        ) : !hasSeats ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <MapPin className="h-10 w-10 mb-2 opacity-30" />
            <p className="text-sm font-medium">Sin distribución de asientos</p>
            <p className="text-xs mt-1">Crea un diseño de espacios primero en la pestaña Espacios</p>
          </div>
        ) : (
          <div ref={containerRef}
            className="overflow-auto rounded-xl border border-gray-200 dark:border-dark-500 bg-gray-50 dark:bg-dark-800"
            style={{ maxHeight: '55vh' }}
            onWheel={e => { if (e.ctrlKey || e.metaKey) { e.preventDefault(); setZoom(z => Math.max(0.5, Math.min(2.5, z + (e.deltaY < 0 ? 0.1 : -0.1)))); } }}
          >
            <div style={{ width: canvasW * zoom, height: canvasH * zoom, position: 'relative', margin: '0 auto' }}>
              {/* Grid dots for reference */}
              <svg className="absolute inset-0 pointer-events-none" width={canvasW * zoom} height={canvasH * zoom} style={{ opacity: 0.3 }}>
                {Array.from({ length: Math.ceil(canvasW * zoom / (BASE_M2PX * scale * zoom)) + 1 }, (_, i) => {
                  const xp = i * BASE_M2PX * scale * zoom;
                  return Array.from({ length: Math.ceil(canvasH * zoom / (BASE_M2PX * scale * zoom)) + 1 }, (_, j) => {
                    const yp = j * BASE_M2PX * scale * zoom;
                    return <circle key={`${i}-${j}`} cx={xp} cy={yp} r={0.8} fill="#9ca3af" />;
                  });
                })}
              </svg>

              {allElements.map(el => {
                const seats = seatsForElement(el);
                const elX = (offsetX + el.x * BASE_M2PX * scale) * zoom;
                const elY = (offsetY + el.y * BASE_M2PX * scale) * zoom;
                const elW = px(el.w) * zoom;
                const elH = px(el.h) * zoom;
                const sR = SEAT_R_M * BASE_M2PX * scale * zoom;

                if (el.type === 'stage') {
                  return (
                    <div key={el.id} className="absolute flex items-center justify-center rounded-xl"
                      style={{
                        left: elX, top: elY, width: elW, height: elH,
                        background: `${el.color}15`, border: `2px dashed ${el.color}50`,
                        transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
                        transformOrigin: 'center center',
                      }}>
                      <span className="text-[10px] font-bold tracking-[2px] uppercase" style={{ color: `${el.color}99`, fontSize: Math.max(8, 10 * scale * zoom) }}>{el.label}</span>
                    </div>
                  );
                }

                if (el.type === 'area') {
                  return (
                    <div key={el.id} className="absolute flex items-center justify-center rounded-xl"
                      style={{
                        left: elX, top: elY, width: elW, height: elH,
                        background: `${el.color}08`, border: `1.5px dashed ${el.color}40`,
                        transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
                        transformOrigin: 'center center',
                      }}>
                      <span className="text-[10px] font-medium" style={{ color: `${el.color}80`, fontSize: Math.max(7, 9 * scale * zoom) }}>{el.label}</span>
                    </div>
                  );
                }

                if (el.type === 'label') {
                  return (
                    <div key={el.id} className="absolute flex items-center"
                      style={{
                        left: elX, top: elY,
                        transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
                      }}>
                      <span className="font-bold whitespace-nowrap" style={{ color: el.color, fontSize: Math.max(8, 11 * scale * zoom) }}>{el.label}</span>
                    </div>
                  );
                }

                // Elements with seats
                const cxEl = elX + elW / 2;
                const cyEl = elY + elH / 2;

                return (
                  <div key={el.id} className="absolute" style={{
                    left: 0, top: 0, width: canvasW * zoom, height: canvasH * zoom,
                    pointerEvents: 'none',
                    transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
                    transformOrigin: `${cxEl}px ${cyEl}px`,
                  }}>
                    {/* Table body */}
                    {(el.type === 'round_table') && (
                      <div className="absolute rounded-full" style={{
                        left: cxEl - elW / 2, top: cyEl - elH / 2, width: elW, height: elH,
                        background: `${el.color}18`, border: `2px solid ${el.color}50`,
                      }}>
                        <span className="absolute inset-0 flex items-center justify-center font-bold" style={{ color: el.color, fontSize: Math.max(6, 8 * scale * zoom) }}>{el.label}</span>
                      </div>
                    )}
                    {(el.type === 'rect_table') && (
                      <div className="absolute rounded-lg" style={{
                        left: cxEl - elW / 2, top: cyEl - elH / 2, width: elW, height: elH,
                        background: `${el.color}18`, border: `2px solid ${el.color}50`,
                      }}>
                        <span className="absolute inset-0 flex items-center justify-center font-bold" style={{ color: el.color, fontSize: Math.max(6, 8 * scale * zoom) }}>{el.label}</span>
                      </div>
                    )}
                    {(el.type === 'seat_block') && (
                      <>
                        <div className="absolute rounded-lg" style={{
                          left: cxEl - elW / 2, top: cyEl - elH / 2, width: elW, height: elH,
                          border: `1.5px dashed ${el.color}30`,
                        }} />
                        <span className="absolute font-bold" style={{
                          left: cxEl - elW / 2, top: cyEl - elH / 2 - 14 * zoom,
                          color: el.color, fontSize: Math.max(7, 9 * scale * zoom),
                        }}>{el.label}</span>
                      </>
                    )}
                    {(el.type === 'booth') && (
                      <div className="absolute rounded-lg flex items-center justify-center" style={{
                        left: cxEl - elW / 2, top: cyEl - elH / 2, width: elW, height: elH,
                        background: `${el.color}15`, border: `2px solid ${el.color}50`,
                      }}>
                        <span className="font-bold" style={{ color: el.color, fontSize: Math.max(5, 7 * scale * zoom) }}>{el.label}</span>
                      </div>
                    )}

                    {/* Seats */}
                    {seats.map(s => {
                      const sx = cxEl + px(s.dx) * zoom;
                      const sy = cyEl + px(s.dy) * zoom;
                      const occ = seatMap.get(s.id);
                      const isMine = participant.numero_asiento === s.id;
                      const isSel = selectedSeat === s.id;
                      const isAvail = !occ || occ.id === participant.id;
                      const bg = seatColor(occ, isMine, isSel);
                      return (
                        <button key={s.id}
                          title={occ && !isMine ? `${occ.nombre} — ${s.id}` : s.id}
                          disabled={!isAvail}
                          onClick={() => setSelectedSeat(isSel ? null : s.id)}
                          className="absolute rounded-full flex items-center justify-center transition-all"
                          style={{
                            pointerEvents: 'auto',
                            left: sx - sR, top: sy - sR, width: sR * 2, height: sR * 2,
                            background: bg, color: '#fff',
                            fontSize: Math.max(5, 7 * scale * zoom), fontWeight: 700,
                            opacity: occ && !isMine ? 0.65 : 1,
                            cursor: isAvail ? 'pointer' : 'not-allowed',
                            boxShadow: isSel ? `0 0 0 ${3 * zoom}px rgba(99,102,241,0.35)` : 'none',
                            transform: isSel ? 'scale(1.2)' : 'scale(1)',
                            zIndex: isSel ? 10 : 1,
                          }}>
                          {occ && !isMine ? occ.nombre.slice(0, 2).toUpperCase() : s.id.split('-').pop()}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-dark-500">
          <div className="text-xs text-gray-500">
            {selectedSeat
              ? <>Asiento: <strong className="text-indigo-600">{selectedSeat}</strong></>
              : 'Haz click en un asiento verde para seleccionarlo'}
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>Cancelar</Button>
            <Button onClick={handleAssign} disabled={!selectedSeat} loading={assigning} icon={<Check className="h-4 w-4" />}>
              Asignar
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

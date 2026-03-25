'use client';

import { useState, useEffect, useMemo } from 'react';
import { MapPin } from 'lucide-react';
import type { Event, EventParticipant, VenueLayout, VenueElement } from '@/lib/services/events';
import { getEventVenueLayout } from '@/lib/services/events';

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

interface SeatMapViewProps {
  event: Event;
  highlightSeatId: string | null;
  participants: EventParticipant[];
}

export default function SeatMapView({ event, highlightSeatId, participants }: SeatMapViewProps) {
  const [layout, setLayout] = useState<VenueLayout | null>(null);
  const [loading, setLoading] = useState(true);

  const seatMap = useMemo(() => {
    const m = new Map<string, EventParticipant>();
    participants.forEach(p => { if (p.numero_asiento) m.set(p.numero_asiento, p); });
    return m;
  }, [participants]);

  useEffect(() => {
    setLoading(true);
    getEventVenueLayout(event.id)
      .then(r => setLayout(r?.layout || null))
      .catch(() => setLayout(null))
      .finally(() => setLoading(false));
  }, [event.id]);

  const { canvasW, canvasH, offsetX, offsetY, scale } = useMemo(() => {
    if (!layout || layout.elements.length === 0) return { canvasW: 300, canvasH: 200, offsetX: 0, offsetY: 0, scale: 1 };
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
    const targetW = 500;
    const targetH = 320;
    const s = Math.min(targetW / (wM * BASE_M2PX), targetH / (hM * BASE_M2PX), 1);
    return {
      canvasW: wM * BASE_M2PX * s,
      canvasH: hM * BASE_M2PX * s,
      offsetX: -gMinX * BASE_M2PX * s,
      offsetY: -gMinY * BASE_M2PX * s,
      scale: s,
    };
  }, [layout]);

  if (loading) return <div className="flex items-center justify-center py-8 text-gray-400 text-xs">Cargando mapa...</div>;

  const allElements = layout?.elements || [];
  const hasSeats = allElements.some(el => ['round_table', 'rect_table', 'seat_block', 'booth'].includes(el.type));

  if (!hasSeats) return null;

  const px = (m: number) => m * BASE_M2PX * scale;

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 overflow-auto" style={{ maxHeight: '340px' }}>
      {highlightSeatId && (
        <div className="flex items-center justify-center gap-3 py-2 px-3 bg-indigo-50 border-b border-indigo-100 text-[11px]">
          <span className="flex items-center gap-1 text-gray-500"><span className="w-3 h-3 rounded-full bg-gray-300 inline-block" /> Asientos</span>
          <span className="flex items-center gap-1 text-gray-500"><span className="w-3 h-3 rounded-full bg-blue-400 inline-block" /> Ocupados</span>
          <span className="flex items-center gap-1 font-semibold text-indigo-700"><span className="w-3 h-3 rounded-full bg-indigo-500 ring-2 ring-indigo-300 inline-block" /> Tu asiento</span>
        </div>
      )}
      <div style={{ width: canvasW, height: canvasH, position: 'relative', margin: '0 auto' }}>
        {allElements.map(el => {
          const seats = seatsForElement(el);
          const elX = (offsetX + el.x * BASE_M2PX * scale);
          const elY = (offsetY + el.y * BASE_M2PX * scale);
          const elW = px(el.w);
          const elH = px(el.h);
          const sR = SEAT_R_M * BASE_M2PX * scale;

          if (el.type === 'stage') {
            return (
              <div key={el.id} className="absolute flex items-center justify-center rounded-xl"
                style={{
                  left: elX, top: elY, width: elW, height: elH,
                  background: `${el.color}12`, border: `2px dashed ${el.color}40`,
                  transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
                  transformOrigin: 'center center',
                }}>
                <span className="font-bold tracking-[2px] uppercase" style={{ color: `${el.color}80`, fontSize: Math.max(7, 9 * scale) }}>{el.label}</span>
              </div>
            );
          }

          if (el.type === 'area') {
            return (
              <div key={el.id} className="absolute flex items-center justify-center rounded-xl"
                style={{
                  left: elX, top: elY, width: elW, height: elH,
                  background: `${el.color}08`, border: `1.5px dashed ${el.color}30`,
                  transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
                  transformOrigin: 'center center',
                }}>
                <span className="font-medium" style={{ color: `${el.color}70`, fontSize: Math.max(6, 8 * scale) }}>{el.label}</span>
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
                <span className="font-bold whitespace-nowrap" style={{ color: el.color, fontSize: Math.max(7, 10 * scale) }}>{el.label}</span>
              </div>
            );
          }

          const cxEl = elX + elW / 2;
          const cyEl = elY + elH / 2;

          return (
            <div key={el.id} className="absolute" style={{
              left: 0, top: 0, width: canvasW, height: canvasH,
              pointerEvents: 'none',
              transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
              transformOrigin: `${cxEl}px ${cyEl}px`,
            }}>
              {el.type === 'round_table' && (
                <div className="absolute rounded-full" style={{
                  left: cxEl - elW / 2, top: cyEl - elH / 2, width: elW, height: elH,
                  background: `${el.color}12`, border: `1.5px solid ${el.color}35`,
                }}>
                  <span className="absolute inset-0 flex items-center justify-center font-bold" style={{ color: `${el.color}90`, fontSize: Math.max(5, 7 * scale) }}>{el.label}</span>
                </div>
              )}
              {el.type === 'rect_table' && (
                <div className="absolute rounded-lg" style={{
                  left: cxEl - elW / 2, top: cyEl - elH / 2, width: elW, height: elH,
                  background: `${el.color}12`, border: `1.5px solid ${el.color}35`,
                }}>
                  <span className="absolute inset-0 flex items-center justify-center font-bold" style={{ color: `${el.color}90`, fontSize: Math.max(5, 7 * scale) }}>{el.label}</span>
                </div>
              )}
              {el.type === 'seat_block' && (
                <>
                  <div className="absolute rounded-lg" style={{
                    left: cxEl - elW / 2, top: cyEl - elH / 2, width: elW, height: elH,
                    border: `1px dashed ${el.color}25`,
                  }} />
                  <span className="absolute font-bold" style={{
                    left: cxEl - elW / 2, top: cyEl - elH / 2 - 12 * scale,
                    color: `${el.color}90`, fontSize: Math.max(6, 8 * scale),
                  }}>{el.label}</span>
                </>
              )}
              {el.type === 'booth' && (
                <div className="absolute rounded-lg flex items-center justify-center" style={{
                  left: cxEl - elW / 2, top: cyEl - elH / 2, width: elW, height: elH,
                  background: `${el.color}10`, border: `1.5px solid ${el.color}35`,
                }}>
                  <span className="font-bold" style={{ color: `${el.color}80`, fontSize: Math.max(4, 6 * scale) }}>{el.label}</span>
                </div>
              )}

              {seats.map(s => {
                const sx = cxEl + px(s.dx);
                const sy = cyEl + px(s.dy);
                const isHighlight = highlightSeatId === s.id;
                const occ = seatMap.get(s.id);
                const isOccupied = !!occ;
                let bg: string;
                let border: string;
                let textColor: string;
                let extraStyle: React.CSSProperties = {};

                if (isHighlight) {
                  bg = '#6366f1';
                  border = '3px solid #818cf8';
                  textColor = '#fff';
                  extraStyle = {
                    boxShadow: '0 0 0 4px rgba(99,102,241,0.25), 0 0 12px rgba(99,102,241,0.4)',
                    transform: 'scale(1.4)',
                    zIndex: 20,
                  };
                } else if (isOccupied) {
                  bg = '#93c5fd';
                  border = '1.5px solid #60a5fa';
                  textColor = '#1e40af';
                } else {
                  bg = '#e5e7eb';
                  border = '1.5px solid #d1d5db';
                  textColor = '#9ca3af';
                }

                return (
                  <div key={s.id}
                    title={isHighlight ? `TU ASIENTO: ${s.id}` : occ ? `${occ.nombre} — ${s.id}` : s.id}
                    className="absolute rounded-full flex items-center justify-center transition-all"
                    style={{
                      left: sx - sR, top: sy - sR, width: sR * 2, height: sR * 2,
                      background: bg, border,
                      fontSize: Math.max(4, 6 * scale), fontWeight: 700,
                      color: textColor,
                      ...extraStyle,
                    }}>
                    {isHighlight
                      ? <MapPin className="text-white" style={{ width: sR * 1.2, height: sR * 1.2 }} />
                      : <span className="pointer-events-none">{s.id.split('-').pop()}</span>}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

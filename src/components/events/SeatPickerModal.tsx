'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import toast from 'react-hot-toast';
import { X, Check, User, MapPin } from 'lucide-react';
import type { Event, EventParticipant, VenueLayout, VenueElement } from '@/lib/services/events';
import { getEventVenueLayout, assignSeatToParticipant } from '@/lib/services/events';

const M2PX = 36;
const SEAT_R = 12;

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
    const sp = 0.52;
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
    setLoading(true);
    getEventVenueLayout(event.id).then(r => {
      setLayout(r?.layout || null);
    }).catch(() => setLayout(null)).finally(() => setLoading(false));
  }, [isOpen, event.id]);

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
      toast.success(`Asiento liberado`);
      onAssigned();
      onClose();
    } catch { toast.error('Error al liberar asiento'); }
    finally { setAssigning(false); }
  }, [participant, onAssigned, onClose]);

  if (!isOpen || !participant) return null;

  const allElements = layout?.elements || [];
  const hasSeats = allElements.some(el => ['round_table', 'rect_table', 'seat_block', 'booth'].includes(el.type));

  return (
    <Modal isOpen onClose={onClose} title="Seleccionar asiento" size="lg">
      <div className="space-y-4">
        {/* Participant info */}
        <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-dark-600">
          <div className="w-9 h-9 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
            <User className="h-4 w-4 text-indigo-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm text-gray-900 dark:text-white truncate">{participant.nombre}</p>
            <div className="flex items-center gap-2 mt-0.5">
              {participant.categoria && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium text-white"
                  style={{ backgroundColor: catColors.get(participant.categoria) || '#0d9488' }}>
                  {participant.categoria}
                </span>
              )}
              {participant.empresa && <span className="text-xs text-gray-500">{participant.empresa}</span>}
              {participant.numero_asiento && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-bold">
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

        {/* Legend */}
        <div className="flex items-center gap-4 text-[11px] text-gray-500 px-1">
          <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded-full bg-green-500 inline-block" /> Disponible</span>
          <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded-full bg-red-400 inline-block" /> Ocupado</span>
          <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded-full bg-indigo-500 ring-2 ring-indigo-300 inline-block" /> Seleccionado</span>
          {participant.numero_asiento && <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded-full bg-amber-400 inline-block" /> Tu asiento</span>}
        </div>

        {/* Seat map */}
        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-400 text-sm">Cargando mapa...</div>
        ) : !hasSeats ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <MapPin className="h-10 w-10 mb-2 opacity-30" />
            <p className="text-sm font-medium">Sin distribución de asientos</p>
            <p className="text-xs mt-1">Crea un diseño de espacios primero en la pestaña Espacios</p>
          </div>
        ) : (
          <div className="overflow-auto max-h-[55vh] rounded-xl border border-gray-200 dark:border-dark-500 bg-white dark:bg-dark-700 p-4">
            <div className="space-y-6">
              {allElements.map(el => {
                const seats = seatsForElement(el);
                if (seats.length === 0) {
                  if (el.type === 'stage') {
                    return (
                      <div key={el.id} className="flex justify-center">
                        <div className="px-12 py-3 rounded-xl border-2 border-dashed border-gray-300 dark:border-dark-400">
                          <span className="text-xs font-bold tracking-[3px] text-gray-400 uppercase">{el.label}</span>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }

                if (el.type === 'seat_block') {
                  const rows = el.rows || 3;
                  const cols = el.cols || 8;
                  const prefix = el.seatPrefix || el.label.slice(0, 2).toUpperCase();
                  return (
                    <div key={el.id} className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-sm" style={{ background: el.color }} />
                        <span className="text-xs font-bold" style={{ color: el.color }}>{el.label}</span>
                        <span className="text-[10px] text-gray-400">
                          ({seats.filter(s => seatMap.has(s.id)).length}/{seats.length} ocupados)
                        </span>
                      </div>
                      <div className="flex flex-col items-center gap-1">
                        {Array.from({ length: rows }, (_, r) => {
                          const rowLetter = String.fromCharCode(65 + r);
                          return (
                            <div key={r} className="flex items-center gap-0.5">
                              <span className="w-5 text-right text-[9px] text-gray-400 font-medium mr-1">{rowLetter}</span>
                              {Array.from({ length: cols }, (_, c) => {
                                const sid = `${prefix}-${rowLetter}${c + 1}`;
                                const occ = seatMap.get(sid);
                                const isMine = participant.numero_asiento === sid;
                                const isSel = selectedSeat === sid;
                                const isAvailable = !occ || occ.id === participant.id;
                                return (
                                  <button key={sid} title={occ ? `${occ.nombre} — ${sid}` : sid}
                                    disabled={!isAvailable}
                                    onClick={() => setSelectedSeat(isSel ? null : sid)}
                                    className="w-7 h-7 rounded-md text-[7px] font-bold flex items-center justify-center transition-all"
                                    style={{
                                      background: isSel ? '#6366f1' : isMine ? '#f59e0b' : occ ? '#f87171' : '#22c55e',
                                      color: '#fff',
                                      opacity: occ && !isMine ? 0.7 : 1,
                                      cursor: isAvailable ? 'pointer' : 'not-allowed',
                                      boxShadow: isSel ? '0 0 0 3px rgba(99,102,241,0.3)' : 'none',
                                      transform: isSel ? 'scale(1.15)' : 'scale(1)',
                                    }}>
                                    {occ && !isMine ? occ.nombre.slice(0, 2).toUpperCase() : (c + 1)}
                                  </button>
                                );
                              })}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                }

                if (el.type === 'round_table' || el.type === 'rect_table') {
                  return (
                    <div key={el.id} className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full" style={{ background: el.color }} />
                        <span className="text-xs font-bold" style={{ color: el.color }}>{el.label}</span>
                        <span className="text-[10px] text-gray-400">
                          ({seats.filter(s => seatMap.has(s.id)).length}/{seats.length})
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 justify-center">
                        {seats.map(s => {
                          const occ = seatMap.get(s.id);
                          const isMine = participant.numero_asiento === s.id;
                          const isSel = selectedSeat === s.id;
                          const isAvailable = !occ || occ.id === participant.id;
                          return (
                            <button key={s.id} title={occ ? `${occ.nombre} — ${s.id}` : s.id}
                              disabled={!isAvailable}
                              onClick={() => setSelectedSeat(isSel ? null : s.id)}
                              className="w-9 h-9 rounded-full text-[8px] font-bold flex items-center justify-center transition-all"
                              style={{
                                background: isSel ? '#6366f1' : isMine ? '#f59e0b' : occ ? '#f87171' : '#22c55e',
                                color: '#fff',
                                opacity: occ && !isMine ? 0.7 : 1,
                                cursor: isAvailable ? 'pointer' : 'not-allowed',
                                boxShadow: isSel ? '0 0 0 3px rgba(99,102,241,0.3)' : 'none',
                                transform: isSel ? 'scale(1.15)' : 'scale(1)',
                              }}>
                              {occ && !isMine ? occ.nombre.slice(0, 2).toUpperCase() : s.id.split('-').pop()}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                }

                if (el.type === 'booth') {
                  const s = seats[0];
                  const occ = seatMap.get(s.id);
                  const isMine = participant.numero_asiento === s.id;
                  const isSel = selectedSeat === s.id;
                  const isAvailable = !occ || occ.id === participant.id;
                  return (
                    <div key={el.id} className="flex items-center gap-3">
                      <button title={occ ? `${occ.nombre} — ${s.id}` : s.id}
                        disabled={!isAvailable}
                        onClick={() => setSelectedSeat(isSel ? null : s.id)}
                        className="w-10 h-10 rounded-lg text-[8px] font-bold flex items-center justify-center transition-all"
                        style={{
                          background: isSel ? '#6366f1' : isMine ? '#f59e0b' : occ ? '#f87171' : '#22c55e',
                          color: '#fff',
                          cursor: isAvailable ? 'pointer' : 'not-allowed',
                          boxShadow: isSel ? '0 0 0 3px rgba(99,102,241,0.3)' : 'none',
                        }}>
                        {occ && !isMine ? occ.nombre.slice(0, 2).toUpperCase() : <MapPin className="h-4 w-4" />}
                      </button>
                      <div>
                        <span className="text-xs font-bold" style={{ color: el.color }}>{el.label}</span>
                        {occ && !isMine && <p className="text-[10px] text-gray-400">{occ.nombre}</p>}
                      </div>
                    </div>
                  );
                }

                return null;
              })}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-dark-500">
          <div className="text-xs text-gray-500">
            {selectedSeat
              ? <>Asiento seleccionado: <strong className="text-indigo-600">{selectedSeat}</strong></>
              : 'Haz click en un asiento verde para seleccionarlo'}
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>Cancelar</Button>
            <Button onClick={handleAssign} disabled={!selectedSeat} loading={assigning}
              icon={<Check className="h-4 w-4" />}>
              Asignar
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

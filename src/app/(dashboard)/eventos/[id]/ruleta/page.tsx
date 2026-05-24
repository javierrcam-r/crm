'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Plus, Trash2, Trophy, Gift, Users, Dices, X,
  Settings, UserCheck, UsersRound, Sparkles, Crown, ChevronDown,
} from 'lucide-react';
import Button from '@/components/ui/Button';
import { useAuth } from '@/contexts/AuthContext';
import {
  getEvent, getEventParticipants,
  type Event, type EventParticipant,
} from '@/lib/services/events';
import {
  getEventPrizes, createEventPrize, deleteEventPrize,
  getEventPrizeWinners, savePrizeWinner, deletePrizeWinner,
  type EventPrize, type EventPrizeWinner,
} from '@/lib/services/prizes';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import toast from 'react-hot-toast';

const SPIN_MS = 5000;
const ITEM_W = 200;
const TOTAL_ITEMS = 80;

function shuffled(pool: string[], count: number): string[] {
  const r: string[] = [];
  for (let i = 0; i < count; i++) r.push(pool[Math.floor(Math.random() * pool.length)]);
  return r;
}

export default function RuletaPage() {
  const params = useParams();
  const { userProfile } = useAuth();
  const eventId = params.id as string;

  const [event, setEvent] = useState<Event | null>(null);
  const [participants, setParticipants] = useState<EventParticipant[]>([]);
  const [prizes, setPrizes] = useState<EventPrize[]>([]);
  const [winners, setWinners] = useState<(EventPrizeWinner & { prize_name?: string })[]>([]);
  const [loading, setLoading] = useState(true);

  const [newPrizeName, setNewPrizeName] = useState('');
  const [newPrizeQty, setNewPrizeQty] = useState(1);

  const [selectedPrizeId, setSelectedPrizeId] = useState('');
  const [phase, setPhase] = useState<'idle' | 'spinning' | 'winner'>('idle');
  const [winner, setWinner] = useState<EventParticipant | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);

  const [eligibilityMode, setEligibilityMode] = useState<'asistentes' | 'todos'>('asistentes');
  const [showPanel, setShowPanel] = useState(false);

  const stripRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<number>(0);

  useEffect(() => { loadData(); }, [eventId, userProfile]);

  const loadData = async () => {
    if (!userProfile) return;
    setLoading(true);
    try {
      const [ev, parts, pz, wn] = await Promise.all([
        getEvent(eventId),
        getEventParticipants(eventId),
        getEventPrizes(eventId),
        getEventPrizeWinners(eventId),
      ]);
      setEvent(ev);
      setParticipants(parts);
      setPrizes(pz);
      setWinners(wn);
      const avail = pz.filter(p => p.cantidad - wn.filter(w => w.prize_id === p.id).length > 0);
      if (avail.length > 0) setSelectedPrizeId(prev => avail.find(a => a.id === prev) ? prev : avail[0].id);
    } catch (e) { console.error(e); toast.error('Error cargando datos'); }
    finally { setLoading(false); }
  };

  const eligible = participants.filter(p => {
    if (eligibilityMode === 'asistentes' && !p.asistencia) return false;
    return !winners.some(w => w.participant_id === p.id);
  });

  const getPrizeAwarded = (pid: string) => winners.filter(w => w.prize_id === pid).length;
  const getPrizeRemaining = (p: EventPrize) => p.cantidad - getPrizeAwarded(p.id);
  const availablePrizes = prizes.filter(p => getPrizeRemaining(p) > 0);

  const handleAddPrize = async () => {
    if (!newPrizeName.trim()) return;
    try {
      await createEventPrize(eventId, { nombre: newPrizeName.trim(), cantidad: newPrizeQty });
      setNewPrizeName(''); setNewPrizeQty(1);
      toast.success('Premio agregado'); loadData();
    } catch (e: any) { toast.error(e?.message || 'Error al agregar premio'); }
  };

  const handleDeletePrize = async (id: string) => {
    if (getPrizeAwarded(id) > 0) { toast.error('Premio con ganadores, no se puede eliminar'); return; }
    try { await deleteEventPrize(id); toast.success('Eliminado'); loadData(); }
    catch { toast.error('Error'); }
  };

  const handleDeleteWinner = async (wid: string, name: string) => {
    if (!confirm(`¿Eliminar a ${name} de ganadores?`)) return;
    try { await deletePrizeWinner(wid); toast.success(`${name} eliminado`); loadData(); }
    catch { toast.error('Error'); }
  };

  const spin = useCallback(() => {
    if (eligible.length === 0) { toast.error('No hay participantes elegibles'); return; }
    if (!selectedPrizeId) { toast.error('Selecciona un premio'); return; }
    const prize = prizes.find(p => p.id === selectedPrizeId);
    if (!prize || getPrizeRemaining(prize) <= 0) { toast.error('Premio agotado'); return; }

    const picked = eligible[Math.floor(Math.random() * eligible.length)];
    const pool = eligible.map(p => p.nombre);
    while (pool.length < 6) pool.push(...eligible.map(p => p.nombre));

    const names = [...shuffled(pool, TOTAL_ITEMS), picked.nombre];

    setWinner(null);
    setShowConfetti(false);
    setPhase('spinning');

    const track = trackRef.current;
    const strip = stripRef.current;
    if (!track || !strip) return;

    strip.innerHTML = '';
    names.forEach((n, idx) => {
      const el = document.createElement('div');
      el.style.cssText = `min-width:${ITEM_W}px;height:100%;display:flex;align-items:center;justify-content:center;font-size:1.15rem;font-weight:600;white-space:nowrap;padding:0 16px;flex-shrink:0;`;
      el.style.color = idx === names.length - 1 ? '#fff' : 'rgba(255,255,255,0.5)';
      el.textContent = n;
      strip.appendChild(el);
    });

    const trackW = track.offsetWidth;
    const totalScrollDist = (names.length - 1) * ITEM_W - (trackW / 2 - ITEM_W / 2);

    strip.style.transition = 'none';
    strip.style.transform = 'translateX(0)';

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        strip.style.transition = `transform ${SPIN_MS}ms cubic-bezier(0.12, 0.8, 0.2, 1)`;
        strip.style.transform = `translateX(-${totalScrollDist}px)`;
      });
    });

    timerRef.current = window.setTimeout(() => {
      setPhase('winner');
      setWinner(picked);
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 5000);
    }, SPIN_MS + 200);
  }, [eligible, selectedPrizeId, prizes, winners]);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const confirmWinner = async () => {
    if (!winner || !selectedPrizeId) return;
    try {
      await savePrizeWinner(eventId, selectedPrizeId, winner.id, winner.nombre);
      toast.success(`${winner.nombre} registrado`);
      setWinner(null); setPhase('idle'); loadData();
    } catch (e: any) {
      if (e.message?.includes('unique') || e.code === '23505') toast.error('Ya tiene premio');
      else toast.error('Error al registrar');
    }
  };

  if (loading || !event) return (
    <div className="flex items-center justify-center min-h-screen bg-[#080b14]">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-500" />
    </div>
  );

  const attended = participants.filter(p => p.asistencia).length;
  const poolSize = eligibilityMode === 'asistentes' ? attended : participants.length;
  const canSpin = phase === 'idle' && eligible.length > 0 && availablePrizes.length > 0;

  return (
    <div className="min-h-screen bg-[#080b14] text-white relative overflow-hidden">
      {/* Ambient glow */}
      <div className="absolute top-[-200px] left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-purple-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-100px] right-[-100px] w-[400px] h-[400px] bg-indigo-600/10 rounded-full blur-[100px] pointer-events-none" />

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between p-4 sm:p-6">
        <div className="flex items-center gap-3">
          <Link href={`/eventos/${eventId}`}>
            <button className="p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors">
              <ArrowLeft className="h-4 w-4 text-white/60" />
            </button>
          </Link>
          <div>
            <h1 className="text-lg font-bold flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-yellow-400" /> Ruleta de Premios
            </h1>
            <p className="text-[11px] text-white/40">{event.nombre}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Stats pills */}
          <div className="hidden sm:flex items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 text-xs font-medium">
              <Users className="h-3 w-3 inline mr-1" />{eligible.length} elegibles
            </span>
            <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs font-medium">
              <Gift className="h-3 w-3 inline mr-1" />{availablePrizes.reduce((s, p) => s + getPrizeRemaining(p), 0)} premios
            </span>
            <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-medium">
              <Trophy className="h-3 w-3 inline mr-1" />{winners.length} ganadores
            </span>
          </div>
          <button onClick={() => setShowPanel(!showPanel)}
            className={`p-2 rounded-xl transition-colors ${showPanel ? 'bg-purple-500/30 text-purple-300' : 'bg-white/5 hover:bg-white/10 text-white/60'}`}>
            <Settings className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Mobile stats */}
      <div className="sm:hidden flex items-center gap-2 px-4 pb-3 overflow-x-auto">
        <span className="px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 text-xs font-medium whitespace-nowrap">
          {eligible.length} elegibles
        </span>
        <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs font-medium whitespace-nowrap">
          {availablePrizes.reduce((s, p) => s + getPrizeRemaining(p), 0)} premios
        </span>
        <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-medium whitespace-nowrap">
          {winners.length} ganadores
        </span>
      </div>

      {/* ===== MAIN SLOT AREA ===== */}
      <div className="relative z-10 flex flex-col items-center justify-center px-4 sm:px-8" style={{ minHeight: 'calc(100vh - 160px)' }}>

        {/* Prize selector */}
        {availablePrizes.length > 0 && (
          <div className="mb-6 w-full max-w-md">
            <div className="relative">
              <Trophy className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-yellow-400 z-10" />
              <select value={selectedPrizeId} onChange={e => setSelectedPrizeId(e.target.value)} disabled={phase === 'spinning'}
                className="w-full pl-10 pr-10 py-3 bg-white/5 border border-white/10 text-white rounded-2xl text-sm font-medium focus:ring-2 focus:ring-purple-500 focus:border-transparent backdrop-blur-md appearance-none cursor-pointer">
                {availablePrizes.map(p => <option key={p.id} value={p.id} className="bg-[#111631]">{p.nombre} — {getPrizeRemaining(p)} disponibles</option>)}
              </select>
              <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40 pointer-events-none" />
            </div>
          </div>
        )}

        {/* SLOT MACHINE */}
        <div className="w-full max-w-2xl mx-auto mb-8">
          <div className="relative rounded-3xl overflow-hidden border-2 border-purple-500/30 bg-gradient-to-b from-white/[0.03] to-white/[0.01] backdrop-blur-xl shadow-[0_0_60px_rgba(168,85,247,0.15)]">

            {/* Top indicator triangle */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 z-30">
              <div className="w-0 h-0 border-l-[12px] border-r-[12px] border-t-[14px] border-l-transparent border-r-transparent border-t-purple-500 drop-shadow-[0_2px_8px_rgba(168,85,247,0.6)]" />
            </div>

            {/* Bottom indicator triangle */}
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 z-30">
              <div className="w-0 h-0 border-l-[12px] border-r-[12px] border-b-[14px] border-l-transparent border-r-transparent border-b-purple-500 drop-shadow-[0_-2px_8px_rgba(168,85,247,0.6)]" />
            </div>

            {/* Center winner zone highlight */}
            <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 z-20 pointer-events-none" style={{ width: ITEM_W }}>
              <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 via-purple-500/10 to-purple-500/20 border-x-2 border-purple-500/50" />
              <div className="absolute inset-y-0 left-0 w-0.5 bg-purple-400 shadow-[0_0_16px_rgba(168,85,247,0.8)]" />
              <div className="absolute inset-y-0 right-0 w-0.5 bg-purple-400 shadow-[0_0_16px_rgba(168,85,247,0.8)]" />
            </div>

            {/* Left fade */}
            <div className="absolute inset-y-0 left-0 w-24 sm:w-32 bg-gradient-to-r from-[#080b14] to-transparent z-20 pointer-events-none" />
            {/* Right fade */}
            <div className="absolute inset-y-0 right-0 w-24 sm:w-32 bg-gradient-to-l from-[#080b14] to-transparent z-20 pointer-events-none" />

            {/* Track */}
            <div ref={trackRef} className="relative overflow-hidden" style={{ height: 100 }}>
              <div ref={stripRef} className="flex h-full items-center" style={{ willChange: 'transform' }} />

              {/* Idle state */}
              {phase === 'idle' && !winner && (
                <div className="absolute inset-0 flex items-center justify-center bg-[#080b14]/80 backdrop-blur-sm z-10">
                  <div className="text-center">
                    <Dices className="h-8 w-8 text-purple-400 mx-auto mb-2 animate-pulse" />
                    <p className="text-white/50 text-sm">Presiona <span className="text-purple-400 font-semibold">GIRAR</span> para sortear</p>
                  </div>
                </div>
              )}

              {/* Winner reveal */}
              {phase === 'winner' && winner && (
                <div className="absolute inset-0 flex items-center justify-center z-10 animate-slot-reveal">
                  <div className="text-center animate-bounce-in">
                    <Crown className="h-10 w-10 text-yellow-400 mx-auto mb-1 drop-shadow-[0_0_20px_rgba(250,204,21,0.6)]" />
                    <p className="text-2xl sm:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-amber-200 to-yellow-300">
                      {winner.nombre}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="w-full max-w-md flex gap-3">
          {phase !== 'winner' ? (
            <button onClick={spin} disabled={!canSpin || phase === 'spinning'}
              className="flex-1 py-5 bg-gradient-to-r from-purple-600 via-fuchsia-600 to-purple-600 hover:from-purple-500 hover:via-fuchsia-500 hover:to-purple-500 disabled:opacity-25 disabled:cursor-not-allowed text-white font-black text-xl sm:text-2xl rounded-2xl transition-all shadow-[0_4px_40px_rgba(168,85,247,0.4)] hover:shadow-[0_8px_60px_rgba(168,85,247,0.6)] active:scale-[0.97] flex items-center justify-center gap-3 uppercase tracking-wider relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
              <Dices className={`h-7 w-7 ${phase === 'spinning' ? 'animate-spin' : ''}`} />
              {phase === 'spinning' ? 'Sorteando...' : 'GIRAR'}
            </button>
          ) : (
            <>
              <button onClick={confirmWinner}
                className="flex-1 py-5 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white font-bold text-lg rounded-2xl transition-all shadow-[0_4px_32px_rgba(16,185,129,0.4)] active:scale-[0.97] flex items-center justify-center gap-2">
                <Trophy className="h-6 w-6" /> Registrar
              </button>
              <button onClick={() => { setWinner(null); setPhase('idle'); setShowConfetti(false); }}
                className="px-6 py-5 bg-white/10 hover:bg-white/15 text-white/60 font-medium rounded-2xl transition-all">
                Descartar
              </button>
            </>
          )}
        </div>

        {poolSize === 0 && (
          <p className="text-amber-400/70 text-sm mt-6 text-center">
            {eligibilityMode === 'asistentes' ? 'No hay participantes con asistencia. Cambia a "Todos" en configuración.' : 'No hay participantes inscritos.'}
          </p>
        )}
      </div>

      {/* ===== SETTINGS PANEL (slide from right) ===== */}
      {showPanel && (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setShowPanel(false)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div className="relative w-full max-w-md bg-[#0e1225] border-l border-white/10 overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-6 space-y-6">
              {/* Panel header */}
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold flex items-center gap-2"><Settings className="h-5 w-5 text-purple-400" /> Configuración</h2>
                <button onClick={() => setShowPanel(false)} className="p-2 rounded-xl bg-white/5 hover:bg-white/10"><X className="h-4 w-4" /></button>
              </div>

              {/* Eligibility */}
              <div>
                <label className="text-xs text-white/40 uppercase tracking-wider block mb-2">Participantes elegibles</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['asistentes', 'todos'] as const).map(mode => (
                    <button key={mode} onClick={() => setEligibilityMode(mode)}
                      className={`flex items-center gap-2 p-3 rounded-xl border transition-all text-left ${eligibilityMode === mode ? 'border-purple-500 bg-purple-500/10' : 'border-white/10 hover:border-white/20'}`}>
                      {mode === 'asistentes' ? <UserCheck className={`h-4 w-4 ${eligibilityMode === mode ? 'text-purple-400' : 'text-white/30'}`} /> : <UsersRound className={`h-4 w-4 ${eligibilityMode === mode ? 'text-purple-400' : 'text-white/30'}`} />}
                      <div>
                        <p className={`text-sm font-medium ${eligibilityMode === mode ? 'text-purple-300' : 'text-white/60'}`}>{mode === 'asistentes' ? 'Asistentes' : 'Todos'}</p>
                        <p className="text-[10px] text-white/30">{mode === 'asistentes' ? `${attended}` : `${participants.length}`}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Prizes */}
              <div>
                <label className="text-xs text-white/40 uppercase tracking-wider block mb-2">Premios</label>
                <div className="flex gap-2 mb-3">
                  <input type="text" placeholder="Nombre del premio" value={newPrizeName} onChange={e => setNewPrizeName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddPrize()}
                    className="flex-1 px-3 py-2.5 bg-white/5 border border-white/10 text-white rounded-xl text-sm placeholder:text-white/20 focus:ring-2 focus:ring-purple-500 focus:border-transparent" />
                  <input type="number" min={1} value={newPrizeQty} onChange={e => setNewPrizeQty(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-14 px-2 py-2.5 bg-white/5 border border-white/10 text-white rounded-xl text-sm text-center focus:ring-2 focus:ring-purple-500 focus:border-transparent" />
                  <button onClick={handleAddPrize} disabled={!newPrizeName.trim()}
                    className="px-3 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-30 text-white rounded-xl transition-colors">
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                {prizes.length === 0 ? (
                  <p className="text-white/20 text-sm text-center py-4">Sin premios configurados</p>
                ) : (
                  <div className="space-y-1.5">
                    {prizes.map(p => {
                      const awarded = getPrizeAwarded(p.id);
                      const remaining = p.cantidad - awarded;
                      return (
                        <div key={p.id} className="flex items-center gap-2 p-2.5 rounded-xl bg-white/5">
                          <Gift className={`h-4 w-4 flex-shrink-0 ${remaining > 0 ? 'text-purple-400' : 'text-white/20'}`} />
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium truncate ${remaining > 0 ? 'text-white' : 'text-white/30 line-through'}`}>{p.nombre}</p>
                            <p className="text-[10px] text-white/30">{awarded}/{p.cantidad}{remaining > 0 && <span className="text-green-400/70 ml-1">• {remaining} rest.</span>}</p>
                          </div>
                          {awarded === 0 && <button onClick={() => handleDeletePrize(p.id)} className="text-red-400/60 hover:text-red-400 p-1"><Trash2 className="h-3.5 w-3.5" /></button>}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Winners */}
              {winners.length > 0 && (
                <div>
                  <label className="text-xs text-white/40 uppercase tracking-wider block mb-2">Ganadores ({winners.length})</label>
                  <div className="space-y-1.5">
                    {winners.map((w, i) => (
                      <div key={w.id} className="flex items-center gap-2 p-2.5 rounded-xl bg-white/5">
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-amber-400 to-yellow-500 flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0">
                          {winners.length - i}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white truncate">{w.participant_name}</p>
                          <p className="text-[10px] text-white/30">{w.prize_name} • {format(new Date(w.won_at), 'HH:mm', { locale: es })}</p>
                        </div>
                        <button onClick={() => handleDeleteWinner(w.id, w.participant_name)} className="text-red-400/60 hover:text-red-400 p-1" title="Eliminar">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Confetti */}
      {showConfetti && <Confetti />}

      <style jsx global>{`
        @keyframes confetti-fall {
          0% { transform: translateY(-10vh) rotate(0deg) scale(1); opacity: 1; }
          80% { opacity: 1; }
          100% { transform: translateY(105vh) rotate(1080deg) scale(0.5); opacity: 0; }
        }
        @keyframes bounce-in {
          0% { transform: scale(0.3); opacity: 0; }
          50% { transform: scale(1.1); }
          70% { transform: scale(0.95); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes slot-reveal {
          0% { background: transparent; }
          100% { background: rgba(8,11,20,0.85); backdrop-filter: blur(8px); }
        }
        .animate-bounce-in { animation: bounce-in 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
        .animate-slot-reveal { animation: slot-reveal 0.5s ease-out forwards; }
      `}</style>
    </div>
  );
}

function Confetti() {
  const pieces = useRef(
    Array.from({ length: 80 }, (_, i) => ({
      left: Math.random() * 100,
      delay: Math.random() * 2.5,
      dur: 2.5 + Math.random() * 2,
      color: ['#a855f7', '#eab308', '#3b82f6', '#ef4444', '#22c55e', '#f97316', '#ec4899', '#06b6d4'][i % 8],
      size: 4 + Math.random() * 6,
      shape: Math.random() > 0.5,
    }))
  ).current;

  return (
    <div className="fixed inset-0 pointer-events-none z-[60] overflow-hidden">
      {pieces.map((p, i) => (
        <div key={i} className="absolute" style={{
          left: `${p.left}%`, top: '-5%',
          width: p.size, height: p.shape ? p.size * 1.5 : p.size,
          borderRadius: p.shape ? '2px' : '50%',
          backgroundColor: p.color,
          animation: `confetti-fall ${p.dur}s ${p.delay}s ease-out forwards`,
          opacity: 0,
        }} />
      ))}
    </div>
  );
}

'use client';

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowLeft, Plus, Trash2, Trophy, Gift, Users, Dices, X,
  Settings, UserCheck, UsersRound, Crown, ChevronDown,
} from 'lucide-react';
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

const SPIN_MS = 5200;
const ITEM_W = 200;
const TOTAL_ITEMS = 70;

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
  const [pickedWinner, setPickedWinner] = useState<EventParticipant | null>(null);
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
        getEvent(eventId), getEventParticipants(eventId),
        getEventPrizes(eventId), getEventPrizeWinners(eventId),
      ]);
      setEvent(ev); setParticipants(parts); setPrizes(pz); setWinners(wn);
      const avail = pz.filter(p => p.cantidad - wn.filter(w => w.prize_id === p.id).length > 0);
      if (avail.length > 0) setSelectedPrizeId(prev => avail.find(a => a.id === prev) ? prev : avail[0].id);
    } catch (e) { console.error(e); toast.error('Error cargando datos'); }
    finally { setLoading(false); }
  };

  const eligible = useMemo(() => participants.filter(p => {
    if (p.categoria && p.categoria.toLowerCase() === 'staff') return false;
    if (eligibilityMode === 'asistentes' && !p.asistencia) return false;
    return !winners.some(w => w.participant_id === p.id);
  }), [participants, eligibilityMode, winners]);

  const getPrizeAwarded = (pid: string) => winners.filter(w => w.prize_id === pid).length;
  const getPrizeRemaining = (p: EventPrize) => p.cantidad - getPrizeAwarded(p.id);
  const availablePrizes = prizes.filter(p => getPrizeRemaining(p) > 0);

  const handleAddPrize = async () => {
    if (!newPrizeName.trim()) return;
    try {
      await createEventPrize(eventId, { nombre: newPrizeName.trim(), cantidad: newPrizeQty });
      setNewPrizeName(''); setNewPrizeQty(1);
      toast.success('Premio agregado'); loadData();
    } catch (e: any) { toast.error(e?.message || 'Error'); }
  };
  const handleDeletePrize = async (id: string) => {
    if (getPrizeAwarded(id) > 0) { toast.error('Premio con ganadores'); return; }
    try { await deleteEventPrize(id); toast.success('Eliminado'); loadData(); } catch { toast.error('Error'); }
  };
  const handleDeleteWinner = async (wid: string, name: string) => {
    if (!confirm(`¿Eliminar a ${name} de ganadores?`)) return;
    try { await deletePrizeWinner(wid); toast.success(`${name} eliminado`); loadData(); } catch { toast.error('Error'); }
  };

  const spin = useCallback(() => {
    if (eligible.length === 0 || !selectedPrizeId) return;
    const prize = prizes.find(p => p.id === selectedPrizeId);
    if (!prize || getPrizeRemaining(prize) <= 0) return;

    const picked = eligible[Math.floor(Math.random() * eligible.length)];
    const pool = eligible.map(p => p.nombre);
    while (pool.length < 8) pool.push(...eligible.map(p => p.nombre));

    const names = [...shuffled(pool, TOTAL_ITEMS), picked.nombre];
    setPickedWinner(null); setShowConfetti(false); setPhase('spinning');

    const track = trackRef.current;
    const strip = stripRef.current;
    if (!track || !strip) return;

    strip.innerHTML = '';
    names.forEach(n => {
      const el = document.createElement('div');
      el.className = 'roulette-name';
      el.textContent = n;
      strip.appendChild(el);
    });

    const trackW = track.offsetWidth;
    const totalDist = (names.length - 1) * ITEM_W - (trackW / 2 - ITEM_W / 2);

    strip.style.transition = 'none';
    strip.style.transform = 'translateX(0)';
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        strip.style.transition = `transform ${SPIN_MS}ms cubic-bezier(0.08, 0.82, 0.17, 1)`;
        strip.style.transform = `translateX(-${totalDist}px)`;
      });
    });

    timerRef.current = window.setTimeout(() => {
      setPhase('winner'); setPickedWinner(picked);
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 6000);
    }, SPIN_MS + 300);
  }, [eligible, selectedPrizeId, prizes, winners]);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const confirmWinner = async () => {
    if (!pickedWinner || !selectedPrizeId) return;
    try {
      await savePrizeWinner(eventId, selectedPrizeId, pickedWinner.id, pickedWinner.nombre);
      toast.success(`${pickedWinner.nombre} registrado`);
      setPickedWinner(null); setPhase('idle'); loadData();
    } catch (e: any) {
      if (e.message?.includes('unique') || e.code === '23505') toast.error('Ya tiene premio');
      else toast.error('Error');
    }
  };

  if (loading || !event) return (
    <div className="flex items-center justify-center min-h-screen bg-[#060911]">
      <div className="animate-spin rounded-full h-12 w-12 border-2 border-purple-500 border-t-transparent" />
    </div>
  );

  const canSpin = phase === 'idle' && eligible.length > 0 && availablePrizes.length > 0;
  const attended = participants.filter(p => p.asistencia).length;

  return (
    <div className="min-h-screen bg-[#060911] text-white relative overflow-hidden select-none">
      {/* Background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[20%] w-[600px] h-[600px] bg-purple-700/[0.06] rounded-full blur-[150px]" />
        <div className="absolute bottom-[-10%] right-[10%] w-[500px] h-[500px] bg-fuchsia-700/[0.04] rounded-full blur-[130px]" />
      </div>

      {/* Header bar */}
      <header className="relative z-10 flex items-center justify-between px-5 sm:px-8 py-4">
        <div className="flex items-center gap-3">
          <Link href={`/eventos/${eventId}`}>
            <div className="p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"><ArrowLeft className="h-4 w-4 text-white/50" /></div>
          </Link>
          <Image src="/logo-disfero.png" alt="Disfero" width={32} height={32} className="rounded-lg" />
          <div>
            <p className="text-sm font-semibold">{event.nombre}</p>
            <p className="text-[10px] text-white/30">{format(new Date(event.fecha_inicio), "d MMM yyyy", { locale: es })}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-4 text-xs text-white/40 mr-2">
            <span><span className="text-purple-400 font-bold">{eligible.length}</span> elegibles</span>
            <span><span className="text-amber-400 font-bold">{availablePrizes.reduce((s, p) => s + getPrizeRemaining(p), 0)}</span> premios</span>
            <span><span className="text-emerald-400 font-bold">{winners.length}</span> ganadores</span>
          </div>
          <button onClick={() => setShowPanel(true)}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/50 transition-colors">
            <Settings className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* Center content */}
      <div className="relative z-10 flex flex-col items-center justify-center px-4" style={{ minHeight: 'calc(100vh - 80px)' }}>

        {/* Prize selector */}
        {availablePrizes.length > 0 && (
          <div className="mb-10 text-center">
            <p className="text-[10px] uppercase tracking-[0.25em] text-white/20 mb-2">Sorteando</p>
            <div className="relative inline-block">
              <select value={selectedPrizeId} onChange={e => setSelectedPrizeId(e.target.value)} disabled={phase === 'spinning'}
                className="appearance-none bg-transparent border border-white/10 rounded-full px-6 pr-10 py-2 text-lg font-bold text-white cursor-pointer hover:border-white/20 focus:outline-none focus:border-purple-500/50 transition-colors">
                {availablePrizes.map(p => <option key={p.id} value={p.id} className="bg-[#0e1225]">{p.nombre} ({getPrizeRemaining(p)})</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30 pointer-events-none" />
            </div>
          </div>
        )}

        {/* ===== SLOT MACHINE ===== */}
        <div className="w-full max-w-3xl mb-10">
          <div className="relative">

            {/* Top triangle pointer */}
            <div className="absolute -top-5 left-1/2 -translate-x-1/2 z-30">
              <svg width="24" height="16" viewBox="0 0 24 16"><path d="M12 16L0 0h24z" fill="#a855f7" opacity="0.8"/></svg>
            </div>

            {/* Bottom triangle pointer */}
            <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 z-30">
              <svg width="24" height="16" viewBox="0 0 24 16"><path d="M12 0L24 16H0z" fill="#a855f7" opacity="0.8"/></svg>
            </div>

            {/* Main container */}
            <div className="relative rounded-2xl overflow-hidden border border-purple-500/20"
              style={{ background: '#0d1117', boxShadow: '0 0 60px rgba(168,85,247,0.1), inset 0 1px 0 rgba(255,255,255,0.03)' }}>

              {/* Center highlight zone */}
              <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 z-20 pointer-events-none" style={{ width: ITEM_W }}>
                <div className="absolute inset-0 bg-purple-500/[0.08]" />
                <div className="absolute inset-y-0 left-0 w-[2px]" style={{ background: 'linear-gradient(to bottom, transparent, #a855f7, transparent)', boxShadow: '0 0 16px rgba(168,85,247,0.6)' }} />
                <div className="absolute inset-y-0 right-0 w-[2px]" style={{ background: 'linear-gradient(to bottom, transparent, #a855f7, transparent)', boxShadow: '0 0 16px rgba(168,85,247,0.6)' }} />
              </div>

              {/* Side fades */}
              <div className="absolute inset-y-0 left-0 w-28 z-10 pointer-events-none" style={{ background: 'linear-gradient(to right, #0d1117, transparent)' }} />
              <div className="absolute inset-y-0 right-0 w-28 z-10 pointer-events-none" style={{ background: 'linear-gradient(to left, #0d1117, transparent)' }} />

              {/* Track */}
              <div ref={trackRef} className="relative overflow-hidden" style={{ height: 96 }}>
                <div ref={stripRef} className="flex h-full items-center" />

                {/* Idle */}
                {phase === 'idle' && !pickedWinner && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center" style={{ background: '#0d1117' }}>
                    <p className="text-white/25 text-sm tracking-wide">Presiona <span className="text-purple-400 font-semibold">GIRAR</span> para sortear</p>
                  </div>
                )}

                {/* Winner reveal */}
                {phase === 'winner' && pickedWinner && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center roulette-reveal">
                    <div className="text-center roulette-bounce">
                      <Crown className="h-8 w-8 text-yellow-400 mx-auto mb-1" style={{ filter: 'drop-shadow(0 0 16px rgba(250,204,21,0.5))' }} />
                      <p className="text-2xl sm:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-white to-yellow-300">
                        {pickedWinner.nombre}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Buttons */}
        <div className="w-full max-w-md flex gap-3">
          {phase !== 'winner' ? (
            <button onClick={spin} disabled={!canSpin}
              className="flex-1 py-5 rounded-2xl font-black text-xl uppercase tracking-wider flex items-center justify-center gap-3 transition-all active:scale-[0.97] disabled:opacity-20 disabled:cursor-not-allowed"
              style={{
                background: canSpin ? 'linear-gradient(135deg, #9333ea, #c026d3, #9333ea)' : '#1a1a2e',
                boxShadow: canSpin ? '0 4px 40px rgba(168,85,247,0.35), inset 0 1px 0 rgba(255,255,255,0.1)' : 'none',
              }}>
              <Dices className={`h-6 w-6 ${phase !== 'idle' ? 'animate-spin' : ''}`} />
              {phase === 'idle' ? 'GIRAR' : 'Sorteando...'}
            </button>
          ) : (
            <>
              <button onClick={confirmWinner}
                className="flex-1 py-5 rounded-2xl font-bold text-lg flex items-center justify-center gap-2 transition-all active:scale-[0.97]"
                style={{ background: 'linear-gradient(135deg, #059669, #10b981)', boxShadow: '0 4px 30px rgba(16,185,129,0.3)' }}>
                <Trophy className="h-5 w-5" /> Registrar Ganador
              </button>
              <button onClick={() => { setPickedWinner(null); setPhase('idle'); setShowConfetti(false); }}
                className="px-6 py-5 rounded-2xl bg-white/5 hover:bg-white/10 text-white/50 font-medium transition-all">
                Descartar
              </button>
            </>
          )}
        </div>

        {prizes.length === 0 && (
          <p className="text-white/20 text-sm mt-8">
            Abre <button onClick={() => setShowPanel(true)} className="text-purple-400 underline underline-offset-2 hover:text-purple-300">configuración</button> para agregar premios
          </p>
        )}
      </div>

      {/* ===== SETTINGS PANEL ===== */}
      {showPanel && (
        <div className="fixed inset-0 z-50" onClick={() => setShowPanel(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="absolute right-0 top-0 bottom-0 w-full max-w-md bg-[#0b0f1e] border-l border-white/5 overflow-y-auto"
            onClick={e => e.stopPropagation()}>
            <div className="p-5 space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold">Configuración</h2>
                <button onClick={() => setShowPanel(false)} className="p-2 rounded-lg bg-white/5 hover:bg-white/10"><X className="h-4 w-4 text-white/50" /></button>
              </div>

              {/* Mode */}
              <div>
                <p className="text-[10px] text-white/25 uppercase tracking-wider mb-2">Elegibles</p>
                <div className="grid grid-cols-2 gap-2">
                  {(['asistentes', 'todos'] as const).map(m => (
                    <button key={m} onClick={() => setEligibilityMode(m)}
                      className={`p-3 rounded-xl border text-left transition-all ${eligibilityMode === m ? 'border-purple-500/40 bg-purple-500/10' : 'border-white/5 bg-white/[0.02] hover:bg-white/[0.04]'}`}>
                      <div className="flex items-center gap-2">
                        {m === 'asistentes' ? <UserCheck className="h-4 w-4 text-purple-400" /> : <UsersRound className="h-4 w-4 text-purple-400" />}
                        <span className={`text-sm font-medium ${eligibilityMode === m ? 'text-white' : 'text-white/50'}`}>{m === 'asistentes' ? 'Asistentes' : 'Todos'}</span>
                      </div>
                      <p className="text-[10px] text-white/20 mt-1 ml-6">{m === 'asistentes' ? `${attended} personas` : `${participants.length} inscritos`}</p>
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-white/15 mt-1.5">Staff se excluye automáticamente</p>
              </div>

              {/* Prizes */}
              <div>
                <p className="text-[10px] text-white/25 uppercase tracking-wider mb-2">Premios</p>
                <div className="flex gap-2 mb-3">
                  <input type="text" placeholder="Nombre del premio" value={newPrizeName} onChange={e => setNewPrizeName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddPrize()}
                    className="flex-1 px-3 py-2 bg-white/5 border border-white/10 text-white rounded-lg text-sm placeholder:text-white/15 focus:outline-none focus:border-purple-500/50" />
                  <input type="number" min={1} value={newPrizeQty} onChange={e => setNewPrizeQty(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-14 px-2 py-2 bg-white/5 border border-white/10 text-white rounded-lg text-sm text-center focus:outline-none focus:border-purple-500/50" />
                  <button onClick={handleAddPrize} disabled={!newPrizeName.trim()}
                    className="px-3 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-20 text-white rounded-lg transition-colors">
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                {prizes.length === 0 ? (
                  <p className="text-white/15 text-xs text-center py-6 border border-dashed border-white/5 rounded-lg">Sin premios</p>
                ) : (
                  <div className="space-y-1">
                    {prizes.map(p => {
                      const aw = getPrizeAwarded(p.id), rem = p.cantidad - aw;
                      return (
                        <div key={p.id} className="flex items-center gap-2 p-2.5 rounded-lg bg-white/[0.03]">
                          <Gift className={`h-4 w-4 flex-shrink-0 ${rem > 0 ? 'text-purple-400' : 'text-white/10'}`} />
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm truncate ${rem > 0 ? 'text-white/80' : 'text-white/20 line-through'}`}>{p.nombre}</p>
                            <p className="text-[10px] text-white/20">{aw}/{p.cantidad}{rem > 0 && <span className="text-green-400/50"> • {rem} rest.</span>}</p>
                          </div>
                          {aw === 0 && <button onClick={() => handleDeletePrize(p.id)} className="text-red-400/30 hover:text-red-400 p-1"><Trash2 className="h-3.5 w-3.5" /></button>}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Winners */}
              {winners.length > 0 && (
                <div>
                  <p className="text-[10px] text-white/25 uppercase tracking-wider mb-2">Ganadores ({winners.length})</p>
                  <div className="space-y-1">
                    {winners.map((w, i) => (
                      <div key={w.id} className="flex items-center gap-2 p-2.5 rounded-lg bg-white/[0.03]">
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-amber-400 to-yellow-500 flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0">
                          {winners.length - i}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white/80 truncate">{w.participant_name}</p>
                          <p className="text-[10px] text-white/20">{w.prize_name} • {format(new Date(w.won_at), 'HH:mm', { locale: es })}</p>
                        </div>
                        <button onClick={() => handleDeleteWinner(w.id, w.participant_name)} className="text-red-400/30 hover:text-red-400 p-1"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showConfetti && <Confetti />}

      <style jsx global>{`
        .roulette-name {
          min-width: ${ITEM_W}px;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.1rem;
          font-weight: 600;
          white-space: nowrap;
          padding: 0 12px;
          flex-shrink: 0;
          color: rgba(255,255,255,0.35);
        }
        .roulette-name:last-child {
          color: #fff;
          font-weight: 800;
          font-size: 1.25rem;
        }
        @keyframes confetti-fall {
          0% { transform: translateY(-10vh) rotate(0); opacity: 1; }
          75% { opacity: 1; }
          100% { transform: translateY(105vh) rotate(720deg); opacity: 0; }
        }
        .roulette-reveal {
          animation: reveal-bg 0.5s ease-out forwards;
        }
        @keyframes reveal-bg {
          from { background: transparent; }
          to { background: rgba(13,17,23,0.9); backdrop-filter: blur(8px); }
        }
        .roulette-bounce {
          animation: bounce-in 0.6s cubic-bezier(0.34,1.56,0.64,1) forwards;
        }
        @keyframes bounce-in {
          0% { transform: scale(0.3); opacity: 0; }
          50% { transform: scale(1.08); }
          70% { transform: scale(0.96); }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

function Confetti() {
  const pieces = useRef(
    Array.from({ length: 80 }, (_, i) => ({
      left: Math.random() * 100,
      delay: Math.random() * 2.5,
      dur: 2 + Math.random() * 2.5,
      color: ['#a855f7','#eab308','#3b82f6','#ef4444','#22c55e','#f97316','#ec4899','#06b6d4'][i % 8],
      size: 4 + Math.random() * 6,
      rect: Math.random() > 0.5,
    }))
  ).current;

  return (
    <div className="fixed inset-0 pointer-events-none z-[60] overflow-hidden">
      {pieces.map((p, i) => (
        <div key={i} className="absolute" style={{
          left: `${p.left}%`, top: '-5%',
          width: p.size, height: p.rect ? p.size * 1.6 : p.size,
          borderRadius: p.rect ? '1px' : '50%',
          backgroundColor: p.color,
          animation: `confetti-fall ${p.dur}s ${p.delay}s ease-out forwards`,
          opacity: 0,
        }} />
      ))}
    </div>
  );
}

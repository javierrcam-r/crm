'use client';

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowLeft, Plus, Trash2, Trophy, Gift, Users, Dices, X,
  Settings, UserCheck, UsersRound, Sparkles, Crown, ChevronDown,
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
const ITEM_W = 220;
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
    } catch (e: any) { toast.error(e?.message || 'Error al agregar premio'); }
  };

  const handleDeletePrize = async (id: string) => {
    if (getPrizeAwarded(id) > 0) { toast.error('Premio con ganadores'); return; }
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
    while (pool.length < 8) pool.push(...eligible.map(p => p.nombre));

    const names = [...shuffled(pool, TOTAL_ITEMS), picked.nombre];

    setPickedWinner(null);
    setShowConfetti(false);
    setPhase('spinning');

    const track = trackRef.current;
    const strip = stripRef.current;
    if (!track || !strip) return;

    strip.innerHTML = '';
    names.forEach(n => {
      const el = document.createElement('div');
      el.className = 'slot-item';
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
      setPhase('winner');
      setPickedWinner(picked);
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
      else toast.error('Error al registrar');
    }
  };

  if (loading || !event) return (
    <div className="flex items-center justify-center min-h-screen bg-[#060911]">
      <div className="animate-spin rounded-full h-12 w-12 border-2 border-purple-500 border-t-transparent" />
    </div>
  );

  const attended = participants.filter(p => p.asistencia).length;
  const poolSize = eligibilityMode === 'asistentes' ? attended : participants.length;
  const canSpin = phase === 'idle' && eligible.length > 0 && availablePrizes.length > 0;
  const selectedPrize = prizes.find(p => p.id === selectedPrizeId);

  return (
    <div className="min-h-screen bg-[#060911] text-white relative overflow-hidden select-none">
      {/* Ambient orbs */}
      <div className="absolute top-[-300px] left-1/4 w-[700px] h-[700px] bg-purple-600/[0.07] rounded-full blur-[150px] pointer-events-none" />
      <div className="absolute bottom-[-200px] right-[-100px] w-[500px] h-[500px] bg-fuchsia-600/[0.05] rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-1/2 left-[-200px] w-[400px] h-[400px] bg-indigo-600/[0.06] rounded-full blur-[100px] pointer-events-none" />

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-4 sm:px-8 py-4">
        <div className="flex items-center gap-3">
          <Link href={`/eventos/${eventId}`}>
            <div className="p-2.5 rounded-2xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.08] backdrop-blur-md transition-all">
              <ArrowLeft className="h-4 w-4 text-white/50" />
            </div>
          </Link>
          <div className="flex items-center gap-3">
            <Image src="/logo-disfero.png" alt="Disfero" width={36} height={36} className="rounded-xl" />
            <div>
              <h1 className="text-base sm:text-lg font-bold tracking-tight">{event.nombre}</h1>
              <p className="text-[10px] text-white/30">{format(new Date(event.fecha_inicio), "d 'de' MMMM yyyy", { locale: es })}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-1.5">
            {[
              { icon: Users, val: eligible.length, label: 'elegibles', color: 'purple' },
              { icon: Gift, val: availablePrizes.reduce((s, p) => s + getPrizeRemaining(p), 0), label: 'premios', color: 'amber' },
              { icon: Trophy, val: winners.length, label: 'ganadores', color: 'emerald' },
            ].map(s => (
              <div key={s.label} className={`px-3 py-1.5 rounded-xl bg-${s.color}-500/10 border border-${s.color}-500/20 backdrop-blur-md`}>
                <span className={`text-${s.color}-400 text-xs font-semibold`}>{s.val}</span>
                <span className="text-white/30 text-[10px] ml-1">{s.label}</span>
              </div>
            ))}
          </div>
          <button onClick={() => setShowPanel(!showPanel)}
            className={`p-2.5 rounded-2xl border backdrop-blur-md transition-all ${showPanel ? 'bg-purple-500/20 border-purple-500/30 text-purple-300' : 'bg-white/[0.04] border-white/[0.06] hover:bg-white/[0.08] text-white/50'}`}>
            <Settings className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* Mobile stats */}
      <div className="sm:hidden flex items-center gap-1.5 px-4 pb-3 overflow-x-auto">
        {[
          { val: eligible.length, label: 'elegibles', c: 'purple' },
          { val: availablePrizes.reduce((s, p) => s + getPrizeRemaining(p), 0), label: 'premios', c: 'amber' },
          { val: winners.length, label: 'ganadores', c: 'emerald' },
        ].map(s => (
          <div key={s.label} className="px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.06] whitespace-nowrap">
            <span className="text-white/70 text-xs font-semibold">{s.val}</span>
            <span className="text-white/30 text-[10px] ml-1">{s.label}</span>
          </div>
        ))}
      </div>

      {/* Main area */}
      <div className="relative z-10 flex flex-col items-center justify-center px-4 sm:px-8" style={{ minHeight: 'calc(100vh - 180px)' }}>

        {/* Current prize badge */}
        {selectedPrize && (
          <div className="mb-8 flex flex-col items-center gap-2">
            <p className="text-[10px] uppercase tracking-[0.2em] text-white/25">Sorteando</p>
            <div className="relative">
              <select value={selectedPrizeId} onChange={e => setSelectedPrizeId(e.target.value)} disabled={phase === 'spinning'}
                className="appearance-none pl-5 pr-10 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-2xl text-base font-bold text-center backdrop-blur-xl cursor-pointer focus:ring-2 focus:ring-purple-500/50 focus:border-transparent transition-all hover:bg-white/[0.07]">
                {availablePrizes.map(p => <option key={p.id} value={p.id} className="bg-[#0e1225]">{p.nombre} ({getPrizeRemaining(p)})</option>)}
                {availablePrizes.length === 0 && <option value="" className="bg-[#0e1225]">Sin premios</option>}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30 pointer-events-none" />
            </div>
          </div>
        )}

        {/* ===== SLOT MACHINE ===== */}
        <div className="w-full max-w-3xl mx-auto mb-10">
          <div className="relative rounded-[28px] overflow-hidden bg-gradient-to-b from-white/[0.04] to-white/[0.01] border border-white/[0.08] backdrop-blur-2xl shadow-[0_0_80px_rgba(168,85,247,0.12),inset_0_1px_0_rgba(255,255,255,0.05)]">

            {/* Inner glow top & bottom */}
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-purple-400/40 to-transparent" />
            <div className="absolute bottom-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-purple-400/20 to-transparent" />

            {/* Logo pointer top */}
            <div className="absolute top-1 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center">
              <div className="w-10 h-10 rounded-full bg-[#060911] border-2 border-purple-500/60 flex items-center justify-center shadow-[0_0_20px_rgba(168,85,247,0.4)]">
                <Image src="/logo-disfero.png" alt="" width={28} height={28} className="rounded-full" />
              </div>
              <div className="w-0 h-0 border-l-[8px] border-r-[8px] border-t-[10px] border-l-transparent border-r-transparent border-t-purple-500/60 -mt-0.5" />
            </div>

            {/* Logo pointer bottom */}
            <div className="absolute bottom-1 left-1/2 -translate-x-1/2 z-30 flex flex-col-reverse items-center">
              <div className="w-8 h-8 rounded-full bg-[#060911] border-2 border-purple-500/40 flex items-center justify-center shadow-[0_0_16px_rgba(168,85,247,0.3)]">
                <Sparkles className="h-4 w-4 text-purple-400" />
              </div>
              <div className="w-0 h-0 border-l-[7px] border-r-[7px] border-b-[9px] border-l-transparent border-r-transparent border-b-purple-500/40 -mb-0.5" />
            </div>

            {/* Center winner zone */}
            <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 z-20 pointer-events-none" style={{ width: ITEM_W }}>
              <div className="absolute inset-0 bg-gradient-to-b from-purple-500/[0.15] via-purple-500/[0.08] to-purple-500/[0.15]" />
              <div className="absolute inset-y-0 left-0 w-[2px] bg-gradient-to-b from-transparent via-purple-400 to-transparent shadow-[0_0_20px_rgba(168,85,247,0.8)]" />
              <div className="absolute inset-y-0 right-0 w-[2px] bg-gradient-to-b from-transparent via-purple-400 to-transparent shadow-[0_0_20px_rgba(168,85,247,0.8)]" />
            </div>

            {/* Side fades */}
            <div className="absolute inset-y-0 left-0 w-28 sm:w-40 bg-gradient-to-r from-[#060911] via-[#060911]/80 to-transparent z-20 pointer-events-none" />
            <div className="absolute inset-y-0 right-0 w-28 sm:w-40 bg-gradient-to-l from-[#060911] via-[#060911]/80 to-transparent z-20 pointer-events-none" />

            {/* Track */}
            <div ref={trackRef} className="relative overflow-hidden py-4" style={{ height: 120 }}>
              <div ref={stripRef} className="flex h-full items-center" style={{ willChange: 'transform' }} />

              {/* Idle overlay */}
              {phase === 'idle' && !pickedWinner && (
                <div className="absolute inset-0 flex items-center justify-center bg-[#060911]/70 backdrop-blur-sm z-10">
                  <div className="text-center">
                    <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                      <Dices className="h-8 w-8 text-purple-400 animate-pulse" />
                    </div>
                    <p className="text-white/40 text-sm">Presiona <span className="text-purple-400 font-bold">GIRAR</span> para sortear</p>
                  </div>
                </div>
              )}

              {/* Winner reveal */}
              {phase === 'winner' && pickedWinner && (
                <div className="absolute inset-0 flex items-center justify-center z-10 animate-slot-reveal">
                  <div className="text-center animate-bounce-in">
                    <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-gradient-to-br from-yellow-400 to-amber-500 flex items-center justify-center shadow-[0_0_40px_rgba(250,204,21,0.4)]">
                      <Crown className="h-8 w-8 text-white drop-shadow-lg" />
                    </div>
                    <p className="text-3xl sm:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 via-amber-100 to-yellow-200 tracking-tight">
                      {pickedWinner.nombre}
                    </p>
                    <div className="flex items-center justify-center gap-2 mt-2">
                      <div className="h-px w-8 bg-gradient-to-r from-transparent to-purple-400/50" />
                      <p className="text-purple-300/60 text-[11px] uppercase tracking-[0.3em] font-medium">Ganador</p>
                      <div className="h-px w-8 bg-gradient-to-l from-transparent to-purple-400/50" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="w-full max-w-lg flex gap-3">
          {phase !== 'winner' ? (
            <button onClick={spin} disabled={!canSpin}
              className="flex-1 py-5 sm:py-6 bg-gradient-to-r from-purple-600 via-fuchsia-500 to-purple-600 hover:from-purple-500 hover:via-fuchsia-400 hover:to-purple-500 disabled:opacity-20 disabled:cursor-not-allowed text-white font-black text-xl sm:text-2xl rounded-2xl transition-all shadow-[0_4px_40px_rgba(168,85,247,0.35)] hover:shadow-[0_8px_60px_rgba(168,85,247,0.5)] active:scale-[0.97] flex items-center justify-center gap-3 uppercase tracking-wider relative overflow-hidden group border border-purple-400/20">
              <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/[0.08] to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
              <Dices className={`h-7 w-7 ${phase !== 'idle' ? 'animate-spin' : ''}`} />
              {phase === 'idle' ? 'GIRAR' : 'Sorteando...'}
            </button>
          ) : (
            <>
              <button onClick={confirmWinner}
                className="flex-1 py-5 sm:py-6 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white font-bold text-lg rounded-2xl transition-all shadow-[0_4px_32px_rgba(16,185,129,0.35)] active:scale-[0.97] flex items-center justify-center gap-2 border border-emerald-400/20">
                <Trophy className="h-6 w-6" /> Registrar Ganador
              </button>
              <button onClick={() => { setPickedWinner(null); setPhase('idle'); setShowConfetti(false); }}
                className="px-6 py-5 bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.1] text-white/50 font-medium rounded-2xl transition-all backdrop-blur-md">
                Descartar
              </button>
            </>
          )}
        </div>

        {poolSize === 0 && prizes.length > 0 && (
          <p className="text-amber-400/60 text-sm mt-6 text-center max-w-md">
            {eligibilityMode === 'asistentes' ? 'No hay asistentes elegibles. Cambia a "Todos" en configuración.' : 'No hay inscritos elegibles.'}
          </p>
        )}
        {prizes.length === 0 && (
          <p className="text-white/30 text-sm mt-6 text-center">Configura premios en el panel de <button onClick={() => setShowPanel(true)} className="text-purple-400 underline underline-offset-2">configuración</button></p>
        )}
      </div>

      {/* Settings panel */}
      {showPanel && (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setShowPanel(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" />
          <div className="relative w-full max-w-md bg-[#0a0e1a]/95 border-l border-white/[0.06] overflow-y-auto backdrop-blur-2xl" onClick={e => e.stopPropagation()}>
            <div className="p-6 space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold flex items-center gap-2"><Settings className="h-5 w-5 text-purple-400" /> Configuración</h2>
                <button onClick={() => setShowPanel(false)} className="p-2 rounded-xl bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.1]"><X className="h-4 w-4 text-white/50" /></button>
              </div>

              {/* Eligibility */}
              <div>
                <label className="text-[10px] text-white/30 uppercase tracking-[0.15em] block mb-2.5">Participantes elegibles</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['asistentes', 'todos'] as const).map(mode => (
                    <button key={mode} onClick={() => setEligibilityMode(mode)}
                      className={`flex items-center gap-2.5 p-3 rounded-2xl border backdrop-blur-md transition-all text-left ${eligibilityMode === mode ? 'border-purple-500/50 bg-purple-500/[0.08]' : 'border-white/[0.06] hover:border-white/[0.12] bg-white/[0.02]'}`}>
                      {mode === 'asistentes' ? <UserCheck className={`h-4 w-4 ${eligibilityMode === mode ? 'text-purple-400' : 'text-white/20'}`} /> : <UsersRound className={`h-4 w-4 ${eligibilityMode === mode ? 'text-purple-400' : 'text-white/20'}`} />}
                      <div>
                        <p className={`text-sm font-semibold ${eligibilityMode === mode ? 'text-purple-300' : 'text-white/50'}`}>{mode === 'asistentes' ? 'Asistentes' : 'Todos'}</p>
                        <p className="text-[10px] text-white/20">{mode === 'asistentes' ? `${attended} personas` : `${participants.length} inscritos`}</p>
                      </div>
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-white/20 mt-2">La categoría "Staff" se excluye automáticamente</p>
              </div>

              {/* Prizes */}
              <div>
                <label className="text-[10px] text-white/30 uppercase tracking-[0.15em] block mb-2.5">Premios</label>
                <div className="flex gap-2 mb-3">
                  <input type="text" placeholder="Nombre del premio" value={newPrizeName} onChange={e => setNewPrizeName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddPrize()}
                    className="flex-1 px-3 py-2.5 bg-white/[0.04] border border-white/[0.08] text-white rounded-xl text-sm placeholder:text-white/15 focus:ring-2 focus:ring-purple-500/50 focus:border-transparent backdrop-blur-md" />
                  <input type="number" min={1} value={newPrizeQty} onChange={e => setNewPrizeQty(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-14 px-2 py-2.5 bg-white/[0.04] border border-white/[0.08] text-white rounded-xl text-sm text-center focus:ring-2 focus:ring-purple-500/50 focus:border-transparent backdrop-blur-md" />
                  <button onClick={handleAddPrize} disabled={!newPrizeName.trim()}
                    className="px-3.5 py-2.5 bg-purple-600/80 hover:bg-purple-500 disabled:opacity-20 text-white rounded-xl transition-colors border border-purple-400/20">
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                {prizes.length === 0 ? (
                  <div className="text-center py-6 rounded-2xl border border-dashed border-white/[0.06]">
                    <Gift className="h-6 w-6 text-white/10 mx-auto mb-1" />
                    <p className="text-white/15 text-xs">Agrega un premio para empezar</p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {prizes.map(p => {
                      const awarded = getPrizeAwarded(p.id);
                      const remaining = p.cantidad - awarded;
                      return (
                        <div key={p.id} className="flex items-center gap-2.5 p-3 rounded-xl bg-white/[0.03] border border-white/[0.05]">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${remaining > 0 ? 'bg-purple-500/15' : 'bg-white/[0.03]'}`}>
                            <Gift className={`h-4 w-4 ${remaining > 0 ? 'text-purple-400' : 'text-white/15'}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium truncate ${remaining > 0 ? 'text-white/90' : 'text-white/25 line-through'}`}>{p.nombre}</p>
                            <p className="text-[10px] text-white/25">{awarded}/{p.cantidad}{remaining > 0 && <span className="text-emerald-400/60 ml-1">• {remaining} rest.</span>}</p>
                          </div>
                          {awarded === 0 && <button onClick={() => handleDeletePrize(p.id)} className="text-red-400/40 hover:text-red-400 p-1 transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Winners */}
              {winners.length > 0 && (
                <div>
                  <label className="text-[10px] text-white/30 uppercase tracking-[0.15em] block mb-2.5">Ganadores ({winners.length})</label>
                  <div className="space-y-1.5">
                    {winners.map((w, i) => (
                      <div key={w.id} className="flex items-center gap-2.5 p-3 rounded-xl bg-white/[0.03] border border-white/[0.05]">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-400 to-yellow-500 flex items-center justify-center text-[10px] font-black text-white flex-shrink-0 shadow-[0_0_12px_rgba(250,204,21,0.2)]">
                          {winners.length - i}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white/90 truncate">{w.participant_name}</p>
                          <p className="text-[10px] text-white/25">{w.prize_name} • {format(new Date(w.won_at), 'HH:mm', { locale: es })}</p>
                        </div>
                        <button onClick={() => handleDeleteWinner(w.id, w.participant_name)} className="text-red-400/40 hover:text-red-400 p-1 transition-colors" title="Eliminar">
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

      {showConfetti && <Confetti />}

      <style jsx global>{`
        .slot-item {
          min-width: ${ITEM_W}px;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.15rem;
          font-weight: 600;
          white-space: nowrap;
          padding: 0 16px;
          flex-shrink: 0;
          color: rgba(255,255,255,0.45);
          text-shadow: 0 0 10px rgba(168,85,247,0.15);
        }
        .slot-item:last-child {
          color: #fff;
          font-weight: 800;
          font-size: 1.3rem;
          text-shadow: 0 0 20px rgba(168,85,247,0.4);
        }
        @keyframes confetti-fall {
          0% { transform: translateY(-10vh) rotate(0deg) scale(1); opacity: 1; }
          75% { opacity: 1; }
          100% { transform: translateY(105vh) rotate(1080deg) scale(0.4); opacity: 0; }
        }
        @keyframes bounce-in {
          0% { transform: scale(0.2); opacity: 0; }
          50% { transform: scale(1.12); }
          70% { transform: scale(0.94); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes slot-reveal {
          0% { background: transparent; backdrop-filter: blur(0); }
          100% { background: rgba(6,9,17,0.88); backdrop-filter: blur(12px); }
        }
        .animate-bounce-in { animation: bounce-in 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
        .animate-slot-reveal { animation: slot-reveal 0.6s ease-out forwards; }
      `}</style>
    </div>
  );
}

function Confetti() {
  const pieces = useRef(
    Array.from({ length: 100 }, (_, i) => ({
      left: Math.random() * 100,
      delay: Math.random() * 3,
      dur: 2.5 + Math.random() * 2.5,
      color: ['#a855f7', '#eab308', '#3b82f6', '#ef4444', '#22c55e', '#f97316', '#ec4899', '#06b6d4', '#fbbf24', '#8b5cf6'][i % 10],
      size: 3 + Math.random() * 7,
      rect: Math.random() > 0.5,
    }))
  ).current;

  return (
    <div className="fixed inset-0 pointer-events-none z-[60] overflow-hidden">
      {pieces.map((p, i) => (
        <div key={i} className="absolute" style={{
          left: `${p.left}%`, top: '-5%',
          width: p.size, height: p.rect ? p.size * 2 : p.size,
          borderRadius: p.rect ? '2px' : '50%',
          backgroundColor: p.color,
          animation: `confetti-fall ${p.dur}s ${p.delay}s ease-out forwards`,
          opacity: 0,
        }} />
      ))}
    </div>
  );
}

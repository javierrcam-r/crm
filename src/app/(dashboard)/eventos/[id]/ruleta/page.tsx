'use client';

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import {
  ArrowLeft, Plus, Trash2, Trophy, Gift, Users, Dices, X,
  Settings, UserCheck, UsersRound, Crown, ChevronDown, Tag, LogOut,
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
  const { userProfile, logout } = useAuth();
  const eventId = params.id as string;
  const [showLogout, setShowLogout] = useState(false);

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
  const [selectedCategory, setSelectedCategory] = useState<string>('__all__');
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

  const categories = useMemo(() => {
    const cats = new Set<string>();
    participants.forEach(p => {
      if (p.categoria && p.categoria.toLowerCase() !== 'staff') cats.add(p.categoria);
    });
    return Array.from(cats).sort();
  }, [participants]);

  const eligible = useMemo(() => participants.filter(p => {
    if (p.categoria && p.categoria.toLowerCase() === 'staff') return false;
    if (eligibilityMode === 'asistentes' && !p.asistencia) return false;
    if (selectedCategory !== '__all__' && p.categoria !== selectedCategory) return false;
    return !winners.some(w => w.participant_id === p.id);
  }), [participants, eligibilityMode, selectedCategory, winners]);

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
    names.forEach((n, i) => {
      const el = document.createElement('div');
      el.className = 'roulette-name';
      if (i === names.length - 1) el.classList.add('roulette-name-winner');
      el.textContent = n;
      strip.appendChild(el);
    });

    const trackW = track.offsetWidth;
    const winnerIdx = names.length - 1;
    const totalDist = winnerIdx * ITEM_W - (trackW / 2 - ITEM_W / 2);

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
    }, SPIN_MS + 400);
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

  const currentPrizeName = prizes.find(p => p.id === selectedPrizeId)?.nombre || '';

  return (
    <div className="min-h-screen text-white relative overflow-hidden select-none bg-black">
      {/* Background image */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-40" style={{ backgroundImage: 'url(/samra_inv_persona.png)' }} />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(6,9,17,0.6) 0%, rgba(10,14,30,0.85) 50%, rgba(6,9,17,0.95) 100%)' }} />
      </div>
      {/* Ambient orbs */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[10%] w-[800px] h-[800px] bg-purple-600/[0.08] rounded-full blur-[200px] neon-pulse" />
        <div className="absolute bottom-[-10%] right-[5%] w-[700px] h-[700px] bg-fuchsia-500/[0.06] rounded-full blur-[180px]" />
        <div className="absolute top-[30%] right-[30%] w-[400px] h-[400px] bg-cyan-500/[0.04] rounded-full blur-[150px]" />
      </div>
      {/* Scan lines overlay */}
      <div className="fixed inset-0 pointer-events-none z-[1] opacity-[0.03]" style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.1) 2px, rgba(255,255,255,0.1) 4px)', backgroundSize: '100% 4px' }} />

      {/* Header bar */}
      <header className="relative z-10 mx-3 sm:mx-6 mt-3 rounded-2xl border border-white/[0.08] px-4 sm:px-6 py-3 flex items-center justify-between backdrop-blur-2xl"
        style={{ background: 'rgba(10,14,30,0.5)', boxShadow: '0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)' }}>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowLogout(v => !v)}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/[0.06] transition-colors">
            <ArrowLeft className="h-4 w-4 text-white/50" />
          </button>
          <Image src="/logo-disfero.png" alt="Disfero" width={36} height={36} className="rounded-lg" />
          <div>
            <p className="text-sm font-bold tracking-wide">{event.nombre}</p>
            <p className="text-[10px] text-white/30">{format(new Date(event.fecha_inicio), "d 'de' MMMM yyyy", { locale: es })}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-1.5">
            {[
              { label: 'elegibles', value: eligible.length, color: '#c084fc', glow: 'rgba(192,132,252,0.15)' },
              { label: 'premios', value: availablePrizes.reduce((s, p) => s + getPrizeRemaining(p), 0), color: '#fbbf24', glow: 'rgba(251,191,36,0.15)' },
              { label: 'ganadores', value: winners.length, color: '#34d399', glow: 'rgba(52,211,153,0.15)' },
            ].map(s => (
              <div key={s.label} className="px-3 py-1.5 rounded-lg border border-white/[0.06] text-[11px] text-white/40"
                style={{ background: s.glow }}>
                <span style={{ color: s.color }} className="font-bold">{s.value}</span> {s.label}
              </div>
            ))}
          </div>
          <button onClick={() => setShowPanel(true)}
            className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/[0.06] text-white/50 transition-colors">
            <Settings className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* Logout menu */}
      {showLogout && (
        <div className="fixed inset-0 z-50" onClick={() => setShowLogout(false)}>
          <div className="absolute top-[60px] left-3 sm:left-6 ml-1 rounded-xl border border-white/[0.1] backdrop-blur-2xl overflow-hidden min-w-[220px]"
            style={{ background: 'rgba(15,19,35,0.95)', boxShadow: '0 12px 40px rgba(0,0,0,0.6)' }}
            onClick={e => e.stopPropagation()}>
            <div className="px-4 py-3 border-b border-white/[0.06]">
              <p className="text-xs font-semibold text-white/70">{userProfile?.nombre_completo || 'Usuario'}</p>
              <p className="text-[10px] text-white/30">{userProfile?.email}</p>
            </div>
            <button onClick={logout}
              className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-red-400 hover:bg-red-500/10 transition-colors">
              <LogOut className="h-4 w-4" /> Cerrar sesión
            </button>
          </div>
        </div>
      )}

      {/* Center content */}
      <div className="relative z-10 flex flex-col items-center justify-center px-4" style={{ minHeight: 'calc(100vh - 80px)' }}>

        {/* Gabriel Samra signature */}
        <div className="mb-6">
          <Image src="/samra-letras.png" alt="Gabriel Samra" width={280} height={80} className="opacity-20 mx-auto" style={{ filter: 'brightness(2.5)' }} />
        </div>

        {/* Prize + Category selectors */}
        <div className="mb-8 flex flex-wrap items-end justify-center gap-3">
          {availablePrizes.length > 0 && (
            <div className="px-5 py-3 rounded-2xl border border-purple-500/20 backdrop-blur-2xl"
              style={{ background: 'rgba(168,85,247,0.06)', boxShadow: '0 4px 24px rgba(168,85,247,0.08)' }}>
              <p className="text-[9px] uppercase tracking-[0.3em] text-purple-300/40 mb-1.5">Sorteando</p>
              <div className="relative">
                <select value={selectedPrizeId} onChange={e => setSelectedPrizeId(e.target.value)} disabled={phase === 'spinning'}
                  className="appearance-none bg-transparent pr-7 text-lg font-black text-white cursor-pointer focus:outline-none w-full">
                  {availablePrizes.map(p => <option key={p.id} value={p.id} className="bg-[#0e1225]">{p.nombre} ({getPrizeRemaining(p)})</option>)}
                </select>
                <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 h-4 w-4 text-purple-400/50 pointer-events-none" />
              </div>
            </div>
          )}

          {categories.length > 1 && (
            <div className="px-5 py-3 rounded-2xl border border-cyan-500/15 backdrop-blur-2xl"
              style={{ background: 'rgba(6,182,212,0.04)', boxShadow: '0 4px 24px rgba(6,182,212,0.06)' }}>
              <p className="text-[9px] uppercase tracking-[0.3em] text-cyan-300/40 mb-1.5">Categoría</p>
              <div className="relative">
                <select value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)} disabled={phase === 'spinning'}
                  className="appearance-none bg-transparent pr-7 text-sm font-bold text-white cursor-pointer focus:outline-none w-full">
                  <option value="__all__" className="bg-[#0e1225]">Todas</option>
                  {categories.map(c => <option key={c} value={c} className="bg-[#0e1225]">{c}</option>)}
                </select>
                <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 h-4 w-4 text-cyan-400/50 pointer-events-none" />
              </div>
            </div>
          )}
        </div>

        {/* ===== SLOT MACHINE ===== */}
        <div className="w-full max-w-4xl mb-6">
          <div className="relative">

            {/* Top pointer */}
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-30">
              <div className="w-0 h-0" style={{ borderLeft: '14px solid transparent', borderRight: '14px solid transparent', borderTop: '14px solid #c084fc', filter: 'drop-shadow(0 0 8px rgba(192,132,252,0.6))' }} />
            </div>
            {/* Bottom pointer */}
            <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 z-30">
              <div className="w-0 h-0" style={{ borderLeft: '14px solid transparent', borderRight: '14px solid transparent', borderBottom: '14px solid #c084fc', filter: 'drop-shadow(0 0 8px rgba(192,132,252,0.6))' }} />
            </div>

            {/* Main container */}
            <div className="relative rounded-2xl overflow-hidden border border-purple-500/25 backdrop-blur-2xl"
              style={{ background: 'rgba(10,14,30,0.5)', boxShadow: `0 0 80px rgba(168,85,247,0.1), inset 0 1px 0 rgba(255,255,255,0.06), 0 0 0 1px rgba(168,85,247,0.05)` }}>

              {/* Animated top/bottom neon lines */}
              <div className="absolute top-0 left-0 right-0 h-[1px] z-20" style={{ background: 'linear-gradient(90deg, transparent, #c084fc, transparent)' }} />
              <div className="absolute bottom-0 left-0 right-0 h-[1px] z-20" style={{ background: 'linear-gradient(90deg, transparent, #c084fc, transparent)' }} />

              {/* Center highlight zone */}
              <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 z-20 pointer-events-none" style={{ width: ITEM_W }}>
                <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(192,132,252,0.08), rgba(168,85,247,0.12), rgba(192,132,252,0.08))' }} />
                <div className="absolute inset-y-0 left-0 w-[2px]" style={{ background: 'linear-gradient(to bottom, transparent 10%, #c084fc 50%, transparent 90%)', boxShadow: '0 0 24px rgba(192,132,252,0.6), 0 0 4px rgba(192,132,252,0.8)' }} />
                <div className="absolute inset-y-0 right-0 w-[2px]" style={{ background: 'linear-gradient(to bottom, transparent 10%, #c084fc 50%, transparent 90%)', boxShadow: '0 0 24px rgba(192,132,252,0.6), 0 0 4px rgba(192,132,252,0.8)' }} />
              </div>

              {/* Side fades */}
              <div className="absolute inset-y-0 left-0 w-36 z-10 pointer-events-none" style={{ background: 'linear-gradient(to right, rgba(8,12,22,0.98), transparent)' }} />
              <div className="absolute inset-y-0 right-0 w-36 z-10 pointer-events-none" style={{ background: 'linear-gradient(to left, rgba(8,12,22,0.98), transparent)' }} />

              {/* Track */}
              <div ref={trackRef} className="relative overflow-hidden" style={{ height: 110 }}>
                <div ref={stripRef} className="flex h-full items-center" />

                {/* Idle */}
                {phase === 'idle' && !pickedWinner && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center"
                    style={{ background: 'rgba(8,12,22,0.88)' }}>
                    <div className="flex items-center gap-3">
                      <Dices className="h-5 w-5 text-purple-500/40" />
                      <p className="text-white/30 text-sm tracking-wide font-medium">Presiona <span className="text-purple-400 font-bold">GIRAR</span> para sortear</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Spinning logo animation while slot runs */}
        {phase === 'spinning' && (
          <div className="mb-4 flex items-center justify-center">
            <div className="relative">
              <div className="logo-orbit">
                {[0, 1, 2, 3, 4, 5].map(i => (
                  <div key={i} className="logo-orbit-item" style={{ '--i': i, '--total': 6 } as React.CSSProperties}>
                    <Image src="/logo-disfero.png" alt="" width={28} height={28} className="rounded-md opacity-60" />
                  </div>
                ))}
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-10 h-10 rounded-full bg-purple-500/20 border border-purple-400/30 flex items-center justify-center"
                  style={{ boxShadow: '0 0 30px rgba(168,85,247,0.3)' }}>
                  <Dices className="h-5 w-5 text-purple-300 animate-spin" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Winner section — name centered, actions to the right */}
        {phase === 'winner' && pickedWinner && (
          <div className="w-full max-w-4xl mb-6 roulette-bounce">
            <div className="flex items-center gap-4 rounded-2xl border border-yellow-400/20 backdrop-blur-2xl px-6 sm:px-8 py-5"
              style={{ background: 'rgba(250,204,21,0.04)', boxShadow: '0 0 60px rgba(250,204,21,0.08), inset 0 1px 0 rgba(255,255,255,0.05)' }}>
              <Crown className="h-10 w-10 text-yellow-400 flex-shrink-0 hidden sm:block" style={{ filter: 'drop-shadow(0 0 16px rgba(250,204,21,0.5))' }} />
              <div className="flex-1 min-w-0 text-center sm:text-left">
                <p className="text-[10px] uppercase tracking-[0.25em] text-yellow-400/40 mb-1">Ganador</p>
                <p className="text-2xl sm:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-white to-yellow-300 truncate">
                  {pickedWinner.nombre}
                </p>
                {pickedWinner.categoria && (
                  <p className="text-xs text-white/25 mt-0.5">{pickedWinner.categoria} — {currentPrizeName}</p>
                )}
              </div>
              <div className="flex flex-col sm:flex-row gap-2 flex-shrink-0">
                <button onClick={confirmWinner}
                  className="px-6 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.97] border border-emerald-400/30"
                  style={{ background: 'linear-gradient(135deg, rgba(5,150,105,0.85), rgba(16,185,129,0.85))', boxShadow: '0 4px 24px rgba(16,185,129,0.3)' }}>
                  <Trophy className="h-4 w-4" /> Registrar
                </button>
                <button onClick={() => { setPickedWinner(null); setPhase('idle'); setShowConfetti(false); }}
                  className="px-5 py-3 rounded-xl border border-white/[0.08] text-white/40 text-sm font-medium transition-all hover:bg-white/[0.06]"
                  style={{ background: 'rgba(255,255,255,0.03)' }}>
                  Descartar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Spin button */}
        {phase !== 'winner' && (
          <div className="w-full max-w-sm">
            <button onClick={spin} disabled={!canSpin}
              className="w-full py-5 rounded-2xl font-black text-xl uppercase tracking-wider flex items-center justify-center gap-3 transition-all active:scale-[0.97] disabled:opacity-20 disabled:cursor-not-allowed border border-purple-400/25 relative overflow-hidden"
              style={{
                background: canSpin ? 'linear-gradient(135deg, rgba(147,51,234,0.85), rgba(192,38,211,0.85))' : 'rgba(255,255,255,0.03)',
                backdropFilter: 'blur(16px)',
                boxShadow: canSpin ? '0 4px 50px rgba(168,85,247,0.35), inset 0 1px 0 rgba(255,255,255,0.15)' : 'none',
              }}>
              {canSpin && <div className="absolute inset-0 shimmer-sweep" />}
              <Dices className={`h-6 w-6 relative z-10 ${phase !== 'idle' ? 'animate-spin' : ''}`} />
              <span className="relative z-10">{phase === 'idle' ? 'GIRAR' : 'Sorteando...'}</span>
            </button>
          </div>
        )}

        {prizes.length === 0 && (
          <p className="text-white/20 text-sm mt-8">
            Abre <button onClick={() => setShowPanel(true)} className="text-purple-400 underline underline-offset-2 hover:text-purple-300">configuración</button> para agregar premios
          </p>
        )}
      </div>

      {/* ===== SETTINGS PANEL ===== */}
      {showPanel && (
        <div className="fixed inset-0 z-50" onClick={() => setShowPanel(false)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-md" />
          <div className="absolute right-0 top-0 bottom-0 w-full max-w-md border-l border-white/[0.08] overflow-y-auto backdrop-blur-2xl"
            style={{ background: 'rgba(10,14,28,0.85)' }}
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

              {/* Category filter */}
              {categories.length > 1 && (
                <div>
                  <p className="text-[10px] text-white/25 uppercase tracking-wider mb-2">Filtrar por categoría</p>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => setSelectedCategory('__all__')}
                      className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${selectedCategory === '__all__' ? 'border-purple-500/40 bg-purple-500/15 text-white' : 'border-white/5 bg-white/[0.02] text-white/40 hover:bg-white/[0.04]'}`}>
                      Todas
                    </button>
                    {categories.map(c => (
                      <button key={c} onClick={() => setSelectedCategory(c)}
                        className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${selectedCategory === c ? 'border-purple-500/40 bg-purple-500/15 text-white' : 'border-white/5 bg-white/[0.02] text-white/40 hover:bg-white/[0.04]'}`}>
                        {c}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-white/15 mt-1.5">{eligible.length} elegibles con filtro actual</p>
                </div>
              )}

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
          width: ${ITEM_W}px;
          min-width: ${ITEM_W}px;
          max-width: ${ITEM_W}px;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.15rem;
          font-weight: 600;
          letter-spacing: 0.02em;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          padding: 0 12px;
          flex-shrink: 0;
          color: rgba(255,255,255,0.3);
          box-sizing: border-box;
          text-shadow: 0 0 8px rgba(255,255,255,0.05);
        }
        .roulette-name-winner {
          color: #fff;
          font-weight: 900;
          font-size: 1.3rem;
          text-shadow: 0 0 20px rgba(192,132,252,0.4);
        }
        @keyframes confetti-fall {
          0% { transform: translateY(-10vh) rotate(0); opacity: 1; }
          75% { opacity: 1; }
          100% { transform: translateY(105vh) rotate(720deg); opacity: 0; }
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
        .neon-pulse {
          animation: neon-breathe 4s ease-in-out infinite;
        }
        @keyframes neon-breathe {
          0%, 100% { opacity: 0.08; }
          50% { opacity: 0.14; }
        }
        .shimmer-sweep {
          background: linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.12) 50%, transparent 60%);
          animation: shimmer 2.5s ease-in-out infinite;
        }
        @keyframes shimmer {
          0% { transform: translateX(-200%); }
          100% { transform: translateX(200%); }
        }
        .logo-orbit {
          width: 120px;
          height: 120px;
          position: relative;
          animation: orbit-spin 3s linear infinite;
        }
        @keyframes orbit-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .logo-orbit-item {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: rotate(calc(var(--i) * 360deg / var(--total))) translateY(-50px) rotate(calc(var(--i) * -360deg / var(--total)));
          margin: -14px;
          animation: orbit-counter 3s linear infinite;
        }
        @keyframes orbit-counter {
          from { transform: rotate(calc(var(--i) * 360deg / var(--total))) translateY(-50px) rotate(calc(-1 * var(--i) * 360deg / var(--total))); }
          to { transform: rotate(calc(var(--i) * 360deg / var(--total) + 360deg)) translateY(-50px) rotate(calc(-1 * (var(--i) * 360deg / var(--total) + 360deg))); }
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

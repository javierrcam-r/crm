'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  CalendarCheck,
  Check,
  X,
  CheckCheck,
  XCircle,
  Loader2,
  Clock,
  MapPin,
  TrendingUp,
  AlertTriangle,
  Calendar,
  Info,
  Filter,
  Plus,
  Target,
} from 'lucide-react';
import { format, startOfWeek, addDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { createVisit } from '@/lib/services/visits';
import toast from 'react-hot-toast';

interface Recommendation {
  recommendationId?: string;
  customerId: string;
  customerName: string;
  customerAddress: string | null;
  customerZona: string | null;
  customerCiudad: string | null;
  date: string;
  dayOfWeek: number;
  dayName: string;
  time: string;
  objetivo?: string;
  reason: string;
  reasons: string[];
  scoreTotal?: number;
  scoreBreakdown?: Record<string, number>;
  features?: Record<string, unknown>;
}

interface PatternInfo {
  customerName: string;
  avgDays: number;
  preferredDay: string;
  dayConfidence: number;
  visitCount: number;
  daysSinceLastVisit: number;
}

interface RecomendCalendModalProps {
  isOpen: boolean;
  onClose: () => void;
  onVisitsCreated: () => void;
  userId: string;
  currentDate: Date;
}

type CellStatus = 'pending' | 'accepted' | 'rejected' | 'creating' | 'created' | 'error';

interface RecommendationCell extends Recommendation {
  status: CellStatus;
  error?: string;
}

export default function RecomendCalendModal({
  isOpen,
  onClose,
  onVisitsCreated,
  userId,
  currentDate,
}: RecomendCalendModalProps) {
  const [loading, setLoading] = useState(false);
  const [recommendations, setRecommendations] = useState<RecommendationCell[]>([]);
  const [patterns, setPatterns] = useState<PatternInfo[]>([]);
  const [stats, setStats] = useState<{
    totalClientsAnalyzed: number;
    totalRecommendations: number;
    feedbackSamples: number;
    feedbackAccepted: number;
    feedbackRejected: number;
    feedbackCompleted: number;
    feedbackNegativeOutcome: number;
  } | null>(null);
  const [generated, setGenerated] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showPatterns, setShowPatterns] = useState(false);
  const [instructionInput, setInstructionInput] = useState('');
  const [instructionTags, setInstructionTags] = useState<string[]>([]);
  const [maxPerDay, setMaxPerDay] = useState(8);
  const instructionExamples = [
    'El martes me voy a Azogues',
    'Los viernes a las 12 voy al banco',
    'El jueves priorizar zona norte',
  ];

  const weekStart = startOfWeek(currentDate, { locale: es });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const addInstructionTag = useCallback((value: string) => {
    const next = value.trim().replace(/\s+/g, ' ');
    if (!next) return;

    setInstructionTags(prev => {
      const exists = prev.some(tag => tag.toLowerCase() === next.toLowerCase());
      return exists ? prev : [...prev, next];
    });
    setInstructionInput('');
  }, []);

  const removeInstructionTag = (tagToRemove: string) => {
    setInstructionTags(prev => prev.filter(tag => tag !== tagToRemove));
  };

  const generateRecommendations = useCallback(async () => {
    setLoading(true);
    try {
      const instructions = instructionTags.join('\n');
      const res = await fetch('/api/recomend-calend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          weekStartDate: weekStart.toISOString(),
          filters: {
            instructions: instructions || undefined,
            maxPerDay,
          },
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Error generando recomendaciones');
      }

      const data = await res.json();
      const cells: RecommendationCell[] = (data.recommendations || []).map((r: Recommendation) => ({
        ...r,
        status: 'pending' as CellStatus,
      }));

      setRecommendations(cells);
      setPatterns(data.patterns || []);
      setStats({
        totalClientsAnalyzed: data.totalClientsAnalyzed || 0,
        totalRecommendations: data.totalRecommendations || 0,
        feedbackSamples: data.feedbackStats?.samples || 0,
        feedbackAccepted: data.feedbackStats?.accepted || 0,
        feedbackRejected: data.feedbackStats?.rejected || 0,
        feedbackCompleted: data.feedbackStats?.completed || 0,
        feedbackNegativeOutcome: data.feedbackStats?.negativeOutcome || 0,
      });
      setGenerated(true);

      if (cells.length === 0) {
        toast('No se encontraron recomendaciones para esta semana. Puede que no haya suficiente historial disponible.', { icon: '📊' });
      }
    } catch (err: any) {
      toast.error(err.message || 'Error generando recomendaciones');
    } finally {
      setLoading(false);
    }
  }, [userId, weekStart, instructionTags, maxPerDay]);

  const updateCellStatus = (index: number, status: CellStatus, error?: string) => {
    setRecommendations(prev =>
      prev.map((r, i) => (i === index ? { ...r, status, error } : r))
    );
  };

  const updateObjetivo = (index: number, objetivo: string) => {
    setRecommendations(prev =>
      prev.map((r, i) => (i === index ? { ...r, objetivo } : r))
    );
  };

  const sendRecommendationFeedback = async (
    rec: RecommendationCell,
    status: 'accepted' | 'rejected' | 'created',
    visitId?: string
  ) => {
    if (!rec.recommendationId) return;

    try {
      await fetch('/api/recomend-calend/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recommendationId: rec.recommendationId,
          status,
          visitId,
        }),
      });
    } catch (err) {
      console.error('Error guardando feedback de recomendación:', err);
    }
  };

  const acceptRecommendation = async (index: number) => {
    const rec = recommendations[index];
    if (rec.status !== 'pending') return;

    updateCellStatus(index, 'creating');
    try {
      await sendRecommendationFeedback(rec, 'accepted');
      const scheduledAt = `${rec.date}T${rec.time}:00`;
      const objetivoFinal = (rec.objetivo && rec.objetivo.trim())
        ? rec.objetivo.trim()
        : `Visita recomendada - ${rec.reason}`;
      const visit = await createVisit({
        customer_id: rec.customerId,
        scheduled_at: new Date(scheduledAt).toISOString(),
        status: 'programada',
        objetivo: objetivoFinal,
      });
      await sendRecommendationFeedback(rec, 'created', visit.id);
      updateCellStatus(index, 'created');
      toast.success(`Visita a ${rec.customerName} programada`);
    } catch (err: any) {
      updateCellStatus(index, 'error', err.message);
      toast.error(`Error al crear visita: ${err.message}`);
    }
  };

  const rejectRecommendation = (index: number) => {
    const rec = recommendations[index];
    if (rec.status !== 'pending') return;
    updateCellStatus(index, 'rejected');
    sendRecommendationFeedback(rec, 'rejected');
  };

  const acceptAll = async () => {
    setSaving(true);
    const pendingIndices = recommendations
      .map((r, i) => (r.status === 'pending' ? i : -1))
      .filter(i => i >= 0);

    for (const idx of pendingIndices) {
      await acceptRecommendation(idx);
    }
    setSaving(false);
    const created = recommendations.filter(r => r.status === 'created' || r.status === 'creating').length + pendingIndices.length;
    if (created > 0) onVisitsCreated();
  };

  const rejectAll = () => {
    const pending = recommendations.filter(r => r.status === 'pending');
    setRecommendations(prev =>
      prev.map(r => (r.status === 'pending' ? { ...r, status: 'rejected' as CellStatus } : r))
    );
    pending.forEach(rec => sendRecommendationFeedback(rec, 'rejected'));
    toast('Todas las recomendaciones rechazadas', { icon: '❌' });
  };

  const handleClose = () => {
    const anyCreated = recommendations.some(r => r.status === 'created');
    if (anyCreated) onVisitsCreated();
    setRecommendations([]);
    setPatterns([]);
    setStats(null);
    setGenerated(false);
    setShowPatterns(false);
    onClose();
  };

  const handleRegenerate = () => {
    setGenerated(false);
    setRecommendations([]);
    setPatterns([]);
    setStats(null);
  };

  const getRecommendationsForDay = (dateStr: string) =>
    recommendations.filter(r => r.date === dateStr);

  const pendingCount = recommendations.filter(r => r.status === 'pending').length;
  const acceptedCount = recommendations.filter(r => r.status === 'created').length;
  const rejectedCount = recommendations.filter(r => r.status === 'rejected').length;

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center sm:p-4"
      onClick={(e) => e.target === e.currentTarget && handleClose()}
    >
      <div className="bg-white dark:bg-dark-700 w-full max-w-5xl flex flex-col rounded-t-2xl sm:rounded-2xl shadow-2xl border-0 sm:border border-gray-200/50 dark:border-dark-500 max-h-[95vh] sm:max-h-[90vh] transform transition-all">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-100 dark:border-dark-500 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl">
              <CalendarCheck className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-base sm:text-xl font-semibold text-gray-900 dark:text-white">
                RecomendCalend
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Semana del {format(weekStart, "d 'de' MMMM", { locale: es })} al{' '}
                {format(addDays(weekStart, 6), "d 'de' MMMM", { locale: es })}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-dark-600 transition-colors"
          >
            <X className="h-5 w-5 text-gray-400 hover:text-gray-600 dark:hover:text-white" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-4 sm:p-6">
          {!generated ? (
            <div className="flex flex-col items-center justify-center py-6 sm:py-10 space-y-6">
              <div className="p-5 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-2xl">
                <TrendingUp className="h-12 w-12 text-emerald-500" />
              </div>
              <div className="text-center max-w-md">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Recomendaciones Inteligentes
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Analiza el historial de visitas para recomendar a quién visitar esta semana.
                </p>
              </div>

              {/* Filters */}
              <div className="w-full max-w-lg space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                  <Filter className="h-4 w-4" />
                  Instrucciones para esta semana
                </div>

                <div>
                  <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Máx. visitas por día</label>
                  <input
                    type="number"
                    min={1}
                    max={15}
                    value={maxPerDay}
                    onChange={(e) => setMaxPerDay(Math.max(1, Math.min(15, Number(e.target.value) || 8)))}
                    className="w-24 px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-dark-500 bg-white dark:bg-dark-600 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">
                    Instrucciones adicionales
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={instructionInput}
                      onChange={(e) => setInstructionInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addInstructionTag(instructionInput);
                        }
                      }}
                      placeholder="Ej: El martes me voy a Azogues"
                      className="flex-1 px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-dark-500 bg-white dark:bg-dark-600 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    />
                    <button
                      type="button"
                      onClick={() => addInstructionTag(instructionInput)}
                      className="inline-flex items-center justify-center w-10 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 active:bg-emerald-700 transition-colors"
                      aria-label="Agregar instrucción"
                    >
                      <Plus className="h-5 w-5" />
                    </button>
                  </div>
                  <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">
                    Agrega una instrucción por tag. Entiende ciudades, sectores y bloqueos de hora.
                  </p>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {instructionTags.map(tag => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => removeInstructionTag(tag)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-100 dark:bg-dark-600 text-gray-700 dark:text-gray-300 text-[11px] hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-300 transition-colors"
                        title="Quitar instrucción"
                      >
                        {tag}
                        <X className="h-3 w-3" />
                      </button>
                    ))}
                    {instructionExamples.map(example => (
                      <button
                        key={example}
                        type="button"
                        onClick={() => addInstructionTag(example)}
                        className="px-2 py-1 rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 text-[11px] hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors"
                      >
                        + {example}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <button
                onClick={generateRecommendations}
                disabled={loading}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-medium hover:from-emerald-600 hover:to-teal-700 transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Analizando historial...
                  </>
                ) : (
                  <>
                    <CalendarCheck className="h-5 w-5" />
                    Generar Recomendaciones
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Stats bar */}
              {stats && (
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="px-3 py-1 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 rounded-lg font-medium">
                    {stats.totalClientsAnalyzed} analizados
                  </span>
                  <span className="px-3 py-1 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 rounded-lg font-medium">
                    {stats.totalRecommendations} recomendaciones
                  </span>
                  {stats.feedbackSamples > 0 && (
                    <span className="px-3 py-1 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 rounded-lg font-medium">
                      Aprende de {stats.feedbackSamples} feedbacks
                    </span>
                  )}
                  {pendingCount > 0 && (
                    <span className="px-3 py-1 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 rounded-lg">
                      {pendingCount} pendientes
                    </span>
                  )}
                  {acceptedCount > 0 && (
                    <span className="px-3 py-1 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 rounded-lg">
                      {acceptedCount} aceptadas
                    </span>
                  )}
                  {rejectedCount > 0 && (
                    <span className="px-3 py-1 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-lg">
                      {rejectedCount} rechazadas
                    </span>
                  )}
                </div>
              )}

              {/* Action buttons row */}
              <div className="flex flex-wrap items-center gap-2">
                {pendingCount > 0 && (
                  <>
                    <button
                      onClick={acceptAll}
                      disabled={saving}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600 transition-all disabled:opacity-50 shadow-sm"
                    >
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCheck className="h-4 w-4" />}
                      Aceptar Todas ({pendingCount})
                    </button>
                    <button
                      onClick={rejectAll}
                      disabled={saving}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition-all disabled:opacity-50 shadow-sm"
                    >
                      <XCircle className="h-4 w-4" />
                      Rechazar Todas ({pendingCount})
                    </button>
                  </>
                )}
                <button
                  onClick={handleRegenerate}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 dark:border-dark-500 text-gray-600 dark:text-gray-300 text-sm hover:bg-gray-50 dark:hover:bg-dark-600 transition-all ml-auto"
                >
                  <Filter className="h-4 w-4" />
                  Cambiar instrucciones
                </button>
                <button
                  onClick={() => setShowPatterns(!showPatterns)}
                  className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 underline"
                >
                  {showPatterns ? 'Ocultar patrones' : 'Ver patrones'}
                </button>
              </div>

              {/* Active filters display */}
              {instructionTags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 text-xs">
                  {instructionTags.map(tag => (
                    <span
                      key={tag}
                      className="px-2 py-1 bg-gray-100 dark:bg-dark-600 text-gray-600 dark:text-gray-400 rounded-md truncate max-w-xs"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Patterns panel */}
              {showPatterns && patterns.length > 0 && (
                <div className="bg-gray-50 dark:bg-dark-600 rounded-xl p-4 border border-gray-200 dark:border-dark-500">
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">
                    Patrones Detectados
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {patterns.map((p, i) => (
                      <div
                        key={i}
                        className="text-xs bg-white dark:bg-dark-700 rounded-lg p-2.5 border border-gray-100 dark:border-dark-500"
                      >
                        <p className="font-medium text-gray-800 dark:text-white truncate">{p.customerName}</p>
                        <p className="text-gray-500 dark:text-gray-400 mt-1">
                          Cada ~{p.avgDays} días · {p.preferredDay}
                          {p.dayConfidence > 40 && ` (${p.dayConfidence}% conf.)`}
                        </p>
                        <p className="text-gray-400 dark:text-gray-500">
                          {p.visitCount} visitas · Hace {p.daysSinceLastVisit} días
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Weekly grid */}
              {recommendations.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
                  {weekDays.map((day) => {
                    const dateStr = format(day, 'yyyy-MM-dd');
                    const dayRecs = getRecommendationsForDay(dateStr);
                    const dow = day.getDay();
                    if (dow === 0 || dow === 6) return null;

                    return (
                      <div
                        key={dateStr}
                        className="border border-gray-200 dark:border-dark-500 rounded-xl overflow-hidden"
                      >
                        <div className="bg-gray-50 dark:bg-dark-600 px-3 py-2 border-b border-gray-200 dark:border-dark-500">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold text-gray-700 dark:text-gray-200 capitalize">
                              {format(day, 'EEEE', { locale: es })}
                            </span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {format(day, 'd MMM', { locale: es })}
                            </span>
                          </div>
                          {dayRecs.length > 0 && (
                            <span className="text-[10px] text-gray-400 dark:text-gray-500">
                              {dayRecs.length} visita{dayRecs.length > 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                        <div className="p-2 space-y-2 min-h-[60px]">
                          {dayRecs.length === 0 ? (
                            <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-3">
                              Sin recomendaciones
                            </p>
                          ) : (
                            dayRecs.map((rec) => {
                              const globalIdx = recommendations.indexOf(rec);
                              return (
                                <RecommendationCard
                                  key={globalIdx}
                                  rec={rec}
                                  onAccept={() => acceptRecommendation(globalIdx)}
                                  onReject={() => rejectRecommendation(globalIdx)}
                                  onObjetivoChange={(value) => updateObjetivo(globalIdx, value)}
                                />
                              );
                            })
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center py-12 text-gray-400 dark:text-gray-500">
                  <Calendar className="h-12 w-12 mb-3" />
                  <p className="text-sm">No hay recomendaciones para esta semana</p>
                  <p className="text-xs mt-1">Revisa el historial de visitas o ajusta las instrucciones</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoTooltip({
  reasons,
  scoreTotal,
  scoreBreakdown,
}: {
  reasons: string[];
  scoreTotal?: number;
  scoreBreakdown?: Record<string, number>;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative inline-flex flex-shrink-0">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        className="p-2 -m-1 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-500 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-800/40 active:bg-indigo-200 transition-colors"
        aria-label="¿Por qué esta recomendación?"
      >
        <Info className="h-5 w-5" />
      </button>
      {open && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 z-50 w-72 sm:w-80 animate-in fade-in-0 zoom-in-95">
          <div className="bg-gray-900 dark:bg-dark-800 text-white text-xs rounded-xl px-4 py-3.5 shadow-xl border border-gray-700 dark:border-dark-500">
            <p className="font-semibold text-emerald-400 mb-2.5 flex items-center gap-1.5 text-sm">
              <TrendingUp className="h-4 w-4" />
              ¿Por qué aquí?
            </p>
            <ul className="space-y-2">
              {reasons.map((r, i) => (
                <li key={i} className="text-gray-200 leading-relaxed text-[13px]">
                  {r}
                </li>
              ))}
            </ul>
            {scoreBreakdown && (
              <div className="mt-3 pt-3 border-t border-gray-700 dark:border-dark-500">
                {typeof scoreTotal === 'number' && (
                  <p className="font-semibold text-indigo-300 mb-1">Score: {scoreTotal.toFixed(1)}</p>
                )}
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-gray-300">
                  {Object.entries(scoreBreakdown)
                    .filter(([, value]) => Math.abs(value) > 0)
                    .slice(0, 10)
                    .map(([key, value]) => (
                      <span key={key} className="flex justify-between gap-2">
                        <span className="truncate">{key}</span>
                        <span className={value >= 0 ? 'text-emerald-300' : 'text-red-300'}>
                          {value >= 0 ? '+' : ''}{value.toFixed(1)}
                        </span>
                      </span>
                    ))}
                </div>
              </div>
            )}
          </div>
          <div className="flex justify-center">
            <div className="w-3 h-3 bg-gray-900 dark:bg-dark-800 rotate-45 -mt-1.5 border-r border-b border-gray-700 dark:border-dark-500" />
          </div>
        </div>
      )}
    </div>
  );
}

function RecommendationCard({
  rec,
  onAccept,
  onReject,
  onObjetivoChange,
}: {
  rec: RecommendationCell;
  onAccept: () => void;
  onReject: () => void;
  onObjetivoChange: (value: string) => void;
}) {
  const [editingObjetivo, setEditingObjetivo] = useState(false);
  const statusStyles: Record<CellStatus, string> = {
    pending: 'bg-white dark:bg-dark-800 border-gray-200 dark:border-dark-500',
    accepted: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800',
    rejected: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 opacity-60',
    creating: 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800',
    created: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-300 dark:border-emerald-700',
    error: 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700',
  };

  return (
    <div className={`rounded-xl border p-3 transition-all ${statusStyles[rec.status]}`}>
      {/* Row 1: Name + Info button */}
      <div className="flex items-center gap-2 mb-1.5">
        <p className="text-sm font-semibold text-gray-900 dark:text-white truncate flex-1">
          {rec.customerName}
        </p>
        <InfoTooltip
          reasons={rec.reasons?.length ? rec.reasons : [rec.reason]}
          scoreTotal={rec.scoreTotal}
          scoreBreakdown={rec.scoreBreakdown}
        />
      </div>

      {/* Row 2: Reason (clearly visible) */}
      <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg px-2.5 py-1.5 mb-2">
        <p className="text-xs text-indigo-700 dark:text-indigo-300 font-medium leading-relaxed">
          {rec.reason}
        </p>
      </div>

      {/* Row 3: Time + Address */}
      <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mb-2">
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {rec.time}
        </span>
        {rec.customerAddress && (
          <span className="flex items-center gap-1 truncate">
            <MapPin className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">{rec.customerAddress}</span>
          </span>
        )}
      </div>

      {/* Objetivo recomendado (editable) */}
      <div className="mb-2">
        <div className="flex items-center gap-1 mb-1 text-[11px] font-medium text-gray-500 dark:text-gray-400">
          <Target className="h-3 w-3" />
          Objetivo
        </div>
        {rec.status === 'pending' || rec.status === 'error' ? (
          editingObjetivo ? (
            <textarea
              autoFocus
              value={rec.objetivo || ''}
              onChange={(e) => onObjetivoChange(e.target.value)}
              onBlur={() => setEditingObjetivo(false)}
              rows={2}
              className="w-full px-2 py-1.5 text-xs rounded-lg border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-dark-800 text-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
              placeholder="Objetivo de la visita"
            />
          ) : (
            <button
              type="button"
              onClick={() => setEditingObjetivo(true)}
              className="w-full text-left px-2 py-1.5 text-xs rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-200 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors flex items-start justify-between gap-1.5"
              title="Editar objetivo"
            >
              <span className="leading-snug">{rec.objetivo || 'Definir objetivo'}</span>
              <span className="text-[10px] text-emerald-500 dark:text-emerald-400 flex-shrink-0 mt-0.5 underline">editar</span>
            </button>
          )
        ) : (
          <p className="px-2 py-1.5 text-xs rounded-lg bg-gray-50 dark:bg-dark-800 text-gray-600 dark:text-gray-300 leading-snug">
            {rec.objetivo || '—'}
          </p>
        )}
      </div>

      {/* Row 4: Action buttons */}
      {rec.status === 'pending' && (
        <div className="flex items-center gap-2">
          <button
            onClick={onAccept}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-emerald-500 text-white text-xs font-medium hover:bg-emerald-600 active:bg-emerald-700 transition-colors"
          >
            <Check className="h-4 w-4" />
            Aceptar
          </button>
          <button
            onClick={onReject}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs font-medium hover:bg-red-200 dark:hover:bg-red-800/40 active:bg-red-300 transition-colors"
          >
            <X className="h-4 w-4" />
            Rechazar
          </button>
        </div>
      )}

      {rec.status === 'creating' && (
        <div className="flex items-center justify-center gap-2 py-2 text-xs text-indigo-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Creando...
        </div>
      )}

      {rec.status === 'created' && (
        <div className="flex items-center justify-center gap-1.5 py-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
          <Check className="h-4 w-4" />
          Visita creada
        </div>
      )}

      {rec.status === 'rejected' && (
        <div className="flex items-center justify-center gap-1.5 py-1.5 text-xs text-red-500 font-medium">
          <X className="h-4 w-4" />
          Rechazada
        </div>
      )}

      {rec.status === 'error' && (
        <div className="flex items-center justify-center gap-1.5 py-1.5 text-xs text-red-500" title={rec.error}>
          <AlertTriangle className="h-4 w-4" />
          Error al crear
        </div>
      )}
    </div>
  );
}

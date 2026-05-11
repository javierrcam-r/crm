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
} from 'lucide-react';
import { format, startOfWeek, addDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { createVisit } from '@/lib/services/visits';
import toast from 'react-hot-toast';

interface Recommendation {
  customerId: string;
  customerName: string;
  customerAddress: string | null;
  date: string;
  dayOfWeek: number;
  dayName: string;
  time: string;
  reason: string;
  reasons: string[];
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
  const [stats, setStats] = useState<{ totalClientsAnalyzed: number; totalRecommendations: number } | null>(null);
  const [generated, setGenerated] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showPatterns, setShowPatterns] = useState(false);

  const weekStart = startOfWeek(currentDate, { locale: es });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const generateRecommendations = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/recomend-calend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          weekStartDate: weekStart.toISOString(),
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
      });
      setGenerated(true);

      if (cells.length === 0) {
        toast('No se encontraron recomendaciones para esta semana. Puede que no haya suficiente historial de visitas.', { icon: '📊' });
      }
    } catch (err: any) {
      toast.error(err.message || 'Error generando recomendaciones');
    } finally {
      setLoading(false);
    }
  }, [userId, weekStart]);

  const updateCellStatus = (index: number, status: CellStatus, error?: string) => {
    setRecommendations(prev =>
      prev.map((r, i) => (i === index ? { ...r, status, error } : r))
    );
  };

  const acceptRecommendation = async (index: number) => {
    const rec = recommendations[index];
    if (rec.status !== 'pending') return;

    updateCellStatus(index, 'creating');
    try {
      const scheduledAt = `${rec.date}T${rec.time}:00`;
      await createVisit({
        customer_id: rec.customerId,
        scheduled_at: new Date(scheduledAt).toISOString(),
        status: 'programada',
        objetivo: `Visita recomendada - ${rec.reason}`,
      });
      updateCellStatus(index, 'created');
      toast.success(`Visita a ${rec.customerName} programada`);
    } catch (err: any) {
      updateCellStatus(index, 'error', err.message);
      toast.error(`Error al crear visita: ${err.message}`);
    }
  };

  const rejectRecommendation = (index: number) => {
    if (recommendations[index].status !== 'pending') return;
    updateCellStatus(index, 'rejected');
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
    setRecommendations(prev =>
      prev.map(r => (r.status === 'pending' ? { ...r, status: 'rejected' as CellStatus } : r))
    );
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
            <div className="flex flex-col items-center justify-center py-12 space-y-6">
              <div className="p-6 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-2xl">
                <TrendingUp className="h-16 w-16 text-emerald-500" />
              </div>
              <div className="text-center max-w-md">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Recomendaciones Inteligentes
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Analiza el historial de visitas de tus clientes para identificar patrones 
                  (frecuencia, día preferido, hora habitual) y recomendar visitas para esta semana.
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                  Solo se consideran clientes que ya tienen al menos una visita registrada.
                </p>
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
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <span className="px-3 py-1 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 rounded-lg font-medium">
                    {stats.totalClientsAnalyzed} clientes analizados
                  </span>
                  <span className="px-3 py-1 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 rounded-lg font-medium">
                    {stats.totalRecommendations} recomendaciones
                  </span>
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

                  <button
                    onClick={() => setShowPatterns(!showPatterns)}
                    className="ml-auto text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 underline"
                  >
                    {showPatterns ? 'Ocultar patrones' : 'Ver patrones detectados'}
                  </button>
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

              {/* Accept All / Reject All buttons */}
              {pendingCount > 0 && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={acceptAll}
                    disabled={saving}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600 transition-all disabled:opacity-50 shadow-sm"
                  >
                    {saving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCheck className="h-4 w-4" />
                    )}
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
                </div>
              )}

              {/* Weekly grid */}
              {recommendations.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {weekDays.map((day) => {
                    const dateStr = format(day, 'yyyy-MM-dd');
                    const dayRecs = getRecommendationsForDay(dateStr);
                    const dow = day.getDay();
                    if (dow === 0) return null;

                    return (
                      <div
                        key={dateStr}
                        className="border border-gray-200 dark:border-dark-500 rounded-xl overflow-hidden"
                      >
                        <div className="bg-gray-50 dark:bg-dark-600 px-3 py-2 border-b border-gray-200 dark:border-dark-500">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                              {format(day, 'EEEE', { locale: es })}
                            </span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {format(day, 'd MMM', { locale: es })}
                            </span>
                          </div>
                          {dayRecs.length > 0 && (
                            <span className="text-[10px] text-gray-400 dark:text-gray-500">
                              {dayRecs.length} visita{dayRecs.length > 1 ? 's' : ''} recomendada{dayRecs.length > 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                        <div className="p-2 space-y-2 min-h-[80px]">
                          {dayRecs.length === 0 ? (
                            <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-4">
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
                  <p className="text-xs mt-1">Asegúrate de tener historial de visitas con tus clientes</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoTooltip({ reasons }: { reasons: string[] }) {
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
    <div ref={ref} className="relative inline-flex">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        className="p-0.5 rounded-full text-indigo-400 hover:text-indigo-600 dark:text-indigo-400 dark:hover:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors"
        aria-label="¿Por qué esta recomendación?"
      >
        <Info className="h-3.5 w-3.5" />
      </button>
      {open && (
        <div className="absolute bottom-full left-0 mb-2 z-50 w-64 sm:w-72 animate-in fade-in-0 zoom-in-95">
          <div className="bg-gray-900 dark:bg-dark-800 text-white text-xs rounded-xl px-3 py-3 shadow-xl border border-gray-700 dark:border-dark-500">
            <p className="font-semibold text-emerald-400 mb-2 flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5" />
              ¿Por qué aquí?
            </p>
            <ul className="space-y-1.5">
              {reasons.map((r, i) => (
                <li key={i} className="text-gray-200 leading-relaxed">
                  {r}
                </li>
              ))}
            </ul>
          </div>
          <div className="ml-4">
            <div className="w-2.5 h-2.5 bg-gray-900 dark:bg-dark-800 rotate-45 -mt-1.5 border-r border-b border-gray-700 dark:border-dark-500" />
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
}: {
  rec: RecommendationCell;
  onAccept: () => void;
  onReject: () => void;
}) {
  const statusStyles: Record<CellStatus, string> = {
    pending: 'bg-white dark:bg-dark-800 border-gray-200 dark:border-dark-500',
    accepted: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800',
    rejected: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 opacity-60',
    creating: 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800',
    created: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-300 dark:border-emerald-700',
    error: 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700',
  };

  return (
    <div
      className={`rounded-lg border p-2.5 transition-all ${statusStyles[rec.status]}`}
    >
      <div className="flex items-start justify-between gap-1">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
              {rec.customerName}
            </p>
            <InfoTooltip reasons={rec.reasons?.length ? rec.reasons : [rec.reason]} />
          </div>
          <div className="flex items-center gap-1 mt-0.5">
            <Clock className="h-3 w-3 text-gray-400 flex-shrink-0" />
            <span className="text-xs text-gray-500 dark:text-gray-400">{rec.time}</span>
          </div>
          {rec.customerAddress && (
            <div className="flex items-center gap-1 mt-0.5">
              <MapPin className="h-3 w-3 text-gray-400 flex-shrink-0" />
              <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {rec.customerAddress}
              </span>
            </div>
          )}
          <p className="text-[10px] text-indigo-500 dark:text-indigo-400 mt-1 font-medium truncate">
            {rec.reason}
          </p>
        </div>

        {rec.status === 'pending' && (
          <div className="flex flex-col gap-1 flex-shrink-0">
            <button
              onClick={onAccept}
              className="p-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-800/40 transition-colors"
              title="Aceptar"
            >
              <Check className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={onReject}
              className="p-1.5 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-800/40 transition-colors"
              title="Rechazar"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {rec.status === 'creating' && (
          <Loader2 className="h-4 w-4 text-indigo-500 animate-spin flex-shrink-0" />
        )}

        {rec.status === 'created' && (
          <div className="flex items-center gap-1 flex-shrink-0">
            <Check className="h-4 w-4 text-emerald-500" />
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">Creada</span>
          </div>
        )}

        {rec.status === 'rejected' && (
          <div className="flex items-center gap-1 flex-shrink-0">
            <X className="h-4 w-4 text-red-400" />
            <span className="text-[10px] text-red-500 font-medium">Rechazada</span>
          </div>
        )}

        {rec.status === 'error' && (
          <div className="flex items-center gap-1 flex-shrink-0" title={rec.error}>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </div>
        )}
      </div>
    </div>
  );
}

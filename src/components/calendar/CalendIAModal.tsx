'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Sparkles, Send, Mic, MicOff, Check, X, Clock, MapPin, Target, User, Calendar, AlertTriangle, Loader2, Pencil, Wand2, Plus, ClipboardList, Users } from 'lucide-react';
import { format } from 'date-fns';
import { getCustomers } from '@/lib/services/customers';
import { createVisit } from '@/lib/services/visits';
import { createActivity } from '@/lib/services/activities';
import { isDateBlocked } from '@/lib/services/blockedDays';
import type { Customer, VisitInsert, ActivityInsert } from '@/types/database';
import toast from 'react-hot-toast';

type ItemKind = 'visita' | 'actividad';

interface ParsedItem {
  type: ItemKind;
  customerName: string;
  title: string;
  date: string;
  time: string;
  objetivo: string;
  location: string;
}

interface CalendIAResponse {
  items?: ParsedItem[];
  visits?: any[]; // legacy
  message: string;
  ambiguous: boolean;
  ambiguousMessage: string;
}

interface MatchedItem extends ParsedItem {
  customer?: Customer;
  matchConfidence: 'high' | 'low' | 'none';
  creating?: boolean;
  created?: boolean;
  error?: string;
}

interface CalendIAModalProps {
  isOpen: boolean;
  onClose: () => void;
  onVisitCreated: () => void;
}

interface SpeechRecognitionEvent {
  results: { [index: number]: { [index: number]: { transcript: string } } };
  resultIndex: number;
}

interface SpeechRecognitionInstance {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

function getSpeechRecognition(): (new () => SpeechRecognitionInstance) | null {
  if (typeof window === 'undefined') return null;
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
}

function normalizeText(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s]/g, '').trim();
}

function matchCustomer(name: string, customers: Customer[]): { customer: Customer | undefined; confidence: 'high' | 'low' | 'none' } {
  if (!name || !customers.length) return { customer: undefined, confidence: 'none' };

  const norm = normalizeText(name);
  const normTokens = norm.split(/\s+/);

  const exact = customers.find(c => normalizeText(c.nombre) === norm);
  if (exact) return { customer: exact, confidence: 'high' };

  const containsAll = customers.find(c => {
    const cn = normalizeText(c.nombre);
    return normTokens.every(t => cn.includes(t));
  });
  if (containsAll) return { customer: containsAll, confidence: 'high' };

  let bestMatch: Customer | undefined;
  let bestScore = 0;
  for (const c of customers) {
    const cn = normalizeText(c.nombre);
    const cnTokens = cn.split(/\s+/);
    let matchCount = 0;
    for (const t of normTokens) {
      if (t.length < 3) continue;
      if (cnTokens.some(ct => ct.includes(t) || t.includes(ct))) matchCount++;
    }
    const score = matchCount / Math.max(normTokens.filter(t => t.length >= 3).length, 1);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = c;
    }
  }

  if (bestScore >= 0.5 && bestMatch) {
    return { customer: bestMatch, confidence: bestScore >= 0.8 ? 'high' : 'low' };
  }

  return { customer: undefined, confidence: 'none' };
}

const EXAMPLES = [
  'Programa una visita con Ana Gordillo mañana a las 10 para seguimiento',
  'Agrega actividad diaria: revisar reportes el lunes a las 8am',
  'Mañana: visita a Catalina a las 9 y reunión interna de equipo a las 3pm',
];

const REFINE_EXAMPLES = [
  'Cambia la hora a las 3pm',
  'Conviértela en actividad diaria',
  'Agrega reunión de equipo mañana a las 4pm',
];

function CustomerPicker({ customers, onChange, onClose }: { customers: Customer[]; onChange: (c: Customer) => void; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);

  const filtered = useMemo(() => {
    if (!query.trim()) return customers.slice(0, 30);
    const q = normalizeText(query);
    return customers.filter(c => normalizeText(c.nombre).includes(q)).slice(0, 30);
  }, [query, customers]);

  return (
    <div className="absolute top-full left-0 right-0 mt-1 z-20 bg-white dark:bg-dark-700 border border-gray-200 dark:border-dark-500 rounded-xl shadow-xl overflow-hidden">
      <input
        ref={ref}
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Buscar cliente..."
        className="w-full px-3 py-2 text-sm border-b border-gray-200 dark:border-dark-500 bg-gray-50 dark:bg-dark-600 text-gray-900 dark:text-white focus:outline-none"
      />
      <div className="max-h-48 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="px-3 py-3 text-xs text-gray-400">Sin resultados</div>
        ) : (
          filtered.map(c => (
            <button
              key={c.id}
              onClick={() => { onChange(c); onClose(); }}
              className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-violet-50 dark:hover:bg-violet-500/10 transition-colors"
            >
              {c.nombre}
            </button>
          ))
        )}
      </div>
    </div>
  );
}

export default function CalendIAModal({ isOpen, onClose, onVisitCreated }: CalendIAModalProps) {
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customersLoaded, setCustomersLoaded] = useState(false);
  const [items, setItems] = useState<MatchedItem[]>([]);
  const [aiMessage, setAiMessage] = useState('');
  const [isAmbiguous, setIsAmbiguous] = useState(false);
  const [ambiguousMsg, setAmbiguousMsg] = useState('');
  const [step, setStep] = useState<'input' | 'preview'>('input');
  const [listening, setListening] = useState(false);
  const [refineListening, setRefineListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [creatingAll, setCreatingAll] = useState(false);
  const [originalInstruction, setOriginalInstruction] = useState('');
  const [refineText, setRefineText] = useState('');
  const [refining, setRefining] = useState(false);
  const [editingCustomerIdx, setEditingCustomerIdx] = useState<number | null>(null);

  useEffect(() => {
    if (isOpen && !customersLoaded) {
      getCustomers().then(data => {
        setCustomers(data);
        setCustomersLoaded(true);
      }).catch(() => {});
    }
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, customersLoaded]);

  useEffect(() => {
    if (!isOpen) {
      setInputText('');
      setItems([]);
      setAiMessage('');
      setIsAmbiguous(false);
      setAmbiguousMsg('');
      setStep('input');
      setCreatingAll(false);
      setOriginalInstruction('');
      setRefineText('');
      setRefining(false);
      setEditingCustomerIdx(null);
      recognitionRef.current?.abort();
      setListening(false);
      setRefineListening(false);
    }
  }, [isOpen]);

  const startVoice = useCallback((target: 'input' | 'refine') => {
    const SR = getSpeechRecognition();
    if (!SR) { toast.error('Dictado por voz no disponible'); return; }
    const recognition = new SR();
    recognition.lang = 'es-EC';
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.onresult = (e: SpeechRecognitionEvent) => {
      let transcript = '';
      for (let i = e.resultIndex; i < Object.keys(e.results).length; i++) {
        transcript += e.results[i][0].transcript;
      }
      if (transcript) {
        if (target === 'input') setInputText(prev => prev ? prev + ' ' + transcript : transcript);
        else setRefineText(prev => prev ? prev + ' ' + transcript : transcript);
      }
    };
    recognition.onend = () => { setListening(false); setRefineListening(false); };
    recognition.onerror = () => { setListening(false); setRefineListening(false); };
    recognitionRef.current = recognition;
    recognition.start();
    if (target === 'input') setListening(true); else setRefineListening(true);
  }, []);

  const toggleVoice = useCallback((target: 'input' | 'refine') => {
    const currentlyListening = target === 'input' ? listening : refineListening;
    if (currentlyListening) {
      recognitionRef.current?.stop();
      setListening(false);
      setRefineListening(false);
      return;
    }
    startVoice(target);
  }, [listening, refineListening, startVoice]);

  const applyMatches = useCallback((rawItems: ParsedItem[]): MatchedItem[] => {
    return rawItems.map(v => {
      if (v.type === 'actividad') {
        return {
          ...v,
          type: 'actividad',
          customerName: '',
          customer: undefined,
          matchConfidence: 'high',
          location: v.location || '',
        };
      }
      const { customer, confidence } = matchCustomer(v.customerName, customers);
      return {
        ...v,
        type: 'visita',
        title: '',
        customer,
        matchConfidence: confidence,
        location: v.location || customer?.direccion || '',
      };
    });
  }, [customers]);

  const handleSubmit = async () => {
    if (!inputText.trim() || loading) return;
    setLoading(true);
    try {
      const customerNames = customers.map(c => c.nombre);
      const res = await fetch('/api/calendia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: inputText.trim(), customerList: customerNames }),
      });
      if (!res.ok) throw new Error('Error al procesar');
      const data: CalendIAResponse = await res.json();

      setAiMessage(data.message);
      setIsAmbiguous(data.ambiguous);
      setAmbiguousMsg(data.ambiguousMessage);
      setOriginalInstruction(inputText.trim());

      const rawItems: ParsedItem[] = data.items && data.items.length
        ? data.items
        : (data.visits || []).map((v: any) => ({ ...v, type: 'visita', title: '' }));

      setItems(applyMatches(rawItems));
      setStep('preview');
    } catch {
      toast.error('Error al procesar tu instrucción');
    } finally {
      setLoading(false);
    }
  };

  const handleRefine = async () => {
    if (!refineText.trim() || refining) return;
    setRefining(true);
    try {
      const customerNames = customers.map(c => c.nombre);
      const currentState = items.filter(v => !v.created).map(v => ({
        type: v.type,
        customerName: v.type === 'visita' ? (v.customer?.nombre || v.customerName) : '',
        title: v.type === 'actividad' ? v.title : '',
        date: v.date,
        time: v.time,
        objetivo: v.objetivo,
        location: v.location,
      }));

      const res = await fetch('/api/calendia/refine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalInstruction,
          currentItems: currentState,
          refinementInstruction: refineText.trim(),
          customerList: customerNames,
        }),
      });
      if (!res.ok) throw new Error('Error');
      const data: CalendIAResponse = await res.json();

      const created = items.filter(v => v.created);
      const rawItems: ParsedItem[] = data.items && data.items.length
        ? data.items
        : (data.visits || []).map((v: any) => ({ ...v, type: 'visita', title: '' }));
      const fresh = applyMatches(rawItems);
      setItems([...created, ...fresh]);
      setAiMessage(data.message);
      setIsAmbiguous(data.ambiguous);
      setAmbiguousMsg(data.ambiguousMessage);
      setRefineText('');
      toast.success('Ajuste aplicado');
    } catch {
      toast.error('Error al aplicar el ajuste');
    } finally {
      setRefining(false);
    }
  };

  const handleCreateAll = async () => {
    const valid = items.filter(v =>
      !v.created && (v.type === 'actividad' ? v.title.trim() : !!v.customer)
    );
    if (!valid.length) { toast.error('No hay entradas válidas para crear'); return; }

    setCreatingAll(true);
    let createdCount = 0;
    for (let i = 0; i < items.length; i++) {
      const v = items[i];
      if (v.created) continue;
      if (v.type === 'visita' && !v.customer) continue;
      if (v.type === 'actividad' && !v.title.trim()) continue;

      setItems(prev => prev.map((p, idx) => idx === i ? { ...p, creating: true, error: undefined } : p));

      try {
        const blocked = await isDateBlocked(v.date);
        if (blocked) {
          setItems(prev => prev.map((p, idx) => idx === i ? { ...p, creating: false, error: 'Día bloqueado' } : p));
          continue;
        }

        if (v.type === 'visita' && v.customer) {
          const visitData: VisitInsert = {
            customer_id: v.customer.id,
            scheduled_at: new Date(`${v.date}T${v.time}`).toISOString(),
            status: 'programada',
            objetivo: v.objetivo,
            location_text: v.location || v.customer.direccion || '',
          };
          await createVisit(visitData);
        } else {
          const activityData: ActivityInsert = {
            titulo: v.title,
            descripcion: v.objetivo || null,
            tipo: 'tarea',
            prioridad: 'media',
            fecha_inicio: new Date(`${v.date}T${v.time}`).toISOString(),
            ubicacion: v.location || null,
            es_virtual: false,
          };
          await createActivity(activityData);
        }
        createdCount++;
        setItems(prev => prev.map((p, idx) => idx === i ? { ...p, creating: false, created: true } : p));
      } catch (err: any) {
        setItems(prev => prev.map((p, idx) => idx === i ? { ...p, creating: false, error: err.message || 'Error' } : p));
      }
    }

    setCreatingAll(false);
    if (createdCount > 0) {
      toast.success(`${createdCount} entrada${createdCount > 1 ? 's' : ''} programada${createdCount > 1 ? 's' : ''}`);
      onVisitCreated();
      if (items.every(v => v.created || v.error)) {
        setTimeout(() => onClose(), 1500);
      }
    }
  };

  const removeItem = (idx: number) => {
    setItems(prev => prev.filter((_, i) => i !== idx));
  };

  const updateItem = (idx: number, updates: Partial<MatchedItem>) => {
    setItems(prev => prev.map((v, i) => i === idx ? { ...v, ...updates, error: undefined } : v));
  };

  const toggleItemType = (idx: number) => {
    setItems(prev => prev.map((v, i) => {
      if (i !== idx) return v;
      if (v.type === 'visita') {
        return {
          ...v,
          type: 'actividad',
          title: v.title || v.customer?.nombre || v.customerName || '',
          customer: undefined,
          customerName: '',
          matchConfidence: 'high',
          error: undefined,
        };
      }
      return {
        ...v,
        type: 'visita',
        customerName: v.customerName || v.title || '',
        title: '',
        matchConfidence: 'none',
        error: undefined,
      };
    }));
  };

  const addEmptyItem = (type: ItemKind) => {
    const today = new Date();
    const newItem: MatchedItem = {
      type,
      customerName: '',
      title: '',
      date: format(today, 'yyyy-MM-dd'),
      time: '09:00',
      objetivo: '',
      location: '',
      matchConfidence: type === 'actividad' ? 'high' : 'none',
    };
    setItems(prev => [...prev, newItem]);
    if (type === 'visita') setEditingCustomerIdx(items.length);
  };

  if (!isOpen) return null;

  const validCount = items.filter(v =>
    !v.created && (v.type === 'actividad' ? v.title.trim() : !!v.customer)
  ).length;
  const allCreated = items.length > 0 && items.every(v => v.created);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white dark:bg-dark-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-dark-600 bg-gradient-to-r from-violet-500/10 to-indigo-500/10 dark:from-violet-500/5 dark:to-indigo-500/5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/25">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">CalendIA</h2>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">Visitas o actividades diarias con lenguaje natural</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-dark-600 transition-colors">
            <X className="h-5 w-5 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {step === 'input' && (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  ¿Qué quieres programar?
                </label>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 -mt-1">
                  Puedes pedir <span className="text-indigo-500 font-medium">visitas con clientes</span> o <span className="text-teal-500 font-medium">actividades diarias</span> (sin cliente).
                </p>
                <div className="relative">
                  <textarea
                    ref={inputRef}
                    value={inputText}
                    onChange={e => setInputText(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); }
                    }}
                    placeholder="Ej: visita con Ana mañana a las 10, y agrega reunión de equipo a las 3pm..."
                    rows={3}
                    className="w-full rounded-xl border border-gray-200 dark:border-dark-500 bg-gray-50 dark:bg-dark-700 px-4 py-3 pr-20 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:ring-2 focus:ring-violet-500 focus:border-transparent resize-none"
                  />
                  <div className="absolute right-2 bottom-2 flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => toggleVoice('input')}
                      className={`p-2 rounded-lg transition-all ${
                        listening
                          ? 'text-red-500 bg-red-50 dark:bg-red-500/15 animate-pulse ring-2 ring-red-200'
                          : 'text-gray-400 hover:text-violet-500 hover:bg-violet-50 dark:hover:bg-violet-500/10'
                      }`}
                      title={listening ? 'Detener' : 'Dictar por voz'}
                    >
                      {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                    </button>
                    <button
                      type="button"
                      onClick={handleSubmit}
                      disabled={!inputText.trim() || loading}
                      className="p-2 rounded-lg bg-violet-500 text-white hover:bg-violet-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                      title="Procesar"
                    >
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                {listening && (
                  <p className="text-xs text-red-500 flex items-center gap-1 animate-pulse">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500" /> Escuchando...
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <p className="text-[11px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">Ejemplos</p>
                {EXAMPLES.map((ex, i) => (
                  <button
                    key={i}
                    onClick={() => setInputText(ex)}
                    className="w-full text-left px-3 py-2 rounded-lg text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-dark-700 hover:bg-violet-50 dark:hover:bg-violet-500/10 hover:text-violet-600 dark:hover:text-violet-400 transition-all border border-transparent hover:border-violet-200 dark:hover:border-violet-500/20"
                  >
                    &ldquo;{ex}&rdquo;
                  </button>
                ))}
              </div>
            </>
          )}

          {step === 'preview' && (
            <>
              {/* AI Message */}
              <div className="flex gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Sparkles className="h-3.5 w-3.5 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-gray-700 dark:text-gray-300">{aiMessage}</p>
                  {isAmbiguous && ambiguousMsg && (
                    <div className="mt-2 flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20">
                      <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-700 dark:text-amber-400">{ambiguousMsg}</p>
                    </div>
                  )}
                  <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1.5 flex items-center gap-1">
                    <Pencil className="h-3 w-3" />
                    Puedes editar cada campo, cambiar el tipo, o dar nuevas instrucciones abajo
                  </p>
                </div>
              </div>

              {/* Item cards */}
              {items.map((v, idx) => {
                const isActividad = v.type === 'actividad';
                const accentColor = isActividad ? 'teal' : 'indigo';
                return (
                <div
                  key={idx}
                  className={`relative rounded-xl border p-3 space-y-2 transition-all ${
                    v.created
                      ? 'border-emerald-200 dark:border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-500/5'
                      : v.error
                        ? 'border-red-200 dark:border-red-500/30 bg-red-50/50 dark:bg-red-500/5'
                        : !isActividad && v.matchConfidence === 'none' && !v.customer
                          ? 'border-red-200 dark:border-red-500/30 bg-red-50/30 dark:bg-red-500/5'
                          : !isActividad && v.matchConfidence === 'low'
                            ? 'border-amber-200 dark:border-amber-500/30 bg-amber-50/30 dark:bg-amber-500/5'
                            : 'border-gray-200 dark:border-dark-500 bg-white dark:bg-dark-700'
                  }`}
                >
                  {v.created && (
                    <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center shadow-md">
                      <Check className="h-3.5 w-3.5 text-white" />
                    </div>
                  )}
                  {v.creating && (
                    <div className="absolute -top-2 -right-2">
                      <Loader2 className="h-5 w-5 text-violet-500 animate-spin bg-white dark:bg-dark-800 rounded-full" />
                    </div>
                  )}
                  {!v.created && !v.creating && (
                    <button
                      onClick={() => removeItem(idx)}
                      className="absolute -top-2 -right-2 p-1 rounded-full bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-500 hover:bg-red-50 hover:border-red-300 dark:hover:bg-red-500/20 text-gray-400 hover:text-red-500 transition-colors shadow-sm"
                      title="Eliminar"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}

                  {/* Type badge + toggle */}
                  <div className="flex items-center gap-2 -mt-1">
                    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                      isActividad
                        ? 'bg-teal-100 dark:bg-teal-500/15 text-teal-700 dark:text-teal-400'
                        : 'bg-indigo-100 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-400'
                    }`}>
                      {isActividad ? <ClipboardList className="h-3 w-3" /> : <Users className="h-3 w-3" />}
                      {isActividad ? 'Actividad diaria' : 'Visita'}
                    </span>
                    {!v.created && (
                      <button
                        onClick={() => toggleItemType(idx)}
                        className="text-[10px] text-gray-400 hover:text-violet-500 underline decoration-dotted transition-colors"
                        title="Cambiar tipo"
                      >
                        cambiar a {isActividad ? 'visita' : 'actividad'}
                      </button>
                    )}
                  </div>

                  {/* Primary row: customer OR title */}
                  {isActividad ? (
                    <div className="relative">
                      <ClipboardList className="h-3.5 w-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        value={v.title}
                        onChange={e => updateItem(idx, { title: e.target.value })}
                        disabled={v.created}
                        placeholder="Título de la actividad"
                        className={`w-full pl-8 pr-2 py-2 rounded-lg text-sm font-medium bg-gray-50 dark:bg-dark-600 border border-gray-200 dark:border-dark-500 text-gray-900 dark:text-white placeholder:text-gray-400 focus:ring-1 focus:ring-${accentColor}-500 focus:border-${accentColor}-500 disabled:opacity-60`}
                      />
                    </div>
                  ) : (
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => !v.created && setEditingCustomerIdx(editingCustomerIdx === idx ? null : idx)}
                        disabled={v.created}
                        className={`w-full flex items-center gap-2 px-2 py-1.5 -mx-1 rounded-lg text-left ${
                          v.created ? '' : 'hover:bg-gray-100 dark:hover:bg-dark-600 cursor-pointer'
                        }`}
                      >
                        <User className="h-4 w-4 text-gray-400 flex-shrink-0" />
                        <div className="flex-1 min-w-0 flex items-center gap-2">
                          {v.customer ? (
                            <span className="text-sm font-medium text-gray-900 dark:text-white truncate">{v.customer.nombre}</span>
                          ) : (
                            <span className="text-sm font-medium text-red-600 dark:text-red-400 truncate">
                              {v.customerName || 'Seleccionar cliente'}
                            </span>
                          )}
                          {v.matchConfidence === 'low' && v.customer && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 flex-shrink-0">
                              parcial
                            </span>
                          )}
                        </div>
                        {!v.created && <Pencil className="h-3 w-3 text-gray-400 flex-shrink-0" />}
                      </button>
                      {editingCustomerIdx === idx && (
                        <CustomerPicker
                          customers={customers}
                          onChange={(c) => updateItem(idx, { customer: c, customerName: c.nombre, matchConfidence: 'high', location: v.location || c.direccion || '' })}
                          onClose={() => setEditingCustomerIdx(null)}
                        />
                      )}
                    </div>
                  )}

                  {/* Date & Time row */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="relative">
                      <Calendar className="h-3.5 w-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="date"
                        value={v.date}
                        onChange={e => updateItem(idx, { date: e.target.value })}
                        disabled={v.created}
                        className="w-full pl-8 pr-2 py-1.5 rounded-lg text-xs bg-gray-50 dark:bg-dark-600 border border-gray-200 dark:border-dark-500 text-gray-700 dark:text-gray-300 focus:ring-1 focus:ring-violet-500 focus:border-violet-500 disabled:opacity-60"
                      />
                    </div>
                    <div className="relative">
                      <Clock className="h-3.5 w-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="time"
                        value={v.time}
                        onChange={e => updateItem(idx, { time: e.target.value })}
                        disabled={v.created}
                        className="w-full pl-8 pr-2 py-1.5 rounded-lg text-xs bg-gray-50 dark:bg-dark-600 border border-gray-200 dark:border-dark-500 text-gray-700 dark:text-gray-300 focus:ring-1 focus:ring-violet-500 focus:border-violet-500 disabled:opacity-60"
                      />
                    </div>
                  </div>

                  {/* Objetivo */}
                  <div className="relative">
                    <Target className="h-3.5 w-3.5 text-gray-400 absolute left-2.5 top-2 pointer-events-none" />
                    <textarea
                      value={v.objetivo}
                      onChange={e => updateItem(idx, { objetivo: e.target.value })}
                      disabled={v.created}
                      placeholder={isActividad ? 'Descripción (opcional)' : 'Objetivo de la visita'}
                      rows={2}
                      className="w-full pl-8 pr-2 py-1.5 rounded-lg text-xs bg-gray-50 dark:bg-dark-600 border border-gray-200 dark:border-dark-500 text-gray-700 dark:text-gray-300 focus:ring-1 focus:ring-violet-500 focus:border-violet-500 resize-none disabled:opacity-60"
                    />
                  </div>

                  {/* Location */}
                  <div className="relative">
                    <MapPin className="h-3.5 w-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={v.location}
                      onChange={e => updateItem(idx, { location: e.target.value })}
                      disabled={v.created}
                      placeholder={isActividad ? 'Lugar o enlace (opcional)' : 'Ubicación'}
                      className="w-full pl-8 pr-2 py-1.5 rounded-lg text-xs bg-gray-50 dark:bg-dark-600 border border-gray-200 dark:border-dark-500 text-gray-700 dark:text-gray-300 focus:ring-1 focus:ring-violet-500 focus:border-violet-500 disabled:opacity-60"
                    />
                  </div>

                  {v.error && (
                    <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" /> {v.error}
                    </p>
                  )}
                </div>
              );})}

              {/* Add manual buttons */}
              {!allCreated && (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => addEmptyItem('visita')}
                    className="py-2 rounded-xl border-2 border-dashed border-gray-200 dark:border-dark-500 text-xs text-gray-500 dark:text-gray-400 hover:border-indigo-300 dark:hover:border-indigo-500/40 hover:text-indigo-500 hover:bg-indigo-50/30 dark:hover:bg-indigo-500/5 transition-all flex items-center justify-center gap-1.5"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Visita
                  </button>
                  <button
                    onClick={() => addEmptyItem('actividad')}
                    className="py-2 rounded-xl border-2 border-dashed border-gray-200 dark:border-dark-500 text-xs text-gray-500 dark:text-gray-400 hover:border-teal-300 dark:hover:border-teal-500/40 hover:text-teal-500 hover:bg-teal-50/30 dark:hover:bg-teal-500/5 transition-all flex items-center justify-center gap-1.5"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Actividad
                  </button>
                </div>
              )}

              {/* Refine input */}
              {!allCreated && (
                <div className="pt-3 mt-1 border-t border-gray-200 dark:border-dark-600 space-y-2">
                  <label className="flex items-center gap-1.5 text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    <Wand2 className="h-3 w-3" />
                    Dar más instrucciones a la IA
                  </label>
                  <div className="relative">
                    <input
                      value={refineText}
                      onChange={e => setRefineText(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') { e.preventDefault(); handleRefine(); }
                      }}
                      placeholder="Ej: conviértela en actividad diaria..."
                      className="w-full rounded-xl border border-gray-200 dark:border-dark-500 bg-gray-50 dark:bg-dark-700 pl-3 pr-20 py-2.5 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                    />
                    <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => toggleVoice('refine')}
                        className={`p-1.5 rounded-lg transition-all ${
                          refineListening
                            ? 'text-red-500 bg-red-50 dark:bg-red-500/15 animate-pulse'
                            : 'text-gray-400 hover:text-violet-500 hover:bg-violet-50 dark:hover:bg-violet-500/10'
                        }`}
                        title={refineListening ? 'Detener' : 'Dictar'}
                      >
                        {refineListening ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
                      </button>
                      <button
                        type="button"
                        onClick={handleRefine}
                        disabled={!refineText.trim() || refining}
                        className="p-1.5 rounded-lg bg-violet-500 text-white hover:bg-violet-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                        title="Aplicar"
                      >
                        {refining ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {REFINE_EXAMPLES.map((ex, i) => (
                      <button
                        key={i}
                        onClick={() => setRefineText(ex)}
                        className="text-[10px] px-2 py-1 rounded-md bg-gray-100 dark:bg-dark-700 text-gray-500 dark:text-gray-400 hover:bg-violet-50 dark:hover:bg-violet-500/10 hover:text-violet-600 dark:hover:text-violet-400 transition-all"
                      >
                        {ex}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {items.length === 0 && !isAmbiguous && (
                <div className="text-center py-6 text-sm text-gray-400">
                  No se identificaron entradas. Intenta ser más específico.
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-200 dark:border-dark-600 flex items-center justify-between gap-3">
          {step === 'input' ? (
            <>
              <p className="text-[11px] text-gray-400 dark:text-gray-500">
                {customersLoaded ? `${customers.length} clientes` : 'Cargando...'}
              </p>
              <button
                onClick={handleSubmit}
                disabled={!inputText.trim() || loading}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-violet-500 to-indigo-600 text-white text-sm font-medium hover:from-violet-600 hover:to-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-2 shadow-lg shadow-violet-500/20"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Procesar
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => { setStep('input'); setItems([]); }}
                className="px-3 py-2 rounded-xl text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-600 transition-colors"
              >
                Volver
              </button>
              <div className="flex items-center gap-2">
                {allCreated ? (
                  <span className="text-sm text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1.5">
                    <Check className="h-4 w-4" /> Listo
                  </span>
                ) : (
                  <button
                    onClick={handleCreateAll}
                    disabled={validCount === 0 || creatingAll}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-violet-500 to-indigo-600 text-white text-sm font-medium hover:from-violet-600 hover:to-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-2 shadow-lg shadow-violet-500/20"
                  >
                    {creatingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    Confirmar {validCount > 0 ? `(${validCount})` : ''}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

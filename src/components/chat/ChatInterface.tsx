'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Sparkles, Trash2, CalendarDays, BarChart3, Users, MapPin } from 'lucide-react';
import MessageBubble from './MessageBubble';
import TypingIndicator from './TypingIndicator';
import AudioRecorder from './AudioRecorder';
import { useAuth } from '@/contexts/AuthContext';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface ChatInterfaceProps {
  mode: 'full' | 'compact';
}

const SUGGESTIONS = [
  { icon: CalendarDays, text: '¿Qué tiene hoy Camila?', color: 'from-blue-500/20 to-cyan-500/20 border-blue-500/10 hover:border-blue-400/30' },
  { icon: BarChart3, text: 'Reporte de visitas esta semana', color: 'from-emerald-500/20 to-teal-500/20 border-emerald-500/10 hover:border-emerald-400/30' },
  { icon: Users, text: 'Comparar vendedores este mes', color: 'from-purple-500/20 to-pink-500/20 border-purple-500/10 hover:border-purple-400/30' },
  { icon: MapPin, text: 'Gastos del último evento', color: 'from-amber-500/20 to-orange-500/20 border-amber-500/10 hover:border-amber-400/30' },
];

export default function ChatInterface({ mode }: ChatInterfaceProps) {
  const { userProfile } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [thinking, setThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    });
  }, []);

  useEffect(scrollToBottom, [messages, streaming, scrollToBottom]);

  useEffect(() => {
    if (!streaming && inputRef.current) inputRef.current.focus();
  }, [streaming]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || streaming || !userProfile) return;
    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: text.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setThinking(true);
    setStreaming(true);

    const assistantId = crypto.randomUUID();

    try {
      abortRef.current = new AbortController();
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
          userProfileId: userProfile.id,
        }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Error de conexión' }));
        setMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: `⚠️ ${err.error || 'Error desconocido'}` }]);
        setThinking(false);
        setStreaming(false);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No reader');
      const decoder = new TextDecoder();
      let buffer = '';
      let fullContent = '';
      let firstChunk = true;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const payload = line.slice(6).trim();
          if (payload === '[DONE]') continue;

          try {
            const parsed = JSON.parse(payload);
            if (parsed.error) {
              fullContent += `\n⚠️ ${parsed.error}`;
            } else if (parsed.content) {
              if (firstChunk) { setThinking(false); firstChunk = false; }
              fullContent += parsed.content;
            }
            setMessages(prev => {
              const existing = prev.find(m => m.id === assistantId);
              if (existing) return prev.map(m => m.id === assistantId ? { ...m, content: fullContent } : m);
              return [...prev, { id: assistantId, role: 'assistant', content: fullContent }];
            });
          } catch {}
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: '⚠️ Error de conexión con el servidor.' }]);
      }
    } finally {
      setThinking(false);
      setStreaming(false);
      abortRef.current = null;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
  };

  const clearChat = () => {
    setMessages([]);
    if (abortRef.current) abortRef.current.abort();
    setStreaming(false);
    setThinking(false);
  };

  const isCompact = mode === 'compact';

  return (
    <div className={`flex flex-col ${isCompact ? 'h-[460px]' : 'h-full'} w-full`}>
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-3 sm:px-5 py-2.5 sm:py-3 border-b border-white/[0.06]"
        style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.04) 0%, transparent 100%)' }}>
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="relative">
            <div className="absolute -inset-0.5 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-xl opacity-50 blur-sm" />
            <div className="relative w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
          </div>
          <div className="min-w-0">
            <h3 className="text-xs sm:text-sm font-bold text-white leading-tight truncate">Omnivisor IA</h3>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-lg shadow-emerald-400/50" />
              <span className="text-[9px] sm:text-[10px] text-white/40 font-medium">Conectado</span>
            </div>
          </div>
        </div>
        {messages.length > 0 && (
          <button onClick={clearChat} className="p-1.5 sm:p-2 rounded-xl hover:bg-white/[0.06] active:bg-white/10 transition-all text-white/30 hover:text-white/60" title="Limpiar chat">
            <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>
        )}
      </div>

      {/* Messages area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 sm:px-5 py-3 sm:py-5 space-y-3 sm:space-y-4"
        style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}>
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center px-2 sm:px-6">
            {/* Logo orb */}
            <div className="relative mb-5 sm:mb-6">
              <div className="absolute -inset-4 sm:-inset-6 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 rounded-full blur-2xl" />
              <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-2xl sm:rounded-3xl bg-gradient-to-br from-white/[0.08] to-white/[0.02] border border-white/10 flex items-center justify-center"
                style={{ backdropFilter: 'blur(20px)' }}>
                <Sparkles className="w-7 h-7 sm:w-9 sm:h-9 text-indigo-400/70" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-emerald-500 border-2 border-slate-950 flex items-center justify-center">
                <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-white" />
              </div>
            </div>

            <p className="text-white/80 text-sm sm:text-base font-semibold mb-1">¿En qué puedo ayudarte?</p>
            <p className="text-white/25 text-[11px] sm:text-xs max-w-[300px] mb-5 sm:mb-6">
              Agendas, reportes, eventos, presupuestos, clientes, pedidos, vacaciones...
            </p>

            {/* Suggestion cards */}
            <div className={`grid gap-2 sm:gap-2.5 w-full ${isCompact ? 'grid-cols-1 max-w-[260px]' : 'grid-cols-1 sm:grid-cols-2 max-w-[420px]'}`}>
              {SUGGESTIONS.slice(0, isCompact ? 3 : 4).map(({ icon: Icon, text, color }) => (
                <button key={text} onClick={() => sendMessage(text)}
                  className={`group flex items-center gap-2 sm:gap-2.5 text-left text-[11px] sm:text-xs bg-gradient-to-br ${color} border rounded-xl sm:rounded-2xl px-3 py-2 sm:px-3.5 sm:py-2.5 transition-all active:scale-[0.97]`}
                  style={{ backdropFilter: 'blur(10px)' }}>
                  <Icon className="w-3.5 h-3.5 text-white/50 group-hover:text-white/70 shrink-0 transition-colors" />
                  <span className="text-white/60 group-hover:text-white/80 transition-colors">{text}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <MessageBubble
            key={msg.id}
            role={msg.role}
            content={msg.content}
            isStreaming={streaming && i === messages.length - 1 && msg.role === 'assistant'}
          />
        ))}

        {thinking && <TypingIndicator />}
      </div>

      {/* Input bar */}
      <div className="shrink-0 px-2 sm:px-4 pb-2 sm:pb-3 pt-1.5 sm:pt-2">
        <div className="relative flex items-end gap-1.5 sm:gap-2 rounded-xl sm:rounded-2xl px-2 sm:px-3 py-1.5 sm:py-2 transition-all border border-white/[0.08] focus-within:border-indigo-500/30"
          style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))', backdropFilter: 'blur(10px)' }}>
          <div className="absolute inset-0 rounded-xl sm:rounded-2xl opacity-0 focus-within:opacity-100 transition-opacity pointer-events-none"
            style={{ boxShadow: '0 0 20px rgba(99,102,241,0.08), inset 0 1px 0 rgba(255,255,255,0.05)' }} />
          <AudioRecorder onTranscription={(text) => { setInput(text); setTimeout(() => sendMessage(text), 100); }} disabled={streaming} />
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribe tu pregunta..."
            disabled={streaming}
            rows={1}
            className="relative z-10 flex-1 bg-transparent text-white text-xs sm:text-sm placeholder-white/20 resize-none outline-none max-h-20 sm:max-h-24 disabled:opacity-40 py-1.5"
            style={{ scrollbarWidth: 'none' }}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || streaming}
            className="relative z-10 w-8 h-8 sm:w-9 sm:h-9 shrink-0 rounded-lg sm:rounded-xl flex items-center justify-center transition-all disabled:opacity-20 bg-gradient-to-br from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 active:scale-90 disabled:from-white/5 disabled:to-white/5 shadow-lg shadow-indigo-500/20 disabled:shadow-none text-white"
          >
            <Send className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>
        </div>
        <p className="text-center text-[9px] text-white/15 mt-1.5 hidden sm:block">
          Omnivisor puede cometer errores. Verifica la información importante.
        </p>
      </div>
    </div>
  );
}

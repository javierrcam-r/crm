'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Sparkles, Trash2 } from 'lucide-react';
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
        setMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: `Error: ${err.error || 'Error desconocido'}` }]);
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
              if (firstChunk) {
                setThinking(false);
                firstChunk = false;
              }
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
        setMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: 'Error de conexión con el servidor.' }]);
      }
    } finally {
      setThinking(false);
      setStreaming(false);
      abortRef.current = null;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const clearChat = () => {
    setMessages([]);
    if (abortRef.current) abortRef.current.abort();
    setStreaming(false);
    setThinking(false);
  };

  const isCompact = mode === 'compact';
  const containerHeight = isCompact ? 'h-[460px]' : 'h-full';

  return (
    <div className={`flex flex-col ${containerHeight} w-full`}>
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white leading-tight">Omnivisor IA</h3>
            <p className="text-[10px] text-indigo-300/70">Asistente CRM Disfero</p>
          </div>
        </div>
        {messages.length > 0 && (
          <button onClick={clearChat} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-white/40 hover:text-white/70" title="Limpiar chat">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4 scrollbar-thin">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center px-6">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-white/10 flex items-center justify-center mb-4">
              <Sparkles className="w-8 h-8 text-indigo-400/60" />
            </div>
            <p className="text-white/70 text-sm font-medium mb-2">Preguntame lo que quieras</p>
            <p className="text-white/30 text-xs max-w-[260px]">
              Agendas, eventos, presupuestos, vacaciones, clientes, pedidos...
            </p>
            <div className="mt-5 grid gap-2 w-full max-w-[280px]">
              {[
                '¿Qué tiene programado hoy Camila?',
                '¿Cuál es el presupuesto del último evento?',
                '¿Quién tiene vacaciones esta semana?',
              ].map((q) => (
                <button key={q} onClick={() => sendMessage(q)}
                  className="text-left text-xs text-indigo-200/70 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/15 rounded-xl px-3 py-2 transition-all">
                  {q}
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

      {/* Input */}
      <div className="shrink-0 px-3 pb-3 pt-2 border-t border-white/5">
        <div className="flex items-end gap-2 bg-white/5 border border-white/10 rounded-2xl px-3 py-2 focus-within:border-indigo-500/40 transition-colors">
          <AudioRecorder onTranscription={(text) => { setInput(text); setTimeout(() => sendMessage(text), 100); }} disabled={streaming} />
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribe tu pregunta..."
            disabled={streaming}
            rows={1}
            className="flex-1 bg-transparent text-white text-sm placeholder-white/30 resize-none outline-none max-h-24 disabled:opacity-40"
            style={{ scrollbarWidth: 'none' }}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || streaming}
            className="w-9 h-9 rounded-xl bg-indigo-500/80 hover:bg-indigo-500 disabled:bg-white/5 disabled:text-white/20 flex items-center justify-center transition-all text-white"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

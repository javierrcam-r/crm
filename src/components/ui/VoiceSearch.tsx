'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, MicOff } from 'lucide-react';

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

interface VoiceSearchProps {
  onResult: (text: string) => void;
  lang?: string;
  className?: string;
}

export default function VoiceSearch({ onResult, lang = 'es-EC', className = '' }: VoiceSearchProps) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState<boolean | null>(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  useEffect(() => {
    setSupported(!!getSpeechRecognition());
    return () => { recognitionRef.current?.abort(); };
  }, []);

  const toggle = useCallback(() => {
    if (!supported) {
      setShowTooltip(true);
      setTimeout(() => setShowTooltip(false), 3000);
      return;
    }

    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }

    const SR = getSpeechRecognition();
    if (!SR) return;

    const recognition = new SR();
    recognition.lang = lang;
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = (e: SpeechRecognitionEvent) => {
      const transcript = e.results[0][0].transcript;
      if (transcript) onResult(transcript);
    };

    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }, [listening, lang, onResult, supported]);

  if (supported === null) return null;

  return (
    <div className="relative">
      <button type="button" onClick={toggle} title={listening ? 'Detener' : 'Buscar por voz'}
        className={`p-1.5 rounded-lg transition-all flex-shrink-0 ${listening
          ? 'text-red-500 bg-red-50 dark:bg-red-500/15 animate-pulse'
          : supported
            ? 'text-gray-400 dark:text-gray-500 hover:text-indigo-500 dark:hover:text-indigo-400 hover:bg-gray-100 dark:hover:bg-slate-700'
            : 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
        } ${className}`}>
        {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
      </button>
      {showTooltip && (
        <div className="absolute right-0 top-full mt-1 z-50 px-2.5 py-1.5 text-[10px] leading-tight rounded-lg bg-gray-900 dark:bg-slate-700 text-white whitespace-nowrap shadow-lg">
          Voz no disponible (requiere HTTPS)
        </div>
      )}
    </div>
  );
}

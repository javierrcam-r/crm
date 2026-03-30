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

interface VoiceDictateProps {
  onTranscript: (text: string) => void;
  lang?: string;
  className?: string;
  size?: 'sm' | 'md';
}

export default function VoiceDictate({ onTranscript, lang = 'es-EC', className = '', size = 'md' }: VoiceDictateProps) {
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
    recognition.continuous = true;
    recognition.interimResults = false;

    recognition.onresult = (e: SpeechRecognitionEvent) => {
      let transcript = '';
      for (let i = e.resultIndex; i < Object.keys(e.results).length; i++) {
        transcript += e.results[i][0].transcript;
      }
      if (transcript) onTranscript(transcript);
    };

    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }, [listening, lang, onTranscript, supported]);

  if (supported === null) return null;

  const iconSize = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4';
  const btnSize = size === 'sm' ? 'p-1' : 'p-1.5';

  return (
    <div className="relative inline-flex">
      <button type="button" onClick={toggle} title={listening ? 'Detener dictado' : 'Dictar por voz'}
        className={`${btnSize} rounded-lg transition-all flex-shrink-0 ${listening
          ? 'text-red-500 bg-red-50 dark:bg-red-500/15 animate-pulse ring-2 ring-red-200 dark:ring-red-500/30'
          : supported
            ? 'text-gray-400 dark:text-gray-500 hover:text-indigo-500 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10'
            : 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
        } ${className}`}>
        {listening ? <MicOff className={iconSize} /> : <Mic className={iconSize} />}
      </button>
      {listening && (
        <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-red-500 animate-ping" />
      )}
      {showTooltip && (
        <div className="absolute right-0 top-full mt-1 z-50 px-2.5 py-1.5 text-[10px] leading-tight rounded-lg bg-gray-900 dark:bg-slate-700 text-white whitespace-nowrap shadow-lg">
          Voz no disponible (requiere HTTPS)
        </div>
      )}
    </div>
  );
}

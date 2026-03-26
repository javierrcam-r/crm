'use client';

import { useState, useEffect } from 'react';
import { Sparkles, X, Maximize2 } from 'lucide-react';
import Link from 'next/link';
import ChatInterface from './ChatInterface';
import { useAuth } from '@/contexts/AuthContext';

export default function FloatingChatWidget() {
  const { userProfile } = useAuth();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  if (!mounted || !userProfile || userProfile.rol !== 'admin') return null;

  return (
    <>
      {/* Floating Button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-50 w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-700 hover:from-indigo-500 hover:to-purple-600 shadow-lg shadow-indigo-500/30 hover:shadow-xl hover:shadow-indigo-500/40 flex items-center justify-center transition-all hover:scale-105 active:scale-95 group"
        >
          <Sparkles className="w-6 h-6 text-white group-hover:rotate-12 transition-transform" />
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-gray-900 animate-pulse" />
        </button>
      )}

      {/* Chat Overlay */}
      {open && (
        <div className="fixed bottom-5 right-5 z-50 w-[380px] max-w-[calc(100vw-40px)] rounded-3xl overflow-hidden shadow-2xl shadow-black/40 border border-white/15"
          style={{ background: 'linear-gradient(145deg, rgba(30,27,75,0.97), rgba(15,23,42,0.97))' }}>
          {/* Overlay Header with close/expand */}
          <div className="flex items-center justify-between px-3 pt-2">
            <span />
            <div className="flex items-center gap-1">
              <Link href="/asistente" onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-white/40 hover:text-white/70" title="Abrir completo">
                <Maximize2 className="w-3.5 h-3.5" />
              </Link>
              <button onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-white/40 hover:text-white/70" title="Cerrar">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <ChatInterface mode="compact" />
        </div>
      )}
    </>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Sparkles, X, Maximize2 } from 'lucide-react';
import Link from 'next/link';
import ChatInterface from './ChatInterface';
import { useAuth } from '@/contexts/AuthContext';

export default function FloatingChatWidget() {
  const { userProfile } = useAuth();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  if (!mounted || !userProfile || userProfile.rol !== 'admin') return null;
  if (pathname === '/asistente') return null;

  return (
    <>
      {/* Floating Button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-4 right-4 sm:bottom-5 sm:right-5 z-50 group"
        >
          <div className="absolute -inset-1 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl opacity-40 blur-md group-hover:opacity-60 transition-opacity" />
          <div className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-700 hover:from-indigo-500 hover:to-purple-600 shadow-2xl shadow-indigo-500/30 flex items-center justify-center transition-all hover:scale-105 active:scale-95">
            <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-white group-hover:rotate-12 transition-transform" />
            <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-emerald-400 rounded-full border-2 border-gray-900 shadow-lg shadow-emerald-400/50">
              <span className="absolute inset-0 bg-emerald-400 rounded-full animate-ping opacity-40" />
            </span>
          </div>
        </button>
      )}

      {/* Chat Overlay */}
      {open && (
        <div className="fixed bottom-3 right-3 sm:bottom-5 sm:right-5 z-50 w-[calc(100vw-24px)] sm:w-[400px] max-w-[420px] rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl shadow-black/50"
          style={{ maxHeight: 'calc(100vh - 100px)' }}>
          {/* Multi-layer glass background */}
          <div className="absolute inset-0 bg-gradient-to-br from-slate-950/[0.98] via-indigo-950/[0.98] to-purple-950/[0.98]" />
          <div className="absolute inset-0"
            style={{ backgroundImage: 'radial-gradient(ellipse at 20% 20%, rgba(99,102,241,0.1), transparent 50%), radial-gradient(ellipse at 80% 80%, rgba(168,85,247,0.08), transparent 50%)' }} />
          <div className="absolute inset-0 rounded-2xl sm:rounded-3xl border border-white/[0.1]" />
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

          {/* Header with controls */}
          <div className="relative z-10 flex items-center justify-between px-2 sm:px-3 pt-1.5 sm:pt-2"
            style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, transparent 100%)' }}>
            <span />
            <div className="flex items-center gap-0.5">
              <Link href="/asistente" onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg hover:bg-white/[0.06] transition-colors text-white/30 hover:text-white/60" title="Abrir completo">
                <Maximize2 className="w-3.5 h-3.5" />
              </Link>
              <button onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg hover:bg-white/[0.06] transition-colors text-white/30 hover:text-white/60" title="Cerrar">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="relative z-10">
            <ChatInterface mode="compact" />
          </div>
        </div>
      )}
    </>
  );
}

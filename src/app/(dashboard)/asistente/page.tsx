'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import ChatInterface from '@/components/chat/ChatInterface';
import { Sparkles, Zap, Shield } from 'lucide-react';

export default function AsistentePage() {
  const { userProfile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && userProfile && userProfile.rol !== 'admin') {
      router.replace('/');
    }
  }, [userProfile, loading, router]);

  if (loading || !userProfile) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="relative">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500/30 to-purple-500/30 animate-pulse" />
          <div className="absolute inset-0 w-12 h-12 rounded-2xl border-2 border-indigo-400/30 border-t-indigo-400 animate-spin" />
        </div>
      </div>
    );
  }

  if (userProfile.rol !== 'admin') return null;

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="relative">
            <div className="absolute -inset-1 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl opacity-40 blur-md" />
            <div className="relative p-2.5 sm:p-3 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-700 shadow-xl shadow-indigo-500/25">
              <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white tracking-tight">
              Asistente IA
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="flex items-center gap-1 text-[10px] sm:text-xs text-indigo-600 dark:text-indigo-400 font-medium">
                <Zap className="w-3 h-3" /> GPT-4
              </span>
              <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
              <span className="flex items-center gap-1 text-[10px] sm:text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                <Shield className="w-3 h-3" /> Omnivisor
              </span>
            </div>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400">En línea</span>
        </div>
      </div>

      {/* Chat glass container */}
      <div className="relative rounded-2xl sm:rounded-3xl overflow-hidden"
        style={{ height: 'calc(100vh - 180px)', minHeight: '400px' }}>
        {/* Multi-layer glassmorphism background */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-indigo-950 to-purple-950" />
        <div className="absolute inset-0"
          style={{
            backgroundImage: 'radial-gradient(ellipse at 15% 20%, rgba(99,102,241,0.15), transparent 50%), radial-gradient(ellipse at 85% 80%, rgba(168,85,247,0.12), transparent 50%), radial-gradient(ellipse at 50% 50%, rgba(59,130,246,0.06), transparent 60%)',
          }} />
        <div className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }} />
        {/* Animated accent orbs */}
        <div className="absolute top-10 left-10 w-48 h-48 sm:w-72 sm:h-72 bg-indigo-500/[0.07] rounded-full blur-3xl animate-pulse" style={{ animationDuration: '4s' }} />
        <div className="absolute bottom-10 right-10 w-48 h-48 sm:w-64 sm:h-64 bg-purple-500/[0.07] rounded-full blur-3xl animate-pulse" style={{ animationDuration: '6s', animationDelay: '2s' }} />
        {/* Glass border */}
        <div className="absolute inset-0 rounded-2xl sm:rounded-3xl border border-white/[0.08] pointer-events-none" />
        <div className="absolute inset-[1px] rounded-2xl sm:rounded-3xl border border-white/[0.04] pointer-events-none" />
        {/* Top shine */}
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

        <div className="relative z-10 h-full">
          <ChatInterface mode="full" />
        </div>
      </div>
    </div>
  );
}

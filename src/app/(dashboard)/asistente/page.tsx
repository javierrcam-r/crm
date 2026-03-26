'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import ChatInterface from '@/components/chat/ChatInterface';

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
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  if (userProfile.rol !== 'admin') return null;

  return (
    <div className="fixed inset-0 z-40 overflow-hidden">
      {/* Animated gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-indigo-950 to-purple-950">
        <div className="absolute inset-0 opacity-30"
          style={{
            backgroundImage: 'radial-gradient(circle at 20% 50%, rgba(99,102,241,0.15), transparent 50%), radial-gradient(circle at 80% 20%, rgba(168,85,247,0.12), transparent 50%), radial-gradient(circle at 50% 80%, rgba(59,130,246,0.1), transparent 50%)',
          }}
        />
        {/* Subtle grid overlay */}
        <div className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />
      </div>

      {/* Glass container */}
      <div className="relative z-10 flex items-center justify-center h-full p-4 sm:p-6 md:p-10">
        <div className="w-full max-w-3xl h-full max-h-[800px] rounded-3xl overflow-hidden border border-white/10 shadow-2xl shadow-black/40"
          style={{ background: 'linear-gradient(145deg, rgba(30,27,75,0.85), rgba(15,23,42,0.9))', backdropFilter: 'blur(40px)' }}>
          <ChatInterface mode="full" />
        </div>
      </div>
    </div>
  );
}

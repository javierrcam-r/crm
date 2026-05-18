'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { LogIn, Fingerprint } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';
import {
  isPlatformAuthenticatorAvailable,
  authenticateWithBiometric,
  getBiometricType,
} from '@/lib/webauthn';
import { getSupabaseClient } from '@/lib/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';

const EASE_EXPO: [number, number, number, number] = [0.22, 1, 0.36, 1];

const cardVariants = {
  idle: { scale: 1, filter: 'blur(0px)', opacity: 1 },
  glow: {
    scale: 1,
    filter: 'blur(0px)',
    opacity: 1,
    transition: { duration: 0.15, ease: EASE_EXPO },
  },
  exit: {
    filter: 'blur(6px)',
    opacity: 0,
    scale: 0.97,
    transition: { duration: 0.5, ease: EASE_EXPO },
  },
};

const leftHalfVariants = {
  hidden: { x: 0, opacity: 1 },
  visible: {
    x: '-55%',
    opacity: 0,
    transition: { duration: 0.9, ease: EASE_EXPO, delay: 0.25 },
  },
};

const rightHalfVariants = {
  hidden: { x: 0, opacity: 1 },
  visible: {
    x: '55%',
    opacity: 0,
    transition: { duration: 0.9, ease: EASE_EXPO, delay: 0.25 },
  },
};

const glowLineVariants = {
  hidden: { scaleY: 0, opacity: 0 },
  visible: {
    scaleY: 1,
    opacity: [0, 1, 1, 0],
    transition: {
      scaleY: { duration: 0.6, ease: EASE_EXPO },
      opacity: { duration: 1.1, times: [0, 0.15, 0.6, 1], ease: 'linear' as const },
    },
  },
};

const welcomeVariants = {
  hidden: { opacity: 0, scale: 0.92, filter: 'blur(8px)' },
  visible: {
    opacity: 1,
    scale: 1,
    filter: 'blur(0px)',
    transition: { duration: 0.8, ease: EASE_EXPO, delay: 0.5 },
  },
};

export default function LoginPage() {
  const router = useRouter();
  const { supabase, userProfile, loading, loginWithTable, setUserProfileDirectly } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState('');
  const [isBiometricLoading, setIsBiometricLoading] = useState(false);

  type Phase = 'form' | 'glow' | 'splitting' | 'welcome' | 'done';
  const [phase, setPhase] = useState<Phase>('form');
  const [welcomeName, setWelcomeName] = useState('');

  useEffect(() => {
    if (!loading && userProfile && phase === 'form') {
      router.push('/');
    }
    checkBiometricAvailability();
  }, [userProfile, loading, router, phase]);

  const checkBiometricAvailability = async () => {
    const available = await isPlatformAuthenticatorAvailable();
    setBiometricAvailable(available);
    if (available) {
      const type = await getBiometricType();
      setBiometricType(type);
    }
  };

  const runCinematicTransition = useCallback((name: string) => {
    setWelcomeName(name);
    setPhase('glow');

    setTimeout(() => setPhase('splitting'), 200);
    setTimeout(() => setPhase('welcome'), 900);
    setTimeout(() => {
      setPhase('done');
      toast.success(name ? `¡Bienvenido, ${name}!` : '¡Bienvenido!');
      router.push('/');
    }, 1800);
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) { toast.error('Error de configuración'); return; }
    setIsLoading(true);
    try {
      const result = await loginWithTable(username, password);
      if (!result.success) {
        toast.error(result.error || 'Credenciales inválidas');
        setIsLoading(false);
        return;
      }
      runCinematicTransition('');
    } catch {
      toast.error('Error al iniciar sesión');
      setIsLoading(false);
    }
  };

  const handleBiometricLogin = async () => {
    setIsBiometricLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { data: credentials, error: credError } = await supabase
        .from('biometric_credentials')
        .select('credential_id, user_id');

      if (credError || !credentials || credentials.length === 0) {
        toast.error('Configura la biometría primero desde tu perfil');
        return;
      }

      const credentialIds = credentials.map((c: { credential_id: string }) => c.credential_id);
      const result = await authenticateWithBiometric(credentialIds);
      if (!result) { toast.error('Autenticación fallida'); return; }

      const usedCredential = credentials.find((c: { credential_id: string }) => c.credential_id === result.credentialId);
      if (!usedCredential) { toast.error('Credencial no encontrada'); return; }

      const { data: profile, error: profileError } = await supabase
        .from('users_profile')
        .select('*')
        .eq('id', usedCredential.user_id)
        .eq('activo', true)
        .single();

      if (profileError || !profile) { toast.error('Usuario no encontrado'); return; }

      await supabase
        .from('biometric_credentials')
        .update({ last_used_at: new Date().toISOString() })
        .eq('credential_id', result.credentialId);

      localStorage.setItem('userProfile', JSON.stringify(profile));
      if (setUserProfileDirectly) setUserProfileDirectly(profile);

      runCinematicTransition(profile.nombre_completo || '');
    } catch (error: any) {
      toast.error(error.message === 'Autenticación cancelada por el usuario' ? 'Cancelado' : 'Error de autenticación');
    } finally {
      setIsBiometricLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0e1a]">
        <div className="w-5 h-5 border-2 border-slate-700 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  if (userProfile && phase === 'form') return null;

  const isSplitting = phase === 'splitting' || phase === 'welcome' || phase === 'done';
  const showWelcome = phase === 'welcome' || phase === 'done';

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0e1a] p-6 overflow-hidden relative">

      {/* Animated gradient orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full bg-indigo-600/20 blur-[120px] animate-pulse" />
        <div className="absolute -bottom-40 -right-40 w-[600px] h-[600px] rounded-full bg-purple-600/15 blur-[140px] animate-pulse [animation-delay:2s]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full bg-cyan-500/10 blur-[100px] animate-pulse [animation-delay:4s]" />
        <div className="absolute top-20 right-20 w-[250px] h-[250px] rounded-full bg-fuchsia-500/10 blur-[80px] animate-pulse [animation-delay:3s]" />
      </div>

      {/* Subtle grid */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />

      {/* ======= CINEMATIC SPLIT ANIMATION ======= */}
      <AnimatePresence>
        {isSplitting && (
          <>
            {/* Central glow line */}
            <motion.div
              key="glow-line"
              variants={glowLineVariants}
              initial="hidden"
              animate="visible"
              className="fixed inset-0 z-40 flex items-center justify-center pointer-events-none"
            >
              <div className="w-[2px] h-[70vh] bg-gradient-to-b from-transparent via-indigo-400 to-transparent shadow-[0_0_30px_8px_rgba(99,102,241,0.4),0_0_80px_20px_rgba(99,102,241,0.15)]" />
            </motion.div>

            {/* Left curtain */}
            <motion.div
              key="left-curtain"
              variants={leftHalfVariants}
              initial="hidden"
              animate="visible"
              className="fixed inset-0 z-30 pointer-events-none"
              style={{ clipPath: 'inset(0 50% 0 0)' }}
            >
              <div className="absolute inset-0 bg-[#0a0e1a]" />
            </motion.div>

            {/* Right curtain */}
            <motion.div
              key="right-curtain"
              variants={rightHalfVariants}
              initial="hidden"
              animate="visible"
              className="fixed inset-0 z-30 pointer-events-none"
              style={{ clipPath: 'inset(0 0 0 50%)' }}
            >
              <div className="absolute inset-0 bg-[#0a0e1a]" />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ======= WELCOME SCREEN (behind curtains) ======= */}
      <AnimatePresence>
        {showWelcome && (
          <motion.div
            key="welcome"
            variants={welcomeVariants}
            initial="hidden"
            animate="visible"
            className="fixed inset-0 z-20 flex items-center justify-center"
          >
            <div className="text-center">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.7, ease: EASE_EXPO, delay: 0.6 }}
                className="relative inline-block"
              >
                <div className="absolute inset-0 rounded-3xl bg-indigo-500/25 blur-2xl scale-150" />
                <Image
                  src="/logo-disfero.png"
                  alt="Disfero"
                  width={160}
                  height={160}
                  className="relative w-28 h-28 object-contain mx-auto drop-shadow-[0_0_50px_rgba(99,102,241,0.5)]"
                  priority
                />
              </motion.div>
              <motion.p
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: EASE_EXPO, delay: 0.9 }}
                className="text-white/90 text-xl font-medium mt-6 tracking-tight"
              >
                {welcomeName ? `Bienvenido, ${welcomeName}` : 'Bienvenido'}
              </motion.p>
              <motion.div
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 0.8, ease: EASE_EXPO, delay: 1.0 }}
                className="mt-3 mx-auto w-16 h-[1px] bg-gradient-to-r from-transparent via-indigo-400/60 to-transparent"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ======= LOGIN CARD ======= */}
      <motion.div
        variants={cardVariants}
        animate={phase === 'glow' ? 'glow' : phase === 'form' ? 'idle' : 'exit'}
        className="relative z-10 w-full max-w-[400px]"
      >
        {/* Button glow pulse overlay */}
        <AnimatePresence>
          {phase === 'glow' && (
            <motion.div
              key="btn-glow"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 z-20 rounded-3xl pointer-events-none"
              style={{
                boxShadow: '0 0 60px 20px rgba(99,102,241,0.2), inset 0 0 60px 10px rgba(99,102,241,0.05)',
              }}
            />
          )}
        </AnimatePresence>

        {/* Glass card */}
        <div className="relative rounded-3xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-2xl shadow-[0_8px_64px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.06)] overflow-hidden">
          {/* Top accent */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-px bg-gradient-to-r from-transparent via-indigo-400/60 to-transparent" />

          <div className="px-8 pt-10 pb-8">
            {/* Logo */}
            <div className="text-center mb-8">
              <div className="relative inline-block">
                <div className="absolute inset-0 rounded-2xl bg-indigo-500/20 blur-xl scale-125" />
                <Image
                  src="/logo-disfero.png"
                  alt="Disfero"
                  width={120}
                  height={120}
                  className="relative w-24 h-24 object-contain mx-auto drop-shadow-[0_0_30px_rgba(99,102,241,0.35)]"
                />
              </div>
              <h1 className="text-xl font-semibold text-white tracking-tight mt-5">
                CRM{' '}
                <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                  Disfero
                </span>
              </h1>
              <p className="text-xs text-slate-400/80 mt-1.5 tracking-wide">
                Sistema de gestión comercial
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleLogin} className="space-y-3.5">
              <div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Usuario"
                  required
                  disabled={phase !== 'form'}
                  className="w-full px-4 py-3 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-indigo-500/50 focus:bg-white/[0.06] focus:shadow-[0_0_20px_rgba(99,102,241,0.1)] transition-all duration-300 backdrop-blur-sm disabled:opacity-50"
                />
              </div>

              <div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Contraseña"
                  required
                  disabled={phase !== 'form'}
                  className="w-full px-4 py-3 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-indigo-500/50 focus:bg-white/[0.06] focus:shadow-[0_0_20px_rgba(99,102,241,0.1)] transition-all duration-300 backdrop-blur-sm disabled:opacity-50"
                />
              </div>

              <motion.button
                type="submit"
                disabled={isLoading || phase !== 'form'}
                whileTap={{ scale: 0.98 }}
                className="relative w-full py-3 mt-1 text-white text-sm font-medium rounded-xl transition-all duration-300 disabled:opacity-50 flex items-center justify-center gap-2 overflow-hidden bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-purple-500 shadow-[0_4px_24px_rgba(99,102,241,0.3),inset_0_1px_0_rgba(255,255,255,0.1)] hover:shadow-[0_4px_32px_rgba(99,102,241,0.45)]"
              >
                {isLoading ? (
                  <div className="w-4 h-4 border-2 border-indigo-300 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    Iniciar sesión
                  </>
                )}
              </motion.button>
            </form>

            {/* Biometric */}
            {biometricAvailable && (
              <>
                <div className="flex items-center gap-4 my-5">
                  <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                  <span className="text-[10px] text-slate-500 uppercase tracking-widest">o</span>
                  <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                </div>

                <motion.button
                  type="button"
                  onClick={handleBiometricLogin}
                  disabled={isBiometricLoading || phase !== 'form'}
                  whileTap={{ scale: 0.98 }}
                  className="w-full py-3 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] hover:border-white/[0.12] text-slate-300 text-sm font-medium rounded-xl transition-all duration-300 disabled:opacity-50 flex items-center justify-center gap-2 backdrop-blur-sm"
                >
                  {isBiometricLoading ? (
                    <div className="w-4 h-4 border-2 border-slate-600 border-t-slate-300 rounded-full animate-spin" />
                  ) : (
                    <>
                      <Fingerprint className="w-4 h-4" />
                      {biometricType}
                    </>
                  )}
                </motion.button>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-white/[0.05] px-8 py-4 bg-white/[0.02]">
            <p className="text-center text-[11px] text-slate-500">
              ¿Necesitas acceso?{' '}
              <a
                href="mailto:javierrcam@gmail.com"
                className="text-indigo-400/80 hover:text-indigo-300 transition-colors"
              >
                Contacta al administrador
              </a>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

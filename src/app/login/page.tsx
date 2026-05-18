'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  LogIn,
  Fingerprint,
  User,
  Lock,
  Eye,
  EyeOff,
  BarChart3,
  Truck,
  LineChart,
  ShieldCheck,
} from 'lucide-react';
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

const BRANDS = [
  { name: 'Schwarzkopf', sub: 'PROFESSIONAL', font: 'font-serif italic' },
  { name: 'SUTRA', sub: 'PROFESSIONAL', font: 'tracking-[0.25em] font-light' },
  { name: 'MYRIALISS', sub: '', font: 'tracking-[0.2em] font-medium' },
  { name: 'HIPERTIN', sub: 'PROFESSIONAL', font: 'tracking-[0.15em] font-medium' },
  { name: 'KEYRA', sub: 'PROFESSIONAL', font: 'tracking-[0.2em] font-semibold' },
];

const FEATURES = [
  { icon: BarChart3, title: 'Gestión inteligente', desc: 'de ventas y clientes' },
  { icon: Truck, title: 'Control total', desc: 'de tu distribución' },
  { icon: LineChart, title: 'Reportes en tiempo real', desc: 'para mejores decisiones' },
  { icon: ShieldCheck, title: 'Plataforma segura', desc: 'y siempre disponible' },
];

function FlowingWaves() {
  return (
    <svg
      className="absolute bottom-0 left-0 w-full h-[45%] pointer-events-none opacity-60"
      viewBox="0 0 1440 600"
      preserveAspectRatio="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="wave1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="rgba(99,102,241,0.3)" />
          <stop offset="50%" stopColor="rgba(168,85,247,0.2)" />
          <stop offset="100%" stopColor="rgba(59,130,246,0.1)" />
        </linearGradient>
        <linearGradient id="wave2" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="rgba(139,92,246,0.25)" />
          <stop offset="100%" stopColor="rgba(99,102,241,0.05)" />
        </linearGradient>
        <linearGradient id="wave3" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="rgba(168,85,247,0.15)" />
          <stop offset="100%" stopColor="rgba(59,130,246,0.2)" />
        </linearGradient>
      </defs>
      <path fill="url(#wave1)" opacity="0.7">
        <animate
          attributeName="d"
          dur="12s"
          repeatCount="indefinite"
          values="
            M0,400 C200,300 400,350 600,320 C800,290 1000,360 1200,300 C1300,270 1400,320 1440,310 L1440,600 L0,600 Z;
            M0,380 C200,340 400,280 600,350 C800,420 1000,300 1200,340 C1300,360 1400,300 1440,330 L1440,600 L0,600 Z;
            M0,400 C200,300 400,350 600,320 C800,290 1000,360 1200,300 C1300,270 1400,320 1440,310 L1440,600 L0,600 Z
          "
        />
      </path>
      <path fill="url(#wave2)" opacity="0.5">
        <animate
          attributeName="d"
          dur="16s"
          repeatCount="indefinite"
          values="
            M0,450 C180,380 380,420 580,380 C780,340 980,410 1180,370 C1300,350 1400,390 1440,380 L1440,600 L0,600 Z;
            M0,420 C180,440 380,360 580,410 C780,460 980,370 1180,400 C1300,420 1400,370 1440,400 L1440,600 L0,600 Z;
            M0,450 C180,380 380,420 580,380 C780,340 980,410 1180,370 C1300,350 1400,390 1440,380 L1440,600 L0,600 Z
          "
        />
      </path>
      <path fill="url(#wave3)" opacity="0.3">
        <animate
          attributeName="d"
          dur="20s"
          repeatCount="indefinite"
          values="
            M0,500 C240,440 480,480 720,450 C960,420 1100,470 1300,440 C1380,430 1440,460 1440,450 L1440,600 L0,600 Z;
            M0,470 C240,500 480,430 720,470 C960,510 1100,440 1300,470 C1380,480 1440,440 1440,460 L1440,600 L0,600 Z;
            M0,500 C240,440 480,480 720,450 C960,420 1100,470 1300,440 C1380,430 1440,460 1440,450 L1440,600 L0,600 Z
          "
        />
      </path>
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const { supabase, userProfile, loading, loginWithTable, setUserProfileDirectly } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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

  const runCinematicTransition = useCallback(
    (name: string) => {
      setWelcomeName(name);
      setPhase('glow');
      setTimeout(() => setPhase('splitting'), 200);
      setTimeout(() => setPhase('welcome'), 900);
      setTimeout(() => {
        setPhase('done');
        toast.success(name ? `¡Bienvenido, ${name}!` : '¡Bienvenido!');
        router.push('/');
      }, 1800);
    },
    [router],
  );

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) {
      toast.error('Error de configuración');
      return;
    }
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
      if (!result) {
        toast.error('Autenticación fallida');
        return;
      }

      const usedCredential = credentials.find(
        (c: { credential_id: string }) => c.credential_id === result.credentialId,
      );
      if (!usedCredential) {
        toast.error('Credencial no encontrada');
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from('users_profile')
        .select('*')
        .eq('id', usedCredential.user_id)
        .eq('activo', true)
        .single();

      if (profileError || !profile) {
        toast.error('Usuario no encontrado');
        return;
      }

      await supabase
        .from('biometric_credentials')
        .update({ last_used_at: new Date().toISOString() })
        .eq('credential_id', result.credentialId);

      localStorage.setItem('userProfile', JSON.stringify(profile));
      if (setUserProfileDirectly) setUserProfileDirectly(profile);

      runCinematicTransition(profile.nombre_completo || '');
    } catch (error: any) {
      toast.error(
        error.message === 'Autenticación cancelada por el usuario'
          ? 'Cancelado'
          : 'Error de autenticación',
      );
    } finally {
      setIsBiometricLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#080b14]">
        <div className="w-5 h-5 border-2 border-slate-700 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  if (userProfile && phase === 'form') return null;

  const isSplitting = phase === 'splitting' || phase === 'welcome' || phase === 'done';
  const showWelcome = phase === 'welcome' || phase === 'done';

  return (
    <div className="min-h-screen flex flex-col bg-[#080b14] overflow-hidden relative">
      {/* ===== BACKGROUND LAYERS ===== */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Ambient orbs */}
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-indigo-600/15 blur-[150px]" />
        <div className="absolute top-1/3 -right-32 w-[500px] h-[500px] rounded-full bg-purple-700/10 blur-[130px]" />
        <div className="absolute bottom-0 left-1/3 w-[400px] h-[400px] rounded-full bg-violet-600/8 blur-[120px]" />

        {/* Subtle noise texture */}
        <div className="absolute inset-0 opacity-[0.015]" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
        }} />

        <FlowingWaves />
      </div>

      {/* ===== CINEMATIC TRANSITION ===== */}
      <AnimatePresence>
        {isSplitting && (
          <>
            <motion.div
              key="glow-line"
              variants={glowLineVariants}
              initial="hidden"
              animate="visible"
              className="fixed inset-0 z-[60] flex items-center justify-center pointer-events-none"
            >
              <div className="w-[2px] h-[70vh] bg-gradient-to-b from-transparent via-indigo-400 to-transparent shadow-[0_0_30px_8px_rgba(99,102,241,0.4),0_0_80px_20px_rgba(99,102,241,0.15)]" />
            </motion.div>
            <motion.div
              key="left-curtain"
              variants={leftHalfVariants}
              initial="hidden"
              animate="visible"
              className="fixed inset-0 z-50 pointer-events-none"
              style={{ clipPath: 'inset(0 50% 0 0)' }}
            >
              <div className="absolute inset-0 bg-[#080b14]" />
            </motion.div>
            <motion.div
              key="right-curtain"
              variants={rightHalfVariants}
              initial="hidden"
              animate="visible"
              className="fixed inset-0 z-50 pointer-events-none"
              style={{ clipPath: 'inset(0 0 0 50%)' }}
            >
              <div className="absolute inset-0 bg-[#080b14]" />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showWelcome && (
          <motion.div
            key="welcome"
            variants={welcomeVariants}
            initial="hidden"
            animate="visible"
            className="fixed inset-0 z-40 flex items-center justify-center"
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

      {/* ===== MAIN CONTENT ===== */}
      <motion.div
        variants={cardVariants}
        animate={phase === 'glow' ? 'glow' : phase === 'form' ? 'idle' : 'exit'}
        className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-8"
      >
        {/* Glow overlay on card phase */}
        <AnimatePresence>
          {phase === 'glow' && (
            <motion.div
              key="btn-glow"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-20 pointer-events-none"
              style={{ boxShadow: 'inset 0 0 120px 40px rgba(99,102,241,0.08)' }}
            />
          )}
        </AnimatePresence>

        {/* ===== GLASS CARD ===== */}
        <div className="w-full max-w-[420px]">
          <div className="relative rounded-2xl border border-white/[0.07] bg-gradient-to-b from-white/[0.06] to-white/[0.02] backdrop-blur-2xl shadow-[0_8px_80px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.04)] overflow-hidden">
            {/* Top glow line */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-[1px] bg-gradient-to-r from-transparent via-indigo-400/40 to-transparent" />

            <div className="px-8 pt-10 pb-7">
              {/* Logo */}
              <div className="text-center mb-7">
                <div className="relative inline-block">
                  <div className="absolute inset-0 rounded-2xl bg-indigo-500/20 blur-xl scale-150" />
                  <Image
                    src="/logo-disfero.png"
                    alt="Disfero"
                    width={100}
                    height={100}
                    className="relative w-20 h-20 object-contain mx-auto drop-shadow-[0_0_30px_rgba(99,102,241,0.3)]"
                  />
                </div>
                <h1 className="text-[22px] font-semibold text-white tracking-tight mt-4">
                  CRM{' '}
                  <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                    Disfero
                  </span>
                  <span className="text-[11px] font-normal text-slate-500 ml-1.5">v2.0</span>
                </h1>
                <p className="text-[11px] text-slate-400/70 mt-1 leading-relaxed">
                  Ecosistema profesional
                  <br />
                  para belleza y distribución
                </p>
              </div>

              {/* Form */}
              <form onSubmit={handleLogin} className="space-y-3">
                {/* Username */}
                <div className="relative group">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Usuario"
                    required
                    disabled={phase !== 'form'}
                    className="w-full pl-10 pr-4 py-3 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-indigo-500/40 focus:bg-white/[0.06] focus:shadow-[0_0_16px_rgba(99,102,241,0.08)] transition-all duration-300 disabled:opacity-50"
                  />
                </div>

                {/* Password */}
                <div className="relative group">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Contraseña"
                    required
                    disabled={phase !== 'form'}
                    className="w-full pl-10 pr-10 py-3 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-indigo-500/40 focus:bg-white/[0.06] focus:shadow-[0_0_16px_rgba(99,102,241,0.08)] transition-all duration-300 disabled:opacity-50"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {/* Submit */}
                <motion.button
                  type="submit"
                  disabled={isLoading || phase !== 'form'}
                  whileTap={{ scale: 0.98 }}
                  className="relative w-full py-3 mt-1 text-white text-sm font-medium rounded-xl disabled:opacity-50 flex items-center justify-center gap-2 overflow-hidden bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 shadow-[0_4px_24px_rgba(99,102,241,0.25),inset_0_1px_0_rgba(255,255,255,0.1)] hover:shadow-[0_4px_32px_rgba(99,102,241,0.4)] hover:brightness-110 active:brightness-95 transition-all duration-300"
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
                  <div className="flex items-center gap-4 my-4">
                    <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                    <span className="text-[10px] text-slate-500 uppercase tracking-widest">o</span>
                    <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                  </div>

                  <motion.button
                    type="button"
                    onClick={handleBiometricLogin}
                    disabled={isBiometricLoading || phase !== 'form'}
                    whileTap={{ scale: 0.98 }}
                    className="w-full py-3 bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.08] text-slate-300 text-sm font-medium rounded-xl transition-all duration-300 disabled:opacity-50 flex items-center justify-center gap-2"
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
            <div className="border-t border-white/[0.05] px-8 py-3.5 bg-white/[0.015]">
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
        </div>

        {/* ===== BRANDS SECTION ===== */}
        <div className="w-full max-w-3xl mt-12 text-center">
          <div className="flex items-center justify-center gap-3 mb-5">
            <div className="h-px w-12 bg-gradient-to-r from-transparent to-white/10" />
            <p className="text-[11px] text-slate-500 tracking-wide">
              Distribuidor oficial de{' '}
              <span className="text-slate-300 font-medium">marcas premium</span>
            </p>
            <div className="h-px w-12 bg-gradient-to-l from-transparent to-white/10" />
          </div>

          <div className="flex items-center justify-center gap-6 sm:gap-10 flex-wrap">
            {BRANDS.map((b) => (
              <div key={b.name} className="text-center opacity-50 hover:opacity-80 transition-opacity duration-300">
                <p className={`text-white text-[13px] sm:text-sm leading-none ${b.font}`}>
                  {b.name}
                </p>
                {b.sub && (
                  <p className="text-[8px] tracking-[0.2em] text-slate-400 mt-0.5">{b.sub}</p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ===== FEATURES BADGES ===== */}
        <div className="w-full max-w-3xl mt-10 mb-4">
          <div className="flex items-stretch justify-center gap-3 sm:gap-4 flex-wrap">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] backdrop-blur-sm"
              >
                <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                  <f.icon className="w-3.5 h-3.5 text-indigo-400" />
                </div>
                <div className="text-left">
                  <p className="text-[11px] font-medium text-slate-300 leading-tight">{f.title}</p>
                  <p className="text-[10px] text-slate-500 leading-tight">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { LogIn, Fingerprint } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';
import { 
  isPlatformAuthenticatorAvailable, 
  authenticateWithBiometric, 
  getBiometricType 
} from '@/lib/webauthn';
import { getSupabaseClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const { supabase, userProfile, loading, loginWithTable, setUserProfileDirectly } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState('');
  const [isBiometricLoading, setIsBiometricLoading] = useState(false);
  
  // Estados para la animación de éxito (minimalista)
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);

  useEffect(() => {
    if (!loading && userProfile && !showSuccessAnimation) {
      router.push('/');
    }
    checkBiometricAvailability();
  }, [userProfile, loading, router, showSuccessAnimation]);
  
  // Animación minimalista: fade + logo + redirect
  const startSuccessAnimation = (callback: () => void) => {
    setShowSuccessAnimation(true);
    setTimeout(() => {
      callback();
    }, 1200);
  };

  const checkBiometricAvailability = async () => {
    const available = await isPlatformAuthenticatorAvailable();
    setBiometricAvailable(available);
    if (available) {
      const type = await getBiometricType();
      setBiometricType(type);
    }
  };

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
      
      // Iniciar animación de éxito y luego redirigir
      startSuccessAnimation(() => {
        toast.success('¡Bienvenido!');
        router.push('/');
      });
    } catch (error: any) {
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

      const credentialIds = credentials.map(c => c.credential_id);
      const result = await authenticateWithBiometric(credentialIds);

      if (!result) {
        toast.error('Autenticación fallida');
        return;
      }

      const usedCredential = credentials.find(c => c.credential_id === result.credentialId);
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
      if (setUserProfileDirectly) {
        setUserProfileDirectly(profile);
      }
      
      // Iniciar animación de éxito y luego redirigir
      startSuccessAnimation(() => {
        toast.success(`¡Bienvenido, ${profile.nombre_completo}!`);
        router.push('/');
      });

    } catch (error: any) {
      if (error.message === 'Autenticación cancelada por el usuario') {
        toast.error('Cancelado');
      } else {
        toast.error('Error de autenticación');
      }
    } finally {
      setIsBiometricLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="w-5 h-5 border-2 border-slate-700 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  if (userProfile) return null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 p-6 overflow-hidden relative">
      
      {/* Animación de éxito - Minimalista */}
      {showSuccessAnimation && (
        <div className="fixed inset-0 z-50 bg-slate-900 flex items-center justify-center animate-fade-in">
          <div className="text-center animate-scale-in">
            <Image
              src="/logo-disfero.png"
              alt="Disfero"
              width={120}
              height={120}
              className="w-24 h-24 object-contain mx-auto mb-4"
              priority
            />
            <div className="flex items-center justify-center gap-2 text-white">
              <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-lg font-medium">Bienvenido</span>
            </div>
          </div>
        </div>
      )}

      {/* Contenido del Login */}
      <div className={`w-full max-w-sm transition-all duration-300 ${
        showSuccessAnimation ? 'opacity-0 scale-95' : 'opacity-100 scale-100'
      }`}>
        {/* Logo */}
        <div className="text-center mb-12">
          <Image
            src="/logo-disfero.png"
            alt="Disfero"
            width={160}
            height={160}
            className="mx-auto mb-6 w-40 h-40 object-contain animate-bounce-slow"
          />
          <h1 className="text-2xl font-semibold text-white tracking-tight">
            CRM <span className="text-indigo-400">Disfero</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Sistema de gestión comercial
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Usuario"
              required
              className="w-full px-4 py-3.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-0 transition-colors"
            />
          </div>

          <div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Contraseña"
              required
              className="w-full px-4 py-3.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-0 transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <div className="w-4 h-4 border-2 border-indigo-400 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <LogIn className="w-4 h-4" />
                Iniciar sesión
              </>
            )}
          </button>
        </form>

        {/* Biometric */}
        {biometricAvailable && (
          <>
            <div className="flex items-center gap-4 my-6">
              <div className="flex-1 h-px bg-slate-700" />
              <span className="text-xs text-slate-500">o</span>
              <div className="flex-1 h-px bg-slate-700" />
            </div>

            <button
              type="button"
              onClick={handleBiometricLogin}
              disabled={isBiometricLoading}
              className="w-full py-3.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-sm font-medium rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isBiometricLoading ? (
                <div className="w-4 h-4 border-2 border-slate-600 border-t-slate-300 rounded-full animate-spin" />
              ) : (
                <>
                  <Fingerprint className="w-4 h-4" />
                  {biometricType}
                </>
              )}
            </button>
          </>
        )}

        {/* Footer */}
        <p className="text-center text-xs text-slate-500 mt-10">
          ¿Necesitas acceso?{' '}
          <a href="mailto:javierrcam@gmail.com" className="text-indigo-400 hover:text-indigo-300 transition-colors">
            Contacta al administrador
          </a>
        </p>
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { User, Lock, LogIn, AlertCircle, Mail as MailIcon, Fingerprint, Smartphone, Scan } from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';
import Link from 'next/link';
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
  const [showPasswordForm, setShowPasswordForm] = useState(false);

  useEffect(() => {
    if (!loading && userProfile) {
      router.push('/');
    }
    checkBiometricAvailability();
  }, [userProfile, loading, router]);

  const checkBiometricAvailability = async () => {
    const available = await isPlatformAuthenticatorAvailable();
    setBiometricAvailable(available);
    
    if (available) {
      const type = await getBiometricType();
      setBiometricType(type);
    } else {
      setShowPasswordForm(true);
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
        return;
      }

      toast.success('Sesión iniciada correctamente');
      router.push('/');
    } catch (error: any) {
      console.error('Error en login:', error);
      toast.error('Error al iniciar sesión');
    } finally {
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
        toast.error('No hay credenciales biométricas registradas. Inicia sesión normalmente y configúrala en tu perfil.');
        setShowPasswordForm(true);
        return;
      }

      const credentialIds = credentials.map(c => c.credential_id);
      const result = await authenticateWithBiometric(credentialIds);

      if (!result) {
        toast.error('Autenticación biométrica fallida');
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
        toast.error('Usuario no encontrado o inactivo');
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
      
      toast.success(`¡Bienvenido, ${profile.nombre_completo}!`);
      router.push('/');

    } catch (error: any) {
      console.error('Error en login biométrico:', error);
      if (error.message === 'Autenticación cancelada por el usuario') {
        toast.error('Autenticación cancelada');
      } else {
        toast.error('Error en autenticación biométrica');
      }
    } finally {
      setIsBiometricLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-indigo-900 to-slate-900">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-white"></div>
          <p className="mt-4 text-white/70">Cargando...</p>
        </div>
      </div>
    );
  }

  if (userProfile) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-indigo-900 to-slate-900 p-4 sm:p-6 lg:p-8">
      {/* Efectos de fondo */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-indigo-500/20 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-500/20 rounded-full blur-3xl"></div>
      </div>

      <div className="relative max-w-md w-full space-y-6 sm:space-y-8">
        {/* Logo y Header */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl shadow-xl mb-4 sm:mb-6">
            <span className="text-2xl sm:text-3xl font-black text-white">D</span>
          </div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white">
            CRM <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">Disfero</span>
          </h1>
          <p className="mt-2 text-sm sm:text-base text-white/60">
            Sistema de Gestión Comercial
          </p>
        </div>

        {/* Card de Login */}
        <Card className="p-6 sm:p-8 bg-white/10 backdrop-blur-xl border border-white/20 shadow-2xl">
          
          {/* Botón de Face ID / Biometría */}
          {biometricAvailable && (
            <div className="mb-6">
              <button
                type="button"
                onClick={handleBiometricLogin}
                disabled={isBiometricLoading}
                className="w-full relative overflow-hidden group rounded-xl"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 opacity-80 group-hover:opacity-100 transition-opacity"></div>
                <div className="relative flex flex-col items-center justify-center py-6 sm:py-8 px-4">
                  {isBiometricLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-12 w-12 sm:h-14 sm:w-14 border-4 border-white/30 border-t-white mb-3"></div>
                      <span className="text-white font-medium text-sm sm:text-base">Verificando identidad...</span>
                    </>
                  ) : (
                    <>
                      <div className="relative mb-3">
                        <Scan className="h-12 w-12 sm:h-14 sm:w-14 text-white animate-pulse" />
                        <Fingerprint className="h-6 w-6 sm:h-7 sm:w-7 text-white absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
                      </div>
                      <span className="text-white font-semibold text-base sm:text-lg">
                        Acceder con {biometricType}
                      </span>
                      <span className="text-white/70 text-xs sm:text-sm mt-1">
                        Toca para autenticarte
                      </span>
                    </>
                  )}
                </div>
              </button>
              
              {!showPasswordForm && (
                <button
                  type="button"
                  onClick={() => setShowPasswordForm(true)}
                  className="w-full mt-4 py-2 text-white/60 hover:text-white text-sm transition-colors"
                >
                  Usar contraseña en su lugar
                </button>
              )}
            </div>
          )}

          {/* Separador */}
          {biometricAvailable && showPasswordForm && (
            <div className="flex items-center gap-3 my-6">
              <div className="flex-1 h-px bg-white/20"></div>
              <span className="text-xs text-white/40 uppercase tracking-wider">o</span>
              <div className="flex-1 h-px bg-white/20"></div>
            </div>
          )}

          {/* Formulario de contraseña */}
          {(showPasswordForm || !biometricAvailable) && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">
                  Usuario
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-white/40" />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="tu_usuario"
                    required
                    className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-white/80">
                    Contraseña
                  </label>
                  <Link
                    href="/recuperar-contraseña"
                    className="text-xs text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
                  >
                    ¿Olvidaste tu contraseña?
                  </Link>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-white/40" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold rounded-xl shadow-lg shadow-indigo-500/30 transition-all disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    <span>Iniciando sesión...</span>
                  </>
                ) : (
                  <>
                    <LogIn className="h-5 w-5" />
                    <span>Iniciar Sesión</span>
                  </>
                )}
              </button>

              {biometricAvailable && showPasswordForm && (
                <button
                  type="button"
                  onClick={() => setShowPasswordForm(false)}
                  className="w-full py-2 text-white/60 hover:text-white text-sm transition-colors flex items-center justify-center gap-2"
                >
                  <Fingerprint className="h-4 w-4" />
                  Volver a usar {biometricType}
                </button>
              )}
            </form>
          )}
        </Card>

        {/* Info adicional */}
        <div className="text-center space-y-3">
          <div className="p-4 bg-white/5 backdrop-blur border border-white/10 rounded-xl">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-indigo-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1 text-left">
                <p className="text-sm font-medium text-white/90">
                  ¿No tienes una cuenta?
                </p>
                <p className="text-xs text-white/60 mt-1">
                  Contacta al administrador para obtener acceso.
                </p>
                <a
                  href="mailto:javierrcam@gmail.com"
                  className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  <MailIcon className="h-3 w-3" />
                  javierrcam@gmail.com
                </a>
              </div>
            </div>
          </div>

          {biometricAvailable && (
            <p className="text-xs text-white/40 flex items-center justify-center gap-1">
              <Smartphone className="h-3 w-3" />
              Configura {biometricType} desde tu perfil
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

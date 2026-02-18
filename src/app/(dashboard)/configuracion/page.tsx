'use client';

import { useState, useEffect } from 'react';
import { Lock, Eye, EyeOff, CheckCircle, AlertCircle, Fingerprint, Trash2, Smartphone, Shield, Settings, ChevronRight, Sun, Moon, Monitor } from 'lucide-react';
import Link from 'next/link';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Badge from '@/components/ui/Badge';
import { useAuth } from '@/contexts/AuthContext';
import { getSupabaseClient } from '@/lib/supabase/client';
import toast from 'react-hot-toast';
import {
  isPlatformAuthenticatorAvailable,
  registerBiometric,
  getBiometricType
} from '@/lib/webauthn';
import { useTheme } from '@/contexts/ThemeContext';
import type { ThemePreference } from '@/types/database';

interface BiometricCredential {
  id: string;
  credential_id: string;
  device_name: string | null;
  created_at: string;
  last_used_at: string | null;
}

export default function ConfiguracionPage() {
  const { supabase, userProfile, refreshUser } = useAuth();
  const { theme, setTheme } = useTheme();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSavingTheme, setIsSavingTheme] = useState(false);
  
  // Biometría
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState('');
  const [biometricCredentials, setBiometricCredentials] = useState<BiometricCredential[]>([]);
  const [isRegisteringBiometric, setIsRegisteringBiometric] = useState(false);
  const [deviceName, setDeviceName] = useState('');
  
  const [isFirstTime, setIsFirstTime] = useState(userProfile?.debe_cambiar_password || false);

  const handleThemeChange = async (newTheme: ThemePreference) => {
    setTheme(newTheme);
    
    if (!supabase || !userProfile) return;
    
    setIsSavingTheme(true);
    try {
      const { error } = await supabase
        .from('users_profile')
        .update({ theme_preference: newTheme })
        .eq('id', userProfile.id);

      if (error) {
        console.error('Error guardando preferencia de tema:', error);
      } else {
        const stored = localStorage.getItem('crm_user_profile');
        if (stored) {
          const profile = JSON.parse(stored);
          profile.theme_preference = newTheme;
          localStorage.setItem('crm_user_profile', JSON.stringify(profile));
        }
      }
    } catch (error) {
      console.error('Error guardando preferencia de tema:', error);
    } finally {
      setIsSavingTheme(false);
    }
  };

  useEffect(() => {
    checkBiometricAvailability();
    loadBiometricCredentials();
  }, [userProfile]);

  const checkBiometricAvailability = async () => {
    const available = await isPlatformAuthenticatorAvailable();
    setBiometricAvailable(available);
    
    if (available) {
      const type = await getBiometricType();
      setBiometricType(type);
    }
  };

  const loadBiometricCredentials = async () => {
    if (!userProfile) return;
    
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('biometric_credentials')
        .select('*')
        .eq('user_id', userProfile.id)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setBiometricCredentials(data);
      }
    } catch (error) {
      console.error('Error cargando credenciales:', error);
    }
  };

  const handleRegisterBiometric = async () => {
    if (!userProfile) return;
    
    setIsRegisteringBiometric(true);
    try {
      const result = await registerBiometric(
        userProfile.id,
        userProfile.username || userProfile.email,
        userProfile.nombre_completo
      );

      if (!result) {
        toast.error('No se pudo registrar la biometría');
        return;
      }

      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from('biometric_credentials')
        .insert({
          user_id: userProfile.id,
          credential_id: result.credentialId,
          public_key: result.publicKey,
          device_name: deviceName || `${biometricType} - ${new Date().toLocaleDateString()}`,
        });

      if (error) {
        console.error('Error guardando credencial:', error);
        toast.error('Error al guardar la credencial');
        return;
      }

      toast.success(`${biometricType} configurado correctamente`);
      setDeviceName('');
      loadBiometricCredentials();

    } catch (error: any) {
      console.error('Error registrando biometría:', error);
      if (error.message === 'Autenticación cancelada por el usuario') {
        toast.error('Registro cancelado');
      } else {
        toast.error(error.message || 'Error al registrar biometría');
      }
    } finally {
      setIsRegisteringBiometric(false);
    }
  };

  const handleDeleteBiometric = async (credentialId: string) => {
    if (!confirm('¿Eliminar esta credencial biométrica?')) return;

    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from('biometric_credentials')
        .delete()
        .eq('id', credentialId);

      if (error) {
        toast.error('Error al eliminar');
        return;
      }

      toast.success('Credencial eliminada');
      loadBiometricCredentials();
    } catch (error) {
      toast.error('Error al eliminar');
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!supabase || !userProfile) {
      toast.error('Error de autenticación');
      return;
    }

    if (newPassword.length < 4) {
      toast.error('La contraseña debe tener al menos 4 caracteres');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('Las contraseñas no coinciden');
      return;
    }

    setIsLoading(true);

    try {
      if (!isFirstTime && currentPassword) {
        const { data: checkUser } = await supabase
          .from('users_profile')
          .select('password')
          .eq('id', userProfile.id)
          .single();

        if (checkUser?.password !== currentPassword) {
          toast.error('La contraseña actual es incorrecta');
          setIsLoading(false);
          return;
        }
      }

      const { error } = await supabase
        .from('users_profile')
        .update({ 
          password: newPassword,
          password_temp: null,
          debe_cambiar_password: false 
        })
        .eq('id', userProfile.id);

      if (error) {
        toast.error(error.message || 'Error al actualizar la contraseña');
        return;
      }

      toast.success('Contraseña actualizada correctamente');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setIsFirstTime(false);
      
      if (refreshUser) {
        await refreshUser();
      }
    } catch (error: any) {
      console.error('Error cambiando contraseña:', error);
      toast.error('Error al cambiar la contraseña');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Configuración</h1>
        <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-200 mt-1">
          Gestiona tu cuenta y preferencias
        </p>
      </div>

      {/* Panel Admin - Configurar Menú */}
      {userProfile?.rol === 'admin' && (
        <Link href="/configuracion/sidebar">
          <Card className="hover:shadow-md transition-shadow cursor-pointer border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-900/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center">
                  <Settings className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">Configurar Menú del Sidebar</p>
                  <p className="text-xs text-gray-500 dark:text-gray-200">Controla qué ítems del menú ve cada rol</p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-gray-400 dark:text-gray-300" />
            </div>
          </Card>
        </Link>
      )}

      {/* Información del Usuario */}
      <Card>
        <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-3 sm:mb-4">Información del Usuario</h2>
        <div className="space-y-2 sm:space-y-3 text-sm">
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-200">Nombre</label>
            <p className="mt-1 text-gray-900 dark:text-gray-100">
              {userProfile?.nombre_completo || 'No disponible'}
            </p>
          </div>
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-200">Usuario</label>
            <p className="mt-1 text-gray-900 dark:text-gray-100">@{userProfile?.username || 'No disponible'}</p>
          </div>
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-200">Email</label>
            <p className="mt-1 text-gray-900 dark:text-gray-100">{userProfile?.email || 'No disponible'}</p>
          </div>
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-200">Rol</label>
            <p className="mt-1 text-gray-900 dark:text-gray-100 capitalize">
              {userProfile?.rol || 'No asignado'}
            </p>
          </div>
        </div>
      </Card>

      {/* Apariencia - Tema */}
      <Card>
        <div className="flex items-center gap-2 mb-3 sm:mb-4">
          {theme === 'dark' ? (
            <Moon className="h-4 w-4 sm:h-5 sm:w-5 text-indigo-600 dark:text-indigo-400" />
          ) : theme === 'light' ? (
            <Sun className="h-4 w-4 sm:h-5 sm:w-5 text-indigo-600 dark:text-indigo-400" />
          ) : (
            <Monitor className="h-4 w-4 sm:h-5 sm:w-5 text-indigo-600 dark:text-indigo-400" />
          )}
          <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">
            Apariencia
          </h2>
        </div>

        <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-200 mb-4">
          Elige el tema que prefieras para cuidar tus ojos. El modo oscuro es ideal para ambientes con poca luz.
        </p>

        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {/* Opción Light */}
          <button
            onClick={() => handleThemeChange('light')}
            disabled={isSavingTheme}
            className={`relative flex flex-col items-center p-3 sm:p-4 rounded-xl border-2 transition-all duration-200 ${
              theme === 'light'
                ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30'
                : 'border-gray-200 dark:border-dark-600 hover:border-gray-300 dark:hover:border-slate-500 bg-white dark:bg-dark-800'
            }`}
          >
            <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center mb-2 ${
              theme === 'light'
                ? 'bg-indigo-100 dark:bg-indigo-800'
                : 'bg-gray-100 dark:bg-dark-700'
            }`}>
              <Sun className={`h-5 w-5 sm:h-6 sm:w-6 ${
                theme === 'light'
                  ? 'text-indigo-600 dark:text-indigo-400'
                  : 'text-gray-500 dark:text-gray-200'
              }`} />
            </div>
            <span className={`text-xs sm:text-sm font-medium ${
              theme === 'light'
                ? 'text-indigo-700 dark:text-indigo-300'
                : 'text-gray-700 dark:text-gray-200'
            }`}>
              Claro
            </span>
            {theme === 'light' && (
              <div className="absolute top-2 right-2">
                <CheckCircle className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              </div>
            )}
          </button>

          {/* Opción Dark */}
          <button
            onClick={() => handleThemeChange('dark')}
            disabled={isSavingTheme}
            className={`relative flex flex-col items-center p-3 sm:p-4 rounded-xl border-2 transition-all duration-200 ${
              theme === 'dark'
                ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30'
                : 'border-gray-200 dark:border-dark-600 hover:border-gray-300 dark:hover:border-slate-500 bg-white dark:bg-dark-800'
            }`}
          >
            <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center mb-2 ${
              theme === 'dark'
                ? 'bg-indigo-100 dark:bg-indigo-800'
                : 'bg-gray-100 dark:bg-dark-700'
            }`}>
              <Moon className={`h-5 w-5 sm:h-6 sm:w-6 ${
                theme === 'dark'
                  ? 'text-indigo-600 dark:text-indigo-400'
                  : 'text-gray-500 dark:text-gray-200'
              }`} />
            </div>
            <span className={`text-xs sm:text-sm font-medium ${
              theme === 'dark'
                ? 'text-indigo-700 dark:text-indigo-300'
                : 'text-gray-700 dark:text-gray-200'
            }`}>
              Oscuro
            </span>
            {theme === 'dark' && (
              <div className="absolute top-2 right-2">
                <CheckCircle className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              </div>
            )}
          </button>

          {/* Opción Auto */}
          <button
            onClick={() => handleThemeChange('auto')}
            disabled={isSavingTheme}
            className={`relative flex flex-col items-center p-3 sm:p-4 rounded-xl border-2 transition-all duration-200 ${
              theme === 'auto'
                ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30'
                : 'border-gray-200 dark:border-dark-600 hover:border-gray-300 dark:hover:border-slate-500 bg-white dark:bg-dark-800'
            }`}
          >
            <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center mb-2 ${
              theme === 'auto'
                ? 'bg-indigo-100 dark:bg-indigo-800'
                : 'bg-gray-100 dark:bg-dark-700'
            }`}>
              <Monitor className={`h-5 w-5 sm:h-6 sm:w-6 ${
                theme === 'auto'
                  ? 'text-indigo-600 dark:text-indigo-400'
                  : 'text-gray-500 dark:text-gray-200'
              }`} />
            </div>
            <span className={`text-xs sm:text-sm font-medium ${
              theme === 'auto'
                ? 'text-indigo-700 dark:text-indigo-300'
                : 'text-gray-700 dark:text-gray-200'
            }`}>
              Automático
            </span>
            {theme === 'auto' && (
              <div className="absolute top-2 right-2">
                <CheckCircle className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              </div>
            )}
          </button>
        </div>

        <p className="mt-3 text-[10px] sm:text-xs text-gray-500 dark:text-gray-200">
          {theme === 'auto' 
            ? 'El tema se ajustará automáticamente según la configuración de tu sistema operativo.'
            : theme === 'dark'
            ? 'El modo oscuro reduce la fatiga visual en ambientes con poca luz.'
            : 'El modo claro es ideal para ambientes bien iluminados.'}
        </p>
      </Card>

      {/* Autenticación Biométrica */}
      {biometricAvailable && (
        <Card>
          <div className="flex items-center gap-2 mb-3 sm:mb-4">
            <Fingerprint className="h-4 w-4 sm:h-5 sm:w-5 text-indigo-600 dark:text-indigo-400" />
            <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">
              Autenticación Biométrica
            </h2>
            <Badge variant="blue" className="text-[10px] sm:text-xs">{biometricType}</Badge>
          </div>

          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-200 mb-4">
            Configura {biometricType} para acceder más rápido sin necesidad de escribir tu contraseña.
          </p>

          {/* Credenciales existentes */}
          {biometricCredentials.length > 0 && (
            <div className="mb-4 space-y-2">
              <p className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-200">Dispositivos registrados:</p>
              {biometricCredentials.map((cred) => (
                <div
                  key={cred.id}
                  className="flex items-center justify-between p-2 sm:p-3 bg-gray-50 dark:bg-dark-700/50 rounded-lg"
                >
                  <div className="flex items-center gap-2 sm:gap-3">
                    <Smartphone className="h-4 w-4 sm:h-5 sm:w-5 text-gray-400 dark:text-gray-300" />
                    <div>
                      <p className="text-xs sm:text-sm font-medium text-gray-900 dark:text-white">
                        {cred.device_name || 'Dispositivo'}
                      </p>
                      <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-200">
                        Registrado: {new Date(cred.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteBiometric(cred.id)}
                    className="p-1.5 sm:p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                    title="Eliminar"
                  >
                    <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Registrar nuevo */}
          <div className="border-t border-gray-200 dark:border-dark-600 pt-4">
            <p className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
              Agregar nuevo dispositivo:
            </p>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              <Input
                type="text"
                value={deviceName}
                onChange={(e) => setDeviceName(e.target.value)}
                placeholder="Nombre del dispositivo (opcional)"
                className="flex-1 text-sm"
              />
              <Button
                onClick={handleRegisterBiometric}
                disabled={isRegisteringBiometric}
                className="flex items-center justify-center gap-2 text-sm"
              >
                {isRegisteringBiometric ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Registrando...
                  </>
                ) : (
                  <>
                    <Fingerprint className="h-4 w-4" />
                    Registrar
                  </>
                )}
              </Button>
            </div>
            <p className="mt-2 text-[10px] sm:text-xs text-gray-500 dark:text-gray-200">
              Se te pedirá autenticar con {biometricType} para completar el registro.
            </p>
          </div>

          {/* Info de seguridad */}
          <div className="mt-4 p-2 sm:p-3 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg border border-indigo-100 dark:border-indigo-800">
            <div className="flex items-start gap-2">
              <Shield className="h-4 w-4 sm:h-5 sm:w-5 text-indigo-600 dark:text-indigo-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs sm:text-sm font-medium text-indigo-900 dark:text-indigo-300">
                  Seguridad Biométrica
                </p>
                <p className="text-[10px] sm:text-xs text-indigo-700 dark:text-indigo-400 mt-1">
                  Tu información biométrica nunca sale de tu dispositivo. 
                  Solo se almacena una clave criptográfica segura.
                </p>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Aviso de cambio de contraseña obligatorio */}
      {userProfile?.debe_cambiar_password && (
        <Card className="bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800">
          <div className="flex items-start gap-2 sm:gap-3">
            <AlertCircle className="h-5 w-5 sm:h-6 sm:w-6 text-amber-600 dark:text-amber-400 flex-shrink-0" />
            <div>
              <h3 className="text-base sm:text-lg font-semibold text-amber-900 dark:text-amber-300">
                ¡Debes cambiar tu contraseña!
              </h3>
              <p className="text-xs sm:text-sm text-amber-700 dark:text-amber-400 mt-1">
                Se te asignó una contraseña temporal. Por seguridad, debes establecer una nueva contraseña.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Cambiar Contraseña */}
      <Card>
        <div className="flex items-center gap-2 mb-3 sm:mb-4">
          <Lock className="h-4 w-4 sm:h-5 sm:w-5 text-gray-600 dark:text-gray-200" />
          <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">
            {isFirstTime ? 'Establecer Nueva Contraseña' : 'Cambiar Contraseña'}
          </h2>
        </div>

        <form onSubmit={handleChangePassword} className="space-y-3 sm:space-y-4">
          {!isFirstTime && (
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                Contraseña Actual *
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-gray-400 dark:text-gray-400" />
                <Input
                  type={showCurrentPassword ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Ingresa tu contraseña actual"
                  required={!isFirstTime}
                  className="pl-9 sm:pl-10 pr-9 sm:pr-10 text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  {showCurrentPassword ? <EyeOff className="h-4 w-4 sm:h-5 sm:w-5" /> : <Eye className="h-4 w-4 sm:h-5 sm:w-5" />}
                </button>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
              Nueva Contraseña *
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-gray-400 dark:text-gray-400" />
              <Input
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                required
                minLength={6}
                className="pl-9 sm:pl-10 pr-9 sm:pr-10 text-sm"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                {showNewPassword ? <EyeOff className="h-4 w-4 sm:h-5 sm:w-5" /> : <Eye className="h-4 w-4 sm:h-5 sm:w-5" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
              Confirmar Nueva Contraseña *
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-gray-400 dark:text-gray-400" />
              <Input
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repite la nueva contraseña"
                required
                minLength={6}
                className="pl-9 sm:pl-10 pr-9 sm:pr-10 text-sm"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4 sm:h-5 sm:w-5" /> : <Eye className="h-4 w-4 sm:h-5 sm:w-5" />}
              </button>
            </div>
          </div>

          <div className="flex gap-2 sm:gap-3">
            {isFirstTime && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsFirstTime(false)}
                className="text-sm"
              >
                Cancelar
              </Button>
            )}
            <Button
              type="submit"
              className="flex items-center gap-2 text-sm"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  {isFirstTime ? 'Estableciendo...' : 'Actualizando...'}
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4" />
                  {isFirstTime ? 'Establecer Contraseña' : 'Cambiar Contraseña'}
                </>
              )}
            </Button>
          </div>
        </form>

        {!isFirstTime && (
          <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-gray-200 dark:border-dark-600">
            <button
              onClick={() => setIsFirstTime(true)}
              className="text-xs sm:text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium"
            >
              ¿Es tu primera vez? Establecer contraseña sin contraseña actual
            </button>
          </div>
        )}
      </Card>
    </div>
  );
}

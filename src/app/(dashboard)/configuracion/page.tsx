'use client';

import { useState, useEffect } from 'react';
import { Lock, Eye, EyeOff, CheckCircle, AlertCircle, Fingerprint, Trash2, Smartphone, Shield } from 'lucide-react';
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

interface BiometricCredential {
  id: string;
  credential_id: string;
  device_name: string | null;
  created_at: string;
  last_used_at: string | null;
}

export default function ConfiguracionPage() {
  const { supabase, userProfile, refreshUser } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // Biometría
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState('');
  const [biometricCredentials, setBiometricCredentials] = useState<BiometricCredential[]>([]);
  const [isRegisteringBiometric, setIsRegisteringBiometric] = useState(false);
  const [deviceName, setDeviceName] = useState('');
  
  const [isFirstTime, setIsFirstTime] = useState(userProfile?.debe_cambiar_password || false);

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
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Configuración</h1>
        <p className="text-xs sm:text-sm text-gray-600 mt-1">
          Gestiona tu cuenta y preferencias
        </p>
      </div>

      {/* Información del Usuario */}
      <Card>
        <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Información del Usuario</h2>
        <div className="space-y-2 sm:space-y-3 text-sm">
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700">Nombre</label>
            <p className="mt-1 text-gray-900">
              {userProfile?.nombre_completo || 'No disponible'}
            </p>
          </div>
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700">Usuario</label>
            <p className="mt-1 text-gray-900">@{userProfile?.username || 'No disponible'}</p>
          </div>
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700">Email</label>
            <p className="mt-1 text-gray-900">{userProfile?.email || 'No disponible'}</p>
          </div>
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700">Rol</label>
            <p className="mt-1 text-gray-900 capitalize">
              {userProfile?.rol || 'No asignado'}
            </p>
          </div>
        </div>
      </Card>

      {/* Autenticación Biométrica */}
      {biometricAvailable && (
        <Card>
          <div className="flex items-center gap-2 mb-3 sm:mb-4">
            <Fingerprint className="h-4 w-4 sm:h-5 sm:w-5 text-indigo-600" />
            <h2 className="text-base sm:text-lg font-semibold text-gray-900">
              Autenticación Biométrica
            </h2>
            <Badge variant="blue" className="text-[10px] sm:text-xs">{biometricType}</Badge>
          </div>

          <p className="text-xs sm:text-sm text-gray-600 mb-4">
            Configura {biometricType} para acceder más rápido sin necesidad de escribir tu contraseña.
          </p>

          {/* Credenciales existentes */}
          {biometricCredentials.length > 0 && (
            <div className="mb-4 space-y-2">
              <p className="text-xs sm:text-sm font-medium text-gray-700">Dispositivos registrados:</p>
              {biometricCredentials.map((cred) => (
                <div
                  key={cred.id}
                  className="flex items-center justify-between p-2 sm:p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-2 sm:gap-3">
                    <Smartphone className="h-4 w-4 sm:h-5 sm:w-5 text-gray-400" />
                    <div>
                      <p className="text-xs sm:text-sm font-medium text-gray-900">
                        {cred.device_name || 'Dispositivo'}
                      </p>
                      <p className="text-[10px] sm:text-xs text-gray-500">
                        Registrado: {new Date(cred.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteBiometric(cred.id)}
                    className="p-1.5 sm:p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    title="Eliminar"
                  >
                    <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Registrar nuevo */}
          <div className="border-t border-gray-200 pt-4">
            <p className="text-xs sm:text-sm font-medium text-gray-700 mb-2">
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
            <p className="mt-2 text-[10px] sm:text-xs text-gray-500">
              Se te pedirá autenticar con {biometricType} para completar el registro.
            </p>
          </div>

          {/* Info de seguridad */}
          <div className="mt-4 p-2 sm:p-3 bg-indigo-50 rounded-lg border border-indigo-100">
            <div className="flex items-start gap-2">
              <Shield className="h-4 w-4 sm:h-5 sm:w-5 text-indigo-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs sm:text-sm font-medium text-indigo-900">
                  Seguridad Biométrica
                </p>
                <p className="text-[10px] sm:text-xs text-indigo-700 mt-1">
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
        <Card className="bg-amber-50 border-amber-200">
          <div className="flex items-start gap-2 sm:gap-3">
            <AlertCircle className="h-5 w-5 sm:h-6 sm:w-6 text-amber-600 flex-shrink-0" />
            <div>
              <h3 className="text-base sm:text-lg font-semibold text-amber-900">
                ¡Debes cambiar tu contraseña!
              </h3>
              <p className="text-xs sm:text-sm text-amber-700 mt-1">
                Se te asignó una contraseña temporal. Por seguridad, debes establecer una nueva contraseña.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Cambiar Contraseña */}
      <Card>
        <div className="flex items-center gap-2 mb-3 sm:mb-4">
          <Lock className="h-4 w-4 sm:h-5 sm:w-5 text-gray-600" />
          <h2 className="text-base sm:text-lg font-semibold text-gray-900">
            {isFirstTime ? 'Establecer Nueva Contraseña' : 'Cambiar Contraseña'}
          </h2>
        </div>

        <form onSubmit={handleChangePassword} className="space-y-3 sm:space-y-4">
          {!isFirstTime && (
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                Contraseña Actual *
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-gray-400" />
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
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showCurrentPassword ? <EyeOff className="h-4 w-4 sm:h-5 sm:w-5" /> : <Eye className="h-4 w-4 sm:h-5 sm:w-5" />}
                </button>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
              Nueva Contraseña *
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-gray-400" />
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
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showNewPassword ? <EyeOff className="h-4 w-4 sm:h-5 sm:w-5" /> : <Eye className="h-4 w-4 sm:h-5 sm:w-5" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
              Confirmar Nueva Contraseña *
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-gray-400" />
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
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
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
          <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-gray-200">
            <button
              onClick={() => setIsFirstTime(true)}
              className="text-xs sm:text-sm text-indigo-600 hover:text-indigo-700 font-medium"
            >
              ¿Es tu primera vez? Establecer contraseña sin contraseña actual
            </button>
          </div>
        )}
      </Card>
    </div>
  );
}

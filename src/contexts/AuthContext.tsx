'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { UserProfile } from '@/types/database';

interface LoginResult {
  success: boolean;
  error?: string;
}

interface AuthContextType {
  supabase: SupabaseClient | null;
  loading: boolean;
  isConfigured: boolean;
  userProfile: UserProfile | null;
  isUserAdmin: boolean;
  loginWithTable: (email: string, password: string) => Promise<LoginResult>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  setUserProfileDirectly: (profile: UserProfile) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Key para localStorage
const USER_STORAGE_KEY = 'crm_user_profile';

// Crear cliente de Supabase
function createSupabaseClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!url || !key || url.includes('tu-proyecto')) {
    return null;
  }
  
  return createBrowserClient(url, key);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [supabase] = useState(() => createSupabaseClient());
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isUserAdmin, setIsUserAdmin] = useState(false);
  
  const isConfigured = supabase !== null;

  // Login usando la tabla users_profile (por username o email)
  const loginWithTable = async (usernameOrEmail: string, password: string): Promise<LoginResult> => {
    if (!supabase) {
      return { success: false, error: 'Error de configuración' };
    }

    try {
      // Buscar usuario por username O email y password en la tabla
      const { data, error } = await supabase
        .from('users_profile')
        .select('*')
        .or(`username.eq.${usernameOrEmail},email.eq.${usernameOrEmail}`)
        .eq('password', password)
        .eq('activo', true)
        .single();

      if (error || !data) {
        return { success: false, error: 'Usuario o contraseña incorrectos' };
      }

      // Guardar en localStorage
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(data));
      
      // Actualizar estado
      setUserProfile(data);
      setIsUserAdmin(data.rol === 'admin');

      return { success: true };
    } catch (error: any) {
      console.error('Error en login:', error);
      return { success: false, error: error.message || 'Error al iniciar sesión' };
    }
  };

  // Logout
  const logout = () => {
    localStorage.removeItem(USER_STORAGE_KEY);
    sessionStorage.clear();
    setUserProfile(null);
    setIsUserAdmin(false);
  };

  // Establecer perfil directamente (usado para login biométrico)
  const setUserProfileDirectly = (profile: UserProfile) => {
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(profile));
    setUserProfile(profile);
    setIsUserAdmin(profile.rol === 'admin');
  };

  // Refrescar usuario desde localStorage o BD
  const refreshUser = async () => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    try {
      // Intentar obtener usuario de localStorage
      const stored = localStorage.getItem(USER_STORAGE_KEY);
      
      if (stored) {
        const profile = JSON.parse(stored) as UserProfile;
        
        // Verificar que el usuario sigue activo en la BD
        const { data, error } = await supabase
          .from('users_profile')
          .select('*')
          .eq('id', profile.id)
          .eq('activo', true)
          .single();

        if (error || !data) {
          // Usuario ya no existe o está inactivo
          logout();
        } else {
          // Actualizar con datos frescos
          localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(data));
          setUserProfile(data);
          setIsUserAdmin(data.rol === 'admin');
        }
      }
    } catch (error) {
      console.error('Error refreshing user:', error);
      logout();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, [supabase]);

  return (
    <AuthContext.Provider value={{ 
      supabase, 
      loading, 
      isConfigured, 
      userProfile, 
      isUserAdmin,
      loginWithTable,
      logout,
      refreshUser,
      setUserProfileDirectly
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Hook para obtener el cliente de Supabase directamente
export function useSupabase() {
  const { supabase, isConfigured } = useAuth();
  return { supabase, isConfigured };
}

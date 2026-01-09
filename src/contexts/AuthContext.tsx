'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

interface AuthContextType {
  supabase: SupabaseClient | null;
  loading: boolean;
  isConfigured: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

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
  
  const isConfigured = supabase !== null;

  useEffect(() => {
    // Simular carga inicial
    setLoading(false);
  }, []);

  return (
    <AuthContext.Provider value={{ supabase, loading, isConfigured }}>
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

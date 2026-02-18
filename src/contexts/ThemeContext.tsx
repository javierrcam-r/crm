'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { ThemePreference } from '@/types/database';

type ResolvedTheme = 'light' | 'dark';

interface ThemeContextType {
  theme: ThemePreference;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = 'crm_theme_preference';

function getThemeByTime(): ResolvedTheme {
  if (typeof window === 'undefined') return 'light';
  
  // Obtener hora actual en zona horaria de Ecuador (America/Guayaquil, UTC-5)
  const ecuadorTime = new Date().toLocaleString('en-US', { 
    timeZone: 'America/Guayaquil',
    hour: 'numeric',
    hour12: false 
  });
  const hour = parseInt(ecuadorTime, 10);
  
  // Dark mode: 6 PM (18:00) a 7 AM (07:00) hora Ecuador
  // Light mode: 7 AM (07:00) a 6 PM (18:00) hora Ecuador
  if (hour >= 18 || hour < 7) {
    return 'dark';
  }
  return 'light';
}

function resolveTheme(preference: ThemePreference): ResolvedTheme {
  if (preference === 'auto') {
    return getThemeByTime();
  }
  return preference;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemePreference>('auto');
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>('light');
  const [mounted, setMounted] = useState(false);

  const applyTheme = useCallback((resolved: ResolvedTheme) => {
    const root = document.documentElement;
    if (resolved === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    setResolvedTheme(resolved);
  }, []);

  const setTheme = useCallback((newTheme: ThemePreference) => {
    setThemeState(newTheme);
    localStorage.setItem(THEME_STORAGE_KEY, newTheme);
    applyTheme(resolveTheme(newTheme));
  }, [applyTheme]);

  useEffect(() => {
    const stored = localStorage.getItem(THEME_STORAGE_KEY) as ThemePreference | null;
    const userProfileStored = localStorage.getItem('crm_user_profile');
    
    let initialTheme: ThemePreference = 'auto';
    
    if (userProfileStored) {
      try {
        const profile = JSON.parse(userProfileStored);
        if (profile.theme_preference) {
          initialTheme = profile.theme_preference;
        }
      } catch {
        // ignore parsing errors
      }
    }
    
    if (stored) {
      initialTheme = stored;
    }
    
    setThemeState(initialTheme);
    applyTheme(resolveTheme(initialTheme));
    setMounted(true);
  }, [applyTheme]);

  useEffect(() => {
    if (!mounted) return;
    
    // Verificar el tema cada minuto cuando está en modo auto
    const checkTimeBasedTheme = () => {
      if (theme === 'auto') {
        const newResolved = getThemeByTime();
        if (newResolved !== resolvedTheme) {
          applyTheme(newResolved);
        }
      }
    };

    // Verificar inmediatamente
    checkTimeBasedTheme();
    
    // Verificar cada minuto
    const interval = setInterval(checkTimeBasedTheme, 60000);
    
    return () => clearInterval(interval);
  }, [theme, mounted, applyTheme, resolvedTheme]);

  if (!mounted) {
    return (
      <ThemeContext.Provider value={{ theme: 'auto', resolvedTheme: 'light', setTheme: () => {} }}>
        {children}
      </ThemeContext.Provider>
    );
  }

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

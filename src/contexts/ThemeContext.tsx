import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';

export type ThemeMode = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'studybridge_theme';

function isValidTheme(val: unknown): val is ThemeMode {
  return val === 'light' || val === 'dark' || val === 'system';
}

function getSystemIsDark(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function resolveThemeMode(mode: ThemeMode): ResolvedTheme {
  if (mode === 'dark') return 'dark';
  if (mode === 'light') return 'light';
  return getSystemIsDark() ? 'dark' : 'light';
}

function applyThemeToDocument(mode: ThemeMode): ResolvedTheme {
  const resolved = resolveThemeMode(mode);
  if (typeof document !== 'undefined') {
    const root = document.documentElement;
    if (resolved === 'dark') {
      root.classList.add('dark');
      root.setAttribute('data-theme', 'dark');
      root.style.colorScheme = 'dark';
    } else {
      root.classList.remove('dark');
      root.setAttribute('data-theme', 'light');
      root.style.colorScheme = 'light';
    }
  }
  return resolved;
}

function readStoredTheme(): ThemeMode {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (isValidTheme(raw)) return raw;
  } catch {
    // ignore storage access errors
  }
  return 'light';
}

interface ThemeContextValue {
  theme: ThemeMode;
  resolvedTheme: ResolvedTheme;
  isDark: boolean;
  setTheme: (nextTheme: ThemeMode) => void;
  syncThemeFromPreferences: (remoteTheme: unknown) => void;
  registerFirestoreSaver: (saver: ((theme: ThemeMode) => void) | null) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    const initial = readStoredTheme();
    applyThemeToDocument(initial);
    return initial;
  });

  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => resolveThemeMode(theme));
  const firestoreSaverRef = useRef<((t: ThemeMode) => void) | null>(null);

  const registerFirestoreSaver = useCallback((saver: ((t: ThemeMode) => void) | null) => {
    firestoreSaverRef.current = saver;
  }, []);

  // Apply class + data-theme on <html> and subscribe to prefers-color-scheme when 'system'
  useEffect(() => {
    const resolved = applyThemeToDocument(theme);
    setResolvedTheme(resolved);

    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // ignore storage access errors
    }

    if (theme !== 'system' || typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }

    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      const nextResolved = applyThemeToDocument('system');
      setResolvedTheme(nextResolved);
    };

    mq.addEventListener('change', handleChange);
    return () => mq.removeEventListener('change', handleChange);
  }, [theme]);

  // Sync across tabs if localStorage changes externally
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && isValidTheme(e.newValue)) {
        setThemeState(e.newValue);
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const setTheme = useCallback((nextTheme: ThemeMode) => {
    if (!isValidTheme(nextTheme)) return;
    applyThemeToDocument(nextTheme);
    setResolvedTheme(resolveThemeMode(nextTheme));
    try {
      localStorage.setItem(STORAGE_KEY, nextTheme);
    } catch {
      // ignore
    }
    setThemeState(nextTheme);
    if (firestoreSaverRef.current) {
      firestoreSaverRef.current(nextTheme);
    }
  }, []);

  const syncThemeFromPreferences = useCallback((remoteTheme: unknown) => {
    if (!isValidTheme(remoteTheme)) return;
    applyThemeToDocument(remoteTheme);
    setResolvedTheme(resolveThemeMode(remoteTheme));
    try {
      localStorage.setItem(STORAGE_KEY, remoteTheme);
    } catch {
      // ignore
    }
    setThemeState(remoteTheme);
  }, []);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        resolvedTheme,
        isDark: resolvedTheme === 'dark',
        setTheme,
        syncThemeFromPreferences,
        registerFirestoreSaver
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return ctx;
}

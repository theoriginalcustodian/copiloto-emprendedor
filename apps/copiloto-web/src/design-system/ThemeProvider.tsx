import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import {
  leerPreferenciaTema,
  PREFERENCIA_DEFAULT,
  resolverPiel,
  type PielEfectiva,
  type PreferenciaTema,
} from '@copiloto/core';

/** Las 2 pieles ODOBI (`nocturno` se retiró en BL-X4, DA-5) — orden estable. «Como el teléfono» no es
 *  una piel: es una preferencia (`PreferenciaTema`) que resuelve a una de estas dos. */
export const THEMES = ['claro', 'oscuro'] as const;

export type Theme = (typeof THEMES)[number];

const STORAGE_KEY = 'copiloto-theme';
const QUERY_SISTEMA_OSCURO = '(prefers-color-scheme: dark)';

function leerPreferenciaPersistida(): PreferenciaTema {
  if (typeof window === 'undefined') return PREFERENCIA_DEFAULT;
  try {
    return leerPreferenciaTema(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    // localStorage puede tirar (modo privado / cuota) — degradar al default, nunca romper el render.
    return PREFERENCIA_DEFAULT;
  }
}

function sistemaEsOscuro(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(QUERY_SISTEMA_OSCURO).matches
    : false;
}

interface ThemeContextValue {
  /** La piel que se está pintando (ya resuelta). */
  theme: PielEfectiva;
  /** Lo que el usuario eligió (puede ser `sistema`). Es lo que se persiste. */
  preference: PreferenciaTema;
  setPreference: (preference: PreferenciaTema) => void;
  /** Elige una piel explícita — atajo de `setPreference`. */
  setTheme: (theme: Theme) => void;
  themes: typeof THEMES;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<PreferenciaTema>(() => leerPreferenciaPersistida());
  const [oscuroSistema, setOscuroSistema] = useState<boolean>(() => sistemaEsOscuro());

  // «Como el teléfono» sigue al sistema EN VIVO: se escucha el cambio de esquema con la app abierta.
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia(QUERY_SISTEMA_OSCURO);
    const alCambiar = (e: MediaQueryListEvent) => setOscuroSistema(e.matches);
    setOscuroSistema(mq.matches);
    mq.addEventListener('change', alCambiar);
    return () => mq.removeEventListener('change', alCambiar);
  }, []);

  const theme = resolverPiel(preference, oscuroSistema);

  // Aplica data-theme al root en cada cambio (incluido el montaje inicial, para que el tema
  // persistido pise el fallback `:root` sin data-theme del CSS).
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const setPreference = useCallback((next: PreferenciaTema) => {
    setPreferenceState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Persistencia best-effort; el estado en memoria ya se actualizó.
    }
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, preference, setPreference, setTheme: setPreference, themes: THEMES }),
    [theme, preference, setPreference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme debe usarse dentro de <ThemeProvider>');
  }
  return ctx;
}

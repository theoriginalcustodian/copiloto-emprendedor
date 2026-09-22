import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import {
  leerPreferenciaTema,
  PREFERENCIA_DEFAULT,
  resolverPiel,
  type PreferenciaTema,
} from '@copiloto/core';

import { almacenClave } from '../adapters/almacen';
import { SKINS, type NombreSkin, type Tokens } from './tokens';

const CLAVE_SKIN = 'copiloto.tema.skin';
interface ContextoTema {
  /** La piel que se pinta (ya resuelta). */
  skin: NombreSkin;
  /** Lo que el usuario eligió (puede ser `sistema` = «Como el teléfono»). Es lo que se persiste. */
  preferencia: PreferenciaTema;
  setPreferencia: (preferencia: PreferenciaTema) => void;
  setSkin: (skin: NombreSkin) => void;
}

const ContextoTema = createContext<ContextoTema | null>(null);

/**
 * Dueño del skin activo. Arranca en `claro` (default de ODOBI — §1 del DoD, "Claro (default)"; es el
 * tema que la app presenta a un emprendedor nuevo). Pinta ALGO antes de que la preferencia
 * persistida, que llega async por `AlmacenClave`, resuelva; y re-pinta si había otro skin guardado
 * de una sesión previa.
 *
 * `leerPreferenciaTema` protege contra cualquier valor persistido que ya no exista — típicamente tras
 * remover o renombrar un skin en un rediseño futuro
 * — y cae al default sin crash, en vez de dejar el contexto en un estado imposible.
 */
export interface ThemeProviderProps {
  children: ReactNode;
  /**
   * SÓLO PARA TESTS (`paresPintadosContraste.test.tsx`). Fija el skin pintado de forma síncrona y
   * determinística, sin tocar `useColorScheme` ni `almacenClave.leer` — el gate de contraste necesita
   * montar cada pantalla bajo CADA piel de `SKINS` sin depender de un storage async ni del esquema del
   * SO de la máquina que corre el test. Ausente (el uso real de la app) ⇒ comportamiento intacto:
   * persistencia + "como el teléfono" como siempre.
   */
  skinForzado?: NombreSkin;
}

export function ThemeProvider({ children, skinForzado }: ThemeProviderProps) {
  const [preferencia, setPreferenciaState] = useState<PreferenciaTema>(PREFERENCIA_DEFAULT);
  // `useColorScheme` re-renderiza cuando el sistema cambia de esquema: «Como el teléfono» sigue al
  // sistema EN VIVO con la app abierta, sin listeners propios.
  const esquema = useColorScheme();

  useEffect(() => {
    if (skinForzado) return; // el gate de contraste no persiste ni lee preferencia — ver `skinForzado`.
    let vivo = true;
    almacenClave.leer(CLAVE_SKIN).then((guardado) => {
      // `leerPreferenciaTema` blinda contra valores de versiones viejas (`nocturno` migra a `oscuro`,
      // lo desconocido cae al default) — sin esto un skin removido dejaría un estado imposible.
      if (vivo && guardado) setPreferenciaState(leerPreferenciaTema(guardado));
    });
    return () => {
      vivo = false;
    };
  }, [skinForzado]);

  const setPreferencia = useCallback((nueva: PreferenciaTema) => {
    setPreferenciaState(nueva);
    // Best-effort: si el guardado falla, la preferencia queda aplicada igual en esta sesión — ver
    // docstring de `AlmacenClave` (perder la preferencia no puede romper la sesión).
    void almacenClave.guardar(CLAVE_SKIN, nueva);
  }, []);

  const skin: NombreSkin = skinForzado ?? resolverPiel(preferencia, esquema === 'dark');
  const valor = useMemo(
    () => ({ skin, preferencia, setPreferencia, setSkin: setPreferencia }),
    [skin, preferencia, setPreferencia],
  );

  return <ContextoTema.Provider value={valor}>{children}</ContextoTema.Provider>;
}

function useContextoTema(): ContextoTema {
  const ctx = useContext(ContextoTema);
  if (!ctx) throw new Error('useTema/useSkin requieren estar dentro de <ThemeProvider>.');
  return ctx;
}

/** La única fuente de color/espaciado/tipografía de toda la app. */
export function useTema(): Tokens {
  const { skin } = useContextoTema();
  return SKINS[skin];
}

export function useSkin(): [NombreSkin, (s: NombreSkin) => void] {
  const { skin, setSkin } = useContextoTema();
  return [skin, setSkin];
}

/** La preferencia elegida (`claro` | `oscuro` | `sistema`) y su setter — para la pantalla de Skins. */
export function usePreferenciaTema(): [PreferenciaTema, (p: PreferenciaTema) => void] {
  const { preferencia, setPreferencia } = useContextoTema();
  return [preferencia, setPreferencia];
}

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { almacenClave } from '../adapters/almacen';
import { SKINS, type NombreSkin, type Tokens } from './tokens';

const CLAVE_SKIN = 'copiloto.tema.skin';
const SKIN_DEFAULT: NombreSkin = 'claro';

interface ContextoTema {
  skin: NombreSkin;
  setSkin: (skin: NombreSkin) => void;
}

const ContextoTema = createContext<ContextoTema | null>(null);

/**
 * Dueño del skin activo. Arranca en `claro` (default de ODOBI — §1 del DoD, "Claro (default)"; es el
 * tema que la app presenta a un emprendedor nuevo). Pinta ALGO antes de que la preferencia
 * persistida, que llega async por `AlmacenClave`, resuelva; y re-pinta si había otro skin guardado
 * de una sesión previa.
 *
 * El guard `guardado in SKINS` de abajo protege en general contra cualquier valor persistido que ya no
 * matchee ninguna clave de `SKINS` — típicamente tras remover o renombrar un skin en un rediseño futuro
 * — y cae al default sin crash, en vez de dejar el contexto en un estado imposible.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [skin, setSkinState] = useState<NombreSkin>(SKIN_DEFAULT);

  useEffect(() => {
    let vivo = true;
    almacenClave.leer(CLAVE_SKIN).then((guardado) => {
      // `guardado in SKINS` blinda contra un valor de una versión vieja de la app con nombres de
      // skin que ya no existen — sin esto, un skin removido dejaría el contexto en un estado
      // imposible en vez de simplemente no aplicar la preferencia.
      if (vivo && guardado && guardado in SKINS) setSkinState(guardado as NombreSkin);
    });
    return () => {
      vivo = false;
    };
  }, []);

  const setSkin = useCallback((nuevo: NombreSkin) => {
    setSkinState(nuevo);
    // Best-effort: si el guardado falla, el skin queda aplicado igual en esta sesión — ver
    // docstring de `AlmacenClave` (perder la preferencia no puede romper la sesión).
    void almacenClave.guardar(CLAVE_SKIN, nuevo);
  }, []);

  const valor = useMemo(() => ({ skin, setSkin }), [skin, setSkin]);

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

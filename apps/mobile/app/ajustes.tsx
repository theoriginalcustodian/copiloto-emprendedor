import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';

import { PantallaAjustes, type AjusteKey } from '../src/modules/ajustes/PantallaAjustes';
import { empujarUnaVez, reabrirNavegacion } from '../src/navegacion/empujarUnaVez';

/**
 * Ruta de "Ajustes" — mismo patrón que `app/apps.tsx`. `PantallaAjustes` ya trae su propio
 * `MarcoGlass` desde antes de esta convergencia (no necesitó envolverse acá).
 *
 * 🔴 **Ajustes es pantalla LANZADORA** — mismo mecanismo que el escritorio
 * (`src/shell/PantallaPrincipal.tsx`) y que Ajustes en documed (`documed-front/apps/mobile/app/
 * ajustes.tsx`, el molde de este archivo): `empujarUnaVez` para el `push` (evita apilar dos glass con
 * un doble toque, ver su docstring) + `reabrirNavegacion()` en `useFocusEffect` para reabrir la
 * puerta al volver.
 *
 * 🔴 **Todas las keys están cableadas, y el mapa es la razón.** Hasta el 2026-07-21 esto era un `if (key
 * === 'facturacionAfip')` suelto: las otras seis entradas del grid **no hacían absolutamente nada al
 * tocarlas**. El toque llegaba, `PantallaAjustes` emitía su `key`, y esta función la descartaba en
 * silencio — sin error, sin aviso, indistinguible de un gesto que no registra. El operador lo
 * reportó como *"ninguno de los iconos de dentro de ajustes funciona, solo el de facturación"*, y
 * eso es exactamente lo que pasaba.
 *
 * Con un `Record` completo, el compilador es el que garantiza que no vuelva a pasar: agregar una key
 * a `AjusteKey` sin darle destino **no compila**. Un `if` puede olvidarse de una rama para siempre;
 * un `Record<AjusteKey, …>` no puede.
 */
const RUTA_POR_AJUSTE: Record<AjusteKey, string> = {
  perfilNegocio: '/ajustes-negocio',
  facturacionAfip: '/ajustes-afip',
  // La MISMA pantalla que antes se abría desde el escritorio: sólo cambió la puerta.
  apps: '/apps',
  miPlan: '/ajustes-mi-plan',
  cuenta: '/ajustes-cuenta',
  apariencia: '/ajustes-skins',
  comoHablarle: '/ajustes-como-hablarle',
};

export default function PantallaAjustesRoute() {
  useFocusEffect(
    useCallback(() => {
      reabrirNavegacion();
    }, []),
  );

  function alAjuste(key: AjusteKey) {
    empujarUnaVez(RUTA_POR_AJUSTE[key]);
  }

  return <PantallaAjustes onAjuste={alAjuste} />;
}

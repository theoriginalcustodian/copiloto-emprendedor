import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';

import { PantallaAjustes, type AjusteKey } from '../src/modules/ajustes/PantallaAjustes';
import { empujarUnaVez, reabrirNavegacion } from '../src/navegacion/empujarUnaVez';

/**
 * Ruta de "Ajustes" — mismo patrón que `app/apps.tsx`. `PantallaAjustes` ya trae su propio
 * `MarcoGlass` desde antes de esta convergencia (no necesitó envolverse acá).
 *
 * 🔴 **Ajustes pasa a ser pantalla LANZADORA** (F5: el tile "Facturación AFIP" abre `/ajustes-afip`) —
 * mismo mecanismo que el escritorio (`src/shell/PantallaPrincipal.tsx`) y que Ajustes en documed
 * (`documed-front/apps/mobile/app/ajustes.tsx`, el molde de este archivo): `empujarUnaVez` para el
 * `push` (evita apilar dos glass con un doble toque, ver su docstring) + `reabrirNavegacion()` en
 * `useFocusEffect` para reabrir la puerta al volver de `/ajustes-afip`.
 *
 * Las otras 6 keys quedan SIN cablear a propósito — sus sub-pantallas (Datos personales,
 * Configuración del sistema, Skins, etc.) no tienen ruta propia todavía en este repo, mismo estado
 * que tenían antes de esta convergencia; cablearlas es otro alcance.
 */
export default function PantallaAjustesRoute() {
  useFocusEffect(
    useCallback(() => {
      reabrirNavegacion();
    }, []),
  );

  function alAjuste(key: AjusteKey) {
    if (key === 'facturacionAfip') {
      empujarUnaVez('/ajustes-afip');
    }
  }

  return <PantallaAjustes onAjuste={alAjuste} />;
}

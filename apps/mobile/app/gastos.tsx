import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';

import { PantallaGastos } from '../src/modules/gastos/PantallaGastos';
import { reabrirNavegacion } from '../src/navegacion/empujarUnaVez';

/**
 * Ruta de "Gastos" — `PantallaGastos` trae su propio `MarcoGlass`; el
 * `presentation: 'transparentModal'` vive en `app/_layout.tsx`.
 *
 * 🔴 **Reabre la puerta de navegación al ganar foco.** `empujarUnaVez` la cerró al abrir este glass, y
 * una pantalla que no la reabre deja rota la navegación de la SIGUIENTE que sí lance algo — un no-op
 * silencioso que aparece lejos de acá. Es la misma clase de bug que ya se cazó en device con el CTA
 * de Facturación.
 */

/**
 * `gastoId` llega como string por la URL. Se convierte con guarda: un valor no numérico significa que
 * alguien construyó el link a mano, y pasarlo igual haría que la pantalla pida un id inválido y
 * muestre un error donde no pasó nada. `undefined` = se abre el listado, sin más.
 */
function idDeParam(v: string | string[] | undefined): number | undefined {
  const crudo = Array.isArray(v) ? v[0] : v;
  if (crudo == null || !/^\d+$/.test(crudo)) return undefined;
  return Number(crudo);
}

export default function PantallaGastosRoute() {
  const params = useLocalSearchParams<{ gastoId?: string }>();

  useFocusEffect(
    useCallback(() => {
      reabrirNavegacion();
    }, []),
  );

  return <PantallaGastos gastoIdInicial={idDeParam(params.gastoId)} />;
}

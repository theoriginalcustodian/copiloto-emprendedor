import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';

import { PantallaGastos } from '../src/modules/gastos/PantallaGastos';
import { reabrirNavegacion } from '../src/navegacion/empujarUnaVez';

/**
 * Ruta de "Gastos" — mismo patrón que `app/presupuestos.tsx`. `PantallaGastos` trae su propio
 * `MarcoGlass`; el `presentation: 'transparentModal'` vive en `app/_layout.tsx`.
 *
 * 🔴 **Reabre la puerta de navegación al ganar foco** aunque hoy esta pantalla no lance ninguna otra.
 * No es de más: `empujarUnaVez` cierra la puerta al abrir este glass, y una pantalla que no la reabre
 * deja rota la navegación de la SIGUIENTE que sí lance algo. El día que Gastos abra un detalle —o la
 * card de confirmación por voz— el bug aparecería lejos de acá y se buscaría en la pantalla
 * equivocada. Es la misma clase de no-op silencioso que ya se cazó en device con el CTA de
 * Facturación.
 */
export default function PantallaGastosRoute() {
  useFocusEffect(
    useCallback(() => {
      reabrirNavegacion();
    }, []),
  );

  return <PantallaGastos />;
}

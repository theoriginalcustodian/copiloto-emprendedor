import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';

import { PantallaPresupuestos } from '../src/modules/presupuestos/PantallaPresupuestos';
import { empujarUnaVez, reabrirNavegacion } from '../src/navegacion/empujarUnaVez';

/**
 * Ruta de "Presupuestos" — mismo patrón que `app/facturacion.tsx`. `PantallaPresupuestos` trae su
 * propio `MarcoGlass`; el `presentation: 'transparentModal'` vive en `app/_layout.tsx`.
 *
 * 🔴 **Es pantalla LANZADORA, y sin esto "Facturar" no hace nada.** `empujarUnaVez` cierra la puerta
 * al lanzar y sólo la reabre la pantalla lanzadora al recuperar el foco; el escritorio la cerró
 * cuando abrió `/presupuestos`, así que si esta ruta no la reabre, el botón "Facturar" del detalle es
 * un **no-op silencioso** — el toque llega, la puerta está cerrada, y vuelve sin navegar. Es
 * exactamente el bug que ya se cazó en device con el CTA de Facturación (2026-07-21), y la regla
 * general: **si una pantalla lanza otra, tiene que reabrir la puerta al ganar foco.**
 *
 * 🔴 **Facturar NO emite.** El id que viaja en la URL es el de un **borrador** que el backend armó
 * con los ítems del presupuesto; el destino es el gate de confirmación que ya existe, no una pantalla
 * nueva. Emitir es un acto fiscal y ese gate es el único lugar donde se firma.
 */
export default function PantallaPresupuestosRoute() {
  useFocusEffect(
    useCallback(() => {
      reabrirNavegacion();
    }, []),
  );

  function alFacturar(facturaId: string) {
    empujarUnaVez({ pathname: '/facturacion', params: { facturaId } });
  }

  return <PantallaPresupuestos onFacturar={alFacturar} />;
}

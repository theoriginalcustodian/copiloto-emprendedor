import { PantallaIngresos } from '../src/modules/ingresos/PantallaIngresos';

/**
 * Ruta de "Ingresos" — mismo patrón que `app/gastos.tsx`, su simétrica. `PantallaIngresos` trae su
 * propio `MarcoGlass`; el `presentation: 'transparentModal'` vive en `app/_layout.tsx`.
 */
export default function PantallaIngresosRoute() {
  return <PantallaIngresos />;
}

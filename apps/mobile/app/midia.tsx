import { PantallaMiDia } from '../src/modules/midia/PantallaMiDia';

/**
 * Ruta de "Mi día" — mismo patrón que `app/inteligencia.tsx`. `PantallaMiDia` trae su propio
 * `MarcoGlass`; el `presentation: 'transparentModal'` vive en `app/_layout.tsx`.
 */
export default function PantallaMiDiaRoute() {
  return <PantallaMiDia />;
}

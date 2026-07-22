import { PantallaContabilidad } from '../src/modules/contabilidad/PantallaContabilidad';

/**
 * Ruta de "Contabilidad" — mismo patrón que `app/inteligencia.tsx`. `PantallaContabilidad` trae su
 * propio `MarcoGlass`; el `presentation: 'transparentModal'` vive en `app/_layout.tsx`.
 */
export default function PantallaContabilidadRoute() {
  return <PantallaContabilidad />;
}

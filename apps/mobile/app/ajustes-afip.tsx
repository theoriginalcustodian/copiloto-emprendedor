import { PantallaAfipSetup } from '../src/modules/ajustes/afip/PantallaAfipSetup';

/**
 * Ruta de "Facturación AFIP" (F5) -- mismo patrón que `app/apps.tsx`/`app/ajustes.tsx`: archivo
 * mínimo que re-exporta la pantalla real. `PantallaAfipSetup` trae su propio `MarcoGlass`; el
 * `presentation: 'transparentModal'` vive en `app/_layout.tsx`, no acá.
 *
 * Es una pantalla HOJA (no lanza nada) -- no participa de `empujarUnaVez`/`reabrirNavegacion`, mismo
 * criterio que `PantallaApps`/`PantallaRecientes`. Se llega acá desde `app/ajustes.tsx` (tile
 * "Facturación AFIP") vía `empujarUnaVez('/ajustes-afip')`.
 */
export default function PantallaAjustesAfipRoute() {
  return <PantallaAfipSetup />;
}

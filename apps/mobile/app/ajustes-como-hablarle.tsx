import { PantallaComoHablarle } from '../src/modules/ajustes/PantallaComoHablarle';

/**
 * Ruta de «Cómo hablarle» (Ajustes → la guía de uso) — mismo patrón que `app/ajustes-negocio.tsx`:
 * archivo mínimo que re-exporta la pantalla real. `PantallaComoHablarle` trae su propio `MarcoGlass`;
 * el `presentation: 'transparentModal'` vive en `app/_layout.tsx`.
 *
 * Pantalla HOJA (no lanza nada) — no participa de `empujarUnaVez`/`reabrirNavegacion`.
 */
export default function PantallaComoHablarleRoute() {
  return <PantallaComoHablarle />;
}

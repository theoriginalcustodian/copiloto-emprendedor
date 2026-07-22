import { PantallaApps } from '../src/modules/apps/PantallaApps';

/**
 * Ruta de "Apps" — clon del patrón de rutas de documed (`app/recientes.tsx`): archivo mínimo que
 * sólo re-exporta la pantalla real. `PantallaApps` trae su propio `MarcoGlass` (vidrio, handle con
 * gesto de arrastre, título e ícono, "Volver"); el `presentation: 'transparentModal'` que deja ver
 * el escritorio detrás vive en `app/_layout.tsx`, no acá.
 *
 * Reemplaza a `CapaFuncion` (capa `absoluteFill` montada como sibling en `index.tsx`, ya borrada):
 * esa capa se comía los toques del vidrio en device — ver el handoff
 * `coordinacion/2026-07-20_handoff_fixes-gestos-glass-mobile.md`. `app/` es el árbol de RUTAS de
 * expo-router (`require.context`) — sólo van rutas acá, ningún test ni helper (ver `app/index.tsx`).
 */
export default function PantallaAppsRoute() {
  return <PantallaApps />;
}

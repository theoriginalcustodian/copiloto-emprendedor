import { PantallaAjustes } from '../src/modules/ajustes/PantallaAjustes';

/**
 * Ruta de "Ajustes" — mismo patrón que `app/apps.tsx`. `PantallaAjustes` ya trae su propio
 * `MarcoGlass` desde antes de esta convergencia (no necesitó envolverse acá).
 *
 * `onAjuste` queda sin cablear a propósito: las 6 sub-pantallas de Ajustes (Datos personales,
 * Configuración del sistema, Skins, etc.) no tienen ruta propia todavía en este repo — mismo estado
 * que tenían antes de esta convergencia, tocar eso es otro alcance.
 */
export default function PantallaAjustesRoute() {
  return <PantallaAjustes />;
}

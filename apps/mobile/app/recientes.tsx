import { PantallaRecientes } from '../src/modules/recientes/PantallaRecientes';

/**
 * Ruta de "Recientes" — mismo patrón que `app/apps.tsx`. `PantallaRecientes` ya trae su propio
 * `MarcoGlass` desde antes de esta convergencia (no necesitó envolverse acá). De sólo lectura: no
 * hay ninguna acción que "termine" la pantalla — se cierra con el gesto/"Volver" que ya trae
 * `MarcoGlass`, nunca sola.
 */
export default function PantallaRecientesRoute() {
  return <PantallaRecientes />;
}

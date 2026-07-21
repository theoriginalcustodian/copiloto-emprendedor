import { PantallaRedes } from '../src/modules/redes/PantallaRedes';

/**
 * Ruta de "Redes Sociales" — mismo patrón que `app/apps.tsx`. `PantallaRedes` trae su propio
 * `MarcoGlass`; ver ese archivo para el porqué del ícono/título compartidos con el tile de entrada.
 */
export default function PantallaRedesRoute() {
  return <PantallaRedes />;
}

import { PantallaInteligencia } from '../src/modules/inteligencia/PantallaInteligencia';

/**
 * Ruta de "Inteligencia de Negocio" — mismo patrón que `app/apps.tsx`. `PantallaInteligencia` trae su propio
 * `MarcoGlass`; ver ese archivo para el porqué del ícono/título compartidos con el tile de entrada.
 */
export default function PantallaInteligenciaRoute() {
  return <PantallaInteligencia />;
}

import { PantallaMetricas } from '../src/modules/metricas/PantallaMetricas';

/**
 * Ruta de "Métricas" — mismo patrón que `app/apps.tsx`. `PantallaMetricas` trae su propio
 * `MarcoGlass`; ver ese archivo para el porqué del ícono/título compartidos con el tile de entrada.
 */
export default function PantallaMetricasRoute() {
  return <PantallaMetricas />;
}

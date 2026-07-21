import { PantallaFacturacion } from '../src/modules/facturacion/PantallaFacturacion';

/**
 * Ruta de "Facturación" — mismo patrón que `app/apps.tsx`. `PantallaFacturacion` trae su propio
 * `MarcoGlass`; ver ese archivo para el porqué del ícono/título compartidos con el tile de entrada.
 */
export default function PantallaFacturacionRoute() {
  return <PantallaFacturacion />;
}

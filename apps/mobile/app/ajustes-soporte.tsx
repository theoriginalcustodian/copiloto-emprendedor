import { PantallaSoporte } from '../src/modules/soporte';

/** Ruta de "Soporte" (SOP5) — mismo patrón que `ajustes-feedback.tsx`: pantalla HOJA, no
 * lanzadora, se llega desde una fila de `PantallaCuenta`. */
export default function PantallaSoporteRoute() {
  return <PantallaSoporte />;
}

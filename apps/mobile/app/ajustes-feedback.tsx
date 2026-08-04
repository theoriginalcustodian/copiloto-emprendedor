import { PantallaFeedback } from '../src/modules/feedback';

/** Ruta de "Feedback" (BETA-1a) — mismo patrón que `ajustes-cuenta.tsx`: pantalla HOJA, no
 * lanzadora (no participa de `empujarUnaVez`), se llega desde una fila de `PantallaCuenta`. */
export default function PantallaFeedbackRoute() {
  return <PantallaFeedback contexto="Mi cuenta" />;
}

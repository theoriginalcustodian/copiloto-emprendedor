import { PantallaAgenda } from '../src/modules/midia/PantallaAgenda';

/**
 * Ruta de «Agenda» (BL-J13) — glass HOJA sobre Mi día, mismo patrón que `ajustes-como-usar.tsx`. Se
 * entra con `empujarUnaVez('/agenda')` desde el panel de calendario de Mi día; «Nuevo evento» vuelve
 * dejando el pedido dicho en el chat principal (`mensajePendiente`).
 */
export default function PantallaAgendaRoute() {
  return <PantallaAgenda />;
}

import { PantallaComoUsarLaApp } from '../src/modules/ajustes/PantallaComoUsarLaApp';

/**
 * Ruta de «Cómo usar la app» (Ajustes → Ayuda). Reemplaza a `ajustes-como-hablarle`, que montaba la
 * guía de capacidades sola: las dos se fundieron en una (Ola 5).
 *
 * Pantalla HOJA — no lanza otro glass, así que no participa de `empujarUnaVez`. Lo que sí hace es
 * VOLVER dejando una pregunta dicha en el chat principal (`mensajePendiente`).
 */
export default function PantallaComoUsarLaAppRoute() {
  return <PantallaComoUsarLaApp />;
}

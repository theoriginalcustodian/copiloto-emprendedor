/**
 * Textos fijos de Soporte compartidos por web y mobile (BL-W10).
 *
 * 🔴 **Sin número de horas.** No hay SLA vigente (acta beta-odobi: `BL-O7` fija responsable y horario);
 * prometer «4 h hábiles» sería un compromiso inventado. Cuando `BL-O7` fije el plazo, cambia ESTA
 * constante y las dos plataformas lo heredan.
 *
 * 🔴 **Qué viaja con el ticket, sólo lo verificado**: `crear_ticket_de_soporte` guarda el asunto y un
 * resumen que redacta el agente, atados a la cuenta (`cliente_id`). No viaja la conversación entera ni
 * datos de otras pantallas; decir «va con esta conversación» sería impreciso.
 */
export const SOPORTE_QUIEN = 'Soporte técnico';

export const SOPORTE_PRESENTACION =
  'Contesto al toque. Si no lo puedo resolver, abro un ticket y lo sigue una persona.';

export const SOPORTE_TIEMPO_RESPUESTA =
  'Los tickets los responde una persona del equipo; todavía no tenemos un plazo de respuesta fijo.';

export const SOPORTE_QUE_VIAJA =
  'Si abro un ticket, el equipo recibe el asunto y un resumen de lo que me contaste, junto con tu cuenta. Nada más.';

/**
 * El placeholder del composer de Soporte. El del chat general invita a anotar un movimiento («Escribí, o
 * hablá…»); acá la persona viene a contar un problema, y el prototipo (`index.html:2181`, `.barra-sop`) lo
 * dice así.
 */
export const SOPORTE_PLACEHOLDER = 'Contame qué pasó…';

/**
 * Los tickets propios y el clip de adjuntos (PROTO4APP §D/§E). Mismas reglas que las constantes de
 * arriba: sin plazo inventado y sin prometer lo que el backend no hace.
 *
 * 🔴 **El clip adjunta a UN ticket, no a la conversación.** `POST /soporte/tickets/{id}/adjuntos` cuelga la
 * imagen de un ticket ya abierto; no hay adjuntos sueltos del chat. Sin ticket no hay a dónde mandarla, y
 * decirlo es mejor que aceptar la foto y perderla.
 */
export const SOPORTE_TICKET_ROTULO_SOBRE = 'Sobre';
export const SOPORTE_TICKET_ROTULO_CONTESTAN = 'Te contestan';
export const SOPORTE_ADJUNTO_SIN_TICKET_TITULO = 'Todavía no hay un ticket abierto';
export const SOPORTE_ADJUNTO_SIN_TICKET =
  'La foto se adjunta a un ticket. Contame qué pasó y, si hace falta abrir uno, después la sumás ahí.';
export const SOPORTE_ADJUNTO_OK = 'Listo, la foto quedó adjunta al ticket.';
export const SOPORTE_ADJUNTO_FORMATO = 'Sólo se pueden adjuntar fotos en JPG o PNG.';
export const SOPORTE_ADJUNTO_RECHAZADO = 'No se pudo adjuntar: la foto pesa demasiado o el ticket ya tiene todas las que admite.';
export const SOPORTE_ADJUNTO_NO_ENCONTRADO = 'No encontramos ese ticket. Probá de nuevo en un momento.';
export const SOPORTE_ADJUNTO_NO_DISPONIBLE = 'Adjuntar fotos todavía no está disponible.';
export const SOPORTE_ADJUNTO_ERROR = 'No pudimos subir la foto. Probá de nuevo.';

/** «Ver tickets anteriores (3)». `n` es lo que el toque despliega, no el total del tenant. */
export function soporteVerTicketsAnteriores(n: number): string {
  return `Ver tickets anteriores (${n})`;
}

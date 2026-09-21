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
export const SOPORTE_QUIEN = 'Soporte de Odobi';

export const SOPORTE_PRESENTACION =
  'Contesto al toque. Si no lo puedo resolver, abro un ticket y lo sigue una persona.';

export const SOPORTE_TIEMPO_RESPUESTA =
  'Los tickets los responde una persona del equipo; todavía no tenemos un plazo de respuesta fijo.';

export const SOPORTE_QUE_VIAJA =
  'Si abro un ticket, el equipo recibe el asunto y un resumen de lo que me contaste, junto con tu cuenta. Nada más.';

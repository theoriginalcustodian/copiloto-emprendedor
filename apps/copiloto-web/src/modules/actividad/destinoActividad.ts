import type { ActividadItem } from '@copiloto/core';

/**
 * A dónde lleva tocar un ítem de actividad. Port 1:1 de
 * `apps/mobile/src/modules/actividad/destinoActividad.ts` — misma función pura, sin `expo-router`
 * acá tampoco (ya no lo tenía mobile): quien la use cablea la navegación con lo que tenga.
 *
 * 🔴 **Devuelve `null` cuando ese tipo no tiene dónde aterrizar, y eso NO es un caso de borde: es la
 * decisión del contrato.** Lo que no tiene destino no se pinta tappable. Hoy sin destino: `ingreso`
 * (Contabilidad) y `presupuesto`/`factura`/`nota_credito` — esos módulos web no existen todavía en
 * este momento del sprint M-WEB, así que quedan sin acción de click hasta que se porten.
 *
 * 🔴 **El id viene como `"<tipo>:<id>"` y se parte UNA vez, acá.**
 */
export interface DestinoActividad {
  pathname: string;
  params: Record<string, string>;
}

function numeroDelId(id: string): string | null {
  const corte = id.lastIndexOf(':');
  if (corte === -1) return null;
  const crudo = id.slice(corte + 1);
  return /^\d+$/.test(crudo) ? crudo : null;
}

/**
 * `ticket_respuesta` es el ÚNICO tipo con un id de TRES partes:
 * `"ticket_respuesta:<ticket_id>:<mensaje_id>"` (`actividad_store.py:141`). `numeroDelId` corta
 * por el ÚLTIMO `:` — para este tipo eso da el `mensaje_id`, no el `ticket_id` que S6-11 necesita
 * para armar el link. Parseo dedicado, no una reutilización a ciegas de `numeroDelId`.
 *
 * Decide por POSICIÓN (la parte del medio), no por el contenido literal de `partes[0]` — quien ya
 * decidió "es este tipo" es `item.tipo` en `destinoDe`, no el prefijo del id.
 */
function ticketIdDelId(id: string): string | null {
  const partes = id.split(':');
  if (partes.length !== 3) return null;
  return /^\d+$/.test(partes[1]) ? partes[1] : null;
}

export function destinoDe(item: ActividadItem): DestinoActividad | null {
  // S6-11: caso propio, ANTES del genérico — su id no se parsea con `numeroDelId` (ver arriba).
  if (item.tipo === 'ticket_respuesta') {
    const ticketId = ticketIdDelId(item.id);
    if (ticketId == null) return null;
    return { pathname: '/soporte-ticket', params: { ticketId } };
  }

  const numero = numeroDelId(item.id);
  if (numero == null) return null;

  switch (item.tipo) {
    case 'gasto':
      return { pathname: '/gastos', params: { gastoId: numero } };
    case 'cliente':
      return { pathname: '/clientes', params: { clienteId: numero } };
    // `presupuesto`, `factura`/`nota_credito` e `ingreso`: sin módulo web propio todavía (o sin
    // destino en absoluto, caso `ingreso`). No se adivina un destino: `null`, la fila no invita a
    // tocarse. Cuando esos módulos se porten, sumar su caso acá — mismo criterio que mobile.
    default:
      return null;
  }
}

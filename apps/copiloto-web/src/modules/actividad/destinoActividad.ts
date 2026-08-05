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

export function destinoDe(item: ActividadItem): DestinoActividad | null {
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

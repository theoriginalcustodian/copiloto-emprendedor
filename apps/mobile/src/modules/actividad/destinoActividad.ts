import type { ActividadItem } from '@copiloto/core';

/**
 * A dónde lleva tocar un ítem de actividad.
 *
 * 🔴 **Devuelve `null` cuando ese tipo no tiene dónde aterrizar, y eso NO es un caso de borde: es la
 * decisión del contrato.** Lo que no tiene destino **no se pinta tappable**, porque un ítem que se
 * toca y no hace nada se lee como *«la app está rota»*, no como *«esa función todavía no está»*. Hoy
 * el único sin destino es `ingreso`, que llega con Contabilidad.
 *
 * 🔴 **El id viene como `"<tipo>:<id>"` y se parte UNA vez, acá.** Es el único lugar que conoce ese
 * formato: si mañana cambia, cambia en un archivo. Y se usa el **`tipo` del ítem**, no el prefijo del
 * id, para decidir el destino — el prefijo se usa sólo para sacar el número. Son dos datos que hoy
 * coinciden y no tienen por qué seguir haciéndolo.
 *
 * Función pura y sin `expo-router`: quien la use cablea la navegación. Así se puede probar el mapeo
 * entero sin montar nada.
 */

export interface DestinoActividad {
  pathname: string;
  params: Record<string, string>;
}

/** `"gasto:21"` → `21`. `null` si no hay una parte numérica utilizable. */
function numeroDelId(id: string): string | null {
  const corte = id.lastIndexOf(':');
  if (corte === -1) return null;
  const crudo = id.slice(corte + 1);
  // Los ids de negocio de este producto son enteros (`bigserial`). Un valor no numérico significa
  // que el backend cambió el formato: mejor no rutear que rutear a una pantalla que va a dar 422.
  return /^\d+$/.test(crudo) ? crudo : null;
}

export function destinoDe(item: ActividadItem): DestinoActividad | null {
  const numero = numeroDelId(item.id);
  if (numero == null) return null;

  switch (item.tipo) {
    case 'gasto':
      return { pathname: '/gastos', params: { gastoId: numero } };
    case 'presupuesto':
      return { pathname: '/presupuestos', params: { presupuestoId: numero } };
    case 'cliente':
      return { pathname: '/clientes', params: { clienteId: numero } };
    // Los dos abren la misma pantalla: una nota de crédito ES un comprobante, y su detalle es el
    // mismo. Que el contrato los liste como tipos distintos sirve para el color (`signo`), no para
    // el destino.
    case 'factura':
    case 'nota_credito':
      return { pathname: '/facturacion', params: { comprobanteId: numero } };
    default:
      // `ingreso` y cualquier tipo que el backend agregue mañana. No se adivina un destino: se
      // devuelve `null` y la fila no invita a tocarse.
      return null;
  }
}

import type { ResultadoFacturar } from '../api/presupuestos';
import type { ReplyCard } from '../api/types';

/**
 * K-07-B / BL-J9 — `card.kind === 'sugerencia_armar_factura'`: tras crear un presupuesto por voz, el
 * copiloto ofrece armar la factura. La card viaja por el mismo camino `gate_card → card` que
 * `requiere_conexion` (contrato `K-07-B-card-armar-factura`).
 *
 * La acción NO tiene pantalla propia: el chip llama `facturarPresupuesto(presupuestoId)` y entra al
 * gate de factura existente. Aditivo: un `kind` desconocido, o sin `presupuesto_id` entero positivo
 * (sin él no hay acción posible), NO pinta nada — el mensaje sigue mostrando su texto.
 */
export interface SugerenciaArmarFactura {
  presupuestoId: number;
  texto: string;
}

export const TEXTO_SUGERENCIA_ARMAR_FACTURA = '¿Te armo la factura?';

export function leerSugerenciaArmarFactura(
  card: ReplyCard | null | undefined,
): SugerenciaArmarFactura | null {
  if (card?.kind !== 'sugerencia_armar_factura') return null;
  const raw = card as Record<string, unknown>;
  const id = raw.presupuesto_id;
  if (typeof id !== 'number' || !Number.isInteger(id) || id <= 0) return null;
  const texto = typeof raw.texto === 'string' && raw.texto.trim() !== '' ? raw.texto.trim() : null;
  return { presupuestoId: id, texto: texto ?? TEXTO_SUGERENCIA_ARMAR_FACTURA };
}

/**
 * Lo que se le dice al emprendedor cuando `facturarPresupuesto` NO abrió el borrador. `null` = abrió
 * (`ok`: se navega al gate de factura, no hay nada que decir). Un solo lugar para web y mobile.
 */
export function avisoArmarFactura(res: ResultadoFacturar): string | null {
  switch (res.status) {
    case 'ok':
      return null;
    case 'ya_facturado':
      return 'Ese presupuesto ya está facturado.';
    case 'falta_perfil_fiscal':
      return 'Antes de facturar, cargá tus datos fiscales en el perfil.';
    case 'estado_incompatible':
      return res.motivo;
    default:
      return 'No pudimos armar la factura. Probá de nuevo.';
  }
}

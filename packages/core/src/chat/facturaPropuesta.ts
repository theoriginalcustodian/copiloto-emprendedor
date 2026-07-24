import type { ReplyCard } from '../api/types';

/**
 * `factura_propuesta` — lo que el copiloto entendió de una factura dictada (hito 9), de sólo
 * LECTURA: emitir es un acto fiscal irreversible, así que acá no se edita nada — se confirma
 * (`Emitir`, cuando el borrador ya está completo) o se delega (`Completar a mano`, que lleva a
 * `PantallaFacturacion` sobre el MISMO borrador). Contrato:
 * `contrato_planificacion-a-todos_hito9-facturar-por-voz-los-mismos-signals-que-la-pantalla` §2.1.
 *
 * 🔴 **`data` está confirmada por el contrato (no es analogía)**, sólo el `kind` es
 * `[ASSUMED_PENDING_VERIFY]` — mismo colchón que `presupuesto_propuesto`: `ReplyCard.kind` es
 * `string` abierto, así que si backend nunca manda este `kind`, `leerFacturaPropuesta` siempre
 * devuelve `null` y el mensaje cae a `Burbuja` sin romper nada.
 *
 * 🔴 **`cantidad`/`precio_unitario`/`total` llegan como `number` del wire** (a diferencia de
 * `presupuesto_propuesto`, que los manda como string) — se convierten a texto con `String()`, nunca
 * se opera con ellos acá. Ver `[[la-coma-decimal-del-teclado-argentino]]`: esta card es de sólo
 * lectura, no hay campo que el usuario tipee.
 */

export interface ItemFacturaPropuesta {
  descripcion: string;
  cantidad: string;
  precioUnitario: string;
}

export interface ClienteFacturaPropuesta {
  razonSocial: string | null;
  cuit: string | null;
  condicionIva: string | null;
}

export interface FacturaPropuesta {
  /** El id CORTO del borrador (nunca el workflow_id) — lo que `confirmarConTokenFresco` y
   *  `facturaIdInicial` esperan. */
  facturaId: string;
  /** `[]` = el borrador está completo y listo para `Emitir`. Códigos tal cual los manda el backend
   *  (`estado().faltantes`), sin traducir acá — la traducción a texto la hace `PantallaFacturacion`. */
  faltantes: string[];
  items: ItemFacturaPropuesta[];
  cliente: ClienteFacturaPropuesta | null;
  total: string;
  tipoComprobante: string | null;
}

function texto(v: unknown): string | null {
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : null;
}

/** Acepta el `number` del wire (caso esperado) o un string numérico defensivo — nunca hace
 *  aritmética, sólo `String()`. */
function numero(v: unknown): string | null {
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  return texto(v);
}

function faltante(v: unknown): string | null {
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : null;
}

function item(v: unknown): ItemFacturaPropuesta | null {
  if (typeof v !== 'object' || v === null) return null;
  const d = v as Record<string, unknown>;
  const descripcion = texto(d.descripcion);
  if (descripcion == null) return null;
  return {
    descripcion,
    cantidad: numero(d.cantidad) ?? '1',
    precioUnitario: numero(d.precio_unitario) ?? '0',
  };
}

function cliente(v: unknown): ClienteFacturaPropuesta | null {
  if (typeof v !== 'object' || v === null) return null;
  const d = v as Record<string, unknown>;
  return {
    razonSocial: texto(d.razon_social),
    cuit: texto(d.cuit),
    condicionIva: texto(d.condicion_iva),
  };
}

/**
 * Devuelve la propuesta, o `null` si esta card no es una — incluido `factura_id` ausente, que es lo
 * único sin lo cual ni `Emitir` ni `Completar a mano` tienen sobre qué actuar.
 */
export function leerFacturaPropuesta(card: ReplyCard | undefined): FacturaPropuesta | null {
  if (card?.kind !== 'factura_propuesta') return null;
  const data = card.data;
  if (typeof data !== 'object' || data === null) return null;

  const d = data as Record<string, unknown>;
  const facturaId = texto(d.factura_id);
  if (facturaId == null) return null;

  const faltantesRaw = Array.isArray(d.faltantes) ? d.faltantes : [];
  const itemsRaw = Array.isArray(d.items) ? d.items : [];

  return {
    facturaId,
    faltantes: faltantesRaw.map(faltante).filter((f): f is string => f !== null),
    items: itemsRaw.map(item).filter((it): it is ItemFacturaPropuesta => it !== null),
    cliente: cliente(d.cliente),
    total: numero(d.total) ?? '0',
    tipoComprobante: texto(d.tipo_comprobante),
  };
}

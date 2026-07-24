import type { ReplyCard } from '../api/types';

/**
 * `presupuesto_propuesto` — la card que el motor mandaría cuando el emprendedor **dicta** un
 * presupuesto (hito 8, modo confirmación). A diferencia de `ingreso_propuesto`, la forma de `data` NO
 * es una convención razonada por analogía: es **exactamente el body de `POST /presupuestos`**, ya
 * fijado y confirmado por backend en
 * `coordinacion/en-curso/2026-07-21_contrato_backend-perfil-negocio-y-presupuestos.md` §2.4
 * (`concepto`, `receptor: {nombre, doc_tipo, doc_nro, condicion_iva, domicilio, contacto}`,
 * `items: [{descripcion, cantidad, precio_unitario, codigo}]`).
 *
 * 🔴 **`[ASSUMED_PENDING_VERIFY]` sólo en el `kind`, no en `data`.** Que backend efectivamente mande
 * ESTE `kind` en un reply de voz es lo único sin confirmar — mismo motivo que `ingreso_propuesto`, y
 * mismo colchón: `ReplyCard.kind` es `string` abierto, así que si backend elige otro nombre esta
 * función sigue devolviendo `null` (cae a `Burbuja`) sin romper nada.
 *
 * 🔴 **`items` es una LISTA editable, no campos sueltos.** Es la razón de ser de esta card (contrato de
 * modos §1): el error de transcripción más caro de un presupuesto vive en el monto de CADA ítem, así
 * que cada fila dictada tiene que poder corregirse antes de guardar — no sólo los datos del receptor.
 */

export interface ItemPresupuestoPropuesto {
  descripcion: string;
  /** String decimal — **nunca `Number()`**. `'1'` si el motor no lo dictó (mismo default que el alta
   *  manual aplica al guardar). */
  cantidad: string;
  /** String decimal. `''` si no vino — el emprendedor lo completa, nunca se inventa un precio. */
  precioUnitario: string;
}

export interface PresupuestoPropuesto {
  concepto: string;
  receptor: {
    nombre: string;
    docTipo: number | null;
    docNro: string | null;
    contacto: string | null;
  };
  items: ItemPresupuestoPropuesto[];
}

function texto(v: unknown): string | null {
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : null;
}

function entero(v: unknown): number | null {
  return typeof v === 'number' && Number.isInteger(v) ? v : null;
}

function item(v: unknown): ItemPresupuestoPropuesto | null {
  if (typeof v !== 'object' || v === null) return null;
  const d = v as Record<string, unknown>;
  const descripcion = texto(d.descripcion);
  // Sin descripción, la fila no dice nada que corregir — se descarta, no se pinta una fila muda.
  if (descripcion == null) return null;
  return {
    descripcion,
    cantidad: texto(d.cantidad) ?? '1',
    precioUnitario: texto(d.precio_unitario) ?? '',
  };
}

/**
 * Devuelve la propuesta, o `null` si esta card no es una — incluido `concepto`/`receptor.nombre`
 * ausentes o **cero ítems con descripción**, que es exactamente lo que el backend exige para crear
 * (§2.4 del contrato: `concepto`, `receptor.nombre` e `items` con ≥1 elemento).
 */
export function leerPresupuestoPropuesto(card: ReplyCard | undefined): PresupuestoPropuesto | null {
  if (card?.kind !== 'presupuesto_propuesto') return null;
  const data = card.data;
  if (typeof data !== 'object' || data === null) return null;

  const d = data as Record<string, unknown>;
  const concepto = texto(d.concepto);
  if (concepto == null) return null;

  const receptorRaw = typeof d.receptor === 'object' && d.receptor !== null ? (d.receptor as Record<string, unknown>) : {};
  const nombre = texto(receptorRaw.nombre);
  if (nombre == null) return null;

  const itemsRaw = Array.isArray(d.items) ? d.items : [];
  const items = itemsRaw.map(item).filter((it): it is ItemPresupuestoPropuesto => it !== null);
  if (items.length === 0) return null;

  return {
    concepto,
    receptor: {
      nombre,
      docTipo: entero(receptorRaw.doc_tipo),
      docNro: texto(receptorRaw.doc_nro),
      contacto: texto(receptorRaw.contacto),
    },
    items,
  };
}

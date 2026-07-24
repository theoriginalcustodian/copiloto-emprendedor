import type { ReplyCard } from '../api/types';

/**
 * `ingreso_propuesto` — la card que el motor mandaría cuando el emprendedor **dicta** un ingreso
 * (hito 8, modo confirmación §2 del contrato: "anotar ingreso" pasa de directo a card editable).
 *
 * 🔴 **`[ASSUMED_PENDING_VERIFY]` — a diferencia de `gasto_propuesto`/`cliente_propuesto`, esta forma
 * NO está medida contra el `/reply` real de backend.** Sigue la MISMA convención que las dos que sí lo
 * están (`data` es exactamente el body de `POST /ingresos` — ver `aWire` en `api/ingresos.ts` — y
 * `kind` es `string` abierto en `ReplyCard`, precisamente para admitir un valor nuevo sin romper), así
 * que el riesgo es acotado: si backend elige otro `kind` u otro nombre de campo, esta función sigue
 * devolviendo `null` (degrada a `Burbuja`, nunca rompe) hasta que se alinee — no hay dato mal mostrado.
 * Cuando backend confirme la forma real, ajustar acá y en el test que la fija.
 *
 * `data` sólo se traduce a camelCase y se defiende de lo que el LLM pueda ensuciar — no reinterpreta.
 */

export interface IngresoPropuesto {
  /** String decimal. **Nunca `Number()`.** Único campo obligatorio (`RegistrarIngresoRequest`). */
  monto: string;
  medio: string | null;
  clienteNombre: string | null;
  concepto: string | null;
  /** `YYYY-MM-DD`, o `''` si el motor no lo resolvió — mismo criterio que `gasto_propuesto.fecha`:
   *  un `''` hace que el formulario omita la clave y el backend aplique su default (hoy, Argentina). */
  fecha: string;
}

function texto(v: unknown): string | null {
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : null;
}

/**
 * Devuelve la propuesta, o `null` si esta card no es una — incluido el caso de una `ingreso_propuesto`
 * **sin monto**, que no se puede pintar (mismo criterio que `leerGastoPropuesto`).
 */
export function leerIngresoPropuesto(card: ReplyCard | undefined): IngresoPropuesto | null {
  if (card?.kind !== 'ingreso_propuesto') return null;
  const data = card.data;
  if (typeof data !== 'object' || data === null) return null;

  const d = data as Record<string, unknown>;
  const monto = texto(d.monto);
  if (monto == null) return null;

  return {
    monto,
    medio: texto(d.medio),
    clienteNombre: texto(d.cliente_nombre),
    concepto: texto(d.concepto),
    fecha: texto(d.fecha) ?? '',
  };
}

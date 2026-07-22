import type { ReplyCard } from '../api/types';
import { esCategoriaValida, type CategoriaGasto, type OrigenGasto } from '../api/gastos';

/**
 * `gasto_propuesto` — la card que el motor manda cuando el emprendedor **dicta** un gasto.
 *
 * 🔴 **Propone, NO guarda.** La tool del motor no está en `WRITE_TOOLS` a propósito: el write ocurre
 * cuando el emprendedor toca Guardar y lo hace la app. Si alguien "arregla" eso metiéndola en las
 * write-tools, el gasto se persiste sin que nadie lo haya visto — que es exactamente lo que §5 del
 * contrato prohíbe.
 *
 * 🔴 **Por qué card editable y no el gate de sí/no que ya existía:** confirmar re-ejecuta los MISMOS
 * argumentos. Si Whisper transcribió *«cincuenta mil»* donde el emprendedor dijo *«quince mil»*, con
 * un sí/no sólo se puede **aceptar el error** o **repetir el dictado entero** — y repetir un dictado
 * es más tedioso que haber tipeado, que es donde se abandona la función. Un monto mal transcripto no
 * se ve después: se ve el total del mes, que es lo que se mira.
 *
 * `data` es **exactamente el body de `POST /gastos`** (verificado por el E2E del backend, que postea
 * la card tal cual y recibe 201). Esta función sólo traduce a camelCase y se defiende de lo que el
 * LLM pueda haber ensuciado — no reinterpreta ni completa nada.
 */

export interface GastoPropuesto {
  /** String decimal. **Nunca `Number()`** — el backend ya resolvió los miles (`"15.000"` = quince mil). */
  monto: string;
  /**
   * Ya resuelta por el backend: hoy, o lo que se dictó (*«ayer»*, *«el lunes»*).
   *
   * 🔴 **Viaja y se manda de vuelta explícita.** Es la única situación en la que la app manda `fecha`:
   * si se omitiera, el backend pondría "hoy" y un gasto dictado como *«lo de ayer»* se guardaría con
   * la fecha equivocada — y en los días 30 y 31 eso lo mueve de MES, o sea del resumen.
   */
  fecha: string;
  categoria: CategoriaGasto;
  proveedor: string | null;
  medioPago: string | null;
  /** Lo que dictó, textual — es contra esto que el emprendedor contrasta lo que la card entendió. */
  descripcion: string | null;
  origen: OrigenGasto;
}

function texto(v: unknown): string | null {
  return typeof v === 'string' && v.trim() !== '' ? v : null;
}

/**
 * Devuelve la propuesta, o `null` si esta card no es una — incluido el caso de una `gasto_propuesto`
 * **sin monto**, que no se puede pintar.
 *
 * `kind` se compara exacto porque el backend lo fija; el resto se valida porque lo llenó un LLM.
 */
export function leerGastoPropuesto(card: ReplyCard | undefined): GastoPropuesto | null {
  if (card?.kind !== 'gasto_propuesto') return null;
  const data = card.data;
  if (typeof data !== 'object' || data === null) return null;

  const d = data as Record<string, unknown>;
  const monto = texto(d.monto);
  // Sin monto no hay card: es el único campo obligatorio del contrato y el único que el copiloto
  // repregunta. Pintar un formulario vacío sería pedirle al emprendedor que tipee lo que ya dictó.
  if (monto == null) return null;

  const categoria = typeof d.categoria === 'string' ? d.categoria : '';
  const origen = d.origen;
  return {
    monto,
    // `?? ''` y no la fecha de hoy calculada acá: si el backend no la mandó, el que sabe qué día es
    // "hoy" para este negocio es él (zona horaria argentina), no el teléfono. Un `''` hace que el
    // formulario omita el campo y el backend aplique su default, que es lo correcto.
    fecha: texto(d.fecha) ?? '',
    // Cae en `otros` si el LLM inventó una categoría. El backend importa la lista del store para que
    // no pase, pero defenderse acá cuesta una línea y el costo de no hacerlo es que el emprendedor
    // vea FALLAR algo que el copiloto le ofreció — el peor tipo de error.
    categoria: esCategoriaValida(categoria) ? categoria : 'otros',
    proveedor: texto(d.proveedor),
    medioPago: texto(d.medio_pago),
    descripcion: texto(d.descripcion),
    origen: origen === 'foto' || origen === 'manual' ? origen : 'voz',
  };
}

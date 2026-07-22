import type { ReplyCard } from '../api/types';
import type { DatosCliente } from '../api/clientes';

/**
 * `cliente_propuesto` — la card que el motor manda cuando el emprendedor **dicta un cliente nuevo**.
 *
 * Forma **medida** por backend contra el `/reply` real con LLM real (no diseñada):
 * `dato_backend-a-frontend_hito-5-vivo-la-forma-exacta-de-la-card`.
 *
 * 🔴 **Propone, NO guarda.** El backend lo verificó con un control explícito —contar filas después del
 * turno: 0—. Si la card se muestra y el emprendedor no toca Guardar, **el cliente no existe**. La UI
 * no puede insinuar lo contrario: un "listo" prematuro haría que se vaya creyendo que lo cargó.
 *
 * 🔴 **`doc_tipo` puede venir `null` con `doc_nro` LLENO, y eso NO se limpia acá.** Es deliberado del
 * backend: si el dictado no da 11 dígitos (CUIT) ni 7-8 (DNI), el número **viaja igual** para que el
 * emprendedor lo corrija. Borrarlo en silencio haría desaparecer el error **junto con el dato**, y el
 * alta saldría "bien" con un cliente sin documento que él creyó haber cargado. Si lo guarda así, el
 * `POST` responde 400 con el motivo legible — **no se replica esa validación en la UI**: sería la
 * validación de más que este frente ya prohibió, y encima duplicada.
 *
 * `data` es **exactamente el body de `POST /clientes`**. Esto sólo traduce a camelCase y se defiende
 * de lo que el LLM pueda haber ensuciado; no reinterpreta ni completa nada.
 */

function texto(v: unknown): string | null {
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : null;
}

/** Un entero del wire, o `null`. Un `doc_tipo` que llegue como string no se descarta: se lee. */
function entero(v: unknown): number | null {
  if (typeof v === 'number' && Number.isInteger(v)) return v;
  if (typeof v === 'string' && /^\d+$/.test(v.trim())) return Number(v.trim());
  return null;
}

/**
 * Devuelve la propuesta lista para `crearCliente`, o `null` si esta card no es una — incluido el caso
 * de una `cliente_propuesto` **sin nombre**, que no se puede pintar ni guardar.
 *
 * `kind` se compara exacto porque lo fija el backend; el resto se valida porque lo llenó un LLM.
 */
export function leerClientePropuesto(card: ReplyCard | undefined): DatosCliente | null {
  if (card?.kind !== 'cliente_propuesto') return null;
  const data = card.data;
  if (typeof data !== 'object' || data === null) return null;

  const d = data as Record<string, unknown>;
  const nombre = texto(d.nombre);
  // Sin nombre no hay card: es el único campo que el backend exige, y pintar un formulario vacío
  // sería pedirle que tipee lo que ya dictó.
  if (nombre == null) return null;

  const docTipo = entero(d.doc_tipo);
  return {
    nombre,
    // 🔴 El 99 es "consumidor final" y un CLIENTE nunca vale 99 — es el registro fantasma que el
    // contrato §3.2 existe para evitar. Si el LLM lo puso, se descarta el TIPO y se conserva el
    // número: el emprendedor elige cuál es, que es exactamente lo que la card sirve para hacer.
    docTipo: docTipo === 99 ? null : docTipo,
    docNro: texto(d.doc_nro),
    condicionIva: entero(d.condicion_iva),
    domicilio: texto(d.domicilio),
    email: texto(d.email),
    telefono: texto(d.telefono),
    notas: texto(d.notas),
    // Viene puesto por el backend y **no se pisa**: es lo que después responde "¿la cartera se armó
    // sola o la cargaron?". Si el LLM mandó cualquier cosa, cae a 'voz', que es de donde vino.
    origen: d.origen === 'manual' || d.origen === 'derivado' ? d.origen : 'voz',
  };
}

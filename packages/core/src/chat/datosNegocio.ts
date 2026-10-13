import type { ReplyCard } from '../api/types';

/**
 * `datos_negocio` — la card de LECTURA con que el copiloto contesta una pregunta por los números del
 * negocio («¿cuánto entró este mes?», «¿quién me debe?»). Forma emitida por el backend
 * (`apps/copiloto/datos_card.py`, preg-datos / C-D5): `data = {titulo, cifras: [{k, v}], chip, nota}`.
 *
 * 🔴 **`v` viaja YA FORMATEADO** (plata argentina `$1.234,56`, o un texto compuesto como
 * «$2.500,00 · 3 comprobantes»). Acá no se parsea, no se suma y no se re-formatea: el número nace en la
 * misma capa que las pantallas de Inteligencia y pasa tal cual (`datos_card.py`: «un builder que
 * recalcula es un segundo camino al mismo número»). Por eso `valor` es `string`, nunca `number`.
 *
 * 🔴 **`nota` es la salvedad que cambia cómo se lee el número** (Mercado Pago desconectado = «lo que
 * entró puede estar incompleto»). Se conserva siempre que venga: una card que la esconde muestra un
 * número que el emprendedor lee como completo. `chip` y `nota` son `string | null` y pueden venir los
 * dos `null`.
 *
 * Es lectura pura: no hay `confirmed`, ni gate, ni propuesta.
 */
export interface CifraDatosNegocio {
  clave: string;
  valor: string;
}

export interface DatosNegocio {
  titulo: string;
  cifras: CifraDatosNegocio[];
  chip: string | null;
  nota: string | null;
}

function texto(v: unknown): string | null {
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : null;
}

function leerCifra(raw: unknown): CifraDatosNegocio | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const clave = texto(r.k);
  const valor = texto(r.v);
  return clave != null && valor != null ? { clave, valor } : null;
}

/**
 * La card de datos del negocio, o `null` si la card no es una. `null` también cuando no hay `titulo` o
 * ninguna cifra legible: el backend nunca emite una card vacía («una tarjeta vacía parece una
 * respuesta»), así que un payload así es un contrato roto y cae a la burbuja de texto, que sí dice algo.
 */
export function leerDatosNegocio(card: ReplyCard | undefined): DatosNegocio | null {
  if (card?.kind !== 'datos_negocio') return null;
  const d = card.data;
  if (typeof d !== 'object' || d === null) return null;
  const r = d as Record<string, unknown>;
  const titulo = texto(r.titulo);
  if (titulo == null || !Array.isArray(r.cifras)) return null;
  const cifras = r.cifras.map(leerCifra).filter((c): c is CifraDatosNegocio => c != null);
  if (cifras.length === 0) return null;
  return { titulo, cifras, chip: texto(r.chip), nota: texto(r.nota) };
}

import type { ReplyCard } from '../api/types';

/**
 * `card.detalle` — el detalle ESTRUCTURADO del gate de confirmación (C-D3, piloto Gmail). Forma emitida
 * por el backend (`apps/copiloto/hitl_card.py`):
 *
 *     {titulo: 'Mail a lucia@x.com',
 *      filas: [{k: 'Para', v: 'lucia@x.com', sub: null, editable: false}, …],
 *      cita: 'cuerpo entero del mail', nota: 'Se manda desde tu Gmail.'}
 *
 * 🔴 **Sale de los `arguments` que se van a EJECUTAR, no del texto.** Es la fuente de verdad de lo que
 * quien confirma está aprobando: la UI pinta de acá `titulo`/`filas`/`cita`, y el `markdown` (preview)
 * deja de ser la fuente de los datos estructurados. Por eso, cuando hay `detalle`, gana sobre cualquier
 * regex del texto (`AMOUNT_RE`, negrita) — ver `mapearGate`.
 *
 * 🔴 **`cita` es el cuerpo ENTERO y se conserva tal cual** (sin recortar, sin `trim` del contenido):
 * quien confirma tiene que ver lo que se manda. Si una pantalla lo trunca, que sea con «ver más».
 *
 * `sub` y `editable` los pone el backend en `null`/`false` a propósito: adónde lleva una fila y qué se
 * edita son decisiones de pantalla.
 *
 * Es el único lugar que sabe qué hacer con un `detalle` sucio. Si el payload no se puede leer (sin
 * título, o sin ninguna fila ni cita), devuelve `null` y la card cae al `markdown`, que sí dice algo.
 */
export interface FilaDetalleGate {
  clave: string;
  valor: string;
  sub: string | null;
  /** Estricto `=== true`: sólo una fila que el backend declara editable lo es. */
  editable: boolean;
}

export interface DetalleGate {
  titulo: string;
  filas: FilaDetalleGate[];
  cita: string | null;
  nota: string | null;
}

/** La clave de la fila que lleva el importe del gate (la que, con `detalle`, GANA sobre `AMOUNT_RE`). */
export const CLAVE_IMPORTE = 'Importe';
/** La clave de la fila del destinatario. */
export const CLAVE_PARA = 'Para';

/** El string tal cual vino (sin recortarlo) si tiene contenido; `null` si está vacío o no es string. */
function textoCrudo(v: unknown): string | null {
  return typeof v === 'string' && v.trim() !== '' ? v : null;
}

function leerFila(raw: unknown): FilaDetalleGate | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const clave = textoCrudo(r.k);
  const valor = textoCrudo(r.v);
  if (clave == null || valor == null) return null;
  return { clave, valor, sub: textoCrudo(r.sub), editable: r.editable === true };
}

export function leerDetalleGate(card: ReplyCard | null | undefined): DetalleGate | null {
  const d = card?.detalle;
  if (typeof d !== 'object' || d === null) return null;
  const r = d as Record<string, unknown>;
  const titulo = textoCrudo(r.titulo);
  if (titulo == null) return null;
  const filas = Array.isArray(r.filas)
    ? r.filas.map(leerFila).filter((f): f is FilaDetalleGate => f != null)
    : [];
  const cita = textoCrudo(r.cita);
  // Sin filas ni cita no hay nada que pintar: un título solo no le dice a quien confirma qué aprueba.
  if (filas.length === 0 && cita == null) return null;
  return { titulo, filas, cita, nota: textoCrudo(r.nota) };
}

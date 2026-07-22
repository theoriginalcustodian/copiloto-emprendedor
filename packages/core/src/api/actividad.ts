import { apiClient } from './client';
import { ApiError } from './errors';

/**
 * `/actividad` — lo que el emprendedor hizo, **cruzando las tablas de negocio**.
 *
 * Contrato: `coordinacion/abierto/2026-07-22_contrato_planificacion-a-todos_actividad-reciente-real.md`.
 * Forma **medida contra el vivo por HTTP público** el 2026-07-22, incluido el viaje del cursor.
 *
 * ⚠️ **Este archivo se reescribió entero.** El anterior modelaba «entradas firmadas» del proyecto
 * clínico (`entrada_id`, `cliente_nombre`, `tipo_operacion`, `extracto`) y no describía nada de este
 * producto — mismo caso que `clientes.ts`. Si aparece en la historia, no es una versión anterior de
 * esto: es otro contrato con el mismo nombre de archivo.
 *
 * 🔴 **El chat NO es actividad.** Los episodios de Graphity son conversación, no operaciones;
 * mezclarlos taparía las cinco cosas que el emprendedor quiere ver. *«¿Qué hice ayer?»* tiene su
 * propio camino y es otro: la tool `consultar_actividad` del motor, que devuelve un resumen en
 * lenguaje natural.
 *
 * 🔴 **`signo`, `titulo` y `detalle` los arma el BACKEND.** La app no compone texto de negocio ni
 * deduce el color del tipo: el día que entre un tipo nuevo, deducirlo pintaría mal **en silencio**, y
 * el mismo ítem se vería distinto en la pantalla principal y en la función.
 */

/** `entra` pinta el ingreso, `sale` el egreso, `neutro` lo que todavía no es plata. Lo decide el backend. */
export type SignoActividad = 'entra' | 'sale' | 'neutro';

export interface ActividadItem {
  /**
   * `"<tipo>:<id>"` — estable, único, y **dice de dónde salió**. Es lo que va a permitir rutear el tap
   * sin una tabla de traducción (hito 5).
   */
  id: string;
  /**
   * `factura | nota_credito | presupuesto | gasto | ingreso | cliente`.
   *
   * `string` abierto y no unión cerrada: un tipo nuevo del backend **no puede romper la lista**. Lo
   * que el cliente no reconozca se muestra igual, con su título y su monto, porque el texto ya viene
   * armado de allá.
   */
  tipo: string;
  /** ISO-8601 con offset. */
  fecha: string;
  /** Qué fue, en el idioma del emprendedor (`"Factura B 0001-00000042"`). */
  titulo: string;
  /** A quién / de qué. `''` cuando no aplica. */
  detalle: string;
  /** String decimal, o `null` si el tipo no tiene monto (un cliente nuevo). **Nunca `Number()`.** */
  monto: string | null;
  signo: SignoActividad;
}

interface ItemCrudo {
  id?: string;
  tipo?: string;
  fecha?: string;
  titulo?: string;
  detalle?: string;
  monto?: string | null;
  signo?: string;
}

function normalizar(i: ItemCrudo, indice: number): ActividadItem {
  const signo = i.signo;
  return {
    // `?? String(indice)`: sin id no se puede rutear, pero **sí** se puede mostrar. Dejarlo caer
    // perdería la fila entera por un campo que sólo hace falta al tocarla.
    id: i.id ?? `desconocido:${indice}`,
    tipo: i.tipo ?? '',
    fecha: i.fecha ?? '',
    titulo: i.titulo ?? '',
    detalle: i.detalle ?? '',
    monto: i.monto ?? null,
    // `neutro` por default: es el que NO pinta color. Si el backend manda un signo que no conozco,
    // no mostrar color es honesto; inventar "entra" teñiría de verde algo que quizá salió.
    signo: signo === 'entra' || signo === 'sale' ? signo : 'neutro',
  };
}

export type ActividadResult =
  | { status: 'ok'; items: ActividadItem[]; cursor: string | null }
  | { status: 'no_disponible' };

export interface ListarActividadParams {
  /** Default 20 del backend, máximo 100. Fuera de rango → 400 (medido). */
  limit?: number;
  /**
   * El cursor **de la respuesta anterior**, tal cual vino.
   *
   * 🔴 **Es un token opaco: no se parsea, no se construye, no se recorta.** Se manda vía
   * `URLSearchParams`, que lo codifica (`|`→`%7C`, `:`→`%3A`). Medido: así viaja intacto — y también
   * sobrevive un cursor viejo con `+00:00`, porque `URLSearchParams` codifica el `+` como `%2B` en
   * vez de dejarlo valer "espacio". Concatenarlo a mano en la URL es lo que rompe.
   */
  cursor?: string | null;
}

/**
 * 🔴 **Se valida por FORMA, no por status.**
 *
 * Una ruta no desplegada devuelve **`200` con el HTML del SPA** (catch-all `@app.get("/{full_path}")`
 * en `apps/copiloto/web.py:141`), no un 404. Y para un endpoint de **sólo lectura** la sonda por verbo
 * tampoco discrimina: `POST /actividad` y `POST /ruta-inventada` dan **405 los dos** (medido por
 * backend). Lo único que distingue es el cuerpo: `{items, cursor}` vs `<!doctype html>`.
 *
 * Este archivo ya se llevó ese golpe una vez: mapeaba sólo 404/501 a `no_disponible` mientras su
 * docstring afirmaba cubrir "la ruta no desplegada", y en producción el `200`+HTML explotaba en
 * `res.json()` — la pantalla mostraba un ERROR donde debía decir "todavía no está disponible".
 */
function esRespuestaDelEndpoint(raw: unknown): boolean {
  return typeof raw === 'object' && raw !== null && 'items' in raw;
}

/**
 * La actividad, más nueva primero.
 *
 * Sin operaciones → `{ status: 'ok', items: [], cursor: null }`. **`[]` no es un error**: es el primer
 * día del emprendedor, y mostrarle datos que no son suyos no se lee como "está vacío" sino como
 * **"esta app no es mía"**.
 *
 * `cursor: null` en la respuesta significa **no hay más páginas**, y viaja siempre — un campo que
 * aparece y desaparece obliga a defenderse de dos formas del mismo dato.
 */
export async function listarActividad(params: ListarActividadParams = {}): Promise<ActividadResult> {
  const query = new URLSearchParams();
  if (params.limit !== undefined) query.set('limit', String(params.limit));
  if (params.cursor != null && params.cursor !== '') query.set('cursor', params.cursor);
  const qs = query.toString();

  try {
    const raw = await apiClient.get<{ items: ItemCrudo[]; cursor: string | null }>(
      qs ? `/actividad?${qs}` : '/actividad',
    );
    if (!esRespuestaDelEndpoint(raw)) return { status: 'no_disponible' };
    return {
      status: 'ok',
      items: (raw.items ?? []).map(normalizar),
      cursor: raw.cursor ?? null,
    };
  } catch (err) {
    // 501 = stub explícito; 405 = ruta sin este verbo. Ninguna es error del usuario ni la arregla un
    // reintento.
    if (err instanceof ApiError && (err.status === 501 || err.status === 405)) {
      return { status: 'no_disponible' };
    }
    // Un `200` con HTML explota en `res.json()`, no en `mapearError`: llega acá como error de parseo
    // y NO como `ApiError`. Es el mismo caso que la guarda de forma, visto desde el otro lado.
    if (!(err instanceof ApiError)) return { status: 'no_disponible' };
    throw err;
  }
}

import { apiClient } from './client';
import { ApiError } from './errors';
import type { ConDisponibilidad } from './afip';

/**
 * `/gastos` — lo que sale. La otra mitad de la contabilidad de gestión (facturación es lo que entra).
 *
 * Contrato: `coordinacion/en-curso/2026-07-21_contrato_planificacion-a-todos_gastos-fase1.md`.
 * **Toda la forma de este archivo está medida contra el servicio vivo**, no leída del contrato:
 * sonda campo por campo, 28/28, el 2026-07-21 (`scratchpad/sonda_gastos.py`). El contrato y el
 * backend coincidieron, pero eso se verificó — no se asumió.
 *
 * 🔴 **`monto` es un STRING decimal y no se convierte a número en ninguna parte.** Es plata: el
 * `float` de JavaScript pierde centavos, y acá los centavos se suman al resumen del mes, que es
 * justamente el número que el emprendedor va a mirar para decidir. Se transporta y se muestra como
 * string (ver `dinero/formatoDinero.ts`).
 *
 * 🔴 **La fecha la pone el backend en hora de Argentina**, no en UTC, y eso importa más de lo que
 * parece: un gasto cargado a las 21:30 de Argentina ya es "mañana" en UTC, y los días 30 y 31 caerían
 * en el **mes siguiente** — o sea, justo en el resumen. Cuando esta capa manda `fecha`, la manda
 * explícita; cuando la omite, confía en ese default. *(Verificado por accidente afortunado: la sonda
 * corrió 01:41 UTC = 22:41 ART del día anterior, y el gasto salió con la fecha argentina.)*
 *
 * 🔴 **No hay `PATCH` ni `DELETE` en Fase 1** — decisión escrita del contrato §12, no un olvido. Un
 * gasto se corrige **antes** de guardarlo, en la card editable de la voz. Este módulo no expone
 * edición ni borrado, y no hay que "agregarlo por las dudas".
 */

/**
 * Las ocho categorías, **lista cerrada**. Un valor fuera de esto es 400 del backend (medido).
 *
 * Fijas y no libres a propósito: si el LLM inventa el nombre, «mercadería» y «stock» quedan como
 * rubros distintos y *«¿en qué se me va la plata?»* deja de tener respuesta. Lo que el emprendedor
 * dijo textual vive en `descripcion`, que sí es libre.
 */
export const CATEGORIAS_GASTO = [
  'mercaderia',
  'servicios',
  'alquiler',
  'sueldos',
  'impuestos',
  'transporte',
  'herramientas',
  'otros',
] as const;

export type CategoriaGasto = (typeof CATEGORIAS_GASTO)[number];

/** Etiquetas para mostrar. El valor que viaja al backend es siempre la clave, nunca esto. */
export const ETIQUETA_CATEGORIA: Record<CategoriaGasto, string> = {
  mercaderia: 'Mercadería',
  servicios: 'Servicios',
  alquiler: 'Alquiler',
  sueldos: 'Sueldos',
  impuestos: 'Impuestos',
  transporte: 'Transporte',
  herramientas: 'Herramientas',
  otros: 'Otros',
};

export function esCategoriaValida(valor: string): valor is CategoriaGasto {
  return (CATEGORIAS_GASTO as readonly string[]).includes(valor);
}

/** De dónde salió el gasto. **No es decorativo** — ver `Gasto.origen`. */
export type OrigenGasto = 'voz' | 'manual' | 'foto';

export interface Gasto {
  /** Entero (`bigserial`), no uuid — igual que presupuestos. */
  id: number;
  /** String decimal con 2 decimales. **Nunca `Number()`** — ver el docstring del módulo. */
  monto: string;
  /**
   * Lo que leyó el OCR de la foto, o `null`.
   *
   * 🔴 **Existe para que la precisión del OCR se pueda MEDIR en producción**, y lo pidió esta sesión
   * antes de que existiera el DDL (cuando agregar una columna todavía era gratis). Sin él, un monto
   * aceptado de la sugerencia del OCR queda indistinguible de uno tipeado a mano, y dentro de un mes
   * la pregunta *"¿el OCR acierta?"* no tiene mejor respuesta que una impresión.
   *
   * `monto === montoSugerido` → acertó · distintos → el usuario corrigió · `null` con `origen: 'foto'`
   * → no pudo leer. Es un `SELECT`, no una llamada extra.
   */
  montoSugerido: string | null;
  /** `YYYY-MM-DD`, en hora de Argentina. Ver el docstring del módulo. */
  fecha: string;
  categoria: CategoriaGasto;
  proveedor: string | null;
  medioPago: string | null;
  /** Lo que el emprendedor dijo textual, cuando vino por voz. */
  descripcion: string | null;
  /**
   * 🔴 **Es cómo vamos a saber si la voz se usa de verdad**, en vez de discutirlo de memoria dentro
   * de un mes. La puerta principal de esta función es hablar; si todos terminan tipeando, el dato lo
   * dice este campo y nada más.
   */
  origen: OrigenGasto;
  /**
   * ISO-8601. ⚠️ **Llega como `2026-07-22T01:41:08.185511+00:00`, NO terminado en `Z`** (medido).
   * El ejemplo del contrato mostraba `Z`. No hacer `endsWith('Z')` con esto.
   */
  creadoEn: string;
}

interface GastoCrudo {
  id: number;
  monto?: string;
  monto_sugerido?: string | null;
  fecha?: string;
  categoria?: string;
  proveedor?: string | null;
  medio_pago?: string | null;
  descripcion?: string | null;
  origen?: string;
  creado_en?: string;
}

function normalizar(g: GastoCrudo): Gasto {
  const categoria = g.categoria ?? '';
  const origen = g.origen ?? '';
  return {
    id: g.id,
    // `?? '0.00'` y no `?? ''`: un gasto sin monto es un dato roto, pero un campo de plata vacío se
    // lee como "gratis". Un cero es visiblemente inconsistente con el resumen y se reporta.
    monto: g.monto ?? '0.00',
    montoSugerido: g.monto_sugerido ?? null,
    fecha: g.fecha ?? '',
    // Cae en 'otros' si el backend mandara algo fuera de la lista. No se inventa una categoría nueva
    // del lado del cliente: la lista cerrada es lo que hace que el resumen tenga sentido.
    categoria: esCategoriaValida(categoria) ? categoria : 'otros',
    proveedor: g.proveedor ?? null,
    medioPago: g.medio_pago ?? null,
    descripcion: g.descripcion ?? null,
    origen: origen === 'voz' || origen === 'foto' ? origen : 'manual',
    creadoEn: g.creado_en ?? '',
  };
}

/**
 * "Esta capacidad no está en este deploy" — **el 404 NO entra acá**.
 *
 * En `/gastos/{id}` el 404 es **semántico**: no existe *para este tenant* (incluye el caso de un id
 * ajeno — el backend no confirma la existencia de recursos de otros, y tiene test adversarial).
 * Tratarlo como "no desplegado" le diría "todavía no está disponible" sobre un endpoint vivo.
 */
function noDesplegado(err: unknown): boolean {
  return err instanceof ApiError && (err.status === 405 || err.status === 501);
}

/**
 * 🔴 **Un `GET` a una ruta no desplegada devuelve `200` con `<!doctype html>`**, no 404 ni 405: el
 * front-door monta un catch-all `@app.get("/{full_path}")` para servir el SPA
 * (`apps/copiloto/web.py:141`). El status diría "todo bien" sobre una ruta que no existe.
 *
 * Por eso los GET se validan por **forma**, no por status. La sonda de despliegue, en cambio, va por
 * **POST** (`POST /gastos {}` → 400/422 = vivo · 405 = no desplegado), que es el único verbo que
 * discrimina. Verificado en negativo contra `/gastos` cuando todavía no existía: dio 405.
 */
function esRespuestaDelEndpoint(raw: unknown, clave: string): boolean {
  return typeof raw === 'object' && raw !== null && clave in raw;
}

export interface ListarGastosParams {
  /** Default 50 del lado del backend. */
  limit?: number;
}

/**
 * El listado del tenant, `fecha DESC`.
 *
 * `total` es **el conteo del tenant, no el largo de la página** — se usa para "37 gastos" aunque la
 * página traiga 50. Tenant sin gastos → `{ status: 'ok', gastos: [], total: 0 }`. **`[]` no es un
 * error**: es el estado normal del primer día.
 */
export async function listarGastos(
  params: ListarGastosParams = {},
): Promise<ConDisponibilidad<{ gastos: Gasto[]; total: number }>> {
  const query = new URLSearchParams();
  if (params.limit !== undefined) query.set('limit', String(params.limit));
  const qs = query.toString();
  try {
    const raw = await apiClient.get<{ gastos: GastoCrudo[]; total: number }>(
      qs ? `/gastos?${qs}` : '/gastos',
    );
    if (!esRespuestaDelEndpoint(raw, 'gastos')) return { status: 'no_disponible' };
    const gastos = (raw.gastos ?? []).map(normalizar);
    // `?? gastos.length` y no al revés: `total` es el conteo real y la página puede ser más corta.
    return { status: 'ok', gastos, total: raw.total ?? gastos.length };
  } catch (err) {
    if (noDesplegado(err)) return { status: 'no_disponible' };
    // Un 200 con HTML explota en `res.json()`, no en `mapearError`: llega acá como error de parseo.
    if (!(err instanceof ApiError)) return { status: 'no_disponible' };
    throw err;
  }
}

/** El detalle. `no_encontrado` cubre el 404 semántico: no existe, **o es de otro tenant**. */
export async function obtenerGasto(
  id: number,
): Promise<ConDisponibilidad<{ gasto: Gasto }> | { status: 'no_encontrado' }> {
  try {
    const raw = await apiClient.get<{ gasto: GastoCrudo }>(`/gastos/${id}`);
    if (!esRespuestaDelEndpoint(raw, 'gasto')) return { status: 'no_disponible' };
    return { status: 'ok', gasto: normalizar(raw.gasto) };
  } catch (err) {
    if (noDesplegado(err)) return { status: 'no_disponible' };
    if (err instanceof ApiError && err.status === 404) return { status: 'no_encontrado' };
    if (!(err instanceof ApiError)) return { status: 'no_disponible' };
    throw err;
  }
}

export interface CrearGastoRequest {
  /** **El único obligatorio.** String decimal > 0. Cero, negativo o no numérico → 400 (medido). */
  monto: string;
  /** Obligatorio. `'voz' | 'manual' | 'foto'`; otro valor → 400 (medido). */
  origen: OrigenGasto;
  /** `YYYY-MM-DD`. Omitido → hoy en Argentina, lo pone el backend. */
  fecha?: string;
  /** Omitida → `'otros'`. Fuera de la lista → 400 (medido). */
  categoria?: CategoriaGasto;
  /** ≤120. */
  proveedor?: string;
  /** ≤40. */
  medioPago?: string;
  /** ≤500. Es donde va lo que el emprendedor dijo textual. */
  descripcion?: string;
  /** Lo que leyó el OCR, cuando `origen: 'foto'`. Ver `Gasto.montoSugerido`. */
  montoSugerido?: string;
}

/**
 * Las claves ausentes **no se mandan** — no viajan como `null`. Mandar `null` explícito sería pedirle
 * al backend que sobrescriba con vacío en vez de usar su default; en `fecha` eso significaría perder
 * el default de zona horaria argentina, que es exactamente lo que no queremos.
 */
function aBodyCrudo(req: CrearGastoRequest): Record<string, unknown> {
  const body: Record<string, unknown> = { monto: req.monto, origen: req.origen };
  if (req.fecha !== undefined) body.fecha = req.fecha;
  if (req.categoria !== undefined) body.categoria = req.categoria;
  if (req.proveedor !== undefined) body.proveedor = req.proveedor;
  if (req.medioPago !== undefined) body.medio_pago = req.medioPago;
  if (req.descripcion !== undefined) body.descripcion = req.descripcion;
  if (req.montoSugerido !== undefined) body.monto_sugerido = req.montoSugerido;
  return body;
}

/**
 * Crea el gasto. **201** con el objeto completo.
 *
 * 🔴 **Nada que venga de voz llega acá sin que el emprendedor lo haya visto y podido corregir**
 * (contrato §5, regla dura). Si Whisper transcribe *«cincuenta mil»* donde dijo *«quince mil»*, ese
 * número entra a la base, envenena la rentabilidad —que es *la razón* por la que carga gastos— y nadie
 * lo va a poder rastrear después: no se ve el gasto mal cargado, se ve el total.
 *
 * Lanza `ApiError` 400 con el `detail` del campo (`"falta monto"`), que es mostrable tal cual.
 */
export async function crearGasto(
  req: CrearGastoRequest,
): Promise<ConDisponibilidad<{ gasto: Gasto }>> {
  try {
    const raw = await apiClient.post<{ gasto: GastoCrudo }>('/gastos', aBodyCrudo(req));
    if (!esRespuestaDelEndpoint(raw, 'gasto')) return { status: 'no_disponible' };
    return { status: 'ok', gasto: normalizar(raw.gasto) };
  } catch (err) {
    if (noDesplegado(err)) return { status: 'no_disponible' };
    throw err;
  }
}

export interface CategoriaResumen {
  categoria: CategoriaGasto;
  /** String decimal. */
  total: string;
  /**
   * Decimal con 1 posición (`33.3`).
   *
   * 🔴 **NO está garantizado que los porcentajes sumen 100** — lo dice el contrato §6 y hay que
   * creerle: con tres categorías iguales dan `33.3` tres veces. **Quien dibuje barras normaliza sobre
   * la suma real**, no confía en que cierre. Es número (no plata), así que acá sí es `number`.
   */
  porcentaje: number;
}

export interface ResumenGastos {
  /** `YYYY-MM`. */
  periodo: string;
  /** String decimal. `'0.00'` cuando no hubo gastos — que es un dato, no una ausencia. */
  total: string;
  /** Ordenado por total desc, **sin las categorías en cero**. */
  porCategoria: CategoriaResumen[];
  /** `null` si no hay datos del mes anterior. Sirve para "gastaste más/menos que el mes pasado". */
  mesAnterior: string | null;
}

interface CategoriaResumenCruda {
  categoria?: string;
  total?: string;
  porcentaje?: number;
}

interface ResumenCrudo {
  periodo?: string;
  total?: string;
  por_categoria?: CategoriaResumenCruda[] | null;
  mes_anterior?: string | null;
}

/**
 * El resumen del mes — **la recompensa de la función**, no un extra.
 *
 * Sin esto, cargar gastos es trabajo que el emprendedor hace *para* el sistema y se abandona en una
 * semana; con esto, es trabajo que el sistema le devuelve.
 *
 * Un período sin gastos responde **200** con `total: '0.00'` y `porCategoria: []` — **no 404**:
 * "no gastaste nada" es un dato. Medido contra el vivo antes y después de crear un gasto: pasó de
 * `0.00` a `15000.50` con `mercaderia` en `porCategoria` (el control del **efecto**, no de la
 * respuesta).
 */
export async function obtenerResumenGastos(
  periodo?: string,
): Promise<ConDisponibilidad<{ resumen: ResumenGastos }>> {
  const qs = periodo !== undefined ? `?periodo=${encodeURIComponent(periodo)}` : '';
  try {
    const raw = await apiClient.get<ResumenCrudo>(`/gastos/resumen${qs}`);
    // `periodo` y no `total`: `total` podría existir en otra respuesta cualquiera; `periodo` es de
    // este endpoint. Y si la ruta no estuviera declarada ANTES de `/gastos/{id}`, esto llegaría como
    // un 422 `int_parsing` sobre un parámetro que nunca mandamos — el síntoma que hizo falta señalar.
    if (!esRespuestaDelEndpoint(raw, 'periodo')) return { status: 'no_disponible' };
    const porCategoria: CategoriaResumen[] = (raw.por_categoria ?? []).map((c) => ({
      categoria: esCategoriaValida(c.categoria ?? '') ? (c.categoria as CategoriaGasto) : 'otros',
      total: c.total ?? '0.00',
      porcentaje: typeof c.porcentaje === 'number' ? c.porcentaje : 0,
    }));
    return {
      status: 'ok',
      resumen: {
        periodo: raw.periodo ?? '',
        total: raw.total ?? '0.00',
        porCategoria,
        mesAnterior: raw.mes_anterior ?? null,
      },
    };
  } catch (err) {
    if (noDesplegado(err)) return { status: 'no_disponible' };
    if (!(err instanceof ApiError)) return { status: 'no_disponible' };
    throw err;
  }
}

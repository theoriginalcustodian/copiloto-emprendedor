import { apiClient } from './client';
import { ApiError } from './errors';
import type { ConDisponibilidad } from './afip';

/**
 * **`/ingresos` — todo lo que entró.** Las facturas cobradas, lo que vio MercadoPago, y lo que el
 * emprendedor **dictó** (*«me pagaron 85 mil en efectivo»*).
 *
 * Vivo desde el 2026-07-22 (`avance_backend_INGRESOS-vivo`, PR #16, E2E 11/11). ⚠️ **Se llamaba
 * `POST /cobros` y pasó a `/ingresos`**: no hay alias, así que el nombre viejo da 405.
 *
 * 🔴 **`origen` no es cosmético y por eso viaja siempre.** Un cobro que el sistema **vio**
 * (`mercadopago`, `factura`) no es la misma evidencia que uno que alguien **tipeó** (`manual`). Si se
 * mezclaran sin marca, el día que la caja no cuadre con el banco no habría por dónde empezar a mirar.
 *
 * 🔴 **Lo único obligatorio es el monto, y la app NO puede exigir más.** Un formulario que pide medio
 * de pago y cliente para anotar que te pagaron es lo que hace que el emprendedor deje de anotar — y
 * volvemos a la caja que miente. El backend devuelve `falta: [...]` para avisar **después** de
 * guardar. Pedir ≠ exigir. [[validacion-de-mas-en-la-ui-enmascara-bugs]]
 *
 * 🔴 **El duplicado se pregunta ANTES, el dato faltante se avisa DESPUÉS.** No es una inconsistencia:
 * un dato que falta **se ve** y se completa cuando aparezca; un ingreso de más **infla la caja y no se
 * ve nunca**. Por eso el 409 llega con el candidato y con `reintentar_con` — la app no tiene que
 * adivinar cómo insistir.
 *
 * ⚠️ **El listado y el alta NO devuelven los mismos campos**, y acá no se disimula: el listado trae
 * `borrable` y `comprobante_nro` pero **no** `falta`; el alta trae `falta` pero **no** `borrable`. Lo
 * que no vino queda en `null` —"no sé"— y nunca en `[]` o `false`, que serían afirmaciones.
 */

/** De dónde salió el ingreso. **Sólo `manual` es borrable.** */
export type OrigenIngreso = 'factura' | 'manual' | 'mercadopago' | 'voz';

/** Qué dato quedó sin cargar. Lo calcula el backend: el aviso y el dato tienen que salir del mismo
 *  lugar o van a divergir. */
export type FaltanteIngreso = 'cliente' | 'medio' | 'concepto';

export interface Ingreso {
  id: number;
  /** String decimal — **plata, nunca `Number()`**. */
  monto: string | null;
  /** Cómo le pagaron, texto libre. `null` si no lo dijo. */
  medio: string | null;
  /** `YYYY-MM-DD`. */
  fecha: string | null;
  origen: OrigenIngreso;
  clienteNombre: string | null;
  concepto: string | null;
  /** La factura de la que salió, si salió de una. */
  comprobanteId: number | null;
  /** El número visible de esa factura. **Sólo viene en el listado.** */
  comprobanteNro: number | null;
  presupuestoRef: number | null;
  /**
   * Lo que quedó sin cargar. **`null` = no lo sabemos** (el listado no lo manda), que es distinto de
   * `[]` = "no falta nada". Pintar `null` como "completo" sería afirmar sobre un dato que no llegó.
   */
  falta: FaltanteIngreso[] | null;
  /**
   * Si se puede borrar. **`null` = no lo sabemos** (el alta no lo manda), y ahí **no se ofrece
   * borrar**: la dirección seguraes no ofrecer una acción destructiva sobre lo que no se conoce.
   * Borrar el rastro de un cobro que el sistema vio sería inventar que esa factura no se cobró.
   */
  borrable: boolean | null;
}

interface IngresoRaw {
  id?: number;
  monto?: string | number | null;
  medio?: string | null;
  fecha?: string | null;
  origen?: string | null;
  cliente_nombre?: string | null;
  concepto?: string | null;
  comprobante_id?: number | null;
  comprobante_nro?: number | null;
  presupuesto_ref?: number | null;
  falta?: unknown;
  borrable?: unknown;
}

function importe(v: unknown): string | null {
  if (typeof v === 'string' && v.trim() !== '') return v.trim();
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  return null;
}

/** Un texto del wire, o `null`. El backend manda `""` para "no lo dijo" — y `""` en la UI se lee como
 *  un renglón en blanco, que parece un bug de pintado en vez de un dato ausente. */
function texto(v: unknown): string | null {
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : null;
}

/**
 * ⚠️ **Un `origen` desconocido cae en `manual`, y esa dirección está elegida.** `manual` es el que se
 * puede borrar y el que se marca como "lo dijiste vos" — o sea, el que se muestra con **menos**
 * autoridad. Errar hacia ahí degrada la confianza de una fila; errar al revés le daría a algo tipeado
 * el peso de algo que el sistema vio, que es exactamente la mezcla que `origen` existe para impedir.
 */
function origen(v: unknown): OrigenIngreso {
  return v === 'factura' || v === 'mercadopago' || v === 'voz' ? v : 'manual';
}

function faltantes(v: unknown): FaltanteIngreso[] | null {
  if (!Array.isArray(v)) return null;
  return v.filter((x): x is FaltanteIngreso => x === 'cliente' || x === 'medio' || x === 'concepto');
}

function normalizar(r: IngresoRaw): Ingreso {
  return {
    id: r.id as number,
    monto: importe(r.monto),
    medio: texto(r.medio),
    fecha: r.fecha ?? null,
    origen: origen(r.origen),
    clienteNombre: texto(r.cliente_nombre),
    concepto: texto(r.concepto),
    comprobanteId: typeof r.comprobante_id === 'number' ? r.comprobante_id : null,
    comprobanteNro: typeof r.comprobante_nro === 'number' ? r.comprobante_nro : null,
    presupuestoRef: typeof r.presupuesto_ref === 'number' ? r.presupuesto_ref : null,
    falta: faltantes(r.falta),
    borrable: typeof r.borrable === 'boolean' ? r.borrable : null,
  };
}

function noDesplegado(err: unknown): boolean {
  return err instanceof ApiError && (err.status === 405 || err.status === 501 || err.status === 503);
}

/** Un `GET` a una ruta no desplegada devuelve **200 con el HTML del SPA**. Ver `clientes.ts`. */
function esRespuestaDelEndpoint(raw: unknown, clave: string): boolean {
  return typeof raw === 'object' && raw !== null && clave in raw;
}

function ingresoDeLaRespuesta(raw: unknown): Ingreso | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const envuelto = (raw as { ingreso?: unknown }).ingreso;
  const candidato = (typeof envuelto === 'object' && envuelto !== null ? envuelto : raw) as IngresoRaw;
  return typeof candidato.id === 'number' ? normalizar(candidato) : null;
}

/**
 * Todo lo que entró, con el **total ya sumado por el backend**. Sumar acá daría un segundo número para
 * la misma pregunta.
 */
export async function listarIngresos(
  params: { limite?: number } = {},
): Promise<ConDisponibilidad<{ ingresos: Ingreso[]; total: string | null }>> {
  const qs = params.limite !== undefined ? `?limite=${params.limite}` : '';
  try {
    const raw = await apiClient.get<{ ingresos?: IngresoRaw[]; total?: string | number | null }>(
      `/ingresos${qs}`,
    );
    if (!esRespuestaDelEndpoint(raw, 'ingresos')) return { status: 'no_disponible' };
    const filas = Array.isArray(raw.ingresos) ? raw.ingresos : [];
    return {
      status: 'ok',
      ingresos: filas.filter((f) => f != null && typeof f.id === 'number').map(normalizar),
      total: importe(raw.total),
    };
  } catch (err) {
    if (noDesplegado(err)) return { status: 'no_disponible' };
    if (!(err instanceof ApiError)) return { status: 'no_disponible' };
    throw err;
  }
}

export interface RegistrarIngresoRequest {
  /** Lo ÚNICO obligatorio. String decimal. */
  monto: string;
  /**
   * 🔴 **Sólo la card dictada la manda, con `'voz'`.** El alta manual no manda este campo y el backend
   * sigue asumiendo `'manual'` en su ausencia — mismo contrato de siempre, cero cambio para
   * `PantallaIngresos`. Antes de hito 8 el `origen:'voz'` lo ponía el backend porque el guardado pasaba
   * por su propio tool call; ahora que la card persiste vía este mismo `POST` genérico, si nadie lo
   * manda el ingreso dictado quedaría indistinguible de uno tipeado — exactamente lo que `origen` existe
   * para impedir (ver el docstring del módulo).
   */
  origen?: OrigenIngreso;
  medio?: string;
  /** `YYYY-MM-DD`. Si falta, el backend pone hoy. */
  fecha?: string;
  clienteRef?: number;
  clienteNombre?: string;
  presupuestoRef?: number;
  concepto?: string;
  /** Uuid **por gesto del usuario**, igual que en cobros. Sin él, dos toques dejan dos ingresos. */
  idemKey?: string;
  /**
   * El segundo turno: el backend detectó un ingreso parecido y respondió 409; el emprendedor dijo que
   * son dos cobros distintos. **Se manda lo mismo con este flag.**
   */
  confirmarDuplicado?: boolean;
}

function aWire(datos: RegistrarIngresoRequest): Record<string, unknown> {
  const wire: Record<string, unknown> = { monto: datos.monto };
  if (datos.origen !== undefined) wire.origen = datos.origen;
  if (datos.medio !== undefined) wire.medio = datos.medio;
  if (datos.fecha !== undefined) wire.fecha = datos.fecha;
  if (datos.clienteRef !== undefined) wire.cliente_ref = datos.clienteRef;
  if (datos.clienteNombre !== undefined) wire.cliente_nombre = datos.clienteNombre;
  if (datos.presupuestoRef !== undefined) wire.presupuesto_ref = datos.presupuestoRef;
  if (datos.concepto !== undefined) wire.concepto = datos.concepto;
  if (datos.idemKey !== undefined) wire.idem_key = datos.idemKey;
  if (datos.confirmarDuplicado === true) wire.confirmar_duplicado = true;
  return wire;
}

export type ResultadoIngreso =
  | { status: 'ok'; ingreso: Ingreso }
  | { status: 'no_disponible' }
  /** El backend rechazó el dato (monto inválido). Trae su explicación. */
  | { status: 'rechazado'; motivo: string }
  /**
   * 🔴 **Hay un ingreso parecido. NO es un error: es una pregunta.** Se muestra el candidato y, si el
   * emprendedor dice que son dos cobros distintos, se reintenta con `confirmarDuplicado: true`.
   * Avisa, no prohíbe — él sabe mejor que el sistema si le pagaron dos veces.
   */
  | { status: 'posible_duplicado'; mensaje: string; candidato: Ingreso | null };

function duplicadoDelBody(body: unknown): { mensaje: string; candidato: Ingreso | null } {
  const generico = 'Hay un ingreso parecido de estos días. ¿Es otro cobro o el mismo?';
  if (typeof body !== 'object' || body === null) return { mensaje: generico, candidato: null };
  const detalle = (body as { detail?: unknown }).detail;
  const d = typeof detalle === 'object' && detalle !== null ? (detalle as Record<string, unknown>) : {};
  const cand = d.candidato;
  return {
    mensaje: typeof d.mensaje === 'string' && d.mensaje.trim() !== '' ? d.mensaje : generico,
    candidato:
      typeof cand === 'object' && cand !== null && typeof (cand as IngresoRaw).id === 'number'
        ? normalizar(cand as IngresoRaw)
        : null,
  };
}

/** Anotar que entró plata. **Sólo el monto es obligatorio.** */
export async function registrarIngreso(datos: RegistrarIngresoRequest): Promise<ResultadoIngreso> {
  try {
    const ingreso = ingresoDeLaRespuesta(await apiClient.post<unknown>('/ingresos', aWire(datos)));
    return ingreso != null ? { status: 'ok', ingreso } : { status: 'no_disponible' };
  } catch (err) {
    if (err instanceof ApiError && err.status === 409) {
      return { status: 'posible_duplicado', ...duplicadoDelBody(err.body) };
    }
    if (err instanceof ApiError && err.status === 400) {
      return { status: 'rechazado', motivo: err.detail ?? 'Ese ingreso no se puede registrar.' };
    }
    if (noDesplegado(err)) return { status: 'no_disponible' };
    if (!(err instanceof ApiError)) return { status: 'no_disponible' };
    throw err;
  }
}

/**
 * Completar lo que faltó, **EN EL MISMO ingreso**.
 *
 * 🔴 Es la segunda mitad de "guarda igual, pero avisa": si contestar el aviso creara un registro
 * nuevo, el aviso **duplicaría la caja** — que es exactamente el daño que esta función viene a evitar.
 */
export async function completarIngreso(
  id: number,
  datos: Pick<RegistrarIngresoRequest, 'medio' | 'clienteRef' | 'clienteNombre' | 'concepto' | 'fecha'>,
): Promise<ResultadoIngreso | { status: 'no_encontrado' }> {
  const wire: Record<string, unknown> = {};
  if (datos.medio !== undefined) wire.medio = datos.medio;
  if (datos.fecha !== undefined) wire.fecha = datos.fecha;
  if (datos.clienteRef !== undefined) wire.cliente_ref = datos.clienteRef;
  if (datos.clienteNombre !== undefined) wire.cliente_nombre = datos.clienteNombre;
  if (datos.concepto !== undefined) wire.concepto = datos.concepto;
  try {
    const ingreso = ingresoDeLaRespuesta(await apiClient.patch<unknown>(`/ingresos/${id}`, wire));
    return ingreso != null ? { status: 'ok', ingreso } : { status: 'no_disponible' };
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return { status: 'no_encontrado' };
    if (noDesplegado(err)) return { status: 'no_disponible' };
    if (!(err instanceof ApiError)) return { status: 'no_disponible' };
    throw err;
  }
}

/**
 * Borrar un ingreso **DICTADO**.
 *
 * El backend responde `404` si no existe **o no es borrable** — el mismo código a propósito. Por eso
 * la app no ofrece el botón salvo `borrable === true`: llegar hasta acá con un cobro de factura
 * devolvería "no encontrado" sobre algo que el emprendedor está viendo en pantalla.
 */
export async function borrarIngreso(
  id: number,
): Promise<{ status: 'ok' } | { status: 'no_disponible' } | { status: 'no_encontrado' }> {
  try {
    await apiClient.del<unknown>(`/ingresos/${id}`);
    return { status: 'ok' };
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return { status: 'no_encontrado' };
    if (noDesplegado(err)) return { status: 'no_disponible' };
    if (!(err instanceof ApiError)) return { status: 'no_disponible' };
    throw err;
  }
}

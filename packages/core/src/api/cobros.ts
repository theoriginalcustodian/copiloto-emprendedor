import { apiClient } from './client';
import { ApiError } from './errors';
import type { ConDisponibilidad } from './afip';

/**
 * **Cobros de comprobantes** — la mitad que faltaba para responder *«¿quién me debe?»*.
 *
 * Forma **declarada por backend antes de implementar**
 * (`dato_backend-a-todos_hito3-la-forma-final-de-los-tres-endpoints`), justamente para que las dos
 * capas no inventen cada una la suya. ⚠️ **Al escribir esto los endpoints todavía NO existían**: el
 * cliente degrada a `no_disponible` ante 405/501, igual que el resto, y la pantalla lo dice en vez de
 * fingir. Lo que NO se puede es declarar esto probado sin medirlo contra el vivo.
 *
 * 🔴 **Un cobro es una DECLARACIÓN del emprendedor, no una inferencia.** El backend eligió una tabla
 * y no una columna `cobrada`, y eso ordena todo lo de acá: hay cobros parciales, hay `saldo`, y hay
 * un cobro que se puede **deshacer**. Un booleano no tiene fecha, ni monto, ni medio.
 *
 * 🔴 **`ausente` no es `cero`.** Si una respuesta no trae `cobrado`/`saldo`, esto devuelve `null` y
 * **nunca 0**. Un comprobante del que no sabemos si se cobró y uno que no se cobró se ven idénticos
 * en pantalla si el cliente los colapsa acá — y sólo uno de los dos es cierto. Es la misma familia
 * del `facturas_atribuibles: false` que backend marcó en Clientes.
 */

/** Los tres estados, **derivados del saldo** por el backend. No hay columna que los guarde. */
export type EstadoCobro = 'impaga' | 'parcial' | 'cobrada';

export interface Cobro {
  id: number;
  monto: string;
  medio: string | null;
  fecha: string;
  creadoEn: string;
}

/**
 * Lo que el backend informa del comprobante después de tocar sus cobros.
 *
 * Todos los importes son **strings decimales** y no pasan por `Number` — la regla de dinero de este
 * repo. `cobrado`/`saldo` son `null` cuando la respuesta no los trajo (ver el docstring del módulo).
 */
export interface EstadoDeCobro {
  id: number;
  total: string | null;
  cobrado: string | null;
  saldo: string | null;
  estadoCobro: EstadoCobro | null;
}

export interface RegistrarCobroRequest {
  /**
   * Opcional: **si falta, el backend cobra el saldo pendiente completo.** Es lo que permite que la
   * app ofrezca un botón «Cobrada» sin pedir monto, que es el caso de v1.
   */
  monto?: string;
  medio?: string;
  /** `YYYY-MM-DD`. Si falta, el backend pone hoy. */
  fecha?: string;
  /**
   * 🔴 **Mandalo SIEMPRE, y que sea uno por GESTO del usuario.**
   *
   * Sin esto, dos toques del botón dejan **dos cobros** — y el backend hace bien en aceptarlos,
   * porque dos cobros parciales del mismo monto **son un caso real** y él no puede distinguir
   * *«cobré dos veces»* de *«toqué dos veces»*. El único que sabe cuál es cuál es este lado.
   *
   * Repetir la misma clave devuelve **201 con el mismo cobro**, no un 409: reintentar es seguro.
   */
  idemKey: string;
}

interface CobroRaw {
  id?: number;
  monto?: string | number | null;
  medio?: string | null;
  fecha?: string | null;
  created_at?: string | null;
}

interface ComprobanteCobroRaw {
  id?: number;
  total?: string | number | null;
  cobrado?: string | number | null;
  saldo?: string | number | null;
  estado_cobro?: string | null;
}

/**
 * Un importe del wire, **como string**, o `null` si no vino.
 *
 * ⛔ No usa `?? '0'`: inventar un cero convierte "no sé" en "no cobró nada", que es una afirmación
 * distinta y que además **se ve exactamente igual** en la pantalla.
 */
function importe(v: unknown): string | null {
  if (typeof v === 'string' && v.trim() !== '') return v.trim();
  // Un número en el wire sería un contrato roto (los importes viajan como string), pero preferimos
  // conservarlo a tirarlo: `String(12500)` sigue siendo el dato.
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  return null;
}

/** El estado sólo se acepta si es uno de los tres. Un valor nuevo del backend cae en `null` — que la
 *  UI trata como "no sé", no como "impaga". */
function estadoCobro(v: unknown): EstadoCobro | null {
  return v === 'impaga' || v === 'parcial' || v === 'cobrada' ? v : null;
}

function normalizarEstado(raw: ComprobanteCobroRaw | undefined | null): EstadoDeCobro | null {
  if (raw == null || typeof raw !== 'object' || raw.id == null) return null;
  return {
    id: raw.id,
    total: importe(raw.total),
    cobrado: importe(raw.cobrado),
    saldo: importe(raw.saldo),
    estadoCobro: estadoCobro(raw.estado_cobro),
  };
}

function normalizarCobro(raw: CobroRaw | undefined | null): Cobro | null {
  if (raw == null || typeof raw !== 'object' || raw.id == null) return null;
  const monto = importe(raw.monto);
  if (monto == null) return null;
  return {
    id: raw.id,
    monto,
    medio: typeof raw.medio === 'string' && raw.medio.trim() !== '' ? raw.medio.trim() : null,
    fecha: raw.fecha ?? '',
    creadoEn: raw.created_at ?? '',
  };
}

export type ResultadoCobro =
  | { status: 'ok'; cobro: Cobro | null; comprobante: EstadoDeCobro | null }
  | { status: 'no_disponible' }
  | { status: 'no_encontrado' }
  /** El backend rechazó el monto (≤ 0, o mayor que el saldo). Trae su explicación, que es mejor que
   *  cualquier texto que pudiéramos escribir acá. */
  | { status: 'rechazado'; motivo: string };

function esNoDesplegado(err: unknown): boolean {
  return err instanceof ApiError && (err.status === 405 || err.status === 501 || err.status === 503);
}

/**
 * 🔴 **Un `GET` a una ruta no desplegada devuelve `200` con el HTML del SPA**, no un error: el
 * front-door monta un catch-all que sirve el SPA. Así que la ausencia del endpoint **no llega como
 * excepción** — llega como éxito con un cuerpo que no tiene la clave.
 *
 * ⚠️ **Esto faltaba acá, y era un bug mío.** Sin el chequeo, `listarImpagos` contra un deploy sin el
 * endpoint devolvía `{status:'ok', comprobantes: [], totalAdeudado: null}` — o sea la pantalla
 * «me deben» diciendo **«no te debe nadie»**. La afirmación más tranquilizadora posible, construida
 * sobre la ausencia total del dato. `clientes.ts` ya tenía esta guarda; la copié sin ella porque el
 * `POST` sí falla ruidoso y asumí que el `GET` también.
 */
function esRespuestaDelEndpoint(raw: unknown, clave: string): boolean {
  return typeof raw === 'object' && raw !== null && clave in raw;
}

/**
 * `POST /afip/comprobantes/{id}/cobros` — registrar que **entró la plata** de esa factura.
 *
 * 🔴 **La respuesta trae el comprobante actualizado, y hay que usar ESE, no recalcular.** El saldo lo
 * deriva el backend (`total − Σ cobros`); si la app lo restara por su cuenta tendría dos fuentes para
 * el mismo número y la que se ve en pantalla podría no ser la que decide el estado.
 */
export async function registrarCobro(
  comprobanteId: number,
  datos: RegistrarCobroRequest,
): Promise<ResultadoCobro> {
  const cuerpo: Record<string, unknown> = { idem_key: datos.idemKey };
  // Sólo viaja lo que vino: mandar `monto: null` no es lo mismo que omitirlo — omitido significa
  // "el saldo completo", que es justo el caso del botón de v1.
  if (datos.monto !== undefined) cuerpo.monto = datos.monto;
  if (datos.medio !== undefined) cuerpo.medio = datos.medio;
  if (datos.fecha !== undefined) cuerpo.fecha = datos.fecha;

  try {
    const raw = await apiClient.post<{ cobro?: CobroRaw; comprobante?: ComprobanteCobroRaw }>(
      `/afip/comprobantes/${comprobanteId}/cobros`,
      cuerpo,
    );
    return {
      status: 'ok',
      cobro: normalizarCobro(raw?.cobro),
      comprobante: normalizarEstado(raw?.comprobante),
    };
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return { status: 'no_encontrado' };
    if (err instanceof ApiError && err.status === 400) {
      return { status: 'rechazado', motivo: err.detail ?? 'Ese monto no se puede registrar.' };
    }
    if (esNoDesplegado(err)) return { status: 'no_disponible' };
    throw err;
  }
}

/**
 * `DELETE /afip/comprobantes/{id}/cobros/{cobroId}` — deshacer un cobro mal cargado.
 *
 * Existe porque **alguien se equivoca**, y sin esto el único arreglo sería tocar la base. Devuelve el
 * comprobante recalculado.
 */
export async function borrarCobro(
  comprobanteId: number,
  cobroId: number,
): Promise<
  | { status: 'ok'; comprobante: EstadoDeCobro | null }
  | { status: 'no_disponible' }
  | { status: 'no_encontrado' }
> {
  try {
    const raw = await apiClient.del<{ comprobante?: ComprobanteCobroRaw }>(
      `/afip/comprobantes/${comprobanteId}/cobros/${cobroId}`,
    );
    return { status: 'ok', comprobante: normalizarEstado(raw?.comprobante) };
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return { status: 'no_encontrado' };
    if (esNoDesplegado(err)) return { status: 'no_disponible' };
    throw err;
  }
}

/**
 * `GET /afip/comprobantes/{id}/cobros` — **el estado de cobro de UN comprobante, y sus cobros**.
 *
 * 🔴 **Es la fuente autorizada, y por eso la ficha pregunta en vez de mirar la fila que ya tenía.** El
 * listado `GET /afip/comprobantes` no declaró traer `estado_cobro`/`saldo`, y asumir que los trae
 * sería inventar la costura entre las dos capas: los campos llegarían `undefined`, el cliente los
 * dejaría en `null`, y la ficha simplemente **no mostraría el cobro** — un dato desapareciendo sin
 * error, atribuible al backend. Preguntar cuesta un request al abrir el detalle y además lo trae
 * **fresco**, que es lo que se necesita después de cobrar desde otro dispositivo.
 *
 * Y sin esto no hay forma de deshacer: `borrarCobro` necesita el **id del cobro**, que sólo viene acá.
 */
export async function listarCobros(
  comprobanteId: number,
): Promise<
  | { status: 'ok'; cobros: Cobro[]; comprobante: EstadoDeCobro | null }
  | { status: 'no_disponible' }
  | { status: 'no_encontrado' }
> {
  try {
    const raw = await apiClient.get<{ cobros?: CobroRaw[]; comprobante?: ComprobanteCobroRaw }>(
      `/afip/comprobantes/${comprobanteId}/cobros`,
    );
    if (!esRespuestaDelEndpoint(raw, 'cobros')) return { status: 'no_disponible' };
    const filas = Array.isArray(raw.cobros) ? raw.cobros : [];
    return {
      status: 'ok',
      cobros: filas.map(normalizarCobro).filter((c): c is Cobro => c != null),
      comprobante: normalizarEstado(raw.comprobante),
    };
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return { status: 'no_encontrado' };
    if (esNoDesplegado(err)) return { status: 'no_disponible' };
    if (!(err instanceof ApiError)) return { status: 'no_disponible' };
    throw err;
  }
}

/** Una fila de «me deben». Es una VISTA del backend, no un `Comprobante` completo: trae sólo lo que
 *  esa pantalla necesita, ya servido. */
export interface ComprobanteImpago {
  id: number;
  nro: number | null;
  receptorNombre: string | null;
  fechaEmision: string | null;
  total: string | null;
  cobrado: string | null;
  saldo: string | null;
  estadoCobro: EstadoCobro | null;
  /** Días desde la emisión, calculados por el backend. `null` si no vino — **no 0**: "hoy" y "no sé"
   *  son cosas distintas, y con 0 la fila diría «hace 0 días» sobre una factura de marzo. */
  dias: number | null;
}

interface ImpagoRaw extends ComprobanteCobroRaw {
  nro?: number | null;
  receptor_nombre?: string | null;
  fecha_emision?: string | null;
  dias?: number | null;
}

/**
 * `GET /afip/comprobantes/impagos` — todo lo que le deben, **con el total ya sumado por el backend**.
 *
 * 🔴 **El `total_adeudado` viene servido y NO se recalcula acá.** Sumar del lado del cliente daría un
 * segundo número para la misma pregunta, y el día que difieran —por un redondeo, por una página que
 * no llegó— el emprendedor ve dos verdades y deja de creerle a las dos.
 */
export async function listarImpagos(): Promise<
  ConDisponibilidad<{ comprobantes: ComprobanteImpago[]; totalAdeudado: string | null }>
> {
  try {
    const raw = await apiClient.get<{ comprobantes?: ImpagoRaw[]; total_adeudado?: string | number | null }>(
      '/afip/comprobantes/impagos',
    );
    // Antes que nada: que esto sea la respuesta del endpoint y no el SPA. Ver `esRespuestaDelEndpoint`.
    if (!esRespuestaDelEndpoint(raw, 'comprobantes')) return { status: 'no_disponible' };
    const filas = Array.isArray(raw?.comprobantes) ? raw.comprobantes : [];
    return {
      status: 'ok',
      comprobantes: filas
        .filter((f) => f != null && f.id != null)
        .map((f) => ({
          id: f.id as number,
          nro: typeof f.nro === 'number' ? f.nro : null,
          receptorNombre: typeof f.receptor_nombre === 'string' && f.receptor_nombre.trim() !== ''
            ? f.receptor_nombre.trim()
            : null,
          fechaEmision: f.fecha_emision ?? null,
          total: importe(f.total),
          cobrado: importe(f.cobrado),
          saldo: importe(f.saldo),
          estadoCobro: estadoCobro(f.estado_cobro),
          dias: typeof f.dias === 'number' && Number.isFinite(f.dias) ? f.dias : null,
        })),
      totalAdeudado: importe(raw?.total_adeudado),
    };
  } catch (err) {
    if (esNoDesplegado(err)) return { status: 'no_disponible' };
    // Un 200 con el HTML del SPA explota en `res.json()`, no como `ApiError`: mismo caso de arriba
    // llegando por la otra puerta.
    if (!(err instanceof ApiError)) return { status: 'no_disponible' };
    throw err;
  }
}

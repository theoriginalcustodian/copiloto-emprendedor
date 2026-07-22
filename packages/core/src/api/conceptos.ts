import { apiClient } from './client';
import { ApiError } from './errors';
import type { ConDisponibilidad } from './afip';

/**
 * **`/conceptos` — el catálogo de lo que el emprendedor vende.** Lo que hace que un presupuesto se
 * arme eligiendo *«corte de pelo»* en vez de tipearlo cada vez, y que el precio sugerido salga de algo.
 *
 * Forma declarada por backend en `dato_backend-a-todos_hito3-la-forma-final-de-los-tres-endpoints`
 * §3, y **vivo desde el 2026-07-22** (`avance_backend-a-todos_hito3-los-tres-frentes-VIVOS`).
 * Verificado desde acá por HTTP el 2026-07-22: los cuatro verbos contra `/conceptos` responden `401`
 * (la ruta existe y pide sesión), mientras el control negativo —una ruta inventada— da `405` en POST
 * y `200` con el HTML del SPA en GET. Sin ese control, un `401` no distinguiría "existe" de
 * "cualquier cosa da 401".
 *
 * ⚠️ **No confundir con `catalogo.ts`**, que es el catálogo de *integraciones* de Composio (Gmail,
 * Drive…). Son dos cosas distintas que se llaman igual en castellano; por eso este archivo se llama
 * `conceptos` y no `catalogo`.
 *
 * 🔴 **Borrar es DESACTIVAR.** `DELETE /conceptos/{id}` pone `activo=false` y no borra la fila: un
 * concepto borrado de verdad dejaría presupuestos viejos apuntando a la nada. Reactivar es
 * `editarConcepto(id, { activo: true })` — no hay endpoint aparte.
 *
 * 🔴 **El precio de referencia NO altera presupuestos ya emitidos.** El presupuesto congela su importe
 * al crearse. Cambiar el catálogo cambia lo que se propone la próxima vez, nunca lo que ya se emitió.
 * Es del backend, pero se anota acá porque es la pregunta que se hace cualquiera que edite un precio
 * desde esta pantalla.
 *
 * 🔴 **`ausente` no es `cero`.** Un concepto sin precio de referencia vale `null`, jamás `"0.00"`:
 * *«no le puse precio»* y *«vale cero»* se ven idénticos en pantalla y sólo uno de los dos es cierto.
 */

export interface Concepto {
  id: number;
  nombre: string;
  /**
   * String decimal — **plata, nunca `Number()`**. `null` cuando no se le puso precio, que es un estado
   * normal y distinto de "vale 0".
   */
  precioReferencia: string | null;
  /**
   * Si sigue ofreciéndose.
   *
   * ⚠️ **Acá razoné mal y vale dejarlo escrito.** Deduje que el listado traía los desactivados *porque
   * el campo existe* —si el backend filtrara, sería constante `true` y no lo mandaría—. Suena
   * impecable y es falso: el endpoint filtra por defecto (`incluir_inactivos=False`) y manda el campo
   * igual. La deducción no habría dado ningún error: el ABM habría mostrado sólo los activos, que es
   * exactamente lo que se espera ver, y el concepto desactivado habría quedado **irrecuperable sin
   * que nadie notara nada**. Lo cazó leer el endpoint, no razonar sobre él. Ver `ListarConceptosParams`.
   */
  activo: boolean;
}

interface ConceptoRaw {
  id?: number;
  nombre?: string | null;
  precio_referencia?: string | number | null;
  activo?: boolean | null;
}

/**
 * Un importe del wire como string, o `null`. Gemelo del de `cobros.ts` — mismo criterio, y duplicar
 * seis líneas es preferible a un módulo de utilidades que invite a meterle reglas de negocio.
 */
function importe(v: unknown): string | null {
  if (typeof v === 'string' && v.trim() !== '') return v.trim();
  // Un número sería un contrato roto (la plata viaja como string), pero conservarlo es mejor que
  // tirarlo: `String(2500)` sigue siendo el dato.
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  return null;
}

/**
 * ⚠️ **`activo` ausente cae en `true`, y la dirección del default está elegida, no heredada.**
 *
 * Las dos salidas son mentiras del mismo tamaño, pero no cuestan lo mismo: un concepto **inactivo
 * mostrado como activo** es visible y el emprendedor lo corrige; uno **activo mostrado como inactivo**
 * desaparece de su catálogo sin ningún error, y cuando lo vuelve a crear se choca con un `409` que le
 * dice *«ya existe»* sobre algo que no ve. El fallo silencioso es el caro.
 */
function normalizar(c: ConceptoRaw): Concepto {
  return {
    id: c.id as number,
    nombre: typeof c.nombre === 'string' ? c.nombre : '',
    precioReferencia: importe(c.precio_referencia),
    activo: c.activo !== false,
  };
}

/**
 * "Esta capacidad no está en este deploy". El `404` **no entra**: en `/conceptos/{id}` es semántico
 * ("ese concepto no es tuyo o no existe"), igual que en Clientes.
 */
function noDesplegado(err: unknown): boolean {
  return err instanceof ApiError && (err.status === 405 || err.status === 501 || err.status === 503);
}

/**
 * 🔴 **Un `GET` a una ruta no desplegada devuelve `200` con el HTML del SPA** —el front-door monta un
 * catch-all— así que la ausencia del endpoint no llega como excepción: llega como éxito con un cuerpo
 * que no tiene la clave. Sin este chequeo, «todavía no hay catálogo» y «el catálogo está vacío» serían
 * la misma pantalla.
 */
function esRespuestaDelEndpoint(raw: unknown, clave: string): boolean {
  return typeof raw === 'object' && raw !== null && clave in raw;
}

export interface ListarConceptosParams {
  /**
   * 🔴 **El backend filtra los desactivados POR DEFECTO** (`incluir_inactivos: bool = False`,
   * `presupuestos_web.py`) — verificado leyendo el endpoint, no deducido del `dato_`, que sólo
   * declaraba `GET /conceptos` a secas.
   *
   * Importa: el ABM de Ajustes **tiene** que pedir `true`, porque si no, un concepto desactivado
   * desaparece de la única pantalla desde la que se podría reactivar. Y el armador de presupuestos
   * tiene que dejarlo en `false`, porque ofrecer algo que el emprendedor retiró es peor que no
   * ofrecerlo. Son dos consumidores con necesidades opuestas: por eso es parámetro y no una decisión
   * tomada acá.
   */
  incluirInactivos?: boolean;
}

/**
 * El catálogo. Un emprendedor nuevo tiene `[]`, y `[]` no es un error: es el estado normal del primer
 * día.
 */
export async function listarConceptos(
  params: ListarConceptosParams = {},
): Promise<ConDisponibilidad<{ conceptos: Concepto[] }>> {
  const ruta = params.incluirInactivos === true ? '/conceptos?incluir_inactivos=true' : '/conceptos';
  try {
    const raw = await apiClient.get<{ conceptos?: ConceptoRaw[] }>(ruta);
    if (!esRespuestaDelEndpoint(raw, 'conceptos')) return { status: 'no_disponible' };
    const filas = Array.isArray(raw.conceptos) ? raw.conceptos : [];
    return {
      status: 'ok',
      // Sin `id` no hay a qué editar ni desactivar: la fila se descarta en vez de pintarse como un
      // concepto con id `undefined` que rompería recién al tocarlo.
      conceptos: filas.filter((c) => c != null && typeof c.id === 'number').map(normalizar),
    };
  } catch (err) {
    if (noDesplegado(err)) return { status: 'no_disponible' };
    // Un 200 con HTML explota en `res.json()`, no como `ApiError`.
    if (!(err instanceof ApiError)) return { status: 'no_disponible' };
    throw err;
  }
}

/**
 * Lo que se manda al crear o editar. **Las claves ausentes no viajan**: en el `PATCH` eso es la
 * diferencia entre no tocar un campo y borrarlo.
 */
export interface DatosConcepto {
  nombre?: string;
  /** `null` = "sacale el precio". `undefined` = "no lo toques". No son lo mismo. */
  precioReferencia?: string | null;
  /** Sólo tiene sentido en la edición: reactivar lo que se había desactivado. */
  activo?: boolean;
}

function aWire(datos: DatosConcepto): Record<string, unknown> {
  const wire: Record<string, unknown> = {};
  if (datos.nombre !== undefined) wire.nombre = datos.nombre;
  if (datos.precioReferencia !== undefined) wire.precio_referencia = datos.precioReferencia;
  if (datos.activo !== undefined) wire.activo = datos.activo;
  return wire;
}

/**
 * El concepto de una respuesta, venga envuelto (`{concepto: {...}}`) o pelado.
 *
 * ✅ **VERIFICADO el 2026-07-22 leyendo `presupuestos_web.py`: manda la ENVUELTA.** `POST`, `PATCH` y
 * `DELETE` devuelven `{"concepto": {...}}`. La tolerancia a la pelada se conserva porque cuesta tres
 * líneas y errar acá **no daría error**: el normalizador leería `undefined` y la pantalla mostraría un
 * concepto en blanco con id `NaN`, que se lee como bug del backend.
 */
function conceptoDeLaRespuesta(raw: unknown): Concepto | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const envuelto = (raw as { concepto?: unknown }).concepto;
  const candidato = (
    typeof envuelto === 'object' && envuelto !== null ? envuelto : raw
  ) as ConceptoRaw;
  return typeof candidato.id === 'number' ? normalizar(candidato) : null;
}

/**
 * El `409` de nombre repetido trae **la ficha del que ya está** (mismo patrón que Clientes). `null` si
 * el body no trae nada reconocible: se avisa igual, sin el botón de abrirlo.
 *
 * ✅ **VERIFICADO el 2026-07-22:** viene bajo `detail` — `HTTPException(409, detail={"mensaje": …,
 * "concepto": …})` serializa `{"detail": {…}}`, así que en la raíz no hay nada. El barrido de los dos
 * niveles ya lo cubría; se deja porque es el mismo que salvó al lector de `factura_id`, donde mirar
 * sólo la raíz sí costó un mensaje falso.
 */
function duplicadoDelBody(body: unknown): Concepto | null {
  if (typeof body !== 'object' || body === null) return null;
  const raiz = body as Record<string, unknown>;
  const detalle =
    typeof raiz.detail === 'object' && raiz.detail !== null
      ? (raiz.detail as Record<string, unknown>)
      : {};

  for (const nivel of [raiz, detalle]) {
    const c = nivel.concepto;
    if (typeof c === 'object' && c !== null && typeof (c as ConceptoRaw).id === 'number') {
      return normalizar(c as ConceptoRaw);
    }
  }
  for (const clave of ['concepto_id', 'id']) {
    for (const nivel of [raiz, detalle]) {
      const v = nivel[clave];
      const id = typeof v === 'number' ? v : typeof v === 'string' && /^\d+$/.test(v) ? Number(v) : null;
      if (id != null) return normalizar({ id });
    }
  }
  return null;
}

/**
 * Resultado de guardar. **El `duplicado` no es un error en rojo**: es *«eso ya lo tenés»*, y la
 * pantalla lleva al que existe en vez de pedirle al emprendedor que invente otro nombre.
 */
export type ResultadoGuardarConcepto =
  | { status: 'ok'; concepto: Concepto }
  | { status: 'no_disponible' }
  | { status: 'duplicado'; existente: Concepto | null };

async function guardar(
  peticion: Promise<unknown>,
): Promise<ResultadoGuardarConcepto | { status: 'no_encontrado' }> {
  try {
    const concepto = conceptoDeLaRespuesta(await peticion);
    return concepto != null ? { status: 'ok', concepto } : { status: 'no_disponible' };
  } catch (err) {
    if (err instanceof ApiError && err.status === 409) {
      return { status: 'duplicado', existente: duplicadoDelBody(err.body) };
    }
    if (err instanceof ApiError && err.status === 404) return { status: 'no_encontrado' };
    if (noDesplegado(err)) return { status: 'no_disponible' };
    if (!(err instanceof ApiError)) return { status: 'no_disponible' };
    // 400/422 (nombre vacío, precio inválido) suben: son accionables y el formulario los muestra tal
    // cual los explica el backend, sin traducirlos a un genérico que borra la causa.
    throw err;
  }
}

/** Alta. Sólo `nombre` es obligatorio — el precio de referencia puede no existir todavía. */
export function crearConcepto(datos: DatosConcepto): Promise<ResultadoGuardarConcepto> {
  // El alta no puede dar `no_encontrado`: no hay id en la ruta.
  return guardar(apiClient.post<unknown>('/conceptos', aWire(datos))) as Promise<ResultadoGuardarConcepto>;
}

/**
 * Edición **parcial**: pasar sólo lo que cambió. Mandar el objeto entero con los campos vacíos
 * borraría lo que había.
 *
 * Reactivar un concepto desactivado es `editarConcepto(id, { activo: true })`.
 */
export function editarConcepto(
  id: number,
  cambios: DatosConcepto,
): Promise<ResultadoGuardarConcepto | { status: 'no_encontrado' }> {
  return guardar(apiClient.patch<unknown>(`/conceptos/${id}`, aWire(cambios)));
}

/**
 * `DELETE /conceptos/{id}` — **desactiva**, no borra. El nombre de esta función lo dice para que nadie
 * la llame creyendo que limpia el catálogo.
 *
 * ⚠️ El backend no declaró qué devuelve. Si trae el concepto actualizado, se usa; si no, `concepto`
 * queda `null` y **la pantalla tiene que recargar la lista** en vez de asumir que quedó inactivo. Dar
 * por hecho el efecto sin verlo es cómo se pinta un estado que nunca ocurrió.
 */
export async function desactivarConcepto(
  id: number,
): Promise<
  | { status: 'ok'; concepto: Concepto | null }
  | { status: 'no_disponible' }
  | { status: 'no_encontrado' }
> {
  try {
    const raw = await apiClient.del<unknown>(`/conceptos/${id}`);
    return { status: 'ok', concepto: conceptoDeLaRespuesta(raw) };
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return { status: 'no_encontrado' };
    if (noDesplegado(err)) return { status: 'no_disponible' };
    throw err;
  }
}

/**
 * Qué cambió entre el concepto que se edita y lo que quedó en el formulario. Devuelve `{}` si no
 * cambió nada — y ese caso conviene mirarlo **antes** de mandar el request: guardar sin tocar nada no
 * debería salir a la red.
 */
export function cambiosDeConcepto(original: Concepto, editado: DatosConcepto): DatosConcepto {
  const cambios: DatosConcepto = {};
  if (editado.nombre !== undefined && editado.nombre !== original.nombre) cambios.nombre = editado.nombre;
  if (editado.precioReferencia !== undefined && editado.precioReferencia !== original.precioReferencia) {
    cambios.precioReferencia = editado.precioReferencia;
  }
  if (editado.activo !== undefined && editado.activo !== original.activo) cambios.activo = editado.activo;
  return cambios;
}

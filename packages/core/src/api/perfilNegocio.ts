import { apiClient } from './client';
import { ApiError, codigoDeConflicto, mensajeDeConflicto } from './errors';
import type { ConDisponibilidad } from './afip';

/**
 * `/perfil-negocio` — qué vende el emprendedor, a quién, y cómo quiere que le hable el copiloto.
 *
 * Contrato: `coordinacion/abierto/2026-07-21_contrato_backend-perfil-negocio-y-presupuestos.md` §1,
 * con las correcciones del `addendum_backend-control-corregido-y-los-huecos-cerrados.md`.
 *
 * 🔴 **`perfil: null` NO es un error, y es el caso más común el primer día.** Todo tenant nuevo
 * arranca así. Quien consuma esto pinta el formulario vacío — nunca un cartel de error ni un
 * reintento. Por eso el resultado distingue tres cosas y no dos: `ok` con perfil, `ok` sin perfil
 * (`perfil: null`), y `no_disponible`. Colapsar los dos primeros obligaría a la pantalla a adivinar.
 *
 * 🔴 **`cliente_id` sale del JWT.** Ningún parámetro de acá lo acepta ni lo manda; el backend ignora
 * el que le manden por query o body. No hay forma de leer ni escribir el perfil de otro tenant.
 *
 * 🔴 **Acá NO se piden CUIT, razón social, domicilio ni condición IVA.** Ya viven en el perfil fiscal
 * (`afip.ts` → `leerPerfil`). Pedirlos otra vez sería una segunda copia del mismo dato, y las dos
 * copias divergen solas.
 */

/** A quién le vende el emprendedor. Cerrada: el backend valida contra exactamente estos tres. */
export type AQuienVende = 'empresas' | 'consumidor_final' | 'ambos';

/** Tono con el que responde el copiloto. */
export type FormalidadCopiloto = 'formal' | 'cercano';

/** Cuánto se extiende el copiloto al responder. */
export type LargoRespuesta = 'breve' | 'detallado';

/**
 * El perfil del negocio, plano a propósito (el contrato lo define así: menos lugares donde
 * equivocarse). El agrupamiento visual en "Negocio" y "Personalidad" lo hace la pantalla; la API no
 * necesita saberlo.
 *
 * **Todos los campos de texto pueden venir `''`.** Un perfil a medio llenar es válido y esperado.
 */
export interface PerfilNegocio {
  queVende: string;
  aQuien: AQuienVende;
  nombreComercial: string;
  horarioAtencion: string;
  formalidad: FormalidadCopiloto;
  largoRespuesta: LargoRespuesta;
  nombreCopiloto: string;
  /**
   * 🔴 **Cuánta ceremonia pide el copiloto antes de guardar** — contrato de modos §3.
   *
   * Vive en el perfil del NEGOCIO y no en el teléfono a propósito: si viviera acá, cambiar de aparato
   * resetearía el modo y —peor— la app podría mandar el modo permisivo por su cuenta. **El backend
   * decide y el backend impone; esto sólo refleja.**
   *
   * ⚠️ **Fail-closed, igual que el backend:** cualquier cosa que no sea exactamente `automatico` se
   * lee como `confirmacion`. Un valor desconocido, un campo ausente o un typo caen en el modo que
   * pregunta — nunca en el que actúa solo. Un default permisivo por un error de lectura es la clase
   * de bug que se descubre por un registro que nadie autorizó.
   */
  modoCeremonia: ModoCeremonia;
  /** ISO-8601 UTC. `''` si el backend no lo mandó (perfil recién creado por un deploy viejo). */
  actualizadoEn: string;
}

/**
 * `confirmacion` = el copiloto muestra la card y espera. `automatico` = guarda y avisa.
 *
 * ⚠️ **Hay un PISO que el modo no puede apagar** (contrato §2): todo lo que sale del teléfono —tocar a
 * un tercero, al fisco, o mover plata de verdad— confirma **siempre**, en los dos modos. Por eso la
 * etiqueta es «Automático» y no «hace todo solo»: una etiqueta que promete no preguntar se siente rota
 * la primera vez que pregunta.
 */
export type ModoCeremonia = 'confirmacion' | 'automatico';

interface PerfilCrudo {
  modo_ceremonia?: string;
  que_vende?: string;
  a_quien?: string;
  nombre_comercial?: string;
  horario_atencion?: string;
  formalidad?: string;
  largo_respuesta?: string;
  nombre_copiloto?: string;
  actualizado_en?: string;
}

/**
 * Valor por defecto de un enum cuyo valor recibido no reconocemos.
 *
 * 🔴 **Un enum desconocido NO puede romper la pantalla ni quedar como string crudo.** Si el backend
 * suma mañana un cuarto valor a `a_quien`, esta app —desplegada, vieja— tiene que seguir mostrando
 * algo coherente en vez de un `<Text>` con un identificador interno o un select sin opción marcada.
 * Cae al default declarado, igual que `copyPaso` en `PantallaAfipSetup`.
 */
function enumODefault<T extends string>(valor: unknown, validos: readonly T[], porDefecto: T): T {
  return typeof valor === 'string' && (validos as readonly string[]).includes(valor) ? (valor as T) : porDefecto;
}

const A_QUIEN_VALIDOS: readonly AQuienVende[] = ['empresas', 'consumidor_final', 'ambos'];
const FORMALIDAD_VALIDOS: readonly FormalidadCopiloto[] = ['formal', 'cercano'];
const LARGO_VALIDOS: readonly LargoRespuesta[] = ['breve', 'detallado'];

function normalizar(p: PerfilCrudo): PerfilNegocio {
  return {
    queVende: p.que_vende ?? '',
    aQuien: enumODefault(p.a_quien, A_QUIEN_VALIDOS, 'ambos'),
    nombreComercial: p.nombre_comercial ?? '',
    horarioAtencion: p.horario_atencion ?? '',
    formalidad: enumODefault(p.formalidad, FORMALIDAD_VALIDOS, 'cercano'),
    largoRespuesta: enumODefault(p.largo_respuesta, LARGO_VALIDOS, 'breve'),
    nombreCopiloto: p.nombre_copiloto ?? '',
    // 🔴 Fail-closed, y NO con `enumODefault`: acá el default no es "el más común" sino "el que no
    // actúa solo". Que sea la misma línea que el backend (`modo_de`) es a propósito — si las dos
    // capas leyeran distinto, el emprendedor vería «Automático» mientras el backend le sigue pidiendo
    // confirmación: los dos correctos por separado, y el producto mintiendo.
    modoCeremonia: p.modo_ceremonia === 'automatico' ? 'automatico' : 'confirmacion',
    actualizadoEn: p.actualizado_en ?? '',
  };
}

/**
 * "Esta capacidad no está en este deploy".
 *
 * 🔴 **El 404 NO entra acá, y esto es lo contrario de lo que hace `catalogo.ts`.** El backend declaró
 * los códigos endpoint por endpoint (regla de `COORDINACION.md` §3.bis): en `/perfil-negocio` y
 * `/presupuestos` el 404 es **semántico** — "ese recurso no existe para ESTE tenant" — así que
 * tratarlo como "no desplegado" le diría al usuario "todavía no está disponible" sobre un endpoint
 * vivo que le está contestando bien.
 *
 * 🔴 **El 405 sí, y es el único síntoma confiable.** El front-door monta un catch-all
 * `@app.get("/{full_path}")` para servir el SPA (`apps/copiloto/web.py:141`), así que una ruta no
 * desplegada matchea ese handler y FastAPI contesta `405 Method Not Allowed` a todo verbo que no sea
 * GET. **Para GET no hay 405: contesta 200 con el HTML del SPA** — de eso se ocupa `formaInesperada`.
 */
function noDesplegado(err: unknown): boolean {
  return err instanceof ApiError && (err.status === 405 || err.status === 501);
}

/**
 * 🔴 **El control que el propio backend propuso primero era inservible, y esta función es el
 * reemplazo del lado del cliente.**
 *
 * Un `GET` a una ruta no desplegada **no da 404 ni 405: da `200` con `<!doctype html>`** (medido
 * contra el servicio vivo el 2026-07-21 sobre las tres rutas del contrato). O sea que el status por
 * sí solo diría "desplegado y todo bien" sobre una ruta que no existe — el instrumento que confirma
 * en vez de verificar. Del lado del cliente el síntoma sería una excepción de parseo de JSON, que no
 * se parece en nada a "todavía no disponible" y mandaría a buscar el bug en la app.
 *
 * Por eso la respuesta se valida por su **forma**, no por su status: si el 200 no trae la clave que
 * el contrato promete, no es este endpoint el que contestó.
 *
 * ⚠️ **Lo que esto NO distingue, dicho de frente:** un backend desplegado pero roto (200 con JSON de
 * otra forma) cae en la misma rama que uno no desplegado. Es aceptable porque la consecuencia para el
 * usuario es idéntica —no hay dato con el que trabajar— y de las dos lecturas posibles, "todavía no
 * está disponible" es la que **no** lo invita a reintentar algo que no puede funcionar.
 */
function esRespuestaDelEndpoint(raw: unknown, clave: string): boolean {
  return typeof raw === 'object' && raw !== null && clave in raw;
}

/** Lo que devuelve `leerPerfilNegocio`: el perfil, o `null` si el tenant nunca configuró nada. */
export type ResultadoPerfilNegocio = ConDisponibilidad<{ perfil: PerfilNegocio | null }>;

/**
 * El perfil del negocio de ESTE tenant.
 *
 * `{ status: 'ok', perfil: null }` = el tenant nunca configuró nada. **No es un error**: pintá el
 * formulario vacío.
 */
export async function leerPerfilNegocio(): Promise<ResultadoPerfilNegocio> {
  try {
    const raw = await apiClient.get<{ perfil: PerfilCrudo | null }>('/perfil-negocio');
    if (!esRespuestaDelEndpoint(raw, 'perfil')) return { status: 'no_disponible' };
    return { status: 'ok', perfil: raw.perfil ? normalizar(raw.perfil) : null };
  } catch (err) {
    if (noDesplegado(err)) return { status: 'no_disponible' };
    // Una respuesta 200 que no es JSON (el catch-all sirviendo el HTML del SPA) explota en
    // `res.json()`, no en `mapearError`: llega acá como error de parseo, no como `ApiError`.
    if (!(err instanceof ApiError)) return { status: 'no_disponible' };
    throw err;
  }
}

/**
 * Los campos que se pueden guardar. **Todos opcionales, pero al menos uno** — un body `{}` es 400.
 *
 * 🔴 **La actualización es PARCIAL: las claves ausentes no se tocan.** Es lo que permite que la
 * sección "Negocio" y la sección "Personalidad" se guarden por separado sin pisarse. Para **vaciar**
 * un campo hay que mandarlo explícitamente como `''` — omitirlo lo deja como estaba.
 */
export interface GuardarPerfilNegocioRequest {
  queVende?: string;
  aQuien?: AQuienVende;
  nombreComercial?: string;
  horarioAtencion?: string;
  formalidad?: FormalidadCopiloto;
  largoRespuesta?: LargoRespuesta;
  nombreCopiloto?: string;
  /**
   * ⚠️ **Mandar `automatico` hoy devuelve `409` y NO guarda** — está en pausa hasta que se corrija el
   * motor (el copiloto puede narrar acciones que no ejecutó, y sin card eso no se ve). El resultado lo
   * dice con el motivo del backend; **no lo escondas del lado de la app**: si sólo estuviera gris en
   * la UI, un `POST` alcanzaría para ponerse en el modo peligroso.
   */
  modoCeremonia?: ModoCeremonia;
}

/**
 * Serializa a snake_case **omitiendo las claves ausentes**, que es lo que hace parcial a la
 * actualización. Un `undefined` explícito viajaría como clave presente en el JSON de algunos
 * serializadores y el backend lo leería como "vaciá este campo" — exactamente lo contrario.
 */
function aBodyCrudo(req: GuardarPerfilNegocioRequest): Record<string, string> {
  const body: Record<string, string> = {};
  if (req.queVende !== undefined) body.que_vende = req.queVende;
  if (req.aQuien !== undefined) body.a_quien = req.aQuien;
  if (req.nombreComercial !== undefined) body.nombre_comercial = req.nombreComercial;
  if (req.horarioAtencion !== undefined) body.horario_atencion = req.horarioAtencion;
  if (req.formalidad !== undefined) body.formalidad = req.formalidad;
  if (req.largoRespuesta !== undefined) body.largo_respuesta = req.largoRespuesta;
  if (req.nombreCopiloto !== undefined) body.nombre_copiloto = req.nombreCopiloto;
  if (req.modoCeremonia !== undefined) body.modo_ceremonia = req.modoCeremonia;
  return body;
}

/** Cuántos caracteres acepta el backend en cada campo. Se validan acá **además** de en el backend
 *  para poder señalar el campo exacto antes del viaje — no para reemplazar esa validación. */
export const LIMITE_QUE_VENDE = 500;
export const LIMITE_CAMPO_CORTO = 120;

/**
 * Guarda una parte del perfil. Devuelve el perfil **completo** ya actualizado — no hace falta
 * re-hacer el GET.
 *
 * Lanza `ApiError` con status 400 si el body no valida (enum inválido, campo demasiado largo, body
 * vacío). El `detail` del backend viene en `.mensaje`.
 */
export type ResultadoGuardarPerfil =
  | ConDisponibilidad<{ perfil: PerfilNegocio }>
  /**
   * 🔴 **El modo pedido está en PAUSA.** No es un error de la app ni algo que reintentar: es una deuda
   * gestionada del backend, con dueño y condición de pago. Trae `mensaje` —el texto que el emprendedor
   * puede leer— y `modoVigente`, el que quedó.
   *
   * **Se pinta el `mensaje` que viene, nunca uno inventado acá:** el día que se levante la pausa, el
   * texto cambia solo. Un copy propio seguiría diciendo «está en pausa» después de habilitado.
   */
  | { status: 'modo_no_disponible'; mensaje: string; modoVigente: ModoCeremonia };

/**
 * Guarda una parte del perfil. Devuelve el perfil **completo** ya actualizado — no hace falta
 * re-hacer el GET.
 */
export async function guardarPerfilNegocio(
  req: GuardarPerfilNegocioRequest,
): Promise<ResultadoGuardarPerfil> {
  const body = aBodyCrudo(req);
  try {
    const raw = await apiClient.post<{ perfil: PerfilCrudo }>('/perfil-negocio', body);
    if (!esRespuestaDelEndpoint(raw, 'perfil')) return { status: 'no_disponible' };
    return { status: 'ok', perfil: normalizar(raw.perfil) };
  } catch (err) {
    if (
      err instanceof ApiError &&
      err.status === 409 &&
      codigoDeConflicto(err.body) === 'modo_automatico_no_disponible'
    ) {
      const vigente = (err.body as { detail?: { modo_vigente?: unknown } })?.detail?.modo_vigente;
      return {
        status: 'modo_no_disponible',
        mensaje: mensajeDeConflicto(err.body) ?? 'Ese modo no está disponible por ahora.',
        // Fail-closed también acá: si el backend no dijo cuál quedó, se asume el que pregunta.
        modoVigente: vigente === 'automatico' ? 'automatico' : 'confirmacion',
      };
    }
    if (noDesplegado(err)) return { status: 'no_disponible' };
    // 400 (enum inválido, campo largo, body vacío) SUBE: es accionable y el formulario lo muestra.
    throw err;
  }
}

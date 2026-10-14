import { apiClient } from './client';
import { ApiError, mensajeDeConflicto } from './errors';
import type { ConDisponibilidad } from './afip';

/**
 * **`/mi-dia/*` — el tablero del detector proactivo (hito 7): 3 solapas, pobladas por las reglas
 * determinísticas del `contrato_mi-dia-y-el-detector-proactivo`, más las 3 mutaciones manuales.**
 *
 * 🔴 **Reemplaza al cliente viejo (`IDS_COLUMNA`, pipeline de 4 etapas), retirado el 2026-07-23 por
 * arbitraje de planificación** (`respuesta_..._mi-dia-es-el-detector-3-solapas...`): el pipeline de
 * facturación (presupuesto→facturado→por cobrar→cobrado) NO es Mi Día — son conceptos distintos, y
 * si algún día se quiere esa vista baja como su propio contrato en su propia URL. Esta URL es del
 * detector, punto.
 *
 * 🔴 **Forma CONFIRMADA por backend** (`respuesta_backend-a-frontend_forma-final...`, PR#96) — ya no
 * es una forma razonada. `id` de solapa es **`hecha` (singular)**, no `hechas` — el título sí es
 * plural. Cada tarjeta trae `{id, regla, entidad_tipo, entidad_id, texto, estado, datos, creada_en,
 * movida_en}`; `texto` es el mensaje YA REDACTADO (paso REDACTAR del contrato §1). `[CONNECT]`
 * todavía: backend mergea PR#96 con CI corriendo — degrada a `no_disponible` hasta el connect real.
 *
 * 🔴 **`id` de solapa se normaliza contra un conjunto CERRADO.** Una solapa con un `id` que no
 * reconozco no puede mostrarse mezclada con las tres conocidas — se descarta entera.
 *
 * 🔴 **Una tarjeta sin `texto` no es una tarjeta.** El mensaje redactado es el contenido — una card
 * con id pero sin frase no tiene qué mostrarle al emprendedor. Se descarta, no se pinta en blanco.
 *
 * 🔴 **`datos` es un objeto sin forma cerrada** (varía por regla — contrato §1: cada regla "trae" sus
 * propios campos). Sólo se lee de ahí lo que ya se sabe mostrar (`cliente`, si viene con ese nombre); lo
 * que no se reconoce no se inventa ni se descarta la tarjeta entera por eso. **`monto`/`fecha` NO se leen
 * de `datos`**: ninguna regla los escribe (H12/DETALLEKV) — el importe y la fecha de la tarjeta viajan ya
 * formateados en `presentacion` (`prosa` + `kv`), y la app no arma esa tabla regla→campo.
 *
 * 🔴 **`estado` no tiene un conjunto cerrado declarado por el contrato** (a diferencia del viejo
 * `EstadoTarjeta` del pipeline) — se transporta como el string que venga, sin inventar un enum que
 * backend no fijó. La UI lo usa sólo para saber en qué solapa está, no para pintar colores por él.
 *
 * 🔴 **`ausente ≠ cero`.** Un dato que no vino vale `null`, jamás `0` ni `''`.
 */

function texto(v: unknown): string | null {
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : null;
}

/** Las 3 solapas del tablero, en orden fijo (contrato §2.3). Conjunto cerrado: el backend manda estos
 *  ids — `hecha` en singular, confirmado PR#96. */
export const IDS_SOLAPA = ['para_hoy', 'haciendo', 'hecha'] as const;
export type IdSolapa = (typeof IDS_SOLAPA)[number];

export interface TarjetaMiDia {
  id: string;
  /** La frase ya redactada por el paso REDACTAR (contrato §1) — el contenido real de la tarjeta. */
  texto: string;
  /** Qué regla la disparó — `null` en las tarjetas manuales (confirmado backend). Para debug/
   *  telemetría, NUNCA para pintar la card distinto por regla: el texto ya trae el tono. */
  regla: string | null;
  entidadTipo: string | null;
  entidadId: string | null;
  /** El estado crudo que manda backend — sin enum propio, ver docstring del módulo. */
  estado: string | null;
  /** `datos.cliente`. Se mantiene como fila mientras `texto` no nombre la entidad (contrato H12 §5). */
  cliente: string | null;
  /** BL-J5: `cobros|arca|presupuestos|tuyas`, o `null` (trabajo/gasto: sólo en «Todo», o backend previo). */
  categoria: string | null;
  /** BL-J5: `critico|pronto|sin_plazo`. `null` sólo con un backend previo al campo — nunca se infiere. */
  criticidad: string | null;
  /** BL-J5: la acción resolutoria de la regla («Renovarlo»…), o `null` si no tiene. */
  verbo: string | null;
  /**
   * H5b — a dónde lleva la acción de la tarjeta, **semántica, no una pantalla**: el backend emite el tipo
   * y la app es dueña del ruteo (contrato `H5B-destino-en-la-tarjeta-critica`, opción B). `null`/ausente =
   * la tarjeta no trae destino (backend previo, o una regla que no lo emite): la app cae a Ajustes.
   */
  destino?: DestinoTarjeta | null;
  /**
   * PROTO4DEPS §C — cómo se PINTA el detalle (chip de antigüedad, filas clave/valor y la acción), derivado
   * por el backend de la regla en un solo lugar. `null`/ausente = backend previo, o una regla que no la
   * emite: la tarjeta se pinta como siempre. La app NO arma una tabla regla→pantalla para suplirla.
   */
  presentacion?: PresentacionTarjeta | null;
}

export interface PresentacionTarjeta {
  /**
   * H12 §2 — la línea explicativa de la tarjeta («Venció hace 22 días. Son $120.000 que ya facturaste…»).
   * 🔴 En la factura impaga **el importe vive acá y no en ninguna `kv`**: pintar `kv` sin `prosa` borra el
   * importe de la pantalla. Por eso `prosa` y `kv` se leen y se pintan juntas.
   */
  prosa: string | null;
  /** `tono` crudo: `critico|pronto|sin_plazo` (la escala de `criticidad`); uno desconocido NO se descarta. */
  chip: { texto: string; tono: string | null } | null;
  /** El rótulo lo decide la regla («Enviado», «Vence»), no el campo: por eso `k` viaja con el dato.
   *  Ya formateado por el backend (`$180.000`, `18 de julio`): la app lo pinta tal cual. */
  kv: { k: string; v: string }[];
  /** `destino` con el MISMO shape que `datos.destino`: quien rutea es la app (`rutaDeDestino`). */
  accion: { texto: string; destino: DestinoTarjeta | null } | null;
}

/**
 * Los valores de `destino.tipo` que este contrato define. Enum **cerrado**: agregar uno exige enmendar el
 * contrato. El normalizador NO filtra por él —un tipo nuevo del backend llega como string y el que
 * decide qué hacer es quien rutea— porque descartarlo acá escondería que apareció algo desconocido.
 */
export const TIPOS_DESTINO = ['conexion', 'comprobante', 'presupuesto', 'trabajo', 'certificado'] as const;
export type TipoDestino = (typeof TIPOS_DESTINO)[number];

export interface DestinoTarjeta {
  /** Crudo del backend: puede no estar en `TIPOS_DESTINO` (app instalada más vieja que el backend). */
  tipo: string;
  /** El servicio al que apunta (`conexion` → mismo valor que `entidad_id`). */
  id: string | null;
  /** Verbatim del catálogo — **nunca** se arma desde la `key` (`catalogo.test.ts`: MercadoPago ≠ Composio). */
  connectPath: string | null;
}

/** `datos.destino` → `DestinoTarjeta`, o `null` si no es un objeto con `tipo` string no vacío. */
function destinoDe(v: unknown): DestinoTarjeta | null {
  if (typeof v !== 'object' || v === null) return null;
  const r = v as Record<string, unknown>;
  const tipo = texto(r.tipo);
  if (tipo == null) return null;
  return { tipo, id: texto(r.id), connectPath: texto(r.connect_path) };
}

/**
 * `presentacion` → `PresentacionTarjeta`, o `null` si no hay nada pintable. Cada pieza es opcional e
 * independiente: una `kv` rota no se lleva puesto el chip. `accion` sin `texto` no existe (una píldora sin
 * rótulo no dice qué hace).
 */
function presentacionDe(v: unknown): PresentacionTarjeta | null {
  if (typeof v !== 'object' || v === null) return null;
  const r = v as Record<string, unknown>;

  const chipRaw = typeof r.chip === 'object' && r.chip !== null ? (r.chip as Record<string, unknown>) : null;
  const chipTexto = chipRaw != null ? texto(chipRaw.texto) : null;
  const chip = chipTexto != null ? { texto: chipTexto, tono: texto(chipRaw?.tono) } : null;

  const kv: { k: string; v: string }[] = [];
  if (Array.isArray(r.kv)) {
    for (const par of r.kv) {
      if (typeof par !== 'object' || par === null) continue;
      const k = texto((par as Record<string, unknown>).k);
      const val = texto((par as Record<string, unknown>).v);
      if (k != null && val != null) kv.push({ k, v: val });
    }
  }

  const accionRaw = typeof r.accion === 'object' && r.accion !== null ? (r.accion as Record<string, unknown>) : null;
  const accionTexto = accionRaw != null ? texto(accionRaw.texto) : null;
  const accion = accionTexto != null ? { texto: accionTexto, destino: destinoDe(accionRaw?.destino) } : null;

  const prosa = texto(r.prosa);

  if (prosa == null && chip == null && kv.length === 0 && accion == null) return null;
  return { prosa, chip, kv, accion };
}

export interface SolapaMiDia {
  id: IdSolapa;
  titulo: string;
  tarjetas: readonly TarjetaMiDia[];
}

export interface TableroMiDia {
  solapas: readonly SolapaMiDia[];
}

interface TableroRaw {
  solapas?: unknown;
}

function esRespuestaDelEndpoint(raw: unknown): boolean {
  return typeof raw === 'object' && raw !== null && 'solapas' in raw;
}

function tarjeta(v: unknown): TarjetaMiDia | null {
  if (typeof v !== 'object' || v === null) return null;
  const r = v as Record<string, unknown>;
  if (typeof r.id !== 'string' || r.id.trim() === '') return null;
  const txt = texto(r.texto);
  if (txt == null) return null;
  const datos = typeof r.datos === 'object' && r.datos !== null ? (r.datos as Record<string, unknown>) : {};
  return {
    id: r.id,
    texto: txt,
    regla: texto(r.regla),
    entidadTipo: texto(r.entidad_tipo),
    entidadId: texto(r.entidad_id),
    estado: texto(r.estado),
    cliente: texto(datos.cliente),
    categoria: texto(r.categoria),
    criticidad: texto(r.criticidad),
    verbo: texto(r.verbo),
    destino: destinoDe(datos.destino),
    // D2 (contrato 2026-10-13): `presentacion` cuelga de la TARJETA, hermana de `datos`. El `?? datos.presentacion`
    // es sólo tolerancia con un emisor viejo, NO una alternativa válida: `datos` no tiene forma cerrada y un
    // campo de contrato dentro de esa bolsa hereda el modo de falla de H12 (leído y nunca escrito).
    presentacion: presentacionDe(r.presentacion ?? datos.presentacion),
  };
}

function solapa(v: unknown): SolapaMiDia | null {
  if (typeof v !== 'object' || v === null) return null;
  const r = v as { id?: unknown; titulo?: unknown; tarjetas?: unknown };
  if (typeof r.id !== 'string' || !(IDS_SOLAPA as readonly string[]).includes(r.id)) return null;
  const tarjetas = Array.isArray(r.tarjetas) ? r.tarjetas : [];
  return {
    id: r.id as IdSolapa,
    titulo: typeof r.titulo === 'string' && r.titulo.trim() !== '' ? r.titulo : r.id,
    tarjetas: tarjetas.map(tarjeta).filter((t): t is TarjetaMiDia => t !== null),
  };
}

export async function leerTablero(): Promise<ConDisponibilidad<{ tablero: TableroMiDia }>> {
  try {
    const raw = await apiClient.get<TableroRaw>('/mi-dia/tablero');
    if (!esRespuestaDelEndpoint(raw)) return { status: 'no_disponible' };
    const solapasRaw = Array.isArray(raw.solapas) ? raw.solapas : [];
    return {
      status: 'ok',
      tablero: { solapas: solapasRaw.map(solapa).filter((s): s is SolapaMiDia => s !== null) },
    };
  } catch {
    return { status: 'no_disponible' };
  }
}

// `POST /mi-dia/tarjetas` es endpoint de COLECCIÓN: un 404 ahí es "la ruta no existe" (no hay id en
// la URL que pueda faltar), mismo criterio que un GET de colección.
function noDesplegadoColeccion(err: unknown): boolean {
  return err instanceof ApiError && (err.status === 404 || err.status === 405 || err.status === 501);
}

// `PATCH`/`DELETE .../{id}/...` son de ENTIDAD: acá el 404 es semántico ("esa tarjeta no existe"), no
// "ruta no desplegada" — por eso NO entra en este chequeo, a diferencia del de colección de arriba.
function noDesplegadoEntidad(err: unknown): boolean {
  return err instanceof ApiError && (err.status === 405 || err.status === 501 || err.status === 503);
}

/**
 * `POST /mi-dia/tarjetas` — alta manual (contrato §2.4: crear a mano o por voz).
 *
 * 🔴 El 400 es un ESTADO, no una excepción. El endpoint rechaza el texto vacío
 * (`mi_dia_web.py:204`) y esta función lo relanzaba: la pantalla reventaba en el caso más fácil de
 * todos — el emprendedor toca «Agregar» con el campo en blanco. Mismo criterio que
 * `cambiarEstadoTarjetaMiDia`, que ya convierte su 400 en estado con el `detail` del backend: el
 * motivo que explica el servidor es la única fuente que le sirve al emprendedor, no se reescribe.
 *
 * Y el `trim()` de la UI NO reemplaza esto: sólo cubre lo que la UI sabe. Un texto que para el
 * backend es vacío y para la UI no (otro criterio de blancos) sigue llegando como 400.
 */
export async function crearTarjetaMiDia(
  texto: string,
): Promise<
  | { status: 'ok'; tarjeta: TarjetaMiDia }
  | { status: 'no_disponible' }
  | { status: 'texto_vacio'; motivo: string }
> {
  try {
    const raw = await apiClient.post<{ tarjeta?: unknown }>('/mi-dia/tarjetas', { texto });
    const t = tarjeta(raw?.tarjeta);
    if (t == null) return { status: 'no_disponible' };
    return { status: 'ok', tarjeta: t };
  } catch (err) {
    if (noDesplegadoColeccion(err)) return { status: 'no_disponible' };
    if (err instanceof ApiError && err.status === 400) {
      return { status: 'texto_vacio', motivo: err.detail ?? 'Escribí qué tenés que hacer.' };
    }
    throw err;
  }
}

/**
 * `PATCH /mi-dia/tarjetas/{id}/estado` — el swipe/toque largo del Kanban (contrato §2.3) y el "cambiar
 * su estado" por voz (§2.4). `estado_invalido` trae el motivo que el backend explica en el 400 — no se
 * reescribe con un mensaje genérico, es la única fuente que le sirve al emprendedor.
 */
export async function cambiarEstadoTarjetaMiDia(
  id: string,
  estado: string,
): Promise<
  | { status: 'ok'; tarjeta: TarjetaMiDia }
  | { status: 'no_disponible' }
  | { status: 'no_encontrado' }
  | { status: 'estado_invalido'; motivo: string }
> {
  try {
    const raw = await apiClient.patch<{ tarjeta?: unknown }>(`/mi-dia/tarjetas/${encodeURIComponent(id)}/estado`, {
      estado,
    });
    const t = tarjeta(raw?.tarjeta);
    if (t == null) return { status: 'no_disponible' };
    return { status: 'ok', tarjeta: t };
  } catch (err) {
    if (noDesplegadoEntidad(err)) return { status: 'no_disponible' };
    if (err instanceof ApiError && err.status === 404) return { status: 'no_encontrado' };
    if (err instanceof ApiError && err.status === 400) {
      return { status: 'estado_invalido', motivo: err.detail ?? mensajeDeConflicto(err.body) ?? 'Ese estado no es válido.' };
    }
    throw err;
  }
}

/** `DELETE /mi-dia/tarjetas/{id}` — borrar/descartar (contrato §2.4). */
export async function borrarTarjetaMiDia(
  id: string,
): Promise<{ status: 'ok' } | { status: 'no_disponible' } | { status: 'no_encontrado' }> {
  try {
    await apiClient.del<unknown>(`/mi-dia/tarjetas/${encodeURIComponent(id)}`);
    return { status: 'ok' };
  } catch (err) {
    if (noDesplegadoEntidad(err)) return { status: 'no_disponible' };
    if (err instanceof ApiError && err.status === 404) return { status: 'no_encontrado' };
    throw err;
  }
}

/**
 * `GET /mi-dia/calendario` (contrato CAL1) — eventos de HOY de Google Calendar, sólo lectura, panel
 * aparte del Kanban (decisión de arquitectura ya cerrada: nunca se importan como tarjetas). Con
 * gracia si el toolkit no está conectado: `conectado: false` no es un error, es un estado a mostrar
 * ("conectá tu Calendar"). Ver `mi_dia_web.py` para el detalle del lado backend.
 *
 * 🔴 **`inicio` es `[ASSUMED_PENDING_VERIFY]`** (docstring de `mi_dia_web.py`): backend pasa crudo lo
 * que devuelve Composio en `start`, sin shape confirmado contra datos reales (bloqueado por el OAuth
 * del tenant canónico). Por eso NO se parsea acá — se transporta como `inicioCrudo: unknown` y
 * `horaDeEvento` (abajo) sólo intenta mostrarlo si reconoce una de las 2 formas públicas y documentadas
 * de la API de Calendar (string ISO, o `{dateTime}`/`{date}`); cualquier otra forma se omite en vez de
 * inventarse un parseo. Corregir acá el día que el spike se re-corra con conexión real.
 */
export interface EventoCalendario {
  id: string;
  titulo: string;
  inicioCrudo: unknown;
}

export interface CalendarioMiDia {
  conectado: boolean;
  eventos: readonly EventoCalendario[];
}

interface CalendarioRaw {
  conectado?: unknown;
  eventos?: unknown;
}

function eventoCalendario(v: unknown): EventoCalendario | null {
  if (typeof v !== 'object' || v === null) return null;
  const r = v as Record<string, unknown>;
  if (typeof r.id !== 'string' || r.id.trim() === '') return null;
  const tit = texto(r.titulo);
  if (tit == null) return null;
  return { id: r.id, titulo: tit, inicioCrudo: r.inicio ?? null };
}

export async function leerCalendario(): Promise<ConDisponibilidad<{ calendario: CalendarioMiDia }>> {
  try {
    const raw = await apiClient.get<CalendarioRaw>('/mi-dia/calendario');
    if (typeof raw !== 'object' || raw === null) return { status: 'no_disponible' };
    const eventosRaw = Array.isArray(raw.eventos) ? raw.eventos : [];
    return {
      status: 'ok',
      calendario: {
        conectado: raw.conectado === true,
        eventos: eventosRaw.map(eventoCalendario).filter((e): e is EventoCalendario => e !== null),
      },
    };
  } catch {
    return { status: 'no_disponible' };
  }
}

/** Ver el docstring de `EventoCalendario` arriba — sólo reconoce las 2 formas públicas de la API de
 *  Google Calendar; `null` si no puede mostrar una hora con certeza (evento de día completo incluido:
 *  `{date}` sin `dateTime` es "todo el día", no una hora que valga la pena mostrar). */
export function horaDeEvento(inicioCrudo: unknown): string | null {
  let iso: string | null = null;
  if (typeof inicioCrudo === 'string') {
    iso = inicioCrudo;
  } else if (typeof inicioCrudo === 'object' && inicioCrudo !== null) {
    const r = inicioCrudo as Record<string, unknown>;
    if (typeof r.dateTime === 'string') iso = r.dateTime;
  }
  if (iso == null) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

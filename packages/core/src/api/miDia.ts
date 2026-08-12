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
 * propios campos). Sólo se leen de ahí los que ya se saben mostrar (cliente/monto/fecha, si vienen con
 * ese nombre); lo que no se reconoce no se inventa ni se descarta la tarjeta entera por eso.
 *
 * 🔴 **`estado` no tiene un conjunto cerrado declarado por el contrato** (a diferencia del viejo
 * `EstadoTarjeta` del pipeline) — se transporta como el string que venga, sin inventar un enum que
 * backend no fijó. La UI lo usa sólo para saber en qué solapa está, no para pintar colores por él.
 *
 * 🔴 **`ausente ≠ cero`.** Un monto que no vino vale `null`, jamás `0`.
 */

/** Un importe del wire como string, o `null`. Gemelo del de `afip.ts`/`inteligencia.ts`. */
function importe(v: unknown): string | null {
  if (typeof v === 'string' && v.trim() !== '') return v.trim();
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  return null;
}

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
  cliente: string | null;
  monto: string | null;
  fecha: string | null;
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
    monto: importe(datos.monto),
    fecha: texto(datos.fecha),
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

/** `POST /mi-dia/tarjetas` — alta manual (contrato §2.4: crear a mano o por voz). */
export async function crearTarjetaMiDia(
  texto: string,
): Promise<{ status: 'ok'; tarjeta: TarjetaMiDia } | { status: 'no_disponible' }> {
  try {
    const raw = await apiClient.post<{ tarjeta?: unknown }>('/mi-dia/tarjetas', { texto });
    const t = tarjeta(raw?.tarjeta);
    if (t == null) return { status: 'no_disponible' };
    return { status: 'ok', tarjeta: t };
  } catch (err) {
    if (noDesplegadoColeccion(err)) return { status: 'no_disponible' };
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

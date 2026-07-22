import { apiClient } from './client';
import { ApiError } from './errors';

/**
 * `/actividad` — "actividad reciente": la lista de acciones de negocio que el usuario ya CONFIRMÓ,
 * cross-cliente. No hay concepto nuevo que inventar acá — la actividad ES la tabla de entradas
 * firmadas (append-only) leída sin filtrar por cliente. Este archivo es el cliente de ESE endpoint,
 * nada más: no decide qué cuenta como actividad, eso ya lo decidió el schema del lado del backend.
 *
 * 🔴 `cliente_id` (tenant) sale del JWT del lado del servidor — `listarActividad` no lo acepta como
 * parámetro ni lo manda nunca: no existe forma de pedirle desde acá "la actividad de otro tenant".
 *
 * 🔴 El endpoint puede no estar desplegado todavía (heredado del proyecto de origen, donde se pidió al
 * backend el mismo día que este archivo se escribió) — `listarActividad` normaliza el 404 (la ruta ni
 * existe todavía) Y el 501 (el backend la registró pero es un stub explícito) al MISMO resultado
 * `{status:'no_disponible'}`. El caller tiene que mostrar esto como un estado HONESTO ("todavía no
 * está disponible"), nunca como una lista vacía: una lista vacía en un registro de actividad dice "no
 * hiciste nada", y esa sería una mentira por ausencia del feature, no por ausencia real de actividad.
 */

/**
 * Un ítem de actividad — una entrada FIRMADA (nada sin confirmar llega jamás a esa tabla, así
 * que no hace falta un flag `confirmado` acá: estar en la lista YA lo dice).
 */
export interface ActividadItem {
  entrada_id: string;
  /** El cliente al que pertenece esta entrada (equivalente al `paciente_id` del origen clínico). Ver
   * la nota de deuda GESTIONADA en `types.ts` (`ChatRequest.cliente_id`) sobre la colisión de nombre
   * con el `cliente_id` del tenant en `MeResponse` — acá no hay colisión de shape (interfaces
   * distintas), sólo el mismo cuidado de lectura. */
  cliente_id: string;
  cliente_nombre: string;
  /**
   * Qué acción generó esta entrada (ej. `'nota'`, `'consulta'`, `'documento'`). El backend lo declara
   * y este cliente NO lo interpreta ni lo traduce — mismo criterio que `ReplyCard.kind` en `types.ts`:
   * `string` abierto (no unión cerrada) para no romper ante un valor nuevo que el front todavía no
   * reconozca.
   */
  tipo_operacion: string;
  /** ISO-8601 con timezone. */
  created_at: string;
  /**
   * ~140 caracteres del markdown en texto plano — mismo criterio que `EntradaCorregible.extracto`
   * (`enmienda.ts`/`types.ts`): sin él, dos entradas del mismo tipo y fecha cercana son
   * indistinguibles en la lista. Es texto de negocio que se MUESTRA, nunca se busca (ver `q` abajo).
   */
  extracto: string;
}

export interface ListarActividadParams {
  /**
   * Búsqueda por NOMBRE de cliente y TIPO DE OPERACIÓN — nunca sobre `extracto`. Es una decisión del
   * operador, no una limitación técnica: buscar dentro del texto de negocio es indexar información
   * sensible, un riesgo propio que merece su propia decisión. Vacío/ausente = sin filtro.
   */
  q?: string;
  /**
   * El cursor OPACO de la página anterior (`cursorSiguiente` de un `ActividadResult` previo).
   * `null`/ausente = primera página. Este cliente nunca interpreta su forma — sólo lo transporta tal
   * cual lo mandó el backend.
   */
  cursor?: string | null;
  limit?: number;
}

/** Tope de página si el caller no especifica uno — mismo valor default que `listarClientes`. */
const LIMITE_DEFAULT = 20;

/**
 * El shape crudo que manda el backend (snake_case) — `listarActividad` lo normaliza a camelCase para
 * el resto del cliente (mismo criterio que `reply.ts` normalizando `RawReplyResponse`).
 */
interface ActividadResponseRaw {
  items: ActividadItem[];
  cursor_siguiente: string | null;
  /**
   * 🔴 `true` = el backend cortó la enumeración SIN agotarla (sin `limit` implícito que oculte
   * resultados; si se corta, la respuesta dice que se cortó). Mismo fail-closed que
   * `PreviewEnmienda.completo` — el caller tiene que decirlo en pantalla, nunca dejar que una lista
   * truncada se lea como si fuera la lista entera.
   */
  truncado: boolean;
}

/**
 * Resultado normalizado — un status explícito en vez de relanzar el 404/501 como excepción, porque
 * acá NO son errores del usuario ni algo que un reintento arregle — son el estado real de un endpoint
 * todavía no desplegado.
 */
export type ActividadResult =
  | { status: 'ok'; items: ActividadItem[]; cursorSiguiente: string | null; truncado: boolean }
  | { status: 'no_disponible' };

/**
 * GET /actividad?q=&cursor=&limit= — Bearer requerido. Ver el docstring del módulo para el criterio
 * de `no_disponible` (404/501) y por qué `q` nunca busca sobre `extracto`.
 */
export async function listarActividad(params: ListarActividadParams = {}): Promise<ActividadResult> {
  const { q = '', cursor = null, limit = LIMITE_DEFAULT } = params;
  const query = new URLSearchParams();
  if (q) query.set('q', q);
  if (cursor) query.set('cursor', cursor);
  query.set('limit', String(limit));

  try {
    const body = await apiClient.get<ActividadResponseRaw>(`/actividad?${query.toString()}`);
    // 🔴 **La ruta no desplegada NO da 404: da `200` con el HTML del SPA.** El front-door monta un
    // catch-all `@app.get("/{full_path}")` (`apps/copiloto/web.py:141`), así que un GET a una ruta
    // inexistente devuelve la página. Medido el 2026-07-22: `GET /actividad` → `200 <!doctype html>`
    // en producción, porque el stub 501 vive en una rama sin mergear.
    //
    // Sin esta guarda, `res.json()` explota con `SyntaxError` —comprobado con una sonda, no deducido—
    // y la pantalla muestra un ERROR donde debería decir "todavía no está disponible". El status por
    // sí solo diría "desplegado y todo bien" sobre una ruta que no existe: por eso se valida la
    // FORMA, no el código.
    if (typeof body !== 'object' || body === null || !('items' in body)) {
      return { status: 'no_disponible' };
    }
    return { status: 'ok', items: body.items, cursorSiguiente: body.cursor_siguiente, truncado: body.truncado };
  } catch (err) {
    // 404 = la ruta ni existe todavía (deploy pendiente); 501 = el backend la registró pero la
    // implementación es un stub explícito. Desde el cliente son indistinguibles EN LA PRÁCTICA ("no
    // puedo mostrarte actividad todavía") y no hace falta que dejen de serlo: ninguna de las dos es
    // un error del usuario ni algo que un reintento resuelva.
    if (err instanceof ApiError && (err.status === 404 || err.status === 501)) {
      return { status: 'no_disponible' };
    }
    // Un `200` con HTML explota en `res.json()`, no en `mapearError`: llega acá como error de parseo
    // y NO como `ApiError`. Es el mismo caso de arriba visto desde el otro lado — la guarda de forma
    // lo agarra cuando el body parsea a algo inesperado, esto cuando ni siquiera parsea.
    if (!(err instanceof ApiError)) return { status: 'no_disponible' };
    throw err;
  }
}

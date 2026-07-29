import { config } from './config';
import { ApiError, ForbiddenError, UnauthorizedError } from './errors';
import type { ArchivoSubida, PeticionHttp, RespuestaHttp } from './http';

interface RequestOptions {
  /** Misma unión que `PeticionHttp['metodo']`: eran dos listas del mismo concepto y `PATCH` estaba
   *  en una sola, así que agregar el método al cliente no compilaba aunque el puerto ya lo aceptara. */
  method?: PeticionHttp['metodo'];
  body?: unknown;
  /** Default true: inyecta `Authorization: Bearer <token>` si hay token persistido. */
  auth?: boolean;
}

// Single-flight: si varias requests dan 401 a la vez, un SOLO refresh corre (GoTrue ROTA el
// refresh en cada uso -> dos refresh concurrentes = el 2º falla por token ya rotado = logout
// espurio). Los 401 concurrentes esperan la MISMA promesa.
let refreshInFlight: Promise<boolean> | null = null;

function refreshSession(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = doRefresh().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

async function doRefresh(): Promise<boolean> {
  const { http, tokens } = config();
  const refreshToken = await tokens.leerRefresh();
  if (!refreshToken) return false; // sesión legacy sin refresh token -> no se puede renovar
  try {
    // Vía el HttpPort CRUDO (no via `apiClient`/`request`) para no recursar el interceptor de 401.
    const res = await http.enviar({
      metodo: 'POST',
      path: '/auth/refresh',
      headers: { 'Content-Type': 'application/json' },
      cuerpoJson: { refresh_token: refreshToken },
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { access_token: string; refresh_token: string };
    await tokens.guardarToken(data.access_token);
    await tokens.guardarRefresh(data.refresh_token); // GoTrue ROTA -> persistir el nuevo
    return true;
  } catch {
    return false; // error de red/parseo -> tratar como refresh fallido
  }
}

async function safeJson(res: RespuestaHttp): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return undefined; // body no-JSON o vacío
  }
}

function stringDetail(body: unknown): string | undefined {
  if (body && typeof body === 'object' && 'detail' in body) {
    const detail = (body as { detail?: unknown }).detail;
    if (typeof detail === 'string') return detail;
  }
  return undefined;
}

/**
 * Mapeo COMPARTIDO de un status HTTP no-ok + body ya parseado a la excepción tipada
 * correspondiente. En el proyecto de origen vivía TRIPLICADO (`audio.ts`, los endpoints
 * clínicos ahora descartados, `clientes.ts`); acá hay UN solo lugar. SIEMPRE lanza.
 *
 * `limpiarTokens` (default `true`) borra la sesión propia en un 401 — se pasa `false` sólo cuando
 * la request original NO llevaba Bearer (`auth:false`, ej. `/auth/login` con credenciales mal
 * escritas: no hay sesión propia que invalidar).
 */
export async function mapearError(status: number, body: unknown, opts: { limpiarTokens?: boolean } = {}): Promise<never> {
  const { limpiarTokens = true } = opts;
  const detail = stringDetail(body);

  if (status === 401) {
    if (limpiarTokens) await config().tokens.limpiar();
    throw new UnauthorizedError(detail, body);
  }
  if (status === 403) {
    throw new ForbiddenError(detail, body);
  }
  // `body` (no sólo el `detail` string): hay endpoints cuyo mismo status tiene dos causas y sólo se
  // distinguen por un campo que el backend adjunta. Ver el docstring de `ApiError.body`.
  throw new ApiError(status, detail ?? `Error HTTP ${status}`, detail, body);
}

/** ¿Es el aborto por timeout del adaptador, y no otro fallo de red? */
function esCorteDeTiempo(error: unknown): boolean {
  // `AbortError` es lo que tiran `fetch` (web) y el `fetch` de Expo (nativo) al abortar. Se mira el
  // `name` y no `instanceof DOMException` porque el core NO puede tocar tipos del DOM (ADR-010).
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    (error as { name?: unknown }).name === 'AbortError'
  );
}

/**
 * Envía y convierte el corte por tiempo en un error del dominio del cliente.
 *
 * Sin esto, un `AbortError` crudo sube por toda la app: cada pantalla tendría que reconocer un tipo
 * del navegador para distinguir "tardó demasiado" de un bug. Como `ApiError` 408, entra por el mismo
 * camino que cualquier otro fallo HTTP y las pantallas que ya muestran `error.detail` lo muestran sin
 * cambiar una línea.
 */
async function enviarConCorte(peticion: PeticionHttp): Promise<RespuestaHttp> {
  const { http } = config();
  try {
    return await http.enviar(peticion);
  } catch (error) {
    if (!esCorteDeTiempo(error)) throw error;
    throw new ApiError(408, 'la conexión tardó demasiado; probá de nuevo', 'timeout');
  }
}

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, auth = true } = opts;
  const { tokens } = config();   // el `http` lo toma `enviarConCorte`, que envuelve el envío
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  if (auth) {
    const token = await tokens.leerToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const peticion: PeticionHttp = { metodo: method, path, headers, cuerpoJson: body };
  // Sólo reintentamos un 401 si REALMENTE mandamos un Bearer (hay sesión). Sin token, un 401 es
  // definitivo (no logueado) y reintentar sería inútil.
  const sentBearer = auth && headers.Authorization !== undefined;

  let res = await enviarConCorte(peticion);

  // Refresh-on-401: si una request CON sesión da 401 (token vencido), renovamos en silencio y
  // reintentamos con el token nuevo. El usuario nunca ve un logout por expiración. Si el refresh
  // falla de verdad (refresh token muerto), `res` sigue 401 y cae al manejo de 401 de abajo
  // (limpiar tokens + throw) = logout real. NO cubre auth-service caído (refresh también fallaría).
  if (res.status === 401 && sentBearer) {
    const refreshed = await refreshSession();
    if (refreshed) {
      const fresh = await tokens.leerToken();
      if (fresh) headers.Authorization = `Bearer ${fresh}`;
      res = await enviarConCorte({ ...peticion, headers });
    }
  }

  if (res.ok) {
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  const errorBody = await safeJson(res);
  return mapearError(res.status, errorBody, { limpiarTokens: auth });
}

export const apiClient = {
  get<T>(path: string, opts?: Omit<RequestOptions, 'method' | 'body'>): Promise<T> {
    return request<T>(path, { ...opts, method: 'GET' });
  },
  post<T>(path: string, body?: unknown, opts?: Omit<RequestOptions, 'method' | 'body'>): Promise<T> {
    return request<T>(path, { ...opts, method: 'POST', body });
  },
  /**
   * `PATCH` — lo usa `cambiarEstadoPresupuesto` (hito 3). El `HttpPort` ya declaraba `'PATCH'` en su
   * unión de métodos y los dos adaptadores lo pasan tal cual a `fetch()` sin ramificar, así que esto
   * es sólo el atajo que faltaba del lado del cliente: no hubo que tocar ninguna plataforma.
   *
   * *(El comentario de `http.ts` decía que lo usaba `actualizarCliente`. Esa función ya no existe —
   * la edición de cliente terminó siendo `POST /clientes/{id}` — así que hasta hoy no había ningún
   * PATCH vivo en el repo.)*
   */
  patch<T>(path: string, body?: unknown, opts?: Omit<RequestOptions, 'method' | 'body'>): Promise<T> {
    return request<T>(path, { ...opts, method: 'PATCH', body });
  },
  /** `DELETE` — hoy sólo lo usa `quitarItem` de facturación. Sin body: el recurso a borrar viaja en
   * el path (`/afip/facturas/{id}/items/{indice}`), que es lo que el backend expone. */
  del<T>(path: string, opts?: Omit<RequestOptions, 'method' | 'body'>): Promise<T> {
    return request<T>(path, { ...opts, method: 'DELETE' });
  },
};

/**
 * POST `multipart/form-data` compartido — usado por las rutas que suben un archivo (ej.
 * `/chat/audio`). Adjunta el Bearer si hay sesión, pero NO fuerza `Content-Type` (el adaptador de
 * plataforma tiene que poner el boundary del multipart él mismo — en web, el browser; pisarlo a
 * mano rompe el parseo en el backend).
 */
export async function postMultipart<T>(
  path: string,
  campos: Record<string, string>,
  campoArchivo: string,
  archivo: ArchivoSubida,
): Promise<T> {
  const { http, tokens } = config();
  const headers: Record<string, string> = {};
  const token = await tokens.leerToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const sentBearer = headers.Authorization !== undefined;

  const peticion = {
    metodo: 'POST' as const,
    path,
    headers,
    multipart: { campos, campoArchivo, archivo },
    // Sin corte por tiempo, a propósito: subir un audio por una red lenta puede tardar mucho más que
    // cualquier request JSON, y abortarlo perdería una grabación que el usuario ya hizo. Además el
    // camino nativo del multipart no pasa por `fetch` (`uploadAsync` streamea desde disco) y no tiene
    // dónde enganchar el `AbortController` — declararlo explícito evita que parezca un olvido.
    timeoutMs: 0,
  };

  let res = await http.enviar(peticion);

  // Refresh-on-401 — mismo criterio que `request()`: sin esto, un dictado con token vencido
  // desloguea en vez de reintentar, y el audio ya grabado se pierde silenciosamente.
  if (res.status === 401 && sentBearer) {
    const refreshed = await refreshSession();
    if (refreshed) {
      const fresh = await tokens.leerToken();
      if (fresh) headers.Authorization = `Bearer ${fresh}`;
      res = await http.enviar({ ...peticion, headers });
    }
  }

  if (res.ok) return (await res.json()) as T;

  const errorBody = await safeJson(res);
  return mapearError(res.status, errorBody);
}

export { safeJson, stringDetail };

import { marcarSesionViva, notificarSesionExpirada } from '@copiloto/core';

import { clearToken, getRefreshToken, getToken, setRefreshToken, setToken } from '../../auth/session';

/** Vacío = mismo-origen (la SPA se sirve desde el dominio del backend); ver vite-env.d.ts. */
const API_BASE = import.meta.env.VITE_API_BASE ?? '';

/** Error base de la API — siempre trae el status HTTP para que el caller pueda ramificar. */
export class ApiError extends Error {
  readonly status: number;
  readonly detail?: string;
  /** Campos extra de un 409 `errores_web.conflicto(codigo, mensaje, **extra)` (ej. `vigente`,
   * `factura_id`, `candidato`) -- `detail` ya se resolvió al `mensaje` legible, esto es lo que
   * queda para el caller que necesita el dato estructurado, no sólo el texto. */
  readonly extra?: Record<string, unknown>;

  constructor(status: number, message: string, detail?: string, extra?: Record<string, unknown>) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
    this.extra = extra;
  }
}

/** 401 — token ausente/inválido/expirado. El caller debe volver a login. */
export class UnauthorizedError extends ApiError {
  constructor(detail?: string) {
    super(401, detail ?? 'No autorizado', detail);
    this.name = 'UnauthorizedError';
  }
}

/** 403 — token válido pero sin tenant habilitado. */
export class ForbiddenError extends ApiError {
  constructor(detail?: string) {
    super(403, detail ?? 'Cuenta no habilitada', detail);
    this.name = 'ForbiddenError';
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'DELETE';
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
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false; // sesión legacy sin refresh token -> no se puede renovar
  try {
    // fetch CRUDO (no via `request`) para no recursar el interceptor de 401.
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { access_token: string; refresh_token: string };
    setToken(data.access_token);
    setRefreshToken(data.refresh_token); // GoTrue ROTA -> persistir el nuevo
    // Hay sesión viva otra vez: rearma el aviso para que una muerte POSTERIOR no salga muda (CTA5).
    marcarSesionViva();
    return true;
  } catch {
    return false; // error de red/parseo -> tratar como refresh fallido
  }
}

/**
 * Bearer para una request autenticada, **renovando si el access token FALTA pero hay refresh**.
 *
 * Gemelo de `bearerVigente()` en `@copiloto/core` (CTA7). Va acá también porque este cliente es el
 * que usan chat, conexiones y cuenta: arreglar sólo el del core dejaba la web con el defecto vivo, y
 * se verificó en el navegador — con el access borrado a mano, la app terminaba en el login.
 *
 * `sesionMuerta` separa tres situaciones que antes se confundían: hay token (o se renovó) · no hay
 * NADA guardado (nunca hubo sesión: nada que borrar) · hay refresh y no renovó (ahí sí murió).
 */
async function bearerVigente(): Promise<{ token: string | null; sesionMuerta: boolean }> {
  const token = getToken();
  if (token) return { token, sesionMuerta: false };
  if (!getRefreshToken()) return { token: null, sesionMuerta: false };
  const ok = await refreshSession(); // single-flight: N requests sin token = UN solo /auth/refresh
  return { token: ok ? getToken() : null, sesionMuerta: !ok };
}

interface ErrorDetail {
  mensaje?: string;
  /** `{codigo, ...extra}` de `errores_web.conflicto()` -- `codigo` viaja adentro para que el
   * caller pueda discriminar sin volver a tocar `client.ts` (ver BL-O6 parte B: `vigente`). */
  extra?: Record<string, unknown>;
}

async function readErrorDetail(res: Response): Promise<ErrorDetail> {
  try {
    const data: unknown = await res.json();
    if (data && typeof data === 'object' && 'detail' in data) {
      const detail = (data as { detail?: unknown }).detail;
      if (typeof detail === 'string') return { mensaje: detail };
      // `detail` OBJETO: es la forma de `errores_web.conflicto(codigo, mensaje, **extra)` —
      // `{codigo, mensaje, ...extra}`. Su docstring dice que `mensaje` "sigue siendo el texto que
      // el emprendedor puede leer: el código es para la app, no para la persona". Hasta el
      // 2026-08-07 acá se caía al piso y la UI mostraba el texto genérico del status en su lugar,
      // que no explica nada. El resto de los campos (`codigo`, `vigente`, `factura_id`,
      // `candidato`, ...) viajaban ya en el body pero `client.ts` los descartaba enteros -- ningún
      // caller podía leerlos sin re-implementar el parseo. `extra` es lo que faltaba.
      if (detail && typeof detail === 'object') {
        const { mensaje, ...resto } = detail as Record<string, unknown>;
        const mensajeStr = typeof mensaje === 'string' ? mensaje : undefined;
        return { mensaje: mensajeStr, extra: Object.keys(resto).length > 0 ? resto : undefined };
      }
    }
  } catch {
    // body no-JSON o vacío — sin detail, se usa el mensaje genérico del status.
  }
  return {};
}

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, auth = true } = opts;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  // Sólo `sesionMuerta` autoriza a borrar los tokens (ver `bearerVigente`).
  let sesionMuerta = false;

  if (auth) {
    const bearer = await bearerVigente();
    if (bearer.token) headers.Authorization = `Bearer ${bearer.token}`;
    sesionMuerta = bearer.sesionMuerta;
  }

  const init: RequestInit = {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  };
  // Sólo reintentamos un 401 si REALMENTE mandamos un Bearer (hay sesión). Sin token, un 401 es
  // definitivo (no logueado) y reintentar sería inútil.
  const sentBearer = auth && headers.Authorization !== undefined;

  let res = await fetch(`${API_BASE}${path}`, init);

  // Refresh-on-401: si una request CON sesión da 401 (token vencido), renovamos en silencio y
  // reintentamos con el token nuevo. El usuario nunca ve un logout por expiración. Si el refresh
  // falla de verdad (refresh token muerto), `res` sigue 401 y cae al manejo de 401 de abajo
  // (clearToken + throw) = logout real. NO cubre auth-service caído (refresh también fallaría).
  if (res.status === 401 && sentBearer) {
    const refreshed = await refreshSession();
    if (refreshed) {
      const fresh = getToken();
      if (fresh) headers.Authorization = `Bearer ${fresh}`;
      res = await fetch(`${API_BASE}${path}`, init);
    } else {
      sesionMuerta = true; // había sesión y no se pudo renovar: esto SÍ es logout
    }
  }

  if (res.ok) {
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  const { mensaje, extra } = await readErrorDetail(res);

  if (res.status === 401) {
    // Antes era `if (auth) clearToken()`: CUALQUIER 401 de CUALQUIER endpoint autenticado destruía
    // la sesión — incluido el 401 por header ausente, que de paso se llevaba el refresh token que
    // podía salvarla. Ahora sólo se limpia cuando una renovación con refresh guardado falló, que es
    // la única prueba de sesión muerta que tiene el cliente.
    //
    // El aviso (CTA5) va PEGADO al `clearToken()` y bajo la misma condición: el punto donde se
    // destruye la sesión es el único que sabe con certeza que murió. Si el aviso viviera en la
    // pantalla que atrapa el `UnauthorizedError`, cada pantalla tendría que acordarse — y la que se
    // olvide deja al usuario deslogueado creyéndose adentro, que es exactamente el defecto de CTA5.
    if (sesionMuerta) {
      clearToken();
      notificarSesionExpirada();
    }
    throw new UnauthorizedError(mensaje);
  }
  if (res.status === 403) {
    throw new ForbiddenError(mensaje);
  }
  throw new ApiError(res.status, mensaje ?? `Error HTTP ${res.status}`, mensaje, extra);
}

export const apiClient = {
  get<T>(path: string, opts?: Omit<RequestOptions, 'method' | 'body'>): Promise<T> {
    return request<T>(path, { ...opts, method: 'GET' });
  },
  post<T>(path: string, body?: unknown, opts?: Omit<RequestOptions, 'method' | 'body'>): Promise<T> {
    return request<T>(path, { ...opts, method: 'POST', body });
  },
  delete<T>(path: string, opts?: Omit<RequestOptions, 'method' | 'body'>): Promise<T> {
    return request<T>(path, { ...opts, method: 'DELETE' });
  },
};

/**
 * POST `multipart/form-data` compartido — usado por las rutas que suben un archivo (ej.
 * `/chat/audio`). NO fuerza `Content-Type`: el browser tiene que poner el boundary del multipart él
 * mismo; pisarlo a mano rompe el parseo en el backend. Por eso no pasa por `request()` (esa función
 * fuerza `Content-Type: application/json` + `JSON.stringify(body)`, incompatible con `FormData`).
 *
 * Mismo refresh-on-401 que `request()`: sin esto, un dictado con token vencido desloguea en vez de
 * reintentar, y el audio ya grabado se pierde en silencio.
 */
export async function postMultipart<T>(path: string, form: FormData): Promise<T> {
  const headers: Record<string, string> = {};
  // Mismo criterio que `request()`: acá pesa el doble — un dictado ya grabado se perdería por no
  // intentar renovar cuando el access token simplemente falta.
  const bearer = await bearerVigente();
  let sesionMuerta = bearer.sesionMuerta;
  if (bearer.token) headers.Authorization = `Bearer ${bearer.token}`;
  const sentBearer = headers.Authorization !== undefined;

  let res = await fetch(`${API_BASE}${path}`, { method: 'POST', headers, body: form });

  if (res.status === 401 && sentBearer) {
    const refreshed = await refreshSession();
    if (refreshed) {
      const fresh = getToken();
      if (fresh) headers.Authorization = `Bearer ${fresh}`;
      res = await fetch(`${API_BASE}${path}`, { method: 'POST', headers, body: form });
    } else {
      sesionMuerta = true;
    }
  }

  if (res.ok) return (await res.json()) as T;

  const { mensaje, extra } = await readErrorDetail(res);

  if (res.status === 401) {
    // Mismo par que en `request()` — si el aviso viviera sólo allá, un dictado sería el único camino
    // de la app capaz de dejar la sesión muerta sin que nadie se entere.
    if (sesionMuerta) {
      clearToken();
      notificarSesionExpirada();
    }
    throw new UnauthorizedError(mensaje);
  }
  if (res.status === 403) {
    throw new ForbiddenError(mensaje);
  }
  throw new ApiError(res.status, mensaje ?? `Error HTTP ${res.status}`, mensaje, extra);
}

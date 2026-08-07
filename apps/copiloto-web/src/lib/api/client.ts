import { clearToken, getRefreshToken, getToken, setRefreshToken, setToken } from '../../auth/session';

/** Vacío = mismo-origen (la SPA se sirve desde el dominio del backend); ver vite-env.d.ts. */
const API_BASE = import.meta.env.VITE_API_BASE ?? '';

/** Error base de la API — siempre trae el status HTTP para que el caller pueda ramificar. */
export class ApiError extends Error {
  readonly status: number;
  readonly detail?: string;

  constructor(status: number, message: string, detail?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
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
  method?: 'GET' | 'POST';
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

async function readErrorDetail(res: Response): Promise<string | undefined> {
  try {
    const data: unknown = await res.json();
    if (data && typeof data === 'object' && 'detail' in data) {
      const detail = (data as { detail?: unknown }).detail;
      if (typeof detail === 'string') return detail;
      // `detail` OBJETO: es la forma de `errores_web.conflicto()` —
      // `{codigo, mensaje, ...extra}`. Su docstring dice que `mensaje` "sigue siendo el texto que
      // el emprendedor puede leer: el código es para la app, no para la persona". Hasta el
      // 2026-08-07 acá se caía al piso y la UI mostraba el texto genérico del status en su lugar,
      // que no explica nada. Aditivo: sólo agrega un caso que antes devolvía `undefined`.
      if (detail && typeof detail === 'object' && 'mensaje' in detail) {
        const mensaje = (detail as { mensaje?: unknown }).mensaje;
        if (typeof mensaje === 'string') return mensaje;
      }
    }
  } catch {
    // body no-JSON o vacío — sin detail, se usa el mensaje genérico del status.
  }
  return undefined;
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

  const detail = await readErrorDetail(res);

  if (res.status === 401) {
    // Antes era `if (auth) clearToken()`: CUALQUIER 401 de CUALQUIER endpoint autenticado destruía
    // la sesión — incluido el 401 por header ausente, que de paso se llevaba el refresh token que
    // podía salvarla. Ahora sólo se limpia cuando una renovación con refresh guardado falló, que es
    // la única prueba de sesión muerta que tiene el cliente.
    if (sesionMuerta) clearToken();
    throw new UnauthorizedError(detail);
  }
  if (res.status === 403) {
    throw new ForbiddenError(detail);
  }
  throw new ApiError(res.status, detail ?? `Error HTTP ${res.status}`, detail);
}

export const apiClient = {
  get<T>(path: string, opts?: Omit<RequestOptions, 'method' | 'body'>): Promise<T> {
    return request<T>(path, { ...opts, method: 'GET' });
  },
  post<T>(path: string, body?: unknown, opts?: Omit<RequestOptions, 'method' | 'body'>): Promise<T> {
    return request<T>(path, { ...opts, method: 'POST', body });
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

  const detail = await readErrorDetail(res);

  if (res.status === 401) {
    if (sesionMuerta) clearToken();
    throw new UnauthorizedError(detail);
  }
  if (res.status === 403) {
    throw new ForbiddenError(detail);
  }
  throw new ApiError(res.status, detail ?? `Error HTTP ${res.status}`, detail);
}

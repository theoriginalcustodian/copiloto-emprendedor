import { clearToken, getToken } from '../../auth/session';

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

async function readErrorDetail(res: Response): Promise<string | undefined> {
  try {
    const data: unknown = await res.json();
    if (data && typeof data === 'object' && 'detail' in data) {
      const detail = (data as { detail?: unknown }).detail;
      if (typeof detail === 'string') return detail;
    }
  } catch {
    // body no-JSON o vacío — sin detail, se usa el mensaje genérico del status.
  }
  return undefined;
}

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, auth = true } = opts;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.ok) {
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  const detail = await readErrorDetail(res);

  if (res.status === 401) {
    // El token propio (si lo había) ya no sirve — limpiarlo para que useSession vuelva a 'anon'.
    // No aplica cuando `auth:false` (ej. /auth/login con credenciales mal escritas: no hay
    // sesión propia que invalidar).
    if (auth) clearToken();
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

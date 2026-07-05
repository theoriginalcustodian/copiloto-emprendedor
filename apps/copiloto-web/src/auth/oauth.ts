/**
 * Google OAuth en el cliente (puro, sin React). Dos piezas:
 *
 *  1) `googleAuthUrl()` — construye la URL a la que navega el botón "Entrar con Google". El browser NO
 *     puede pegarle a la GoTrue por loopback: el flujo OAuth arranca navegando al vhost PÚBLICO de auth
 *     (`VITE_AUTH_URL`, ej https://auth.178-105-191-1.sslip.io). Si `VITE_AUTH_URL` está vacío (dev/mock
 *     o build sin Google), devuelve null → el botón NO se muestra (feature-flag por build, cero hardcoding).
 *
 *  2) `consumeOauthCallback()` — tras el callback de Google, GoTrue redirige a la app con los tokens en el
 *     FRAGMENT (#access_token=...&refresh_token=...). Esta función los extrae y LIMPIA el hash de la URL
 *     (nunca dejar el token en la barra ni en el historial). El `SessionProvider` la corre al montar.
 */

/** Base pública de auth, sin trailing slash. Se lee en cada llamada (testeable vía vi.stubEnv). */
function authBase(): string {
  return (import.meta.env.VITE_AUTH_URL ?? '').replace(/\/+$/, '');
}

/** URL del botón "Entrar con Google", o null si el build no tiene `VITE_AUTH_URL` (→ ocultar el botón). */
export function googleAuthUrl(): string | null {
  const base = authBase();
  if (!base || typeof window === 'undefined') return null;
  const redirectTo = `${window.location.origin}/`;
  return `${base}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirectTo)}`;
}

export interface OauthTokens {
  access_token: string;
  refresh_token: string | null;
}

/**
 * Extrae los tokens del fragment del callback OAuth y limpia el hash. Devuelve null si no venimos de
 * un callback (sin `access_token` ni `error` en el fragment). Si hay `error` (ej. el usuario canceló
 * en Google), limpia el hash igual y devuelve null → la app sigue como anónima.
 */
export function consumeOauthCallback(): OauthTokens | null {
  if (typeof window === 'undefined') return null;
  const hash = window.location.hash;
  if (hash.length < 2) return null;
  const params = new URLSearchParams(hash.slice(1));
  const access = params.get('access_token');
  const err = params.get('error') ?? params.get('error_description');
  if (!access && !err) return null; // fragment ajeno al OAuth (ej. #/ruta) → no tocar

  // Veníamos de un callback (token o error): limpiar el fragment SIEMPRE (no dejar el token en la URL).
  try {
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
  } catch {
    /* best-effort: si replaceState falla, no romper el login */
  }

  if (!access) return null; // error del proveedor → anónimo
  return { access_token: access, refresh_token: params.get('refresh_token') };
}

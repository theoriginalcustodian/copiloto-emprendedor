import { makeRedirectUri } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';

/**
 * Google OAuth nativo, contra el mismo GoTrue dedicado que ya usa `copiloto-web`
 * (`apps/copiloto-web/src/auth/oauth.ts` — mismo endpoint `/auth/v1/authorize?provider=google`,
 * mismo fragment de retorno). La diferencia es el transporte: la PWA navega el browser entero y
 * vuelve por `window.location`; acá no hay "browser entero" al que volver, así que se usa el patrón
 * oficial de Expo para proveedores OAuth custom (no el `Google.useAuthRequest` nativo, que habla
 * DIRECTO con Google — acá GoTrue es el intermediario):
 * `WebBrowser.openAuthSessionAsync(authUrl, redirectUrl)` — abre Custom Tabs (Android) / una sesión
 * `ASWebAuthenticationSession` (iOS), y la cierra sola apenas el navegador redirige al `redirectUrl`
 * (el deep link `copiloto://`, ya registrado vía `scheme` en `app.json`), devolviendo esa URL final
 * completa (con el fragment) a la app. Fuente: docs oficiales de Expo, `WebBrowser.openAuthSessionAsync`.
 *
 * `EXPO_PUBLIC_API_BASE` ya es la base de GoTrue en este backend (el OAuth vive en el MISMO dominio
 * del chat, no en un subdominio `auth.*` — mismo diseño que `sync-web.sh` documenta para la web).
 */
/** Se lee en cada llamada (no una constante top-level) -- mismo motivo que `oauth.ts` de la web: testeable. */
function authBase(): string {
  return (process.env.EXPO_PUBLIC_API_BASE ?? '').replace(/\/+$/, '');
}

export interface OauthTokens {
  access_token: string;
  refresh_token: string | null;
}

export type OauthOutcome =
  | { ok: true; tokens: OauthTokens }
  | { ok: false; reason: 'cancelado' | 'sin-tokens' | 'sin-configurar' };

/** Extrae `access_token`/`refresh_token` del fragment de la URL de retorno de GoTrue. */
function extraerTokens(urlRetorno: string): OauthTokens | null {
  const indiceFragment = urlRetorno.indexOf('#');
  if (indiceFragment === -1) return null;
  const params = new URLSearchParams(urlRetorno.slice(indiceFragment + 1));
  const access = params.get('access_token');
  if (!access) return null;
  return { access_token: access, refresh_token: params.get('refresh_token') };
}

/**
 * Abre el flujo de Google contra GoTrue y espera a que el usuario vuelva (clic humano real en el
 * consentimiento de Google — no automatizable, por diseño de Google contra abuso). Resuelve con los
 * tokens si el usuario completó el login, o con el motivo si canceló / el build no tiene auth
 * configurada.
 */
export async function iniciarLoginGoogle(): Promise<OauthOutcome> {
  const base = authBase();
  if (!base) return { ok: false, reason: 'sin-configurar' };

  const redirectUrl = makeRedirectUri({ scheme: 'copiloto' });
  const authUrl = `${base}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirectUrl)}`;

  const resultado = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);

  if (resultado.type !== 'success' || !resultado.url) return { ok: false, reason: 'cancelado' };

  const tokens = extraerTokens(resultado.url);
  if (!tokens) return { ok: false, reason: 'sin-tokens' };
  return { ok: true, tokens };
}

import { GoogleSignin, isSuccessResponse } from '@react-native-google-signin/google-signin';

/**
 * Google Sign-In NATIVO (Credential Manager en Android, sin browser) — reemplaza el flujo anterior
 * basado en `expo-web-browser` (BETA-4b, 2026-08-05). El pedido explícito del operador: en la app
 * tiene que aparecer el selector de cuenta NATIVO del sistema (como cualquier app que usa el botón
 * "Iniciar sesión con Google" de Android), no un navegador -- ni Custom Tabs forzando Chrome ni
 * ningún otro. `@react-native-google-signin/google-signin` habla con la Credential Manager API de
 * Android directo, sin abrir actividad de navegador alguna.
 *
 * El `idToken` que devuelve Google se intercambia server-side por un token PROPIO en
 * `POST /auth/google/id-token` (`apps/copiloto/web.py`) -- el device nunca habla directo con GoTrue
 * (mismo criterio que `/auth/login` para email/password, ver `onboarding.GoTrueAdmin.id_token_grant`).
 *
 * Requiere, del lado de Google Cloud Console, un client OAuth tipo "Android" con el `package name` +
 * SHA-1 del build EAS instalado, Y del lado de GoTrue, que `GOTRUE_EXTERNAL_GOOGLE_CLIENT_ID` incluya
 * (comma-separated) tanto este client Web como el Android -- GoTrue acepta múltiples audiences por
 * proveedor (mismo mecanismo documentado para Apple Web+iOS).
 *
 * 🔴 **El `DEVELOPER_ERROR` que rompía el login en device era ESTO, y no el certificado** (CTA6,
 * 2026-08-07). El prefijo numérico de un `client_id` de Google **es el número de proyecto**: la app
 * pedía el login con un Web del proyecto de **Composio** (prestado) mientras el client Android vivía
 * en `890375505063` (`copiloto-emprendedor`) desde el 3 de agosto. Google exige
 * que los dos estén en el MISMO proyecto: *"Android clients and Web clients (server client ID) must
 * be in the same project"*. Nada que ver con la huella de firma — cuando se intentó registrar el
 * SHA-1, Google contestó que **ya estaba en uso**, o sea que el certificado del APK ya era el bueno.
 *
 * ⚠️ **Este docstring afirmaba antes que el SHA-1 "coincide EXACTO con el registrado", verificado
 * contra el build `d8110bf9`. Ese no es el build instalado**, así que la frase daba por probado algo
 * que nadie había medido sobre el binario real. La verificación que vale queda atada a su build en el
 * `cierre_` de CTA6, no acá: un docstring que fecha mal una verificación es peor que no tenerla
 * ([[el-contrato-afirma-el-mecanismo-que-no-opero]]).
 *
 * Y el drift que lo mantuvo vivo: `memoria/copiloto-google-signin-nativo-credential-manager.md` daba
 * este fix por hecho el 2026-08-05 — pero `git log -L21,21` muestra que la constante **nació** con el
 * client de Composio y no cambió nunca. El E2E de ese día pasó en verde porque en ese momento el
 * Android registrado y el Web pertenecían al mismo proyecto prestado: el instrumento no falló,
 * respondía otra pregunta.
 */
const WEB_CLIENT_ID = '890375505063-a2tim63uf5advkp19atf6seqat9ogjbj.apps.googleusercontent.com';

/** Se lee en cada llamada (no una constante top-level) -- testeable, mismo motivo que `oauth.ts` de la web. */
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

/**
 * `GoogleSignin.configure` debe correr una sola vez antes del primer `signIn` (lo exige la librería
 * -- llamadas repetidas son inofensivas pero innecesarias). El flag de módulo alcanza: no hay
 * concurrencia real dentro de una sesión de la app.
 */
let configurado = false;
function asegurarConfigurado(): void {
  if (configurado) return;
  GoogleSignin.configure({ webClientId: WEB_CLIENT_ID });
  configurado = true;
}

/** Intercambia el `idToken` de Google por el token propio del backend. `null` ante cualquier fallo
 * de red/servidor -- el caller lo trata como 'sin-tokens' (mismo criterio que la respuesta vacía del
 * fragment en el flujo anterior). */
async function intercambiarIdToken(idToken: string, base: string): Promise<OauthTokens | null> {
  let resp;
  try {
    resp = await fetch(`${base}/auth/google/id-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id_token: idToken }),
    });
  } catch {
    return null;
  }
  if (!resp.ok) return null;
  const data = await resp.json();
  if (!data?.access_token) return null;
  return { access_token: data.access_token, refresh_token: data.refresh_token ?? null };
}

/**
 * Abre el selector nativo de cuenta de Google y espera a que el usuario elija/confirme (clic humano
 * real -- no automatizable). Resuelve con los tokens propios si el intercambio con el backend tuvo
 * éxito, o con el motivo si el usuario canceló / el build no tiene auth configurada.
 */
export async function iniciarLoginGoogle(): Promise<OauthOutcome> {
  const base = authBase();
  if (!base) return { ok: false, reason: 'sin-configurar' };

  asegurarConfigurado();

  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const respuesta = await GoogleSignin.signIn();
    if (!isSuccessResponse(respuesta)) return { ok: false, reason: 'cancelado' };

    const idToken = respuesta.data.idToken;
    if (!idToken) return { ok: false, reason: 'sin-tokens' };

    const tokens = await intercambiarIdToken(idToken, base);
    if (!tokens) return { ok: false, reason: 'sin-tokens' };
    return { ok: true, tokens };
  } catch {
    // PLAY_SERVICES_NOT_AVAILABLE / IN_PROGRESS / error de red del propio signIn -- ninguno es una
    // cancelación del usuario (esa ya se maneja arriba vía isSuccessResponse), así que caen acá.
    return { ok: false, reason: 'sin-tokens' };
  }
}

import { apiClient } from './client';
import { ApiError, mensajeDeConflicto } from './errors';
import type { GoogleIdTokenRequest, LoginRequest, LoginResponse } from './types';

/** POST /auth/login — sin Bearer (todavía no hay sesión propia que adjuntar). */
export function login(email: string, password: string): Promise<LoginResponse> {
  const body: LoginRequest = { email, password };
  return apiClient.post<LoginResponse>('/auth/login', body, { auth: false });
}

/**
 * POST /auth/google/id-token — sign-in nativo de Google (Credential Manager en Android, sin
 * browser). `idToken` ya lo emitió Google nativamente en el device; el backend hace el id_token-grant
 * server-side contra GoTrue (mismo motivo que `login`: el cliente nunca habla directo con GoTrue).
 * Mismo shape de respuesta que `login` — el caller sigue el mismo camino post-login.
 */
export function loginWithGoogleIdToken(idToken: string): Promise<LoginResponse> {
  const body: GoogleIdTokenRequest = { id_token: idToken };
  return apiClient.post<LoginResponse>('/auth/google/id-token', body, { auth: false });
}

/**
 * Resultado del alta con mail y contraseña (Martin 12/11, flujo «Entrada a Odobi»). Los rechazos
 * esperables —mail inválido, contraseña que GoTrue no acepta— vuelven como valor con un `mensaje`
 * para mostrar; un fallo de red o un 5xx vuelve como `red`.
 */
export type ResultadoAlta = { ok: true } | { ok: false; motivo: 'rechazada'; mensaje: string } | { ok: false; motivo: 'red' };

/**
 * POST /auth/signup — alta self-service con mail y contraseña (sin Bearer: todavía no hay tenant).
 * El backend NO devuelve tokens: quien llama hace el login después (`SessionProvider.registrar`).
 * Mismo endpoint que usa la web (`copiloto-web/src/lib/api/auth.ts`).
 *
 * ⚠️ Hoy el alta NO verifica el mail (GoTrue sin SMTP, `MAILER_AUTOCONFIRM`): el código de 6 dígitos
 * del flujo de diseño queda para cuando el backend tenga correo saliente.
 */
export async function registrarCuenta(email: string, password: string): Promise<ResultadoAlta> {
  try {
    await apiClient.post<unknown>('/auth/signup', { email, password }, { auth: false });
    return { ok: true };
  } catch (err) {
    if (err instanceof ApiError && err.status >= 400 && err.status < 500) {
      // El texto de GoTrue llega en inglés («Password should be…»): se muestra uno propio, en castellano.
      return { ok: false, motivo: 'rechazada', mensaje: 'No pudimos crear la cuenta. Revisá el mail y que la contraseña tenga al menos 8 caracteres.' };
    }
    return { ok: false, motivo: 'red' };
  }
}

/**
 * Resultado de un cambio de credenciales (K-12 / BL-J11). Los fallos ESPERABLES —contraseña actual
 * incorrecta, contraseña inválida, mail ya usado— vuelven como valor con el `mensaje` del backend
 * (es el texto que se le muestra a la persona, nunca uno inventado acá); lo inesperado sigue
 * lanzando.
 */
export type ResultadoCambioCredencial =
  | { ok: true; confirmacionPendiente: boolean }
  | { ok: false; codigo: string | null; mensaje: string };

async function cambiar(path: string, body: object): Promise<ResultadoCambioCredencial> {
  try {
    const res = await apiClient.post<{ ok?: boolean; confirmacion_pendiente?: boolean }>(path, body);
    return { ok: true, confirmacionPendiente: res?.confirmacion_pendiente === true };
  } catch (err) {
    // 400 (cuenta sin email, `web.py:1193`), 401 (actual incorrecta), 409 (mail en uso),
    // 422 (política): todos traen `detail.{codigo,mensaje}`.
    if (err instanceof ApiError && [400, 401, 409, 422].includes(err.status)) {
      const detalle = (err.body as { detail?: { codigo?: unknown } } | undefined)?.detail;
      const codigo = typeof detalle?.codigo === 'string' ? detalle.codigo : null;
      return { ok: false, codigo, mensaje: mensajeDeConflicto(err.body) ?? err.detail ?? 'No pudimos hacer el cambio.' };
    }
    throw err;
  }
}

/** POST /auth/cambiar-contrasena — el backend reautentica con la actual antes de tocar nada. */
export function cambiarContrasena(contrasenaActual: string, contrasenaNueva: string): Promise<ResultadoCambioCredencial> {
  return cambiar('/auth/cambiar-contrasena', { contrasena_actual: contrasenaActual, contrasena_nueva: contrasenaNueva });
}

/** POST /auth/cambiar-email — 200 `confirmacion_pendiente`: la persona confirma desde el mail nuevo. */
export function cambiarEmail(emailNuevo: string): Promise<ResultadoCambioCredencial> {
  return cambiar('/auth/cambiar-email', { email_nuevo: emailNuevo });
}

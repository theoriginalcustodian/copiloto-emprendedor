import { postMultipart } from './client';
import { ApiError } from './errors';
import type { ArchivoSubida } from './http';

/**
 * `POST /gastos/leer-foto` — BL-J7, 3er ítem del DoD (contrato
 * `2026-09-22_contrato_planificacion-a-backend-y-frontend2_endpoint-foto-gasto-sin-chat.md`).
 * Hermano de `transcribir.ts` (K-10): lee sin despachar al agente ni escribir en el hilo del chat —
 * a diferencia de `sendFoto`/`/chat/foto`, que sí abre sesión y persiste la reply. `gasto` viaja con
 * EXACTAMENTE la forma de `data` de la card `gasto_propuesto` (snake_case) — se traduce con
 * `datosGastoPropuesto` (`chat/gastoPropuesto.ts`), no acá: este módulo es sólo el puerto de red.
 */
export interface LeerFotoGastoResponse {
  gasto: unknown;
}

/**
 * Texto en español para cada error de `POST /gastos/leer-foto` (contrato §3). 413/415 usan el
 * `detail` que manda el backend porque ya es específico ("imagen demasiado grande (máx 10 MB)" /
 * "formato de imagen no soportado (jpg/png)"); el resto tiene un texto fijo porque el `detail` de
 * esos códigos no está pensado para mostrarse tal cual.
 */
export function avisoErrorLecturaFoto(err: unknown): string {
  if (err instanceof ApiError) {
    switch (err.status) {
      case 401:
        return 'Tu sesión venció. Volvé a entrar para leer la foto.';
      case 413:
      case 415:
        return err.detail != null && err.detail !== '' ? err.detail : 'Ese archivo no es una imagen válida (jpg/png, máx 10 MB).';
      case 422:
        return 'No pude leer el ticket. Probá con otra foto o cargalo a mano.';
      case 502:
      case 503:
        return 'No pude leer la foto ahora; cargalo a mano.';
      default:
        return 'No pude leer la foto ahora; cargalo a mano.';
    }
  }
  return 'No pude leer la foto ahora; cargalo a mano.';
}

/**
 * Sube la foto del ticket y devuelve la propuesta cruda (`gasto`), sin persistir nada — el gasto
 * recién se guarda cuando el usuario confirma el formulario con `crearGasto`, mismo camino que ya
 * existe. `imagen` no lleva más campos (sin `session_id`): a diferencia de `/chat/foto`, este
 * endpoint no tiene sesión de chat.
 */
export function leerFotoGasto(imagen: ArchivoSubida): Promise<LeerFotoGastoResponse> {
  return postMultipart<LeerFotoGastoResponse>('/gastos/leer-foto', {}, 'imagen', imagen);
}

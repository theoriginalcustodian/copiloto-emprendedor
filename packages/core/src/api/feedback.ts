import { apiClient, postMultipart } from './client';
import type { ArchivoSubida } from './http';
import type { EnviarFeedbackAudioResponse, EnviarFeedbackResponse } from './types';

/**
 * `/feedback` — BETA-1a, feedback in-app (voz + texto). Contrato:
 * `coordinacion/abierto/2026-08-04_contrato_planificacion-a-todos_BETA1a-feedback-endpoint.md`.
 *
 * Dos rutas, mismo patrón que `/chat` vs `/chat/audio` (`chat.ts`/`audio.ts`): texto va JSON directo,
 * voz va multipart y el backend transcribe server-side (cero retención de audio, mismo criterio que
 * `useVozComando`). Standalone —no entra en `CopilotApi`/`mockApi`— igual que `gastos.ts`/
 * `clientes.ts`: esa interfaz es sólo el núcleo de chat (login/sendChat/sendAudio/sendFoto/getReply/
 * warm), el resto de la superficie son funciones exportadas directas.
 *
 * Errores (422 texto vacío / >2000 chars, y los mismos códigos de `/chat/audio` para la voz —
 * 413/503/502/422) llegan como `ApiError` con `.detail` mostrable tal cual — el caller no reinterpreta.
 */

/** `texto.trim()` vacío o `>2000` chars → 422 del backend (mismo criterio que el resto de la API: la
 * app no duplica la validación, sólo muestra el `detail` que ya viene explicado). */
export function enviarFeedback(texto: string, contexto?: string): Promise<EnviarFeedbackResponse> {
  return apiClient.post<EnviarFeedbackResponse>('/feedback', {
    texto,
    ...(contexto !== undefined ? { contexto } : {}),
  });
}

/** `audio` es OPACO al core (`ArchivoSubida`) — mismo criterio que `sendAudio`/`sendFoto`: el
 * adaptador de cada plataforma sabe adjuntarlo al multipart real. */
export function enviarFeedbackAudio(
  audio: ArchivoSubida,
  contexto?: string,
): Promise<EnviarFeedbackAudioResponse> {
  return postMultipart<EnviarFeedbackAudioResponse>(
    '/feedback/audio',
    contexto !== undefined ? { contexto } : {},
    'audio',
    audio,
  );
}

/**
 * `GET /feedback` (K-08, BL-J12) — el feedback PROPIO del tenant autenticado, más nuevo primero, con
 * su estado «escuchado» (lo marca el equipo desde la consola de admin). El backend filtra siempre por
 * `cliente_id`; acá no se reinterpreta nada.
 *
 * Tolerante por diseño (mismo criterio que el resto del core): un item sin `escuchado` cuenta como NO
 * escuchado (`false`, nunca «escuchado por omisión»); `escuchadoEn` ausente → `null`; un item sin `id`
 * o sin `texto` string se descarta en vez de romper la lista.
 */
export interface FeedbackPropio {
  id: number;
  tipo: string;
  texto: string;
  contexto: string | null;
  creadoEn: string | null;
  escuchado: boolean;
  escuchadoEn: string | null;
}

interface FeedbackPropioCrudo {
  id?: unknown;
  tipo?: unknown;
  texto?: unknown;
  contexto?: unknown;
  created_at?: unknown;
  escuchado?: unknown;
  escuchado_en?: unknown;
}

const comoTextoONull = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null);

export async function listarFeedbackPropio(): Promise<FeedbackPropio[]> {
  const res = await apiClient.get<{ items?: FeedbackPropioCrudo[] }>('/feedback');
  const out: FeedbackPropio[] = [];
  for (const it of res?.items ?? []) {
    if (typeof it.id !== 'number' || typeof it.texto !== 'string') continue;
    out.push({
      id: it.id,
      tipo: typeof it.tipo === 'string' ? it.tipo : 'texto',
      texto: it.texto,
      contexto: comoTextoONull(it.contexto),
      creadoEn: comoTextoONull(it.created_at),
      escuchado: it.escuchado === true,
      escuchadoEn: comoTextoONull(it.escuchado_en),
    });
  }
  return out;
}

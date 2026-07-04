import { clearToken, getToken } from '../../auth/session';
import { ApiError, ForbiddenError, UnauthorizedError } from './client';
import type { SendAudioResponse } from './types';

/** Vacío = mismo-origen — mismo criterio que `client.ts` (ver ese archivo, vite-env.d.ts). */
const API_BASE = import.meta.env.VITE_API_BASE ?? '';

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

/**
 * POST /chat/audio (multipart/form-data) — Bearer requerido (Task 19, FASE 4). Contrato: campos
 * `session_id` (form) + `audio` (blob webm/mp4, filename `voz.webm`) -> `{wf_id, accepted,
 * transcript}`.
 *
 * NO reusa `apiClient.post` de `client.ts`: ese helper fuerza `Content-Type: application/json` +
 * `JSON.stringify(body)` (client.ts, función `request`), incompatible con un body `FormData` — el
 * browser tiene que setear el `Content-Type: multipart/form-data; boundary=…` él mismo; pisarlo a
 * mano rompe el parseo del boundary en el backend. `client.ts` queda fuera de mi ownership en este
 * sprint ("el resto de lib/api salvo lo indicado"), así que este archivo replica el mapeo mínimo
 * de errores (401/403/genérico) en vez de tocarlo — es una duplicación chica y visible (~15 líneas),
 * candidato a extraer a un `apiClient.postForm` compartido la próxima vez que alguien toque
 * `client.ts` (documentado en el report de este sprint).
 */
export async function sendAudio(sessionId: string, blob: Blob): Promise<SendAudioResponse> {
  const form = new FormData();
  form.append('session_id', sessionId);
  form.append('audio', blob, 'voz.webm');

  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}/chat/audio`, {
    method: 'POST',
    headers,
    body: form,
  });

  if (res.ok) return (await res.json()) as SendAudioResponse;

  const detail = await readErrorDetail(res);

  if (res.status === 401) {
    clearToken();
    throw new UnauthorizedError(detail);
  }
  if (res.status === 403) {
    throw new ForbiddenError(detail);
  }
  throw new ApiError(res.status, detail ?? `Error HTTP ${res.status}`, detail);
}

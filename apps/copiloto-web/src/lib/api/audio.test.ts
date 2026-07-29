import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getToken, setRefreshToken, setToken } from '../../auth/session';
import { ApiError, ForbiddenError, UnauthorizedError } from './client';
import { sendAudio } from './audio';

function mockResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as Response;
}

describe('sendAudio — POST /chat/audio (multipart)', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    window.localStorage.clear();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('arma un FormData con session_id + audio y postea con Bearer, SIN Content-Type manual', async () => {
    setToken('tok-123');
    const blob = new Blob(['fake-audio-bytes'], { type: 'audio/webm' });
    fetchMock.mockResolvedValueOnce(
      mockResponse(200, { wf_id: 'wf-1', accepted: true, transcript: 'Mandale un mail a Juan' }),
    );

    const result = await sendAudio('sid-abc', blob);

    expect(result).toEqual({ wf_id: 'wf-1', accepted: true, transcript: 'Mandale un mail a Juan' });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/chat/audio');
    expect(init.method).toBe('POST');

    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer tok-123');
    expect(headers['Content-Type']).toBeUndefined(); // el browser pone el boundary, no nosotros

    const body = init.body as FormData;
    expect(body).toBeInstanceOf(FormData);
    expect(body.get('session_id')).toBe('sid-abc');
    const audioField = body.get('audio');
    expect(audioField).toBeInstanceOf(Blob);
    expect((audioField as File).name).toBe('voz.webm');
  });

  it('mapea 401 a UnauthorizedError y limpia el token propio', async () => {
    setToken('tok-expirado');
    fetchMock.mockResolvedValueOnce(mockResponse(401, { detail: 'expirado' }));

    await expect(sendAudio('sid', new Blob())).rejects.toBeInstanceOf(UnauthorizedError);
    expect(window.localStorage.getItem('copiloto-token')).toBeNull();
  });

  it('mapea 403 a ForbiddenError sin tocar el token', async () => {
    setToken('tok-valido');
    fetchMock.mockResolvedValueOnce(mockResponse(403, { detail: 'sin tenant' }));

    await expect(sendAudio('sid', new Blob())).rejects.toBeInstanceOf(ForbiddenError);
    expect(window.localStorage.getItem('copiloto-token')).toBe('tok-valido');
  });

  it('otros status no-ok mapean a ApiError genérico con el status HTTP', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse(500, { detail: 'boom' }));

    const error = (await sendAudio('sid', new Blob()).catch((err: unknown) => err)) as ApiError;
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(500);
  });

  it('EL QUE IMPORTA: token vencido a mitad del dictado → refresca y reintenta CON el mismo audio, no lo pierde', async () => {
    setToken('tok-viejo');
    setRefreshToken('rt-viejo');
    fetchMock
      .mockResolvedValueOnce(mockResponse(401, { detail: 'expirado' })) // request original
      .mockResolvedValueOnce(
        mockResponse(200, { access_token: 'tok-nuevo', refresh_token: 'rt-nuevo' }),
      ) // POST /auth/refresh
      .mockResolvedValueOnce(
        mockResponse(200, { wf_id: 'wf-1', accepted: true, transcript: 'Mandale un mail a Juan' }),
      ); // reintento

    const blob = new Blob(['fake-audio-bytes'], { type: 'audio/webm' });
    const result = await sendAudio('sid-abc', blob);

    expect(result).toEqual({ wf_id: 'wf-1', accepted: true, transcript: 'Mandale un mail a Juan' });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(getToken()).toBe('tok-nuevo');

    // El reintento (3ª llamada) debe llevar el MISMO FormData que la request original (1ª) — el
    // audio no se descarta ni se re-crea entre el 401 y el reintento.
    const original = fetchMock.mock.calls[0] as [string, RequestInit];
    const reintento = fetchMock.mock.calls[2] as [string, RequestInit];
    expect(reintento[1].body).toBe(original[1].body);
    expect((reintento[1].body as FormData).get('audio')).toBeInstanceOf(Blob);
  });
});

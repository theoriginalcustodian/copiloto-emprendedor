import { afterEach, describe, expect, it, vi } from 'vitest';

import { apiClient } from './client';
import { getReply } from './reply';

afterEach(() => vi.restoreAllMocks());

describe('getReply — normaliza el shape crudo del backend', () => {
  it('mapea reply_text -> text y choices null -> undefined (shape real de /reply)', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
      replies: [
        { id: 140, reply_text: '¡Hola! Puedo ayudarte…', choices: null, created_at: '2026-07-04 02:49:38+00:00' },
      ],
      next_id: 140,
    });

    const res = await getReply('sid-123', 0);

    expect(res).toEqual({
      replies: [{ id: 140, text: '¡Hola! Puedo ayudarte…', choices: undefined }],
      next_id: 140,
    });
  });

  it('preserva choices cuando el backend los manda (HITL/desambiguación)', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
      replies: [
        { id: 5, reply_text: 'Tenés dos Juan', choices: [{ label: 'Juan Pérez', value: 'p1' }], created_at: 'x' },
      ],
      next_id: 5,
    });

    const res = await getReply('sid', 4);

    expect(res.replies[0].choices).toEqual([{ label: 'Juan Pérez', value: 'p1' }]);
  });

  it('pasa session_id y after_id como query params', async () => {
    const spy = vi.spyOn(apiClient, 'get').mockResolvedValueOnce({ replies: [], next_id: 0 });
    await getReply('abc', 12);
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('session_id=abc'));
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('after_id=12'));
  });
});

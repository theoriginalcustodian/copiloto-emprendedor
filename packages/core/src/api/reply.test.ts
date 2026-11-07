import { describe, expect, it, vi } from 'vitest';

const get = vi.fn(async (_path: string) => ({ replies: [], next_id: 0 }));
vi.mock('./client', () => ({ apiClient: { get: (p: string) => get(p) } }));

import { getReply } from './reply';

describe('getReply long-poll', () => {
  it('sin waitS manda la request de siempre (contrato viejo)', async () => {
    await getReply('s1', 4);
    expect(get).toHaveBeenLastCalledWith('/reply?session_id=s1&after_id=4');
  });

  it('con waitS agrega wait', async () => {
    await getReply('s1', 4, 15);
    expect(get).toHaveBeenLastCalledWith('/reply?session_id=s1&after_id=4&wait=15');
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';

import { apiClient } from './client';
import { warm } from './warm';

afterEach(() => vi.restoreAllMocks());

describe('warm — precalienta la memoria de largo plazo (best-effort)', () => {
  it('hace POST a /warm (sin body: el cliente_id sale del token en el backend)', async () => {
    const spy = vi.spyOn(apiClient, 'post').mockResolvedValueOnce({ warmed: true });

    const res = await warm();

    expect(spy).toHaveBeenCalledWith('/warm');
    expect(res).toEqual({ warmed: true });
  });

  it('propaga warmed:false tal cual (memoria off / Graphity degradado en el backend)', async () => {
    vi.spyOn(apiClient, 'post').mockResolvedValueOnce({ warmed: false });

    const res = await warm();

    expect(res).toEqual({ warmed: false });
  });
});

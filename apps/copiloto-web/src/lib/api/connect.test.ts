import { afterEach, describe, expect, it, vi } from 'vitest';

import { apiClient } from './client';
import { getConnect } from './connect';

afterEach(() => vi.restoreAllMocks());

describe('getConnect — data-driven, no bifurca por proveedor', () => {
  it('hace GET exacto al connect_path que le pasan (Mercado Pago)', async () => {
    const spy = vi.spyOn(apiClient, 'get').mockResolvedValueOnce({ url: 'https://mp.example/oauth' });
    const res = await getConnect('/mp/connect');
    expect(spy).toHaveBeenCalledWith('/mp/connect');
    expect(res).toEqual({ url: 'https://mp.example/oauth' });
  });

  it('hace GET exacto al connect_path que le pasan (Composio, con querystring)', async () => {
    const spy = vi.spyOn(apiClient, 'get').mockResolvedValueOnce({ url: 'https://composio.example/oauth' });
    const res = await getConnect('/composio/connect?service=gmail');
    expect(spy).toHaveBeenCalledWith('/composio/connect?service=gmail');
    expect(res).toEqual({ url: 'https://composio.example/oauth' });
  });
});

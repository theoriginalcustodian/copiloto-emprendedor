import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/api')>();
  return {
    ...actual,
    api: {
      login: vi.fn(),
      me: vi.fn(),
      catalog: vi.fn(),
      connect: vi.fn(),
      sendChat: vi.fn(),
      getReply: vi.fn(),
    },
  };
});

import type { CatalogService } from '../../lib/api';
import { api } from '../../lib/api';
import { useConnections } from './useConnections';

const GMAIL: CatalogService = {
  key: 'gmail',
  display_name: 'Gmail',
  work_label: 'Mandar y leer emails',
  category: 'comunicacion',
  kind: 'composio',
  description: 'Conectá tu Gmail.',
  capabilities: ['send_email'],
  connected: true,
  connect_path: '/composio/connect?service=gmail',
};

const MERCADOPAGO: CatalogService = {
  key: 'mercadopago',
  display_name: 'Mercado Pago',
  work_label: 'Cobrar',
  category: 'pagos',
  kind: 'mercadopago',
  description: 'Conectá tu cuenta de Mercado Pago.',
  capabilities: ['create_charge'],
  connected: false,
  connect_path: '/mp/connect',
};

describe('useConnections', () => {
  beforeEach(() => {
    vi.mocked(api.catalog).mockReset();
    vi.mocked(api.connect).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('carga el catálogo al montar y expone services/groups/contadores', async () => {
    vi.mocked(api.catalog).mockResolvedValueOnce({ services: [GMAIL, MERCADOPAGO] });

    const { result } = renderHook(() => useConnections());

    expect(result.current.status).toBe('loading');

    await waitFor(() => expect(result.current.status).toBe('ready'));

    expect(result.current.services).toEqual([GMAIL, MERCADOPAGO]);
    expect(result.current.connectedCount).toBe(1);
    expect(result.current.totalCount).toBe(2);
    expect(result.current.groups).toEqual([
      { category: 'comunicacion', services: [GMAIL] },
      { category: 'pagos', services: [MERCADOPAGO] },
    ]);
    expect(api.catalog).toHaveBeenCalledTimes(1);
  });

  it('catalog que falla al montar deja status=error', async () => {
    vi.mocked(api.catalog).mockRejectedValueOnce(new Error('network down'));

    const { result } = renderHook(() => useConnections());

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.services).toEqual([]);
  });

  it('connect(service) llama a api.connect con el connect_path correcto y devuelve la url', async () => {
    vi.mocked(api.catalog).mockResolvedValueOnce({ services: [GMAIL, MERCADOPAGO] });
    vi.mocked(api.connect).mockResolvedValueOnce({ url: 'https://mp.example/oauth/xyz' });

    const { result } = renderHook(() => useConnections());
    await waitFor(() => expect(result.current.status).toBe('ready'));

    let url = '';
    await act(async () => {
      url = await result.current.connect(MERCADOPAGO);
    });

    expect(api.connect).toHaveBeenCalledWith('/mp/connect');
    expect(url).toBe('https://mp.example/oauth/xyz');
  });

  it('refresh() vuelve a pedir el catálogo', async () => {
    vi.mocked(api.catalog)
      .mockResolvedValueOnce({ services: [GMAIL] })
      .mockResolvedValueOnce({ services: [GMAIL, MERCADOPAGO] });

    const { result } = renderHook(() => useConnections());
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.totalCount).toBe(1);

    await act(async () => {
      await result.current.refresh();
    });

    expect(api.catalog).toHaveBeenCalledTimes(2);
    expect(result.current.totalCount).toBe(2);
  });
});

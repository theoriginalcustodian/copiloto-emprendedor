import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { listarFeedbackPropio } = vi.hoisted(() => ({ listarFeedbackPropio: vi.fn() }));

vi.mock('@copiloto/core', async (orig) => ({
  ...(await orig<typeof import('@copiloto/core')>()),
  listarFeedbackPropio,
}));

import { LoPedisteVos } from './LoPedisteVos';

const item = (id: number, escuchado: boolean, texto = `pedido ${id}`) => ({
  id,
  tipo: 'texto',
  texto,
  contexto: null,
  creadoEn: '2026-09-20T14:00:00Z',
  escuchado,
  escuchadoEn: escuchado ? '2026-09-21T09:00:00Z' : null,
});

describe('LoPedisteVos (BL-J12, K-08)', () => {
  beforeEach(() => listarFeedbackPropio.mockReset());

  it('muestra cada pedido con su estado: «Escuchado» sólo si el equipo lo marcó', async () => {
    listarFeedbackPropio.mockResolvedValue([item(42, true, 'más rápido'), item(41, false, 'modo oscuro')]);
    render(<LoPedisteVos />);

    expect(await screen.findByTestId('lo-pediste-vos')).toHaveTextContent('Lo pediste vos');
    expect(screen.getByTestId('lo-pediste-vos-42')).toHaveTextContent('más rápido');
    expect(screen.getByTestId('lo-pediste-vos-42-escuchado')).toHaveTextContent('Escuchado');
    expect(screen.getByTestId('lo-pediste-vos-41')).toHaveTextContent('modo oscuro');
    expect(screen.queryByTestId('lo-pediste-vos-41-escuchado')).toBeNull();
    expect(screen.getByTestId('lo-pediste-vos-41-pendiente')).toHaveTextContent('Enviado');
  });

  it('fail-soft: sin pedidos o con el endpoint caído no dibuja nada', async () => {
    listarFeedbackPropio.mockResolvedValueOnce([]);
    const a = render(<LoPedisteVos />);
    await waitFor(() => expect(listarFeedbackPropio).toHaveBeenCalledTimes(1));
    expect(a.container).toBeEmptyDOMElement();
    a.unmount();

    listarFeedbackPropio.mockRejectedValueOnce(new Error('500'));
    const b = render(<LoPedisteVos />);
    await waitFor(() => expect(listarFeedbackPropio).toHaveBeenCalledTimes(2));
    expect(b.container).toBeEmptyDOMElement();
  });

  it('al subir `version` vuelve a pedir la lista (un envío nuevo aparece sin recargar)', async () => {
    listarFeedbackPropio.mockResolvedValueOnce([item(1, false)]);
    const r = render(<LoPedisteVos version={0} />);
    await screen.findByTestId('lo-pediste-vos-1');

    listarFeedbackPropio.mockResolvedValueOnce([item(2, false), item(1, false)]);
    r.rerender(<LoPedisteVos version={1} />);
    expect(await screen.findByTestId('lo-pediste-vos-2')).toBeInTheDocument();
  });
});

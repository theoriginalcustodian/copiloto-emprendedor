import { act, render, screen, waitFor } from '@testing-library/react-native';

jest.mock('@copiloto/core', () => {
  const actual = jest.requireActual('@copiloto/core');
  return { ...actual, listarFeedbackPropio: jest.fn() };
});

import { listarFeedbackPropio, type FeedbackPropio } from '@copiloto/core';

import { ThemeProvider } from '../../theme/ThemeProvider';
import { LoPedisteVos } from './LoPedisteVos';

const item = (o: Partial<FeedbackPropio>): FeedbackPropio => ({
  id: 1,
  tipo: 'texto',
  texto: 'que el gasto tenga foto',
  contexto: null,
  creadoEn: '2026-09-20T10:00:00Z',
  escuchado: false,
  escuchadoEn: null,
  ...o,
});

const montar = () =>
  render(
    <ThemeProvider>
      <LoPedisteVos />
    </ThemeProvider>,
  );

describe('LoPedisteVos', () => {
  beforeEach(() => jest.mocked(listarFeedbackPropio).mockReset());

  it('muestra «Escuchado» sólo en el escuchado y «Enviado» en el resto', async () => {
    jest
      .mocked(listarFeedbackPropio)
      .mockResolvedValue([item({ id: 1, escuchado: true }), item({ id: 2, texto: 'otro' })]);
    await montar();
    await waitFor(() => expect(screen.getByTestId('lo-pediste-vos-1-escuchado')).toBeTruthy());
    expect(screen.getByTestId('lo-pediste-vos-2-pendiente')).toBeTruthy();
    expect(screen.queryByTestId('lo-pediste-vos-2-escuchado')).toBeNull();
  });

  it('fail-soft: sin items no dibuja nada', async () => {
    jest.mocked(listarFeedbackPropio).mockResolvedValue([]);
    await montar();
    // `toHaveBeenCalled()` se satisface en cuanto el efecto INVOCA el mock, antes de que su promesa
    // resuelva — la aserción de abajo (nada visible) pasa igual "por casualidad" sin haber esperado
    // el `.then()` del componente, y esa promesa puede terminar de resolver YA en el test siguiente
    // (flake reportado por backend: `screen` sin `render` vigente, `setItems` fuera de `act`). Un
    // `act(async () => {})` fuerza a que el microtask del efecto corra ACÁ, dentro de este test.
    await waitFor(() => expect(listarFeedbackPropio).toHaveBeenCalled());
    await act(async () => {});
    expect(screen.queryByTestId('lo-pediste-vos')).toBeNull();
  });

  it('fail-soft: si el endpoint falla no dibuja nada ni lanza', async () => {
    jest.mocked(listarFeedbackPropio).mockRejectedValue(new Error('500'));
    await montar();
    await waitFor(() => expect(listarFeedbackPropio).toHaveBeenCalled());
    await act(async () => {}); // mismo cierre de carrera que el test de arriba, ver su comentario.
    expect(screen.queryByTestId('lo-pediste-vos')).toBeNull();
  });
});

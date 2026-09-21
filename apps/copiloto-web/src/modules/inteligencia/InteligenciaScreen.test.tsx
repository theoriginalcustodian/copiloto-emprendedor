import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { leerPortada } = vi.hoisted(() => ({ leerPortada: vi.fn() }));

vi.mock('@copiloto/core', async (orig) => ({
  ...(await orig<typeof import('@copiloto/core')>()),
  leerPortada,
}));
vi.mock('./ChatInteligencia', () => ({ ChatInteligencia: () => null }));
vi.mock('./graficos/GraficosInteligencia', () => ({ GraficosInteligencia: () => null }));

import { InteligenciaScreen } from './InteligenciaScreen';

const PORTADA = {
  caja: { saldo: '184000.00', moneda: 'ARS', fechaCorte: null, variacionPct: null },
  mes: { ingresos: '95000.00', gastos: '31000.00', rentabilidad: '64000.00', facturado: '120000.00', cobrado: '90000.00' },
  serieMensual: [],
  mejoresClientes: [],
  porCobrar: { total: '0', vencido: '0' },
};

describe('InteligenciaScreen — estado textual del refresco (BL-W6)', () => {
  beforeEach(() => {
    leerPortada.mockReset();
    leerPortada.mockResolvedValue({ status: 'ok', portada: PORTADA });
  });

  it('Actualizando… mientras carga y «Al día · recién» al terminar', async () => {
    render(<InteligenciaScreen />);
    await screen.findByTestId('inteligencia-actualizar');
    const estado = screen.getByTestId('inteligencia-refresco-estado');
    expect(estado).toHaveTextContent('');

    let liberar: () => void = () => undefined;
    leerPortada.mockImplementationOnce(
      () => new Promise((res) => { liberar = () => res({ status: 'ok', portada: PORTADA }); }),
    );
    fireEvent.click(screen.getByTestId('inteligencia-actualizar'));
    await waitFor(() => expect(estado).toHaveTextContent('Actualizando…'));
    expect(screen.getByTestId('inteligencia-actualizar')).toBeDisabled();

    await act(async () => liberar());
    await waitFor(() => expect(estado).toHaveTextContent('Al día · recién'));
  });

  it('el estado se anuncia (role=status) y web no ofrece «Tirá»/«Soltá»', async () => {
    render(<InteligenciaScreen />);
    await screen.findByTestId('inteligencia-actualizar');
    expect(screen.getByRole('status')).toBe(screen.getByTestId('inteligencia-refresco-estado'));
    expect(document.body.textContent).not.toMatch(/Tirá para|Soltá para/);
  });
});

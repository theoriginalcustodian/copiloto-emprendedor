import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { leerPortada } = vi.hoisted(() => ({ leerPortada: vi.fn() }));

vi.mock('@copiloto/core', async (orig) => ({
  ...(await orig<typeof import('@copiloto/core')>()),
  leerPortada,
}));
vi.mock('./AcumuladoAnual', () => ({ AcumuladoAnual: () => <div data-testid="acumulado-mock" /> }));
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
    render(<InteligenciaScreen onAbrirChat={() => {}} />);
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
    render(<InteligenciaScreen onAbrirChat={() => {}} />);
    await screen.findByTestId('inteligencia-actualizar');
    expect(screen.getByRole('status')).toBe(screen.getByTestId('inteligencia-refresco-estado'));
    expect(document.body.textContent).not.toMatch(/Tirá para|Soltá para/);
  });
});

describe('InteligenciaScreen — acumulado del año fusionado (BL-X2)', () => {
  it('monta «Acumulado del año» dentro del resumen (ya no hay pantalla Contabilidad)', async () => {
    leerPortada.mockResolvedValue({ status: 'ok', portada: PORTADA });
    render(<InteligenciaScreen onAbrirChat={() => {}} />);
    expect(await screen.findByTestId('acumulado-mock')).toBeInTheDocument();
  });
});

describe('InteligenciaScreen — «Preguntar» es una SALIDA al chat (decisión táctica 2026-10-13)', () => {
  beforeEach(() => {
    leerPortada.mockReset();
    leerPortada.mockResolvedValue({ status: 'ok', portada: PORTADA });
  });

  it('tocar «Preguntar» abre el chat y NO cambia de cuerpo: la portada sigue ahí', async () => {
    const onAbrirChat = vi.fn();
    render(<InteligenciaScreen onAbrirChat={onAbrirChat} />);
    await screen.findByTestId('inteligencia-caja');

    fireEvent.click(screen.getByTestId('inteligencia-solapa-preguntar'));

    expect(onAbrirChat).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('inteligencia-caja')).toBeInTheDocument();
    expect(screen.queryByTestId('preguntar-inteligencia-input')).toBeNull();
  });

  it('🔴 CONTROL — «Resumen» (la pantalla actual) no es un botón y no navega', async () => {
    const onAbrirChat = vi.fn();
    render(<InteligenciaScreen onAbrirChat={onAbrirChat} />);
    await screen.findByTestId('inteligencia-caja');

    const resumen = screen.getByTestId('inteligencia-solapa-resumen');
    fireEvent.click(resumen);

    expect(resumen).toHaveAttribute('aria-current', 'page');
    expect(resumen.tagName).not.toBe('BUTTON');
    expect(onAbrirChat).not.toHaveBeenCalled();
  });
});

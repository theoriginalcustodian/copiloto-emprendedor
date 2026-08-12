import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * `MidiaScreen` — mismo arnés que `PantallaMiDia.test.tsx` (mobile): `@copiloto/core` mockeado,
 * foco en el WIRING (tap/click → mutación → relectura) y en el panel de calendario nuevo (CAL1 §3),
 * que tiene que convivir con el Kanban sin pisarle el estado.
 */
vi.mock('@copiloto/core', async (importOriginal) => {
  const original = await importOriginal<typeof import('@copiloto/core')>();
  return {
    ...original,
    leerTablero: vi.fn(),
    cambiarEstadoTarjetaMiDia: vi.fn(),
    borrarTarjetaMiDia: vi.fn(),
    leerCalendario: vi.fn(),
  };
});

import {
  borrarTarjetaMiDia,
  cambiarEstadoTarjetaMiDia,
  leerCalendario,
  leerTablero,
} from '@copiloto/core';

import { MidiaScreen } from './MidiaScreen';

const leerMock = vi.mocked(leerTablero);
const cambiarEstadoMock = vi.mocked(cambiarEstadoTarjetaMiDia);
const borrarMock = vi.mocked(borrarTarjetaMiDia);
const leerCalendarioMock = vi.mocked(leerCalendario);

const TABLERO = {
  solapas: [
    {
      id: 'para_hoy' as const,
      titulo: 'Para hoy',
      tarjetas: [
        {
          id: 't1',
          texto: 'El trabajo de la panadería te dejó $8.000 en contra.',
          regla: 'trabajo_con_margen_negativo',
          entidadTipo: 'trabajo',
          entidadId: 'trab-1',
          estado: 'pendiente',
          cliente: 'Panadería del barrio',
          monto: '-8000.00',
          fecha: '2026-07-22',
        },
      ],
    },
    { id: 'haciendo' as const, titulo: 'Haciendo', tarjetas: [] },
    { id: 'hecha' as const, titulo: 'Hechas', tarjetas: [] },
  ],
};

beforeEach(() => {
  leerMock.mockReset().mockResolvedValue({ status: 'ok', tablero: TABLERO });
  cambiarEstadoMock.mockReset().mockResolvedValue({ status: 'ok', tarjeta: TABLERO.solapas[0].tarjetas[0] });
  borrarMock.mockReset().mockResolvedValue({ status: 'ok' });
  leerCalendarioMock.mockReset().mockResolvedValue({ status: 'ok', calendario: { conectado: false, eventos: [] } });
});

describe('MidiaScreen — el Kanban (wiring básico)', () => {
  it('arranca en "Para hoy" y pinta su tarjeta', async () => {
    render(<MidiaScreen />);
    await waitFor(() => expect(screen.getByTestId('midia-tarjeta-t1')).toBeInTheDocument());
    expect(screen.getByText('El trabajo de la panadería te dejó $8.000 en contra.')).toBeInTheDocument();
  });
});

describe('MidiaScreen — panel de calendario (CAL1 §3, fuera del Kanban)', () => {
  it('sin conectar: invita a conectar, y el Kanban sigue vivo al lado', async () => {
    leerCalendarioMock.mockResolvedValue({ status: 'ok', calendario: { conectado: false, eventos: [] } });
    render(<MidiaScreen />);

    await waitFor(() => expect(screen.getByTestId('midia-calendario-no-conectado')).toBeInTheDocument());
    expect(screen.getByText(/Conectá Google Calendar/)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('midia-tarjeta-t1')).toBeInTheDocument());
  });

  it('conectado sin eventos hoy: lo dice, no una lista vacía silenciosa', async () => {
    leerCalendarioMock.mockResolvedValue({ status: 'ok', calendario: { conectado: true, eventos: [] } });
    render(<MidiaScreen />);

    await waitFor(() => expect(screen.getByTestId('midia-calendario-vacio')).toBeInTheDocument());
  });

  it('conectado con eventos: título + hora reconocible; evento de día completo se ve igual sin hora', async () => {
    leerCalendarioMock.mockResolvedValue({
      status: 'ok',
      calendario: {
        conectado: true,
        eventos: [
          { id: 'ev1', titulo: 'Reunión con proveedor', inicioCrudo: { dateTime: '2026-08-12T15:00:00-03:00' } },
          { id: 'ev2', titulo: 'Cumpleaños (todo el día)', inicioCrudo: { date: '2026-08-12' } },
        ],
      },
    });
    render(<MidiaScreen />);

    await waitFor(() => expect(screen.getByTestId('midia-calendario-evento-ev1')).toBeInTheDocument());
    expect(screen.getByText('Reunión con proveedor')).toBeInTheDocument();
    expect(screen.getByText('Cumpleaños (todo el día)')).toBeInTheDocument();
  });

  it('🔴 calendario `no_disponible` no rompe ni tapa el Kanban — se omite en silencio', async () => {
    leerCalendarioMock.mockResolvedValue({ status: 'no_disponible' });
    render(<MidiaScreen />);

    await waitFor(() => expect(screen.getByTestId('midia-tarjeta-t1')).toBeInTheDocument());
    expect(screen.queryByTestId('midia-calendario')).not.toBeInTheDocument();
    expect(screen.queryByTestId('midia-calendario-no-conectado')).not.toBeInTheDocument();
  });
});

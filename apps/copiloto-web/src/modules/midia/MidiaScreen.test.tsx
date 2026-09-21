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
    leerPortada: vi.fn(),
  };
});

import {
  CLAVE_DIAS_CALMA,
  borrarTarjetaMiDia,
  cambiarEstadoTarjetaMiDia,
  leerCalendario,
  leerPortada,
  leerTablero,
} from '@copiloto/core';

import { MidiaScreen } from './MidiaScreen';

const leerMock = vi.mocked(leerTablero);
const cambiarEstadoMock = vi.mocked(cambiarEstadoTarjetaMiDia);
const borrarMock = vi.mocked(borrarTarjetaMiDia);
const leerCalendarioMock = vi.mocked(leerCalendario);
const leerPortadaMock = vi.mocked(leerPortada);

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
  leerPortadaMock.mockReset().mockResolvedValue({ status: 'no_disponible' });
  window.localStorage.clear();
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

const PORTADA = {
  caja: { saldo: '125000.00', moneda: 'ARS', fechaCorte: null, variacionPct: null },
  mes: { ingresos: '300000.00', gastos: null, rentabilidad: null, facturado: null, cobrado: null },
  serieMensual: [],
  mejoresClientes: [],
  porCobrar: { total: null, vencido: null },
};

describe('MidiaScreen — portada del negocio (BL-W8)', () => {
  it('muestra la caja y el trío; un dato ausente es «—», nunca «$0»', async () => {
    leerPortadaMock.mockResolvedValue({ status: 'ok', portada: PORTADA });
    render(<MidiaScreen />);
    await waitFor(() => expect(screen.getByTestId('midia-portada')).toBeInTheDocument());
    expect(screen.getByTestId('midia-portada-caja')).not.toHaveTextContent('—');
    expect(screen.getByTestId('midia-portada-salio')).toHaveTextContent('—');
    expect(screen.getByTestId('midia-portada-por-cobrar')).toHaveTextContent('—');
    expect(screen.getByTestId('midia-portada-salio')).not.toHaveTextContent('$0');
  });

  it('sin portada la pantalla sigue viva (degrada sola)', async () => {
    leerPortadaMock.mockRejectedValue(new Error('red'));
    render(<MidiaScreen />);
    await waitFor(() => expect(screen.getByTestId('midia-tarjeta-t1')).toBeInTheDocument());
    expect(screen.queryByTestId('midia-portada')).not.toBeInTheDocument();
  });
});

describe('MidiaScreen — chips y contador (BL-W7)', () => {
  it('el contador cuenta para hoy y en curso; los chips filtran y el vacío por filtro lo dice', async () => {
    render(<MidiaScreen />);
    await waitFor(() => expect(screen.getByTestId('midia-tarjeta-t1')).toBeInTheDocument());
    expect(screen.getByTestId('midia-contador')).toHaveTextContent('1 para hoy · 0 en curso');

    // t1 es de la regla trabajo_con_margen_negativo, sin categoría propia: sólo se ve en «Todo».
    fireEvent.click(screen.getByTestId('midia-chip-arca'));
    expect(screen.queryByTestId('midia-tarjeta-t1')).not.toBeInTheDocument();
    expect(screen.getByTestId('midia-vacio-filtro-titulo')).toHaveTextContent(/Nada en .* por acá/);

    fireEvent.click(screen.getByTestId('midia-chip-todo'));
    expect(screen.getByTestId('midia-tarjeta-t1')).toBeInTheDocument();
  });
});

describe('MidiaScreen — vacío con Calma (BL-W5)', () => {
  const VACIO = { solapas: TABLERO.solapas.map((s) => ({ ...s, tarjetas: [] })) };

  it('«Para hoy» vacío muestra la taza y la explicación', async () => {
    leerMock.mockResolvedValue({ status: 'ok', tablero: VACIO });
    render(<MidiaScreen />);
    await waitFor(() => expect(screen.getByTestId('midia-vacio-titulo')).toHaveTextContent('Nada urgente por hoy'));
    expect(screen.getByTestId('midia-vacio-taza')).toBeInTheDocument();
    expect(screen.getByTestId('midia-vacio-cuerpo')).toBeInTheDocument();
  });

  it('las otras solapas vacías van sin taza', async () => {
    leerMock.mockResolvedValue({ status: 'ok', tablero: VACIO });
    render(<MidiaScreen />);
    await waitFor(() => expect(screen.getByTestId('midia-vacio')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('midia-solapa-hecha'));
    expect(screen.getByTestId('midia-vacio-titulo')).toHaveTextContent('No hay tarjetas acá todavía.');
    expect(screen.queryByTestId('midia-vacio-taza')).not.toBeInTheDocument();
  });

  it('tras N días distintos la explicación se retira; título y taza quedan', async () => {
    window.localStorage.setItem(CLAVE_DIAS_CALMA, JSON.stringify(['2020-01-01', '2020-01-02', '2020-01-03']));
    leerMock.mockResolvedValue({ status: 'ok', tablero: VACIO });
    render(<MidiaScreen />);
    await waitFor(() => expect(screen.getByTestId('midia-vacio-titulo')).toBeInTheDocument());
    await waitFor(() => expect(screen.queryByTestId('midia-vacio-cuerpo')).not.toBeInTheDocument());
    expect(screen.getByTestId('midia-vacio-taza')).toBeInTheDocument();
  });
});

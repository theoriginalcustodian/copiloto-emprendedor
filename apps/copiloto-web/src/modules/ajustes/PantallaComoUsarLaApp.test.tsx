import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@copiloto/core', async (importOriginal) => {
  const original = await importOriginal<typeof import('@copiloto/core')>();
  return {
    ...original,
    leerCapacidades: vi.fn(),
  };
});

import { leerCapacidades, tomarPendiente, TEMAS_AYUDA, type GuiaCapacidades } from '@copiloto/core';

import { PantallaComoUsarLaApp } from './PantallaComoUsarLaApp';

const mockCapacidades = vi.mocked(leerCapacidades);

const GUIA: GuiaCapacidades = {
  capacidades: [{ tool: 'anotar_gasto', rotulo: 'Gastos', ejemplos: ['gasté 15 lucas en nafta'] }],
  fechas: { entiendo: ['ayer', 'el martes'], siNoEsta: 'Si no la entiendo, te la pregunto.' },
};

/**
 * `PantallaComoUsarLaApp` (BL-W12) — la fusión de `PantallaComoHablarle` (borrada) y los cinco temas
 * de la versión BL-W9. Molde: `apps/mobile/.../PantallaComoUsarLaApp.test.tsx`.
 */
describe('PantallaComoUsarLaApp — la fusión de la guía y los temas (Ola 5, BL-W12)', () => {
  beforeEach(() => {
    mockCapacidades.mockReset();
  });

  it('muestra los cinco temas del prototipo, numerados y en orden', async () => {
    mockCapacidades.mockResolvedValue({ status: 'ok', guia: GUIA });
    render(<PantallaComoUsarLaApp onAbrirChat={vi.fn()} />);

    expect(screen.getAllByTestId(/^como-usar-tema-/)).toHaveLength(5);
    TEMAS_AYUDA.forEach((t, i) => {
      expect(screen.getByTestId(`como-usar-tema-${i}`)).toHaveTextContent(t.titulo);
    });
  });

  it.each(TEMAS_AYUDA.map((t, i) => [i, t.pregunta] as const))(
    'el tema %i deja SU pregunta en el buzón y abre el chat principal',
    async (i, pregunta) => {
      mockCapacidades.mockResolvedValue({ status: 'ok', guia: GUIA });
      const onAbrirChat = vi.fn();
      render(<PantallaComoUsarLaApp onAbrirChat={onAbrirChat} />);

      fireEvent.click(screen.getByTestId(`como-usar-tema-${i}`));

      expect(onAbrirChat).toHaveBeenCalledTimes(1);
      expect(tomarPendiente()).toBe(pregunta);
    },
  );

  it('trae los ejemplos de `GET /capacidades`, no escritos a mano', async () => {
    mockCapacidades.mockResolvedValue({ status: 'ok', guia: GUIA });
    render(<PantallaComoUsarLaApp onAbrirChat={vi.fn()} />);

    await waitFor(() => expect(screen.getByTestId('como-usar-grupo-0')).toBeInTheDocument());
    expect(screen.getByTestId('como-usar-grupo-0')).toHaveTextContent(/gasté 15 lucas en nafta/);
    expect(screen.getByTestId('como-usar-fechas')).toHaveTextContent(/ayer/);
  });

  it('🔴 BL-W12: dos capacidades con el MISMO rótulo (dos "Presupuestos" del catálogo) no repiten encabezado', async () => {
    // Caso real citado en el contrato: `tool_catalog.py:369-370` publica `crear_presupuesto` y
    // `listar_presupuestos` con el mismo rótulo «Presupuestos». `PantallaComoHablarle` (borrada)
    // armaba un bloque por `tool`, así que el encabezado salía dos veces.
    mockCapacidades.mockResolvedValue({
      status: 'ok',
      guia: {
        capacidades: [
          { tool: 'crear_presupuesto', rotulo: 'Presupuestos', ejemplos: ['armame un presupuesto para Juan'] },
          { tool: 'listar_presupuestos', rotulo: 'Presupuestos', ejemplos: ['qué presupuestos tengo pendientes'] },
        ],
        fechas: { entiendo: [], siNoEsta: null },
      },
    });
    render(<PantallaComoUsarLaApp onAbrirChat={vi.fn()} />);

    await waitFor(() => expect(screen.getByTestId('como-usar-grupo-0')).toBeInTheDocument());
    expect(screen.queryByTestId('como-usar-grupo-1')).not.toBeInTheDocument(); // UN solo grupo
    expect(screen.getAllByText('Presupuestos')).toHaveLength(1); // el encabezado no se repite
    expect(screen.getByTestId('como-usar-grupo-0')).toHaveTextContent(/armame un presupuesto para Juan/);
    expect(screen.getByTestId('como-usar-grupo-0')).toHaveTextContent(/qué presupuestos tengo pendientes/);
  });

  it('🔴 si la guía no está disponible, los TEMAS siguen ahí', async () => {
    mockCapacidades.mockResolvedValue({ status: 'no_disponible' });
    render(<PantallaComoUsarLaApp onAbrirChat={vi.fn()} />);

    await waitFor(() => expect(screen.getByTestId('como-usar-no-disponible')).toBeInTheDocument());
    expect(screen.getByTestId('como-usar-tema-0')).toBeInTheDocument();
    expect(screen.getByTestId('como-usar-pie')).toBeInTheDocument();
  });

  it('lo que entra al chat es una PREGUNTA, no el título del tema', () => {
    TEMAS_AYUDA.forEach((t) => {
      expect(t.pregunta).toMatch(/\?$/);
      expect(t.pregunta).not.toBe(t.titulo);
    });
  });
});

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { SOPORTE_QUE_VIAJA, SOPORTE_TIEMPO_RESPUESTA } from '@copiloto/core';

vi.mock('../../auth/useSession', () => ({ useSession: () => ({ me: { cliente_id: 'c1' } }) }));
vi.mock('./useChatSoporte', () => ({
  useChatSoporte: () => ({ messages: [], sendStatus: 'idle', send: vi.fn(), sendAudio: vi.fn() }),
}));

import { SoporteScreen } from './SoporteScreen';

describe('SoporteScreen — encabezado (BL-W10)', () => {
  it('muestra isotipo y «Soporte de Odobi»', () => {
    render(<SoporteScreen funcion="soporte_tecnico" />);
    expect(screen.getByTestId('marca')).toBeInTheDocument();
    expect(screen.getByTestId('soporte-quien')).toHaveTextContent('Soporte de Odobi');
  });

  it('dice el tiempo de respuesta y qué viaja con el ticket', () => {
    render(<SoporteScreen funcion="soporte_tecnico" />);
    const d = screen.getByTestId('soporte-detalle');
    expect(d).toHaveTextContent(SOPORTE_TIEMPO_RESPUESTA);
    expect(d).toHaveTextContent(SOPORTE_QUE_VIAJA);
  });

  it('no promete un número de horas (no hay SLA)', () => {
    render(<SoporteScreen funcion="soporte_tecnico" />);
    expect(screen.getByTestId('soporte-detalle').textContent).not.toMatch(/\d+\s*(h|hs|horas|hábiles)/i);
  });
});

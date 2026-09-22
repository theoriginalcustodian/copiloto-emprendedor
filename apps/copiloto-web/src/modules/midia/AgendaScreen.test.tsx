import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * `AgendaScreen` (BL-J13) — `leerAgenda` mockeado (su parseo y el clamp de 14 días se prueban en
 * core); acá: los 4 grupos con el título del backend, el estado vacío de cada uno, «no conectado» ≠
 * «sin eventos», degradación ante un endpoint caído y el puente «Nuevo evento» → chat principal.
 */
vi.mock('@copiloto/core', async (importOriginal) => {
  const original = await importOriginal<typeof import('@copiloto/core')>();
  return { ...original, leerAgenda: vi.fn() };
});

import { leerAgenda, tomarPendiente, TEXTO_NUEVO_EVENTO, type AgendaMiDia } from '@copiloto/core';

import { AgendaScreen } from './AgendaScreen';

const leerMock = vi.mocked(leerAgenda);

const grupo = (id: 'hoy' | 'manana' | 'semana' | 'sin_hora', titulo: string, eventos: AgendaMiDia['grupos'][number]['eventos'] = []) => ({
  id,
  titulo,
  eventos,
});

const AGENDA: AgendaMiDia = {
  conectado: true,
  grupos: [
    grupo('hoy', 'Hoy'),
    grupo('manana', 'Mañana', [
      { id: 'ev1', titulo: 'Reunión con Ana', inicioCrudo: '2026-09-22T10:00:00-03:00', finCrudo: '2026-09-22T11:00:00-03:00', diaCompleto: false },
    ]),
    grupo('semana', 'Esta semana'),
    grupo('sin_hora', 'Sin hora', [
      { id: 'ev2', titulo: 'Vence monotributo', inicioCrudo: '2026-09-25', finCrudo: '2026-09-26', diaCompleto: true },
    ]),
  ],
};

const montar = (over: Partial<Parameters<typeof AgendaScreen>[0]> = {}) => {
  const props = { onVolver: vi.fn(), onAbrirChat: vi.fn(), ...over };
  render(<AgendaScreen {...props} />);
  return props;
};

beforeEach(() => {
  leerMock.mockReset().mockResolvedValue({ status: 'ok', agenda: AGENDA });
  tomarPendiente();
});

describe('AgendaScreen', () => {
  it('pinta los 4 grupos con el título del backend y el estado vacío de cada uno', async () => {
    montar();
    await waitFor(() => expect(screen.getByTestId('agenda-grupo-hoy')).toBeInTheDocument());
    expect(screen.getByTestId('agenda-grupo-hoy')).toHaveTextContent('Hoy');
    expect(screen.getByTestId('agenda-grupo-manana')).toHaveTextContent('Mañana');
    expect(screen.getByTestId('agenda-grupo-semana')).toHaveTextContent('Esta semana');
    expect(screen.getByTestId('agenda-grupo-sin_hora')).toHaveTextContent('Sin hora');
    expect(screen.getByTestId('agenda-grupo-hoy-vacio')).toBeInTheDocument();
    expect(screen.getByTestId('agenda-grupo-semana-vacio')).toBeInTheDocument();
    expect(screen.queryByTestId('agenda-grupo-manana-vacio')).not.toBeInTheDocument();
  });

  it('cada evento muestra su franja: horaria o «Todo el día»', async () => {
    montar();
    await waitFor(() => expect(screen.getByTestId('agenda-evento-ev1')).toBeInTheDocument());
    expect(screen.getByTestId('agenda-evento-ev1')).toHaveTextContent('Reunión con Ana');
    expect(screen.getByTestId('agenda-evento-ev1')).toHaveTextContent(/\d{2}:\d{2}.* – \d{2}:\d{2}/);
    expect(screen.getByTestId('agenda-evento-ev2')).toHaveTextContent('Todo el día');
  });

  it('sin conectar: ofrece conectar y NUNCA dice que no hay eventos', async () => {
    leerMock.mockResolvedValue({ status: 'ok', agenda: { ...AGENDA, conectado: false } });
    montar();
    await waitFor(() => expect(screen.getByTestId('agenda-no-conectado')).toHaveTextContent(/Conectá Google Calendar/));
    expect(screen.queryByTestId('agenda-grupo-hoy')).not.toBeInTheDocument();
    expect(screen.queryByText(/Nada por acá/)).not.toBeInTheDocument();
  });

  it('endpoint caído (o 400): avisa y deja reintentar, no rompe', async () => {
    leerMock.mockResolvedValueOnce({ status: 'no_disponible' });
    montar();
    await waitFor(() => expect(screen.getByTestId('agenda-no-disponible')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('agenda-reintentar'));
    await waitFor(() => expect(screen.getByTestId('agenda-grupo-hoy')).toBeInTheDocument());
    expect(leerMock).toHaveBeenCalledTimes(2);
  });

  it('«Nuevo evento» deja el texto en el buzón del chat y abre el chat (no escribe en Calendar)', async () => {
    const { onAbrirChat } = montar();
    fireEvent.click(screen.getByTestId('agenda-nuevo-evento'));
    expect(onAbrirChat).toHaveBeenCalledTimes(1);
    expect(tomarPendiente()).toBe(TEXTO_NUEVO_EVENTO);
  });

  it('«← Mi día» vuelve', async () => {
    const { onVolver } = montar();
    fireEvent.click(screen.getByTestId('agenda-volver'));
    expect(onVolver).toHaveBeenCalledTimes(1);
  });
});

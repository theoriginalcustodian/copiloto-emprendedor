import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn() },
  useFocusEffect: jest.fn(),
}));

/** Partial mock: sólo la red. El parseo, el clamp de 14 días y la franja se prueban en core. */
jest.mock('@copiloto/core', () => {
  const actual = jest.requireActual('@copiloto/core');
  return { ...actual, leerAgenda: jest.fn() };
});

import { router } from 'expo-router';

import { TEXTO_NUEVO_EVENTO, leerAgenda, type AgendaMiDia } from '@copiloto/core';

import { tomarPendiente } from '../chat/mensajePendiente';
import { ThemeProvider } from '../../theme/ThemeProvider';
import { PantallaAgenda } from './PantallaAgenda';

const mockLeer = leerAgenda as jest.MockedFunction<typeof leerAgenda>;

const AGENDA: AgendaMiDia = {
  conectado: true,
  grupos: [
    { id: 'hoy', titulo: 'Hoy', eventos: [] },
    {
      id: 'manana',
      titulo: 'Mañana',
      eventos: [
        { id: 'ev1', titulo: 'Reunión con Ana', inicioCrudo: '2026-09-22T10:00:00-03:00', finCrudo: '2026-09-22T11:00:00-03:00', diaCompleto: false },
      ],
    },
    { id: 'semana', titulo: 'Esta semana', eventos: [] },
    {
      id: 'sin_hora',
      titulo: 'Sin hora',
      eventos: [{ id: 'ev2', titulo: 'Vence monotributo', inicioCrudo: '2026-09-25', finCrudo: '2026-09-26', diaCompleto: true }],
    },
  ],
};

async function montar() {
  return render(
    <ThemeProvider>
      <PantallaAgenda />
    </ThemeProvider>,
  );
}

describe('PantallaAgenda (BL-J13)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    tomarPendiente();
    mockLeer.mockResolvedValue({ status: 'ok', agenda: AGENDA });
  });

  it('pinta los 4 grupos con el título del backend y el estado vacío de cada uno', async () => {
    await montar();
    await waitFor(() => expect(screen.getByTestId('agenda-grupo-hoy')).toBeTruthy());
    expect(screen.getByTestId('agenda-grupo-hoy')).toHaveTextContent(/Hoy/);
    expect(screen.getByTestId('agenda-grupo-manana')).toHaveTextContent(/Mañana/);
    expect(screen.getByTestId('agenda-grupo-semana')).toHaveTextContent(/Esta semana/);
    expect(screen.getByTestId('agenda-grupo-sin_hora')).toHaveTextContent(/Sin hora/);
    expect(screen.getByTestId('agenda-grupo-hoy-vacio')).toBeTruthy();
    expect(screen.getByTestId('agenda-grupo-semana-vacio')).toBeTruthy();
    expect(screen.queryByTestId('agenda-grupo-manana-vacio')).toBeNull();
  });

  it('cada evento muestra su franja: horaria o «Todo el día»', async () => {
    await montar();
    await waitFor(() => expect(screen.getByTestId('agenda-evento-ev1')).toBeTruthy());
    expect(screen.getByTestId('agenda-evento-ev1')).toHaveTextContent(/Reunión con Ana/);
    expect(screen.getByTestId('agenda-evento-ev1')).toHaveTextContent(/\d{2}:\d{2}.* – \d{2}:\d{2}/);
    expect(screen.getByTestId('agenda-evento-ev2')).toHaveTextContent(/Todo el día/);
  });

  it('sin conectar: ofrece conectar y NUNCA dice que no hay eventos', async () => {
    mockLeer.mockResolvedValue({ status: 'ok', agenda: { ...AGENDA, conectado: false } });
    await montar();
    await waitFor(() => expect(screen.getByTestId('agenda-no-conectado')).toHaveTextContent(/Conectá Google Calendar/));
    expect(screen.queryByTestId('agenda-grupo-hoy')).toBeNull();
    expect(screen.queryByText(/Nada por acá/)).toBeNull();
  });

  it('endpoint caído (o 400): avisa y deja reintentar, no rompe', async () => {
    mockLeer.mockResolvedValueOnce({ status: 'no_disponible' });
    await montar();
    await waitFor(() => expect(screen.getByTestId('agenda-no-disponible')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('agenda-reintentar'));
    await waitFor(() => expect(screen.getByTestId('agenda-grupo-hoy')).toBeTruthy());
    expect(mockLeer).toHaveBeenCalledTimes(2);
  });

  it('🔴 «Nuevo evento» deja el pedido para el CHAT PRINCIPAL y cierra el glass (no escribe en Calendar)', async () => {
    await montar();
    await fireEvent.press(screen.getByTestId('agenda-nuevo-evento'));
    expect(router.back).toHaveBeenCalledTimes(1);
    expect(tomarPendiente()).toBe(TEXTO_NUEVO_EVENTO);
  });
});

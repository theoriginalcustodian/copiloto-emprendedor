import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

/** Partial mock: sólo la red. `formatearImporte` REAL — la fila de resultado muestra plata. */
jest.mock('@copiloto/core', () => {
  const actual = jest.requireActual('@copiloto/core');
  return { ...actual, listarActividad: jest.fn() };
});

import { listarActividad, type ActividadItem } from '@copiloto/core';

import { ThemeProvider } from '../../theme/ThemeProvider';
import { BuscadorActividad } from './BuscadorActividad';

const mockBuscar = listarActividad as jest.MockedFunction<typeof listarActividad>;

function item(over: Partial<ActividadItem> = {}): ActividadItem {
  return {
    id: 'gasto:8',
    tipo: 'gasto',
    fecha: '2026-07-22T14:00:00Z',
    titulo: 'Nafta YPF',
    detalle: 'combustible · efectivo',
    monto: '8500.00',
    signo: 'sale',
    ...over,
  };
}

function montar(props: Partial<React.ComponentProps<typeof BuscadorActividad>> = {}) {
  return render(
    <ThemeProvider>
      <BuscadorActividad funcion="gastos" testIDBase="busq" {...props}>
        <Text testID="lista-rica">lista rica del glass</Text>
      </BuscadorActividad>
    </ThemeProvider>,
  );
}

async function tipear(texto: string) {
  await act(async () => {
    fireEvent.changeText(screen.getByTestId('busq-input'), texto);
  });
}

describe('BuscadorActividad', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    mockBuscar.mockResolvedValue({ status: 'ok', items: [item()], cursor: null });
    // El mount no consulta el feed (no hay query todavía), así que los tests pueden sobreescribir el
    // mock ANTES de tipear y el override vale al momento del fetch.
    await montar();
  });

  it('sin query muestra la lista RICA y NO consulta el feed', async () => {
    expect(screen.getByTestId('lista-rica')).toBeTruthy();
    expect(mockBuscar).not.toHaveBeenCalled();
  });

  it('🔴 al buscar pega a `/actividad?funcion=X&q=` y muestra el card uniforme, no la lista rica', async () => {
    await tipearYEsperar('nafta', 'actividad-gasto:8-titulo');

    // Decisión C: la búsqueda va por el feed uniforme, con la función acotada.
    expect(mockBuscar).toHaveBeenLastCalledWith({ funcion: 'gastos', q: 'nafta', limit: 20 });
    expect(screen.getByTestId('actividad-gasto:8-titulo')).toHaveTextContent('Nafta YPF');
    expect(screen.getByTestId('actividad-gasto:8-monto')).toHaveTextContent('−$8.500,00');
    // Mientras hay query, la lista rica NO se muestra (el buscador la reemplaza, no la duplica).
    expect(screen.queryByTestId('lista-rica')).toBeNull();
  });

  it('sin resultados avisa honesto, sin datos de nadie', async () => {
    mockBuscar.mockResolvedValue({ status: 'ok', items: [], cursor: null });

    await tipearYEsperar('zzz', 'busq-vacio');
    expect(screen.getByTestId('busq-vacio')).toBeTruthy();
  });

  it('el feed no disponible degrada, no explota', async () => {
    mockBuscar.mockResolvedValue({ status: 'no_disponible' });

    await tipearYEsperar('nafta', 'busq-no-disponible');
    expect(screen.getByTestId('busq-no-disponible')).toBeTruthy();
  });

  it('si hay más de una página, pide refinar en vez de paginar', async () => {
    mockBuscar.mockResolvedValue({ status: 'ok', items: [item()], cursor: 'hay-mas' });

    await tipearYEsperar('n', 'busq-hay-mas');
    expect(screen.getByTestId('busq-hay-mas')).toBeTruthy();
  });

  it('borrar la query vuelve a la lista rica', async () => {
    await tipearYEsperar('nafta', 'actividad-gasto:8-titulo');

    await tipear('');
    await waitFor(() => expect(screen.getByTestId('lista-rica')).toBeTruthy(), { timeout: 2000 });
  });
});

/** Tipear + esperar (a través del debounce de 350 ms + el fetch) a que aparezca un testID. */
async function tipearYEsperar(texto: string, testIDEsperado: string) {
  await tipear(texto);
  await waitFor(() => expect(screen.getByTestId(testIDEsperado)).toBeTruthy(), { timeout: 2000 });
}

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { type ActividadItem, type ActividadResult } from '@copiloto/core';

import { ThemeProvider } from '../../theme/ThemeProvider';
import { ListaActividad, type FuenteActividad } from './ListaActividad';

/**
 * `ListaActividad` es el componente REUSABLE del feed. Estos tests lo ejercitan **standalone** (sin
 * `PantallaRecientes`), que es el punto: prueban que la fuente y el `testIDBase` parametrizan de
 * verdad, no que "recientes" siga andando (eso lo cubre `PantallaRecientes.test.tsx`, la
 * characterization suite de la extracción).
 *
 * La fuente es un spy plano — el componente NO llama a `listarActividad` directo, recibe `fuente`. Así
 * el listado por función (`funcion=gastos`) es el MISMO componente con otra fuente, y eso es lo que
 * acá se verifica.
 */

function item(over: Partial<ActividadItem> = {}): ActividadItem {
  return {
    id: 'factura:42',
    tipo: 'factura',
    fecha: '2026-07-22T14:30:00Z',
    titulo: 'Factura B 0001-00000042',
    detalle: 'Panadería Los Tilos',
    monto: '136000.00',
    signo: 'entra',
    ...over,
  };
}

function montar(props: Partial<React.ComponentProps<typeof ListaActividad>> & { fuente: FuenteActividad }) {
  return render(
    <ThemeProvider>
      <ListaActividad testIDBase="feed" {...props} />
    </ThemeProvider>,
  );
}

describe('ListaActividad', () => {
  it('pide la primera página con {limit} y SIN cursor', async () => {
    const fuente = jest.fn<Promise<ActividadResult>, [{ limit: number; cursor?: string | null }]>(
      async () => ({ status: 'ok', items: [item()], cursor: null }),
    );

    await montar({ fuente });

    await waitFor(() => expect(screen.getByTestId('feed-lista')).toBeTruthy());
    expect(fuente).toHaveBeenCalledWith({ limit: 20 });
  });

  it('🔴 el testIDBase namespacea los testID — dos listas en la misma pantalla no colisionan', async () => {
    // CONTROL de la parametrización: el mismo componente montado con otra base produce otros testID.
    // Sin esto, recientes-global y recientes-por-función se pisarían el `-lista`.
    const fuente: FuenteActividad = async () => ({ status: 'ok', items: [item()], cursor: null });

    await montar({ fuente, testIDBase: 'recientes-gastos' });

    await waitFor(() => expect(screen.getByTestId('recientes-gastos-lista')).toBeTruthy());
    expect(screen.queryByTestId('feed-lista')).toBeNull();
  });

  it('🔴 el scroll infinito manda el cursor OPACO tal cual vino', async () => {
    const cursorDelServidor = '2026-07-22T14:30:00Z|factura:42';
    const fuente = jest
      .fn<Promise<ActividadResult>, [{ limit: number; cursor?: string | null }]>()
      .mockResolvedValueOnce({ status: 'ok', items: [item()], cursor: cursorDelServidor })
      .mockResolvedValueOnce({ status: 'ok', items: [item({ id: 'gasto:9' })], cursor: null });

    await montar({ fuente });
    await waitFor(() => expect(screen.getByTestId('feed-lista')).toBeTruthy());

    await act(async () => {
      fireEvent(screen.getByTestId('feed-lista'), 'onEndReached');
    });

    expect(fuente).toHaveBeenLastCalledWith({ limit: 20, cursor: cursorDelServidor });
    await waitFor(() => expect(screen.getByTestId('actividad-gasto:9-titulo')).toBeTruthy());
    // La página anterior sigue: se concatena, no se reemplaza.
    expect(screen.getByTestId('actividad-factura:42-titulo')).toBeTruthy();
  });

  it('con `cursor: null` NO pide más — el final lo dice el cursor, no el largo de la página', async () => {
    const fuente = jest.fn<Promise<ActividadResult>, [{ limit: number; cursor?: string | null }]>(
      async () => ({ status: 'ok', items: [item()], cursor: null }),
    );

    await montar({ fuente });
    await waitFor(() => expect(screen.getByTestId('feed-lista')).toBeTruthy());

    await act(async () => {
      fireEvent(screen.getByTestId('feed-lista'), 'onEndReached');
    });

    expect(fuente).toHaveBeenCalledTimes(1);
  });

  it('no_disponible muestra el texto PARAMETRIZADO por función, no explota', async () => {
    const fuente: FuenteActividad = async () => ({ status: 'no_disponible' });

    await montar({ fuente, testIDBase: 'feed', textoNoDisponible: 'Los gastos todavía no están.' });

    await waitFor(() => expect(screen.getByTestId('feed-no-disponible')).toBeTruthy());
    expect(screen.getByTestId('feed-no-disponible')).toHaveTextContent('Los gastos todavía no están.');
  });

  it('sin items muestra el vacío PARAMETRIZADO, nunca datos de nadie', async () => {
    const fuente: FuenteActividad = async () => ({ status: 'ok', items: [], cursor: null });

    await montar({ fuente, textoVacio: 'Todavía no hay gastos.' });

    await waitFor(() => expect(screen.getByTestId('feed-vacio')).toBeTruthy());
    expect(screen.getByTestId('feed-vacio')).toHaveTextContent('Todavía no hay gastos.');
  });
});

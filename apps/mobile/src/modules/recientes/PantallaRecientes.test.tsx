import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

// Jest (jest-expo) -- describe/it/expect/jest son globales, no se importan de vitest.

/** Partial mock de `@copiloto/core`: sólo se reemplaza `listarActividad` -- reusa el resto del
 * módulo REAL. */
jest.mock('@copiloto/core', () => {
  const actual = jest.requireActual('@copiloto/core');
  return {
    ...actual,
    listarActividad: jest.fn(),
  };
});

import { listarActividad, type ActividadItem, type ActividadResult } from '@copiloto/core';

import { ThemeProvider } from '../../theme/ThemeProvider';
import { PantallaRecientes } from './PantallaRecientes';

function itemMock(over: Partial<ActividadItem> = {}): ActividadItem {
  return {
    entrada_id: 'e1',
    cliente_id: 'c1',
    cliente_nombre: 'Ana Pérez',
    tipo_operacion: 'documento',
    created_at: '2026-07-19T10:00:00Z',
    extracto: 'Presupuesto Acme SA · Documento',
    ...over,
  };
}

function ok(over: Partial<Extract<ActividadResult, { status: 'ok' }>> = {}): ActividadResult {
  return { status: 'ok', items: [], cursorSiguiente: null, truncado: false, ...over };
}

async function montar() {
  return render(
    <ThemeProvider>
      <PantallaRecientes />
    </ThemeProvider>,
  );
}

describe('PantallaRecientes', () => {
  beforeEach(() => {
    jest.mocked(listarActividad).mockReset().mockResolvedValue(ok());
  });

  it('muestra "cargando" antes de resolver la primera búsqueda', async () => {
    jest.mocked(listarActividad).mockReturnValueOnce(new Promise(() => {})); // nunca resuelve en este test

    await montar();

    expect(screen.getByTestId('pantalla-recientes-cargando')).toBeTruthy();
  });

  it('al montar, busca con q vacío (toda la actividad) y renderiza los items EN EL ORDEN que llegan', async () => {
    const a = itemMock({ entrada_id: 'a', cliente_nombre: 'Ana', created_at: '2026-07-19T12:00:00Z' });
    const b = itemMock({ entrada_id: 'b', cliente_nombre: 'Beto', created_at: '2026-07-18T09:00:00Z' });
    // El backend ya manda esto en orden `created_at DESC` -- la pantalla NO tiene que reordenarlos
    // (si lo hiciera, este test fallaría con a/b invertidos).
    jest.mocked(listarActividad).mockResolvedValueOnce(ok({ items: [a, b] }));

    await montar();

    await waitFor(() => expect(listarActividad).toHaveBeenCalledWith(expect.objectContaining({ q: '' })));
    await waitFor(() => expect(screen.getByTestId('reciente-row-a')).toBeTruthy());
    const filas = screen.getAllByTestId(/^reciente-row-/);
    expect(filas.map((f) => f.props.testID)).toEqual(['reciente-row-a', 'reciente-row-b']);
    expect(screen.getByText('Ana')).toBeTruthy();
    expect(screen.getByText('Beto')).toBeTruthy();
  });

  it('vacío DE VERDAD: sin query y 0 items -> el mensaje de "todavía no hay actividad" (no el de búsqueda)', async () => {
    await montar();

    await waitFor(() => expect(screen.getByTestId('pantalla-recientes-vacio')).toBeTruthy());
    expect(screen.queryByTestId('pantalla-recientes-sin-resultados')).toBeNull();
  });

  it('sin-resultados-para-esa-búsqueda: CON query y 0 items -> mensaje distinto del vacío de verdad', async () => {
    jest.mocked(listarActividad).mockResolvedValue(ok({ items: [] }));

    await montar();
    await waitFor(() => expect(screen.getByTestId('pantalla-recientes-vacio')).toBeTruthy());

    await fireEvent.changeText(screen.getByTestId('pantalla-recientes-buscar'), 'nadie con este nombre');

    await waitFor(() => expect(screen.getByTestId('pantalla-recientes-sin-resultados')).toBeTruthy());
    expect(screen.queryByTestId('pantalla-recientes-vacio')).toBeNull();
  });

  it('EL TEST CENTRAL: endpoint no disponible (404/501 normalizados) -> mensaje propio, NUNCA la lista vacía', async () => {
    jest.mocked(listarActividad).mockResolvedValueOnce({ status: 'no_disponible' });

    await montar();

    await waitFor(() => expect(screen.getByTestId('pantalla-recientes-no-disponible')).toBeTruthy());
    expect(screen.queryByTestId('pantalla-recientes-vacio')).toBeNull();
    expect(screen.queryByTestId('pantalla-recientes-sin-resultados')).toBeNull();
    expect(screen.getByTestId('pantalla-recientes-no-disponible')).toHaveTextContent('todavía no está disponible', {
      exact: false,
    });
  });

  it('si la búsqueda rechaza (red/error real), muestra el estado de error -- no lo confunde con "no disponible"', async () => {
    jest.mocked(listarActividad).mockRejectedValueOnce(new Error('network down'));

    await montar();

    await waitFor(() => expect(screen.getByTestId('pantalla-recientes-error')).toBeTruthy());
    expect(screen.queryByTestId('pantalla-recientes-no-disponible')).toBeNull();
  });

  it('truncado:true muestra el aviso; truncado:false no lo muestra', async () => {
    jest.mocked(listarActividad).mockResolvedValueOnce(ok({ items: [itemMock()], truncado: true }));

    await montar();

    await waitFor(() => expect(screen.getByTestId('pantalla-recientes-truncado')).toBeTruthy());
  });

  it('sin truncado, no se muestra ningún aviso de corte', async () => {
    jest.mocked(listarActividad).mockResolvedValueOnce(ok({ items: [itemMock()], truncado: false }));

    await montar();

    await waitFor(() => expect(screen.getByTestId(`reciente-row-${itemMock().entrada_id}`)).toBeTruthy());
    expect(screen.queryByTestId('pantalla-recientes-truncado')).toBeNull();
  });

  it('debounce: varios cambios rápidos de texto disparan UNA sola consulta, con el último valor', async () => {
    await montar();
    await waitFor(() => expect(listarActividad).toHaveBeenCalledTimes(1)); // la del mount

    jest.mocked(listarActividad).mockClear();
    const input = screen.getByTestId('pantalla-recientes-buscar');
    await fireEvent.changeText(input, 'a');
    await fireEvent.changeText(input, 'an');
    await fireEvent.changeText(input, 'ana');

    await waitFor(() => expect(listarActividad).toHaveBeenCalledTimes(1));
    expect(listarActividad).toHaveBeenCalledWith(expect.objectContaining({ q: 'ana' }));
  });

  it('la búsqueda NUNCA manda cliente_id -- ese parámetro no existe en el shape que arma la pantalla', async () => {
    await montar();
    await fireEvent.changeText(screen.getByTestId('pantalla-recientes-buscar'), 'ana');

    await waitFor(() => expect(listarActividad).toHaveBeenLastCalledWith(expect.objectContaining({ q: 'ana' })));
    const llamada = jest.mocked(listarActividad).mock.calls.at(-1)?.[0];
    expect(llamada).not.toHaveProperty('cliente_id');
  });

  it('paginación: onEndReached con cursorSiguiente pide la página siguiente y CONCATENA (no reemplaza)', async () => {
    const primera = itemMock({ entrada_id: 'p1-item' });
    const segunda = itemMock({ entrada_id: 'p2-item', cliente_nombre: 'Otro Cliente' });
    jest.mocked(listarActividad).mockResolvedValueOnce(ok({ items: [primera], cursorSiguiente: 'cursor-pagina-2' }));

    await montar();
    await waitFor(() => expect(screen.getByTestId('reciente-row-p1-item')).toBeTruthy());

    jest.mocked(listarActividad).mockResolvedValueOnce(ok({ items: [segunda], cursorSiguiente: null }));
    await fireEvent(screen.getByTestId('pantalla-recientes-lista'), 'endReached', { distanceFromEnd: 0 });

    await waitFor(() => expect(screen.getByTestId('reciente-row-p2-item')).toBeTruthy());
    // La primera sigue ahí -- la página 2 se AGREGA, no pisa la 1.
    expect(screen.getByTestId('reciente-row-p1-item')).toBeTruthy();
    expect(listarActividad).toHaveBeenLastCalledWith(expect.objectContaining({ cursor: 'cursor-pagina-2' }));
  });

  it('paginación: con cursorSiguiente null (última página), onEndReached NO pide nada más', async () => {
    jest.mocked(listarActividad).mockResolvedValueOnce(ok({ items: [itemMock()], cursorSiguiente: null }));

    await montar();
    await waitFor(() => expect(screen.getByTestId(`reciente-row-${itemMock().entrada_id}`)).toBeTruthy());

    jest.mocked(listarActividad).mockClear();
    await fireEvent(screen.getByTestId('pantalla-recientes-lista'), 'endReached', { distanceFromEnd: 0 });

    // Nada que esperar -- afirmamos la ausencia de un 2do llamado tras un tick.
    await new Promise((r) => setTimeout(r, 50));
    expect(listarActividad).not.toHaveBeenCalled();
  });
});

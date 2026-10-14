import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

/**
 * Partial mock de `@copiloto/core`: sólo la red. `destinoDeImputacion` y `etiquetaDeDestino` quedan
 * REALES a propósito — lo que se prueba acá es que la pantalla las use; su comportamiento ya tiene
 * sus casos en `packages/core/src/api/gastos.test.ts` y `trabajos.test.ts`.
 */
jest.mock('@copiloto/core', () => {
  const actual = jest.requireActual('@copiloto/core');
  return {
    ...actual,
    obtenerGasto: jest.fn(),
    imputarGasto: jest.fn(),
    listarTrabajosImputables: jest.fn(),
  };
});

import {
  imputarGasto,
  listarTrabajosImputables,
  obtenerGasto,
  type Gasto,
  type ImputacionGasto,
} from '@copiloto/core';

import { ThemeProvider } from '../../theme/ThemeProvider';
import { DetalleGasto } from './DetalleGasto';

const mockObtener = obtenerGasto as jest.MockedFunction<typeof obtenerGasto>;
const mockImputar = imputarGasto as jest.MockedFunction<typeof imputarGasto>;
const mockTrabajos = listarTrabajosImputables as jest.MockedFunction<typeof listarTrabajosImputables>;

/**
 * `DetalleGasto` (mobile) — **el bloque de imputación de `SM-E3`**, gemelo de
 * `apps/copiloto-web/src/modules/gastos/DetalleGasto.test.tsx`. Esta pantalla no tenía NINGÚN test en
 * ninguno de los dos fronts (medido el 2026-10-14).
 *
 * El caso que más importa es el primero: `imputacion === null` («este backend no lo dijo») **no** es
 * lo mismo que las tres referencias en `null` («sin imputar»). Afirmar «sin imputar» sobre el primero
 * sería inventar un dato sobre la plata del emprendedor, y pasaría justo contra un deploy anterior al
 * 2026-10-14, donde la clave no viaja.
 */
const SIN_IMPUTAR: ImputacionGasto = {
  gastoId: 2, presupuestoRef: null, comprobanteRef: null, cobroRef: null,
};

function gasto(over: Partial<Gasto> = {}): Gasto {
  return {
    id: 2,
    monto: '15000.50',
    montoSugerido: null,
    fecha: '2026-10-14',
    categoria: 'mercaderia',
    proveedor: null,
    medioPago: null,
    descripcion: null,
    origen: 'manual',
    creadoEn: '2026-10-14T01:41:08.185511+00:00',
    imputacion: SIN_IMPUTAR,
    ...over,
  };
}

async function montar(g: Gasto) {
  return render(
    <ThemeProvider>
      <DetalleGasto gasto={g} onCerrar={() => {}} />
    </ThemeProvider>,
  );
}

beforeEach(() => {
  mockObtener.mockReset();
  mockImputar.mockReset();
  mockTrabajos.mockReset();
  mockObtener.mockResolvedValue({ status: 'ok', gasto: gasto() });
  mockTrabajos.mockResolvedValue({
    status: 'ok',
    trabajos: [
      { eslabon: 'presupuesto', ref: 12, etiqueta: 'Panaderia del barrio · #7' },
      { eslabon: 'comprobante', ref: 90, etiqueta: 'Factura B 0001-00000090' },
    ],
  });
});

describe('DetalleGasto · imputación al trabajo (SM-E3)', () => {
  it('🔴 sin la clave `imputacion` el bloque NO se muestra: «no lo dijo» no es «sin imputar»', async () => {
    const viejo = gasto({ imputacion: null });
    mockObtener.mockResolvedValue({ status: 'ok', gasto: viejo });

    await montar(viejo);

    await waitFor(() => expect(screen.getByTestId('detalle-gasto-fecha')).toBeTruthy());
    expect(screen.queryByTestId('detalle-gasto-trabajo')).toBeNull();
    expect(screen.queryByTestId('detalle-gasto-sin-imputar')).toBeNull();
  });

  it('con las tres referencias en null dice que está sin imputar y nombra la consecuencia', async () => {
    await montar(gasto());

    await waitFor(() => expect(screen.getByTestId('detalle-gasto-sin-imputar')).toBeTruthy());
    expect(screen.getByText(/no le baja el margen a ningún trabajo/)).toBeTruthy();
    // Imputar no es obligatorio: no hay nada que bloquee ni que exija (`gastos_web.py:162`).
    expect(screen.queryByTestId('detalle-gasto-desimputar')).toBeNull();
  });

  it('imputado muestra el trabajo y ofrece quitarlo', async () => {
    const g = gasto({ imputacion: { ...SIN_IMPUTAR, presupuestoRef: 12 } });
    mockObtener.mockResolvedValue({ status: 'ok', gasto: g });

    await montar(g);

    await waitFor(() => expect(screen.getByTestId('detalle-gasto-trabajo-imputado')).toBeTruthy());
    expect(screen.getByText('Presupuesto #12')).toBeTruthy();
    expect(screen.getByTestId('detalle-gasto-desimputar')).toBeTruthy();
    expect(screen.queryByTestId('detalle-gasto-sin-imputar')).toBeNull();
  });

  it('elegir un trabajo manda la imputación y la pantalla pasa a mostrarlo', async () => {
    mockImputar.mockResolvedValue({ status: 'ok', imputacion: { ...SIN_IMPUTAR, presupuestoRef: 12 } });
    await montar(gasto());

    await waitFor(() => expect(screen.getByTestId('detalle-gasto-imputar')).toBeTruthy());
    await act(async () => { fireEvent.press(screen.getByTestId('detalle-gasto-imputar')); });

    await waitFor(() => expect(screen.getByTestId('detalle-gasto-trabajos-opcion-presupuesto:12')).toBeTruthy());
    await act(async () => { fireEvent.press(screen.getByTestId('detalle-gasto-trabajos-opcion-presupuesto:12')); });

    await waitFor(() => expect(screen.getByTestId('detalle-gasto-trabajo-imputado')).toBeTruthy());
    expect(mockImputar).toHaveBeenCalledWith(2, { eslabon: 'presupuesto', ref: 12 });
    expect(screen.getByText('Presupuesto #12')).toBeTruthy();
  });

  it('🔴 quitar manda `null` y la pantalla vuelve a «sin imputar» -- el efecto, no sólo la llamada', async () => {
    const g = gasto({ imputacion: { ...SIN_IMPUTAR, comprobanteRef: 90 } });
    mockObtener.mockResolvedValue({ status: 'ok', gasto: g });
    mockImputar.mockResolvedValue({ status: 'ok', imputacion: SIN_IMPUTAR });

    await montar(g);

    await waitFor(() => expect(screen.getByTestId('detalle-gasto-desimputar')).toBeTruthy());
    await act(async () => { fireEvent.press(screen.getByTestId('detalle-gasto-desimputar')); });

    await waitFor(() => expect(screen.getByTestId('detalle-gasto-sin-imputar')).toBeTruthy());
    expect(mockImputar).toHaveBeenCalledWith(2, null);
  });

  it('🔴 si la escritura falla, el trabajo NO cambia en pantalla y se dice el error', async () => {
    // Un optimista que pinta el destino antes de la respuesta dejaría al emprendedor creyendo que el
    // gasto quedó imputado cuando el backend lo rechazó.
    mockImputar.mockResolvedValue({ status: 'no_encontrado' });
    await montar(gasto());

    await waitFor(() => expect(screen.getByTestId('detalle-gasto-imputar')).toBeTruthy());
    await act(async () => { fireEvent.press(screen.getByTestId('detalle-gasto-imputar')); });
    await waitFor(() => expect(screen.getByTestId('detalle-gasto-trabajos-opcion-presupuesto:12')).toBeTruthy());
    await act(async () => { fireEvent.press(screen.getByTestId('detalle-gasto-trabajos-opcion-presupuesto:12')); });

    await waitFor(() => expect(screen.getByTestId('detalle-gasto-trabajo-error')).toBeTruthy());
    expect(screen.queryByTestId('detalle-gasto-trabajo-imputado')).toBeNull();
    expect(screen.getByTestId('detalle-gasto-sin-imputar')).toBeTruthy();
  });

  it('sin trabajos todavía lo dice con el texto del primer día', async () => {
    mockTrabajos.mockResolvedValue({ status: 'ok', trabajos: [] });
    await montar(gasto());

    await waitFor(() => expect(screen.getByTestId('detalle-gasto-imputar')).toBeTruthy());
    await act(async () => { fireEvent.press(screen.getByTestId('detalle-gasto-imputar')); });

    await waitFor(() => expect(screen.getByTestId('detalle-gasto-trabajos-vacio')).toBeTruthy());
  });

  it('si los trabajos no se pueden traer lo dice, y NO como «no tenés trabajos»', async () => {
    // `[]` afirma algo sobre los datos del emprendedor; `no_disponible`, sobre la red.
    mockTrabajos.mockResolvedValue({ status: 'no_disponible' });
    await montar(gasto());

    await waitFor(() => expect(screen.getByTestId('detalle-gasto-imputar')).toBeTruthy());
    await act(async () => { fireEvent.press(screen.getByTestId('detalle-gasto-imputar')); });

    await waitFor(() => expect(screen.getByTestId('detalle-gasto-trabajos-no-disponible')).toBeTruthy());
    expect(screen.queryByTestId('detalle-gasto-trabajos-vacio')).toBeNull();
  });
});

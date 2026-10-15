import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/** Partial mock: sólo la red — mismo arnés que `GastosScreen.test.tsx`. */
vi.mock('@copiloto/core', async (importOriginal) => {
  const original = await importOriginal<typeof import('@copiloto/core')>();
  return {
    ...original,
    obtenerGasto: vi.fn(),
    imputarGasto: vi.fn(),
    listarTrabajosImputables: vi.fn(),
  };
});

import {
  imputarGasto,
  listarTrabajosImputables,
  obtenerGasto,
  type Gasto,
  type ImputacionGasto,
} from '@copiloto/core';

import { DetalleGasto } from './DetalleGasto';

const mockObtener = vi.mocked(obtenerGasto);
const mockImputar = vi.mocked(imputarGasto);
const mockTrabajos = vi.mocked(listarTrabajosImputables);

/**
 * `DetalleGasto` (web) — **el bloque de imputación de `SM-E3`**. Esta pantalla no tenía NINGÚN test
 * en ninguno de los dos fronts (medido el 2026-10-14); su gemelo es
 * `apps/mobile/src/modules/gastos/DetalleGasto.test.tsx`.
 *
 * Lo que fija este archivo es la distinción de **tres estados**, que es donde está el defecto fácil:
 * `imputacion === null` («este backend no lo dijo») NO es lo mismo que las tres referencias en `null`
 * («sin imputar»). Pintar «sin imputar» sobre el primero sería afirmar algo sobre la plata del
 * emprendedor que nadie midió — y pasaría justo contra un deploy viejo, donde no se puede saber.
 *
 * `destinoDeImputacion` y `rotuloDeImputacion` se dejan **reales** a propósito: lo que se prueba acá es
 * que la pantalla las use, y su comportamiento ya tiene sus casos en
 * `packages/core/src/api/gastos.test.ts` y `trabajos.test.ts`.
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

    render(<DetalleGasto gasto={viejo} onCerrar={() => {}} />);

    await waitFor(() => expect(screen.getByTestId('detalle-gasto-fecha')).toBeTruthy());
    expect(screen.queryByTestId('detalle-gasto-trabajo')).toBeNull();
    // Y en particular no aparece la afirmación: es el error que este caso existe para prevenir.
    expect(screen.queryByTestId('detalle-gasto-sin-imputar')).toBeNull();
  });

  it('con las tres referencias en null dice que está sin imputar y nombra la consecuencia', async () => {
    render(<DetalleGasto gasto={gasto()} onCerrar={() => {}} />);

    await waitFor(() => expect(screen.getByTestId('detalle-gasto-sin-imputar')).toBeTruthy());
    expect(screen.getByTestId('detalle-gasto-sin-imputar')).toHaveTextContent(
      'no le baja el margen a ningún trabajo',
    );
    // 🔴 Y NO hay nada que obligue: imputar no es obligatorio (`gastos_web.py:162`).
    expect(screen.queryByTestId('detalle-gasto-desimputar')).toBeNull();
  });

  it('🔴 imputado pinta EXACTAMENTE la etiqueta del backend, no un número re-derivado del id', async () => {
    // El defecto de device (2026-10-15): se eligió «asesoría contable · #3» (número humano) y el
    // detalle mostró «Presupuesto #227» (el id de base). `presupuestoRef` es 227 a propósito.
    const g = gasto({ imputacion: { ...SIN_IMPUTAR, presupuestoRef: 227, etiqueta: 'asesoría contable · #3' } });
    mockObtener.mockResolvedValue({ status: 'ok', gasto: g });

    render(<DetalleGasto gasto={g} onCerrar={() => {}} />);

    await waitFor(() => expect(screen.getByTestId('detalle-gasto-trabajo-imputado')).toBeTruthy());
    const dato = screen.getByTestId('detalle-gasto-trabajo-imputado');
    expect(dato).toHaveTextContent('Trabajo');
    expect(dato).toHaveTextContent('asesoría contable · #3');
    expect(dato.textContent).not.toContain('227');
    expect(screen.getByTestId('detalle-gasto-desimputar')).toBeTruthy();
    expect(screen.queryByTestId('detalle-gasto-sin-imputar')).toBeNull();
  });

  it('🔴 imputado SIN etiqueta (`null`) no inventa ningún número: el nombre del eslabón solo', async () => {
    const g = gasto({ imputacion: { ...SIN_IMPUTAR, presupuestoRef: 227, etiqueta: null } });
    mockObtener.mockResolvedValue({ status: 'ok', gasto: g });

    render(<DetalleGasto gasto={g} onCerrar={() => {}} />);

    await waitFor(() => expect(screen.getByTestId('detalle-gasto-trabajo-imputado')).toBeTruthy());
    const valor = screen.getByTestId('detalle-gasto-trabajo-imputado').querySelector('.detalle-gasto__dato-valor');
    expect(valor?.textContent).toBe('Presupuesto');
    expect(screen.getByTestId('detalle-gasto-trabajo-imputado').textContent).not.toContain('#');
    expect(screen.getByTestId('detalle-gasto-desimputar')).toBeTruthy();
    expect(screen.queryByTestId('detalle-gasto-sin-imputar')).toBeNull();
  });

  it('elegir un trabajo manda la imputación y la pantalla pasa a mostrarlo', async () => {
    mockImputar.mockResolvedValue({
      status: 'ok',
      imputacion: { ...SIN_IMPUTAR, presupuestoRef: 12, etiqueta: 'asesoría contable · #3' },
    });
    render(<DetalleGasto gasto={gasto()} onCerrar={() => {}} />);

    await waitFor(() => expect(screen.getByTestId('detalle-gasto-imputar')).toBeTruthy());
    await act(async () => { fireEvent.click(screen.getByTestId('detalle-gasto-imputar')); });
    await waitFor(() => expect(screen.getByTestId('detalle-gasto-trabajo-presupuesto-12')).toBeTruthy());
    await act(async () => { fireEvent.click(screen.getByTestId('detalle-gasto-trabajo-presupuesto-12')); });

    await waitFor(() => expect(screen.getByTestId('detalle-gasto-trabajo-imputado')).toBeTruthy());
    expect(mockImputar).toHaveBeenCalledWith(2, { eslabon: 'presupuesto', ref: 12 });
    // Lo que confirma es el rótulo que devolvió el PUT, el mismo del selector -- no `Presupuesto #12`.
    const dato = screen.getByTestId('detalle-gasto-trabajo-imputado');
    expect(dato).toHaveTextContent('asesoría contable · #3');
    expect(dato.textContent).not.toContain('Presupuesto #12');
  });

  it('🔴 quitar manda `null` y la pantalla vuelve a «sin imputar» -- el efecto, no sólo la llamada', async () => {
    const g = gasto({ imputacion: { ...SIN_IMPUTAR, comprobanteRef: 90 } });
    mockObtener.mockResolvedValue({ status: 'ok', gasto: g });
    mockImputar.mockResolvedValue({ status: 'ok', imputacion: SIN_IMPUTAR });

    render(<DetalleGasto gasto={g} onCerrar={() => {}} />);

    await waitFor(() => expect(screen.getByTestId('detalle-gasto-desimputar')).toBeTruthy());
    await act(async () => { fireEvent.click(screen.getByTestId('detalle-gasto-desimputar')); });

    await waitFor(() => expect(screen.getByTestId('detalle-gasto-sin-imputar')).toBeTruthy());
    expect(mockImputar).toHaveBeenCalledWith(2, null);
  });

  it('🔴 si la escritura falla, el trabajo NO cambia en pantalla y se dice el error', async () => {
    // El caso que más engaña: un optimista que pinta el destino antes de la respuesta deja al
    // emprendedor creyendo que el gasto quedó imputado cuando el backend lo rechazó.
    mockImputar.mockResolvedValue({ status: 'no_encontrado' });
    render(<DetalleGasto gasto={gasto()} onCerrar={() => {}} />);

    await waitFor(() => expect(screen.getByTestId('detalle-gasto-imputar')).toBeTruthy());
    await act(async () => { fireEvent.click(screen.getByTestId('detalle-gasto-imputar')); });
    await waitFor(() => expect(screen.getByTestId('detalle-gasto-trabajo-presupuesto-12')).toBeTruthy());
    await act(async () => { fireEvent.click(screen.getByTestId('detalle-gasto-trabajo-presupuesto-12')); });

    await waitFor(() => expect(screen.getByTestId('detalle-gasto-trabajo-error')).toBeTruthy());
    expect(screen.queryByTestId('detalle-gasto-trabajo-imputado')).toBeNull();
    expect(screen.getByTestId('detalle-gasto-sin-imputar')).toBeTruthy();
  });

  it('si los trabajos no se pueden traer lo dice, y NO como «no tenés trabajos»', async () => {
    // `[]` afirma algo sobre los datos del emprendedor; `no_disponible`, sobre la red. Confundirlos
    // le haría creer que perdió sus presupuestos.
    mockTrabajos.mockResolvedValue({ status: 'no_disponible' });
    render(<DetalleGasto gasto={gasto()} onCerrar={() => {}} />);

    await waitFor(() => expect(screen.getByTestId('detalle-gasto-imputar')).toBeTruthy());
    await act(async () => { fireEvent.click(screen.getByTestId('detalle-gasto-imputar')); });

    await waitFor(() => expect(screen.getByTestId('detalle-gasto-trabajos-no-disponible')).toBeTruthy());
    expect(screen.queryByTestId('detalle-gasto-trabajos-vacio')).toBeNull();
  });

  it('sin trabajos todavía lo dice con el texto del primer día', async () => {
    mockTrabajos.mockResolvedValue({ status: 'ok', trabajos: [] });
    render(<DetalleGasto gasto={gasto()} onCerrar={() => {}} />);

    await waitFor(() => expect(screen.getByTestId('detalle-gasto-imputar')).toBeTruthy());
    await act(async () => { fireEvent.click(screen.getByTestId('detalle-gasto-imputar')); });

    await waitFor(() => expect(screen.getByTestId('detalle-gasto-trabajos-vacio')).toBeTruthy());
  });
});

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/** Partial mock: sólo la red. `leerIngresoPropuesto`, REAL — mismo arnés que
 *  `TarjetaGastoPropuesto.test.tsx`. */
vi.mock('@copiloto/core', async (importOriginal) => {
  const original = await importOriginal<typeof import('@copiloto/core')>();
  return {
    ...original,
    registrarIngreso: vi.fn(),
    completarIngreso: vi.fn(),
  };
});

import { registrarIngreso, leerIngresoPropuesto, type Ingreso } from '@copiloto/core';

import { TarjetaIngresoPropuesto } from './TarjetaIngresoPropuesto';

const mockRegistrar = vi.mocked(registrarIngreso);

function propuesta(over: Record<string, unknown> = {}) {
  const p = leerIngresoPropuesto({
    kind: 'ingreso_propuesto',
    data: {
      monto: '85000',
      medio: 'transferencia',
      cliente_nombre: 'Panadería La Esquina',
      concepto: 'pintura del local',
      fecha: '2026-08-12',
      ...over,
    },
  });
  if (p == null) throw new Error('la propuesta de prueba no debería ser null');
  return p;
}

function ingresoGuardado(over: Partial<Ingreso> = {}): Ingreso {
  return {
    id: 4,
    monto: '85000.00',
    medio: 'transferencia',
    fecha: '2026-08-12',
    origen: 'voz',
    clienteNombre: 'Panadería La Esquina',
    concepto: 'pintura del local',
    falta: [],
    borrable: true,
    ...over,
  } as unknown as Ingreso;
}

const MENSAJE_ID = 'assistant-1';

describe('TarjetaIngresoPropuesto', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear(); // guard cross-reload vive en localStorage — aislar entre tests
  });

  it('dice explícitamente que TODAVÍA no se guardó', async () => {
    render(<TarjetaIngresoPropuesto propuesta={propuesta()} mensajeId={MENSAJE_ID} />);

    expect(await screen.findByText(/todavía no lo guardé/)).toBeInTheDocument();
  });

  it('precarga monto, cliente, medio y concepto — editables', async () => {
    render(<TarjetaIngresoPropuesto propuesta={propuesta()} mensajeId={MENSAJE_ID} />);

    expect(await screen.findByTestId('ingreso-monto')).toHaveValue('85000');
    expect(screen.getByTestId('ingreso-cliente')).toHaveValue('Panadería La Esquina');
    expect(screen.getByTestId('ingreso-medio')).toHaveValue('transferencia');
    expect(screen.getByTestId('ingreso-concepto')).toHaveValue('pintura del local');
  });

  it('al guardar (completo) el FORM sigue mostrando su propio "completo" — la card NO lo tapa en la misma sesión', async () => {
    mockRegistrar.mockResolvedValue({ status: 'ok', ingreso: ingresoGuardado({ falta: [] }) });
    render(<TarjetaIngresoPropuesto propuesta={propuesta()} mensajeId={MENSAJE_ID} />);

    expect(mockRegistrar).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('ingreso-guardar'));

    await waitFor(() => expect(screen.getByTestId('ingreso-completo')).toBeInTheDocument());
    // La Tarjeta sigue en 'editando' (el form sigue montado) — no aparece el Tile terminal propio.
    expect(screen.queryByTestId('ingreso-propuesto-guardado')).toBeNull();
  });

  it('al guardar (incompleto) el FORM sigue mostrando su propio aviso "falta" con Completar', async () => {
    mockRegistrar.mockResolvedValue({ status: 'ok', ingreso: ingresoGuardado({ falta: ['medio'] }) });
    render(<TarjetaIngresoPropuesto propuesta={propuesta()} mensajeId={MENSAJE_ID} />);

    fireEvent.click(screen.getByTestId('ingreso-guardar'));

    await waitFor(() => expect(screen.getByTestId('ingreso-falta')).toBeInTheDocument());
    expect(screen.getByTestId('ingreso-completar')).toBeInTheDocument();
  });

  it('descartar no guarda nada', () => {
    render(<TarjetaIngresoPropuesto propuesta={propuesta()} mensajeId={MENSAJE_ID} />);

    fireEvent.click(screen.getByTestId('ingreso-cancelar'));

    expect(screen.getByTestId('ingreso-propuesto-descartado')).toBeInTheDocument();
    expect(mockRegistrar).not.toHaveBeenCalled();
  });
});

describe('TarjetaIngresoPropuesto — guard cross-reload (caso hostil)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it('card ya guardada (en una sesión previa) + reload (remount) ⇒ va directo al Tile terminal, no se puede duplicar', async () => {
    mockRegistrar.mockResolvedValue({ status: 'ok', ingreso: ingresoGuardado({ falta: [] }) });
    const { unmount } = render(<TarjetaIngresoPropuesto propuesta={propuesta()} mensajeId={MENSAJE_ID} />);

    fireEvent.click(screen.getByTestId('ingreso-guardar'));
    await waitFor(() => expect(mockRegistrar).toHaveBeenCalledTimes(1));

    unmount(); // simula el reload: React se remonta desde cero, sólo `localStorage` sobrevive

    render(<TarjetaIngresoPropuesto propuesta={propuesta()} mensajeId={MENSAJE_ID} />);

    // Va DIRECTO al estado terminal — nunca pasa por el formulario editable.
    expect(screen.getByTestId('ingreso-propuesto-guardado')).toBeInTheDocument();
    expect(screen.queryByTestId('ingreso-guardar')).toBeNull();
    expect(screen.queryByTestId('ingreso-monto')).toBeNull();
    // Control negativo del guard: sin él este 2º render volvería a 'editando' y el click habría
    // llamado a `registrarIngreso` una 2ª vez (duplicado). Sigue en 1 con el guard puesto.
    expect(mockRegistrar).toHaveBeenCalledTimes(1);
  });

  it('card ya DESCARTADA + reload (remount) ⇒ sigue descartada, no reaparece editable', () => {
    render(<TarjetaIngresoPropuesto propuesta={propuesta()} mensajeId={MENSAJE_ID} />);
    fireEvent.click(screen.getByTestId('ingreso-cancelar'));
    expect(screen.getByTestId('ingreso-propuesto-descartado')).toBeInTheDocument();

    render(<TarjetaIngresoPropuesto propuesta={propuesta()} mensajeId={MENSAJE_ID} />);

    expect(screen.getAllByTestId('ingreso-propuesto-descartado').length).toBeGreaterThan(0);
    expect(screen.queryByTestId('ingreso-guardar')).toBeNull();
    expect(mockRegistrar).not.toHaveBeenCalled();
  });

  it('dos mensajes distintos (`mensajeId` distinto) NO comparten resolución — la marca es por card, no global', async () => {
    mockRegistrar.mockResolvedValue({ status: 'ok', ingreso: ingresoGuardado({ falta: [] }) });
    const { unmount } = render(<TarjetaIngresoPropuesto propuesta={propuesta()} mensajeId="assistant-1" />);
    fireEvent.click(screen.getByTestId('ingreso-guardar'));
    await waitFor(() => expect(mockRegistrar).toHaveBeenCalledTimes(1));
    unmount();

    render(<TarjetaIngresoPropuesto propuesta={propuesta()} mensajeId="assistant-2" />);

    expect(await screen.findByTestId('ingreso-monto')).toBeInTheDocument(); // el 2º sigue editable
  });
});

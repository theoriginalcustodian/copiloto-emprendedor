import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/** Partial mock: sólo la red. `leerClientePropuesto`, REAL — mismo arnés que
 *  `TarjetaGastoPropuesto.test.tsx`. */
vi.mock('@copiloto/core', async (importOriginal) => {
  const original = await importOriginal<typeof import('@copiloto/core')>();
  return {
    ...original,
    crearCliente: vi.fn(),
  };
});

import { crearCliente, leerClientePropuesto, type Cliente } from '@copiloto/core';

import { TarjetaClientePropuesto } from './TarjetaClientePropuesto';

const mockCrear = vi.mocked(crearCliente);

function propuesta(over: Record<string, unknown> = {}) {
  const p = leerClientePropuesto({
    kind: 'cliente_propuesto',
    data: {
      nombre: 'Panadería La Esquina',
      doc_tipo: null,
      doc_nro: null,
      condicion_iva: null,
      domicilio: null,
      email: null,
      telefono: null,
      notas: null,
      origen: 'voz',
      ...over,
    },
  });
  if (p == null) throw new Error('la propuesta de prueba no debería ser null');
  return p;
}

function clienteGuardado(nombre: string): Cliente {
  return {
    id: 3,
    nombre,
    docTipo: null,
    docNro: null,
    condicionIva: null,
    domicilio: null,
    email: null,
    telefono: null,
    notas: null,
  } as unknown as Cliente;
}

const MENSAJE_ID = 'assistant-1';

describe('TarjetaClientePropuesto', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear(); // guard cross-reload vive en localStorage — aislar entre tests
  });

  it('dice explícitamente que TODAVÍA no se agregó', async () => {
    render(<TarjetaClientePropuesto propuesta={propuesta()} mensajeId={MENSAJE_ID} />);

    expect(await screen.findByText(/todavía no lo agregué/)).toBeInTheDocument();
  });

  it('precarga el nombre dictado — editable', async () => {
    render(<TarjetaClientePropuesto propuesta={propuesta()} mensajeId={MENSAJE_ID} />);

    expect(await screen.findByTestId('cliente-nombre')).toHaveValue('Panadería La Esquina');
  });

  it('al dar de alta se convierte en confirmación — no persiste en automático', async () => {
    mockCrear.mockResolvedValue({ status: 'ok', cliente: clienteGuardado('Panadería La Esquina') });
    render(<TarjetaClientePropuesto propuesta={propuesta()} mensajeId={MENSAJE_ID} />);

    expect(mockCrear).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('cliente-guardar'));

    await waitFor(() => expect(screen.getByTestId('cliente-propuesto-guardado')).toBeInTheDocument());
    expect(screen.getByTestId('cliente-propuesto-guardado')).toHaveTextContent(
      'Cliente agregado: Panadería La Esquina',
    );
  });

  it('409 por documento: se convierte en "ya lo tenés", no en error', async () => {
    mockCrear.mockResolvedValue({
      status: 'duplicado',
      duplicado: { por: 'documento', dueno: clienteGuardado('Panadería La Esquina') },
    });
    render(<TarjetaClientePropuesto propuesta={propuesta()} mensajeId={MENSAJE_ID} />);

    fireEvent.click(screen.getByTestId('cliente-guardar'));

    await waitFor(() => expect(screen.getByTestId('cliente-propuesto-ya-existe')).toBeInTheDocument());
    expect(screen.getByTestId('cliente-propuesto-ya-existe')).toHaveTextContent(
      'Ese cliente ya está en tu cartera: Panadería La Esquina.',
    );
  });

  it('409 por nombre (homónimo): se queda EDITANDO, no cierra la card', async () => {
    mockCrear.mockResolvedValue({
      status: 'duplicado',
      duplicado: { por: 'nombre', dueno: clienteGuardado('Panadería La Esquina') },
    });
    render(<TarjetaClientePropuesto propuesta={propuesta()} mensajeId={MENSAJE_ID} />);

    fireEvent.click(screen.getByTestId('cliente-guardar'));

    await waitFor(() => expect(screen.getByTestId('cliente-homonimo')).toBeInTheDocument());
    // Sigue el formulario, no un estado terminal de la card:
    expect(screen.getByTestId('cliente-nombre')).toBeInTheDocument();
  });

  it('descartar no guarda nada', () => {
    render(<TarjetaClientePropuesto propuesta={propuesta()} mensajeId={MENSAJE_ID} />);

    fireEvent.click(screen.getByTestId('cliente-cancelar'));

    expect(screen.getByTestId('cliente-propuesto-descartado')).toBeInTheDocument();
    expect(mockCrear).not.toHaveBeenCalled();
  });
});

describe('TarjetaClientePropuesto — guard cross-reload (caso hostil)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it('card ya GUARDADA + reload (remount) ⇒ va directo al estado terminal, no se puede duplicar', async () => {
    mockCrear.mockResolvedValue({ status: 'ok', cliente: clienteGuardado('Panadería La Esquina') });
    const { unmount } = render(<TarjetaClientePropuesto propuesta={propuesta()} mensajeId={MENSAJE_ID} />);

    fireEvent.click(screen.getByTestId('cliente-guardar'));
    await waitFor(() => expect(screen.getByTestId('cliente-propuesto-guardado')).toBeInTheDocument());
    expect(mockCrear).toHaveBeenCalledTimes(1);

    unmount(); // simula el reload: React se remonta desde cero, sólo `localStorage` sobrevive

    render(<TarjetaClientePropuesto propuesta={propuesta()} mensajeId={MENSAJE_ID} />);

    expect(screen.getByTestId('cliente-propuesto-guardado')).toBeInTheDocument();
    expect(screen.queryByTestId('cliente-guardar')).toBeNull();
    expect(screen.queryByTestId('cliente-nombre')).toBeNull();
    // Control negativo del guard: sin él este 2º render volvería a 'editando' y el click habría
    // llamado a `crearCliente` una 2ª vez (duplicado). Sigue en 1 con el guard puesto.
    expect(mockCrear).toHaveBeenCalledTimes(1);
  });

  it('card ya EN "ya_existe" + reload (remount) ⇒ sigue en ese estado, no vuelve a editable', async () => {
    mockCrear.mockResolvedValue({
      status: 'duplicado',
      duplicado: { por: 'documento', dueno: clienteGuardado('Panadería La Esquina') },
    });
    const { unmount } = render(<TarjetaClientePropuesto propuesta={propuesta()} mensajeId={MENSAJE_ID} />);
    fireEvent.click(screen.getByTestId('cliente-guardar'));
    await waitFor(() => expect(screen.getByTestId('cliente-propuesto-ya-existe')).toBeInTheDocument());

    unmount();

    render(<TarjetaClientePropuesto propuesta={propuesta()} mensajeId={MENSAJE_ID} />);

    expect(screen.getByTestId('cliente-propuesto-ya-existe')).toBeInTheDocument();
    expect(screen.queryByTestId('cliente-nombre')).toBeNull();
  });

  it('card ya DESCARTADA + reload (remount) ⇒ sigue descartada, no reaparece editable', () => {
    render(<TarjetaClientePropuesto propuesta={propuesta()} mensajeId={MENSAJE_ID} />);
    fireEvent.click(screen.getByTestId('cliente-cancelar'));
    expect(screen.getByTestId('cliente-propuesto-descartado')).toBeInTheDocument();

    render(<TarjetaClientePropuesto propuesta={propuesta()} mensajeId={MENSAJE_ID} />);

    expect(screen.getAllByTestId('cliente-propuesto-descartado').length).toBeGreaterThan(0);
    expect(screen.queryByTestId('cliente-guardar')).toBeNull();
    expect(mockCrear).not.toHaveBeenCalled();
  });

  it('dos mensajes distintos (`mensajeId` distinto) NO comparten resolución — la marca es por card, no global', async () => {
    mockCrear.mockResolvedValue({ status: 'ok', cliente: clienteGuardado('Panadería La Esquina') });
    const { unmount } = render(<TarjetaClientePropuesto propuesta={propuesta()} mensajeId="assistant-1" />);
    fireEvent.click(screen.getByTestId('cliente-guardar'));
    await waitFor(() => expect(screen.getByTestId('cliente-propuesto-guardado')).toBeInTheDocument());
    unmount();

    render(<TarjetaClientePropuesto propuesta={propuesta()} mensajeId="assistant-2" />);

    expect(await screen.findByTestId('cliente-nombre')).toBeInTheDocument(); // el 2º sigue editable
  });
});

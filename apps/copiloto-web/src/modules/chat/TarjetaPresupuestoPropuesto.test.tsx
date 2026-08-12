import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/** Partial mock: sólo la red. `leerPresupuestoPropuesto`, REAL. `listarConceptos` resuelve vacío —
 *  el catálogo es un acelerador aparte, no lo que se está probando acá (mismo arnés que
 *  `apps/mobile/src/modules/chat/TarjetaPresupuestoPropuesto.test.tsx`). */
vi.mock('@copiloto/core', async (importOriginal) => {
  const original = await importOriginal<typeof import('@copiloto/core')>();
  return {
    ...original,
    crearPresupuesto: vi.fn(),
    listarConceptos: vi.fn().mockResolvedValue({ status: 'ok', conceptos: [] }),
  };
});

import { crearPresupuesto, leerPresupuestoPropuesto, type Presupuesto } from '@copiloto/core';

import { TarjetaPresupuestoPropuesto } from './TarjetaPresupuestoPropuesto';

const mockCrear = vi.mocked(crearPresupuesto);

function propuesta(over: Record<string, unknown> = {}) {
  const p = leerPresupuestoPropuesto({
    kind: 'presupuesto_propuesto',
    data: {
      concepto: 'Instalación eléctrica',
      receptor: { nombre: 'Juan Pérez', doc_tipo: 96, doc_nro: '20123456', contacto: 'juan@mail.com' },
      items: [
        { descripcion: 'Mano de obra', cantidad: '1', precio_unitario: '30000' },
        { descripcion: 'Materiales', cantidad: '1', precio_unitario: '15000' },
      ],
      ...over,
    },
  });
  if (p == null) throw new Error('la propuesta de prueba no debería ser null');
  return p;
}

function presupuestoGuardado(numero: number): Presupuesto {
  return {
    id: 9,
    numero,
    fecha: '2026-07-24T12:00:00Z',
    concepto: 'Instalación eléctrica',
    receptor: {
      nombre: 'Juan Pérez',
      docTipo: 96,
      docNro: '20123456',
      condicionIva: null,
      domicilio: '',
      contacto: 'juan@mail.com',
    },
    items: [],
    cantidadItems: 2,
    total: '45000.00',
    moneda: 'ARS',
    docLink: null,
    docId: null,
    sheetFila: null,
    reemplazaA: null,
    reemplazadoPor: null,
    facturaId: null,
    facturado: false,
  } as unknown as Presupuesto;
}

const MENSAJE_ID = 'assistant-1';

describe('TarjetaPresupuestoPropuesto', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear(); // guard cross-reload vive en localStorage — aislar entre tests
  });

  it('dice explícitamente que TODAVÍA no se guardó', async () => {
    render(<TarjetaPresupuestoPropuesto propuesta={propuesta()} mensajeId={MENSAJE_ID} />);

    expect(await screen.findByText(/todavía no lo anoté/)).toBeInTheDocument();
  });

  it('precarga el concepto, el receptor y cada fila de ítems — editables', async () => {
    render(<TarjetaPresupuestoPropuesto propuesta={propuesta()} mensajeId={MENSAJE_ID} />);

    expect(await screen.findByTestId('presupuesto-concepto')).toHaveValue('Instalación eléctrica');
    expect(screen.getByTestId('presupuesto-nombre')).toHaveValue('Juan Pérez');
    expect(screen.getByTestId('presupuesto-item-0-descripcion')).toHaveValue('Mano de obra');
    expect(screen.getByTestId('presupuesto-item-1-descripcion')).toHaveValue('Materiales');
  });

  it('NO es una corrección — no muestra "Corregir el N°" ni manda reemplazaA', async () => {
    mockCrear.mockResolvedValue({ status: 'ok', presupuesto: presupuestoGuardado(7) });
    render(<TarjetaPresupuestoPropuesto propuesta={propuesta()} mensajeId={MENSAJE_ID} />);

    expect(screen.queryByText(/Corregir el N°/)).toBeNull();

    fireEvent.click(screen.getByTestId('presupuesto-guardar'));

    await waitFor(() => expect(mockCrear).toHaveBeenCalled());
    expect(mockCrear.mock.calls[0][0]).not.toHaveProperty('reemplazaA');
  });

  it('al guardar se convierte en confirmación con el número asignado — no persiste en automático', async () => {
    mockCrear.mockResolvedValue({ status: 'ok', presupuesto: presupuestoGuardado(7) });
    render(<TarjetaPresupuestoPropuesto propuesta={propuesta()} mensajeId={MENSAJE_ID} />);

    expect(mockCrear).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('presupuesto-guardar'));

    await waitFor(() => expect(screen.getByTestId('presupuesto-propuesto-guardado')).toBeInTheDocument());
    expect(screen.getByTestId('presupuesto-propuesto-guardado')).toHaveTextContent('Presupuesto anotado — N° 7');
    expect(screen.queryByTestId('presupuesto-guardar')).toBeNull();
  });

  it('descartar no guarda nada', () => {
    render(<TarjetaPresupuestoPropuesto propuesta={propuesta()} mensajeId={MENSAJE_ID} />);

    fireEvent.click(screen.getByTestId('presupuesto-cancelar'));

    expect(screen.getByTestId('presupuesto-propuesto-descartado')).toBeInTheDocument();
    expect(mockCrear).not.toHaveBeenCalled();
  });
});

describe('TarjetaPresupuestoPropuesto — guard cross-reload (caso hostil)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it('card ya GUARDADA + reload (remount) + no hay botón Guardar posible ⇒ no se puede duplicar', async () => {
    mockCrear.mockResolvedValue({ status: 'ok', presupuesto: presupuestoGuardado(7) });
    const { unmount } = render(<TarjetaPresupuestoPropuesto propuesta={propuesta()} mensajeId={MENSAJE_ID} />);

    fireEvent.click(screen.getByTestId('presupuesto-guardar'));
    await waitFor(() => expect(screen.getByTestId('presupuesto-propuesto-guardado')).toBeInTheDocument());
    expect(mockCrear).toHaveBeenCalledTimes(1);

    unmount(); // simula el reload: React se remonta desde cero, sólo `localStorage` sobrevive

    render(<TarjetaPresupuestoPropuesto propuesta={propuesta()} mensajeId={MENSAJE_ID} />);

    // Va DIRECTO al estado terminal — nunca pasa por el formulario editable.
    expect(screen.getByTestId('presupuesto-propuesto-guardado')).toHaveTextContent('Presupuesto anotado — N° 7');
    expect(screen.queryByTestId('presupuesto-guardar')).toBeNull();
    expect(screen.queryByTestId('presupuesto-concepto')).toBeNull();
    // Control negativo del guard: sin él, este segundo render volvería a 'editando' y un click acá
    // habría llamado a `crearPresupuesto` una 2ª vez (duplicado). Sigue en 1 con el guard puesto.
    expect(mockCrear).toHaveBeenCalledTimes(1);
  });

  it('card ya DESCARTADA + reload (remount) ⇒ sigue descartada, no reaparece editable', () => {
    render(<TarjetaPresupuestoPropuesto propuesta={propuesta()} mensajeId={MENSAJE_ID} />);
    fireEvent.click(screen.getByTestId('presupuesto-cancelar'));
    expect(screen.getByTestId('presupuesto-propuesto-descartado')).toBeInTheDocument();

    render(<TarjetaPresupuestoPropuesto propuesta={propuesta()} mensajeId={MENSAJE_ID} />);

    expect(screen.getAllByTestId('presupuesto-propuesto-descartado').length).toBeGreaterThan(0);
    expect(screen.queryByTestId('presupuesto-guardar')).toBeNull();
    expect(mockCrear).not.toHaveBeenCalled();
  });

  it('dos mensajes distintos (`mensajeId` distinto) NO comparten resolución — la marca es por card, no global', async () => {
    mockCrear.mockResolvedValue({ status: 'ok', presupuesto: presupuestoGuardado(7) });
    const { unmount } = render(<TarjetaPresupuestoPropuesto propuesta={propuesta()} mensajeId="assistant-1" />);
    fireEvent.click(screen.getByTestId('presupuesto-guardar'));
    await waitFor(() => expect(screen.getByTestId('presupuesto-propuesto-guardado')).toBeInTheDocument());
    unmount();

    render(<TarjetaPresupuestoPropuesto propuesta={propuesta()} mensajeId="assistant-2" />);

    // `findBy` (no `getBy`): deja asentar el efecto async de `listarConceptos` del 2º render antes de
    // que el test termine — evita un warning de act() por un `setState` que cae después del `expect`.
    expect(await screen.findByTestId('presupuesto-concepto')).toBeInTheDocument(); // el 2º sigue editable
  });
});

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

describe('TarjetaPresupuestoPropuesto', () => {
  beforeEach(() => vi.clearAllMocks());

  it('dice explícitamente que TODAVÍA no se guardó', async () => {
    render(<TarjetaPresupuestoPropuesto propuesta={propuesta()} />);

    expect(await screen.findByText(/todavía no lo anoté/)).toBeInTheDocument();
  });

  it('precarga el concepto, el receptor y cada fila de ítems — editables', async () => {
    render(<TarjetaPresupuestoPropuesto propuesta={propuesta()} />);

    expect(await screen.findByTestId('presupuesto-concepto')).toHaveValue('Instalación eléctrica');
    expect(screen.getByTestId('presupuesto-nombre')).toHaveValue('Juan Pérez');
    expect(screen.getByTestId('presupuesto-item-0-descripcion')).toHaveValue('Mano de obra');
    expect(screen.getByTestId('presupuesto-item-1-descripcion')).toHaveValue('Materiales');
  });

  it('NO es una corrección — no muestra "Corregir el N°" ni manda reemplazaA', async () => {
    mockCrear.mockResolvedValue({ status: 'ok', presupuesto: presupuestoGuardado(7) });
    render(<TarjetaPresupuestoPropuesto propuesta={propuesta()} />);

    expect(screen.queryByText(/Corregir el N°/)).toBeNull();

    fireEvent.click(screen.getByTestId('presupuesto-guardar'));

    await waitFor(() => expect(mockCrear).toHaveBeenCalled());
    expect(mockCrear.mock.calls[0][0]).not.toHaveProperty('reemplazaA');
  });

  it('al guardar se convierte en confirmación con el número asignado — no persiste en automático', async () => {
    mockCrear.mockResolvedValue({ status: 'ok', presupuesto: presupuestoGuardado(7) });
    render(<TarjetaPresupuestoPropuesto propuesta={propuesta()} />);

    expect(mockCrear).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('presupuesto-guardar'));

    await waitFor(() => expect(screen.getByTestId('presupuesto-propuesto-guardado')).toBeInTheDocument());
    expect(screen.getByTestId('presupuesto-propuesto-guardado')).toHaveTextContent('Presupuesto anotado — N° 7');
    expect(screen.queryByTestId('presupuesto-guardar')).toBeNull();
  });

  it('descartar no guarda nada', () => {
    render(<TarjetaPresupuestoPropuesto propuesta={propuesta()} />);

    fireEvent.click(screen.getByTestId('presupuesto-cancelar'));

    expect(screen.getByTestId('presupuesto-propuesto-descartado')).toBeInTheDocument();
    expect(mockCrear).not.toHaveBeenCalled();
  });
});

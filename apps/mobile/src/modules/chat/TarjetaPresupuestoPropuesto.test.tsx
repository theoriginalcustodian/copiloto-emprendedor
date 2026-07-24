import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

/** Partial mock: sólo la red. `leerPresupuestoPropuesto`, REAL. `listarConceptos` resuelve vacío —
 *  el catálogo es un acelerador aparte, no lo que se está probando acá. */
jest.mock('@copiloto/core', () => {
  const actual = jest.requireActual('@copiloto/core');
  return {
    ...actual,
    crearPresupuesto: jest.fn(),
    listarConceptos: jest.fn().mockResolvedValue({ status: 'ok', conceptos: [] }),
  };
});

import { crearPresupuesto, leerPresupuestoPropuesto, type Presupuesto } from '@copiloto/core';

import { ThemeProvider } from '../../theme/ThemeProvider';
import { TarjetaPresupuestoPropuesto } from './TarjetaPresupuestoPropuesto';

const mockCrear = crearPresupuesto as jest.MockedFunction<typeof crearPresupuesto>;

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
    id: 9, numero, fecha: '2026-07-24T12:00:00Z', concepto: 'Instalación eléctrica',
    receptor: { nombre: 'Juan Pérez', docTipo: 96, docNro: '20123456', condicionIva: null, domicilio: '', contacto: 'juan@mail.com' },
    items: [], cantidadItems: 2, total: '45000.00', moneda: 'ARS', docLink: null, docId: null,
    sheetFila: null, reemplazaA: null, reemplazadoPor: null, facturaId: null, facturado: false,
  } as unknown as Presupuesto;
}

async function montar(p = propuesta()) {
  return render(
    <ThemeProvider>
      <TarjetaPresupuestoPropuesto propuesta={p} />
    </ThemeProvider>,
  );
}

describe('TarjetaPresupuestoPropuesto', () => {
  beforeEach(() => jest.clearAllMocks());

  it('dice explícitamente que TODAVÍA no se guardó', async () => {
    await montar();

    expect(screen.getByTestId('presupuesto-propuesto-aviso')).toHaveTextContent(
      'Esto entendí. Revisalo, corregí lo que haga falta y tocá Guardar — todavía no lo anoté.',
    );
  });

  it('precarga el concepto, el receptor y CADA fila de ítems — editables', async () => {
    await montar();

    expect(screen.getByTestId('presupuesto-propuesto-formulario-concepto-input').props.value).toBe(
      'Instalación eléctrica',
    );
    expect(screen.getByTestId('presupuesto-propuesto-formulario-nombre-input').props.value).toBe('Juan Pérez');
    expect(screen.getByTestId('presupuesto-propuesto-formulario-item-0-descripcion-input').props.value).toBe(
      'Mano de obra',
    );
    expect(screen.getByTestId('presupuesto-propuesto-formulario-item-1-descripcion-input').props.value).toBe(
      'Materiales',
    );
  });

  it('🔴 permite CORREGIR el monto mal transcripto de un ítem antes de guardar', async () => {
    mockCrear.mockResolvedValue({ status: 'ok', presupuesto: presupuestoGuardado(7) });
    await montar();

    await act(async () => {
      fireEvent.changeText(screen.getByTestId('presupuesto-propuesto-formulario-item-0-precio-input'), '35000');
    });
    await act(async () => {
      fireEvent.press(screen.getByTestId('presupuesto-propuesto-formulario-guardar'));
    });

    expect(mockCrear).toHaveBeenCalledWith(
      expect.objectContaining({
        items: expect.arrayContaining([expect.objectContaining({ precioUnitario: '35000' })]),
      }),
    );
  });

  it('NO es una corrección — no manda `reemplazaA` ni dice "Corregir el N°"', async () => {
    mockCrear.mockResolvedValue({ status: 'ok', presupuesto: presupuestoGuardado(7) });
    await montar();

    expect(screen.queryByText(/Corregir el N°/)).toBeNull();

    await act(async () => {
      fireEvent.press(screen.getByTestId('presupuesto-propuesto-formulario-guardar'));
    });

    expect(mockCrear).toHaveBeenCalledWith(expect.not.objectContaining({ reemplazaA: expect.anything() }));
  });

  it('al guardar se convierte en confirmación con el número asignado', async () => {
    mockCrear.mockResolvedValue({ status: 'ok', presupuesto: presupuestoGuardado(7) });
    await montar();

    await act(async () => {
      fireEvent.press(screen.getByTestId('presupuesto-propuesto-formulario-guardar'));
    });

    await waitFor(() => expect(screen.getByTestId('presupuesto-propuesto-guardado')).toBeTruthy());
    expect(screen.getByTestId('presupuesto-propuesto-guardado')).toHaveTextContent('Presupuesto anotado — N° 7');
    expect(screen.queryByTestId('presupuesto-propuesto-formulario-guardar')).toBeNull();
  });

  it('descartar no guarda nada', async () => {
    await montar();

    await act(async () => {
      fireEvent.press(screen.getByTestId('presupuesto-propuesto-formulario-cancelar'));
    });

    expect(screen.getByTestId('presupuesto-propuesto-descartado')).toBeTruthy();
    expect(mockCrear).not.toHaveBeenCalled();
  });
});

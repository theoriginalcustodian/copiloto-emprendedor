import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

/** Partial mock: sólo la red. `ApiError`, `leerGastoPropuesto` y los formateadores, REALES. */
jest.mock('@copiloto/core', () => {
  const actual = jest.requireActual('@copiloto/core');
  return { ...actual, crearGasto: jest.fn() };
});

import { crearGasto, leerGastoPropuesto, type Gasto } from '@copiloto/core';

import { ThemeProvider } from '../../theme/ThemeProvider';
import { TarjetaGastoPropuesto } from './TarjetaGastoPropuesto';

const mockCrear = crearGasto as jest.MockedFunction<typeof crearGasto>;

function propuesta(over: Record<string, unknown> = {}) {
  const p = leerGastoPropuesto({
    kind: 'gasto_propuesto',
    data: {
      monto: '50000.00',
      fecha: '2026-07-20',
      categoria: 'mercaderia',
      proveedor: 'Distribuidora Sur',
      medio_pago: null,
      descripcion: 'pagué quince mil de mercadería',
      origen: 'voz',
      ...over,
    },
  });
  if (p == null) throw new Error('la propuesta de prueba no debería ser null');
  return p;
}

function gastoGuardado(monto: string): Gasto {
  return {
    id: 9, monto, montoSugerido: null, fecha: '2026-07-20', categoria: 'mercaderia',
    proveedor: 'Distribuidora Sur', medioPago: null, descripcion: null, origen: 'voz',
    creadoEn: '2026-07-22T02:00:00+00:00',
  };
}

async function montar(p = propuesta()) {
  return render(
    <ThemeProvider>
      <TarjetaGastoPropuesto propuesta={p} />
    </ThemeProvider>,
  );
}

describe('TarjetaGastoPropuesto', () => {
  beforeEach(() => jest.clearAllMocks());

  it('dice explícitamente que TODAVÍA no se guardó', async () => {
    // Sin este cartel el emprendedor lee el "listo" del copiloto, no toca Guardar, y el gasto se
    // pierde creyendo los dos que estaba hecho.
    await montar();

    expect(screen.getByTestId('gasto-propuesto-aviso')).toHaveTextContent('Esto entendí. Revisalo y tocá Guardar — todavía no lo anoté.');
  });

  it('muestra lo que se dictó, textual, para poder contrastarlo', async () => {
    await montar();

    expect(screen.getByTestId('gasto-propuesto-dicho')).toHaveTextContent('«pagué quince mil de mercadería»');
  });

  it('🔴 permite CORREGIR el monto mal transcripto antes de guardar', async () => {
    // El caso que justifica que esto sea un formulario y no un sí/no: Whisper entendió "cincuenta
    // mil" donde se dijo "quince mil". Con un sí/no sólo se podría aceptar el error o repetir todo
    // el dictado.
    mockCrear.mockResolvedValue({ status: 'ok', gasto: gastoGuardado('15000.00') });
    await montar();

    await act(async () => {
      fireEvent.changeText(screen.getByTestId('gasto-monto-input'), '15000');
    });
    await act(async () => {
      fireEvent.press(screen.getByTestId('gasto-guardar'));
    });

    expect(mockCrear).toHaveBeenCalledWith(expect.objectContaining({ monto: '15000' }));
  });

  it('manda la FECHA que resolvió el motor, no la de hoy', async () => {
    // Es la única situación en la que la app manda `fecha`: el motor ya resolvió «ayer»/«el lunes».
    // Omitirla haría que el backend ponga hoy, y los días 30 y 31 eso mueve el gasto de MES.
    mockCrear.mockResolvedValue({ status: 'ok', gasto: gastoGuardado('50000.00') });
    await montar();

    await act(async () => {
      fireEvent.press(screen.getByTestId('gasto-guardar'));
    });

    expect(mockCrear).toHaveBeenCalledWith(expect.objectContaining({ fecha: '2026-07-20', origen: 'voz' }));
  });

  it('al guardar se convierte en confirmación y ya no se puede volver a mandar', async () => {
    mockCrear.mockResolvedValue({ status: 'ok', gasto: gastoGuardado('50000.00') });
    await montar();

    await act(async () => {
      fireEvent.press(screen.getByTestId('gasto-guardar'));
    });

    await waitFor(() => expect(screen.getByTestId('gasto-propuesto-guardado')).toBeTruthy());
    expect(screen.getByTestId('gasto-propuesto-guardado')).toHaveTextContent('Gasto anotado: $50.000,00');
    // El botón desaparece: una card que sigue posteable después de guardar es un gasto duplicado.
    expect(screen.queryByTestId('gasto-guardar')).toBeNull();
  });

  it('descartar no guarda nada', async () => {
    await montar();

    await act(async () => {
      fireEvent.press(screen.getByTestId('gasto-cancelar'));
    });

    expect(screen.getByTestId('gasto-propuesto-descartado')).toBeTruthy();
    expect(mockCrear).not.toHaveBeenCalled();
  });
});

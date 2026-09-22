/**
 * `PantallaIngresos` — la plata que entra.
 *
 * Lo que se fija acá es lo que hace que la función SIRVA: que anotar cueste un campo, que el duplicado
 * se pregunte en vez de prohibirse, y que no se ofrezca borrar lo que el sistema vio.
 *
 * ⚠️ Todo `fireEvent` va con `await` — ver el docstring de `jest.config.js`.
 */
jest.mock('@copiloto/core', () => {
  const actual = jest.requireActual('@copiloto/core');
  return {
    ...actual,
    listarIngresos: jest.fn(),
    obtenerResumenIngresos: jest.fn(),
    registrarIngreso: jest.fn(),
    completarIngreso: jest.fn(),
    borrarIngreso: jest.fn(),
    transcribir: jest.fn(),
  };
});

// BL-J7/K-10 — mismo arnés que `modules/voz/MicFuncion.test.tsx`: `MicFuncion` (mobile) envuelve
// `BotonVoz`/`useVozComando`, no `MediaRecorder` como en web.
jest.mock('expo-file-system/legacy', () => ({
  deleteAsync: jest.fn().mockResolvedValue(undefined),
}));

const mockVoz = {
  fase: 'inactivo' as 'inactivo' | 'grabando' | 'pausado' | 'listo',
  niveles: [] as number[],
  iniciar: jest.fn().mockResolvedValue(true),
  pausar: jest.fn(),
  reanudar: jest.fn(),
  detener: jest.fn().mockResolvedValue(undefined),
  descartar: jest.fn().mockResolvedValue(undefined),
  tomar: jest.fn(),
};
jest.mock('../chat/useVozComando', () => ({ useVozComando: () => mockVoz }));

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Gesture } from 'react-native-gesture-handler';

import {
  borrarIngreso,
  completarIngreso,
  listarIngresos,
  obtenerResumenIngresos,
  registrarIngreso,
  transcribir,
  type Ingreso,
} from '@copiloto/core';

import { PantallaIngresos } from './PantallaIngresos';
import { ThemeProvider } from '../../theme/ThemeProvider';

const listarMock = listarIngresos as jest.MockedFunction<typeof listarIngresos>;
const resumenMock = obtenerResumenIngresos as jest.MockedFunction<typeof obtenerResumenIngresos>;
const registrarMock = registrarIngreso as jest.MockedFunction<typeof registrarIngreso>;
const completarMock = completarIngreso as jest.MockedFunction<typeof completarIngreso>;
const borrarMock = borrarIngreso as jest.MockedFunction<typeof borrarIngreso>;
const transcribirMock = transcribir as jest.MockedFunction<typeof transcribir>;

/** Dispara el ciclo completo del gesto de `BotonVoz` (apretar `MIN_HOLD_MS` y soltar) — mismo
 * mecanismo que `modules/voz/MicFuncion.test.tsx` (mobile). `espiaPan` tiene que estar activo DESDE
 * ANTES del `render`: el recognizer se crea al montar `MicFuncion`, que vive en el listado. */
async function dictar(espiaPan: ReturnType<typeof jest.spyOn>) {
  const recognizer = espiaPan.mock.results[espiaPan.mock.results.length - 1]?.value as {
    handlers: { onBegin?: (e: unknown) => void; onFinalize?: (e: unknown, exito: boolean) => void };
  };
  let ahora = 1_000_000;
  const relojEspia = jest.spyOn(Date, 'now').mockImplementation(() => ahora);
  await act(async () => {
    recognizer.handlers.onBegin?.({});
  });
  ahora += 400;
  await act(async () => {
    recognizer.handlers.onFinalize?.({}, true);
  });
  relojEspia.mockRestore();
}

const DICTADO: Ingreso = {
  id: 1, monto: '85000.00', medio: 'efectivo', fecha: '2026-07-22', origen: 'manual',
  clienteNombre: 'Panadería', concepto: null, comprobanteId: null, comprobanteNro: null,
  presupuestoRef: null, falta: null, borrable: true,
};

const DE_FACTURA: Ingreso = {
  id: 2, monto: '10000.00', medio: null, fecha: '2026-07-21', origen: 'factura',
  clienteNombre: 'Kiosco', concepto: null, comprobanteId: 86, comprobanteNro: 901,
  presupuestoRef: null, falta: null, borrable: false,
};

async function montar() {
  return render(
    <ThemeProvider>
      <PantallaIngresos />
    </ThemeProvider>,
  );
}

async function tipear(testID: string, texto: string) {
  await fireEvent.changeText(screen.getByTestId(testID), texto);
  await waitFor(() => expect(screen.getByTestId(testID).props.value).toBe(texto));
}

beforeEach(() => {
  jest.clearAllMocks();
  listarMock.mockResolvedValue({ status: 'ok', ingresos: [DICTADO, DE_FACTURA], total: '95000.00' });
  resumenMock.mockResolvedValue({
    status: 'ok',
    resumen: { periodo: 'agosto', total: '95000.00', mesAnterior: '112000.00' },
  });
  registrarMock.mockResolvedValue({ status: 'ok', ingreso: { ...DICTADO, id: 9, falta: [] } });
  completarMock.mockResolvedValue({ status: 'ok', ingreso: { ...DICTADO, id: 9, falta: [] } });
  borrarMock.mockResolvedValue({ status: 'ok' });
});

describe('PantallaIngresos — el listado', () => {
  it('muestra lo cobrado del mes — del ENDPOINT de resumen, no de sumar la lista', async () => {
    await montar();

    await waitFor(() => expect(screen.getByTestId('ingresos-resumen-cifra')).toBeTruthy());
    expect(screen.getByTestId('ingresos-resumen-cifra').props.children).toContain('95.000');
    expect(screen.getByTestId('ingresos-resumen-rotulo')).toHaveTextContent('Cobraste este mes');
    expect(screen.getByTestId('ingresos-resumen-chip')).toHaveTextContent('Mes anterior: $112.000,00');
  });

  /**
   * 🔴 `listarIngresos().total` suma filas recientes SIN recortar por fecha. Si el resumen no está
   * disponible, la pantalla no puede caer a ese número: sería «lo del mes» con otra cosa adentro.
   * Prefiere no mostrar nada.
   */
  it('sin resumen no inventa un total con la suma de la lista', async () => {
    resumenMock.mockResolvedValue({ status: 'no_disponible' } as Awaited<ReturnType<typeof obtenerResumenIngresos>>);
    await montar();

    await waitFor(() => expect(screen.getByTestId('ingresos-lista')).toBeTruthy());
    expect(screen.queryByTestId('ingresos-resumen')).toBeNull();
  });

  it('el aviso de MercadoPago viaja con el número, no en el pie', async () => {
    await montar();
    await waitFor(() => expect(screen.getByTestId('ingresos-aviso-mercadopago')).toBeTruthy());
  });

  it('🔴 la procedencia se ve en TODAS las filas, también en las que anotó el emprendedor', async () => {
    // Sin la marca, en tres meses nadie sabe qué dato es duro y cuál es de memoria.
    await montar();

    await waitFor(() => expect(screen.getByTestId('ingresos-fila-1')).toBeTruthy());
    expect(screen.getByText(/lo anotaste vos/)).toBeTruthy();
    expect(screen.getByText(/de una factura/)).toBeTruthy();
  });

  it('🔴 sólo se ofrece borrar lo que el backend marcó borrable', async () => {
    // Borrar el rastro de un cobro que el sistema VIO sería inventar que esa factura no se cobró — y
    // el backend contestaría 404 sobre algo que está en pantalla.
    await montar();

    await waitFor(() => expect(screen.getByTestId('ingresos-borrar-1')).toBeTruthy());
    expect(screen.queryByTestId('ingresos-borrar-2')).toBeNull();
  });

  it('🔴 `borrable` en null tampoco ofrece borrar — "no sé" no habilita una acción destructiva', async () => {
    listarMock.mockResolvedValue({ status: 'ok', ingresos: [{ ...DICTADO, borrable: null }], total: '1' });

    await montar();

    await waitFor(() => expect(screen.getByTestId('ingresos-fila-1')).toBeTruthy());
    expect(screen.queryByTestId('ingresos-borrar-1')).toBeNull();
  });

  it('borrar RELEE en vez de sacar la fila local — el total lo suma el backend', async () => {
    await montar();
    await waitFor(() => expect(screen.getByTestId('ingresos-borrar-1')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('ingresos-borrar-1'));

    await waitFor(() => expect(borrarMock).toHaveBeenCalledWith(1));
    // Sacarla de la lista local dejaría el total viejo al lado de la lista nueva.
    await waitFor(() => expect(listarMock).toHaveBeenCalledTimes(2));
  });

  it('sin ingresos lo dice, y no muestra un cero como si fuera un dato', async () => {
    listarMock.mockResolvedValue({ status: 'ok', ingresos: [], total: '0.00' });

    await montar();

    await waitFor(() => expect(screen.getByTestId('ingresos-vacio')).toBeTruthy());
  });

  it('sin endpoint desplegado lo dice, en vez de una caja vacía', async () => {
    listarMock.mockResolvedValue({ status: 'no_disponible' });

    await montar();

    await waitFor(() => expect(screen.getByTestId('ingresos-no-disponible')).toBeTruthy());
    expect(screen.queryByTestId('ingresos-vacio')).toBeNull();
  });
});

describe('PantallaIngresos — anotar', () => {
  async function abrirFormulario() {
    await montar();
    await waitFor(() => expect(screen.getByTestId('ingresos-nuevo')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('ingresos-nuevo'));
    await waitFor(() => expect(screen.getByTestId('ingreso-form-guardar')).toBeTruthy());
  }

  it('🔴 con SÓLO el monto se puede anotar — nada más viaja', async () => {
    // Un formulario que exige medio y cliente para anotar que te pagaron es lo que hace que el
    // emprendedor deje de anotar, y la caja vuelve a mentir.
    await abrirFormulario();

    await tipear('ingreso-form-monto-input', '85000');
    await fireEvent.press(screen.getByTestId('ingreso-form-guardar'));

    await waitFor(() => expect(registrarMock).toHaveBeenCalled());
    const datos = registrarMock.mock.calls[0][0];
    expect(datos.monto).toBe('85000');
    expect(datos.clienteNombre).toBeUndefined();
    expect(datos.medio).toBeUndefined();
    // Y con clave por gesto, igual que el cobro de una factura.
    expect(typeof datos.idemKey).toBe('string');
  });

  it('🔴 acepta el monto escrito con COMA y lo manda con punto', async () => {
    // Mismo bug que tuvo FormularioGasto: el teclado numérico entrega coma en configuración
    // regional argentina, y el backend hace `Decimal("5678,90")` → InvalidOperation → 400.
    await abrirFormulario();

    await tipear('ingreso-form-monto-input', '5678,90');
    await fireEvent.press(screen.getByTestId('ingreso-form-guardar'));

    await waitFor(() => expect(registrarMock).toHaveBeenCalled());
    expect(registrarMock.mock.calls[0][0].monto).toBe('5678.90');
  });

  it('sin monto no sale a la red, y lo dice', async () => {
    await abrirFormulario();

    await fireEvent.press(screen.getByTestId('ingreso-form-guardar'));

    await waitFor(() => expect(screen.getByTestId('ingreso-form-error')).toBeTruthy());
    expect(registrarMock).not.toHaveBeenCalled();
  });

  it('🔴 el duplicado se PREGUNTA con su candidato, y se puede guardar igual', async () => {
    // Avisa, no prohíbe: el emprendedor sabe mejor que el sistema si le pagaron dos veces.
    registrarMock.mockResolvedValueOnce({
      status: 'posible_duplicado',
      mensaje: 'hay un ingreso parecido de estos días — ¿es otro cobro o el mismo?',
      candidato: DICTADO,
    });
    await abrirFormulario();

    await tipear('ingreso-form-monto-input', '85000');
    await fireEvent.press(screen.getByTestId('ingreso-form-guardar'));
    await waitFor(() => expect(screen.getByTestId('ingreso-form-duplicado')).toBeTruthy());
    expect(screen.getByTestId('ingreso-form-duplicado-candidato')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('ingreso-form-confirmar-duplicado'));

    await waitFor(() => expect(registrarMock).toHaveBeenCalledTimes(2));
    expect(registrarMock.mock.calls[1][0].confirmarDuplicado).toBe(true);
  });

  it('🔴 el reintento del duplicado reusa la MISMA clave de gesto', async () => {
    registrarMock.mockResolvedValueOnce({ status: 'posible_duplicado', mensaje: 'parecido', candidato: null });
    await abrirFormulario();

    await tipear('ingreso-form-monto-input', '85000');
    await fireEvent.press(screen.getByTestId('ingreso-form-guardar'));
    await waitFor(() => expect(screen.getByTestId('ingreso-form-duplicado')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('ingreso-form-confirmar-duplicado'));

    await waitFor(() => expect(registrarMock).toHaveBeenCalledTimes(2));
    expect(registrarMock.mock.calls[1][0].idemKey).toBe(registrarMock.mock.calls[0][0].idemKey);
  });

  it('🔴 lo que faltó se avisa DESPUÉS de guardar, y completar usa el MISMO ingreso', async () => {
    // Si contestar el aviso creara otro registro, el aviso duplicaría la caja.
    registrarMock.mockResolvedValue({
      status: 'ok',
      ingreso: { ...DICTADO, id: 9, falta: ['cliente', 'medio'] },
    });
    await abrirFormulario();

    await tipear('ingreso-form-monto-input', '85000');
    await fireEvent.press(screen.getByTestId('ingreso-form-guardar'));
    await waitFor(() => expect(screen.getByTestId('ingreso-form-falta')).toBeTruthy());

    await tipear('ingreso-form-medio-input', 'efectivo');
    await fireEvent.press(screen.getByTestId('ingreso-form-completar'));

    await waitFor(() => expect(completarMock).toHaveBeenCalledWith(9, { medio: 'efectivo' }));
    // Y NO un alta nueva.
    expect(registrarMock).toHaveBeenCalledTimes(1);
  });
});

describe('PantallaIngresos — BL-J7/K-10 (mic en la fila del rótulo)', () => {
  let espiaPan: ReturnType<typeof jest.spyOn>;

  beforeEach(() => {
    listarMock.mockResolvedValue({ status: 'ok', ingresos: [], total: '0.00' });
    mockVoz.fase = 'inactivo';
    mockVoz.niveles = [];
    mockVoz.iniciar.mockResolvedValue(true);
    mockVoz.detener.mockResolvedValue(undefined);
    mockVoz.descartar.mockResolvedValue(undefined);
    mockVoz.tomar.mockReset();
    transcribirMock.mockReset();
    // `Gesture.Pan` se espía DESDE ANTES del `render`: `MicFuncion` vive en el listado.
    espiaPan = jest.spyOn(Gesture, 'Pan');
  });

  afterEach(() => {
    espiaPan.mockRestore();
  });

  it('dictado → abre el alta con `concepto` prellenado, y NO guarda nada solo (DoD FE2 §4)', async () => {
    mockVoz.tomar.mockReturnValue({ nombre: 'voz.m4a', mime: 'audio/m4a', datos: 'file:///cache/voz.m4a' });
    transcribirMock.mockResolvedValue({ transcript: 'venta de pan dulce' });

    await montar();
    await waitFor(() => expect(screen.getByTestId('ingresos-nuevo')).toBeTruthy());

    await dictar(espiaPan);

    await waitFor(() => expect(screen.getByTestId('ingreso-form-concepto-input')).toBeTruthy());
    expect(screen.getByTestId('ingreso-form-concepto-input').props.value).toBe('venta de pan dulce');
    expect(registrarMock).not.toHaveBeenCalled();
  });

  it('transcripción vacía NO abre el alta — se queda en el listado con el error del mic', async () => {
    mockVoz.tomar.mockReturnValue({ nombre: 'voz.m4a', mime: 'audio/m4a', datos: 'file:///cache/voz.m4a' });
    transcribirMock.mockResolvedValue({ transcript: '   ' });

    await montar();
    await waitFor(() => expect(screen.getByTestId('ingresos-nuevo')).toBeTruthy());

    await dictar(espiaPan);

    await waitFor(() => expect(screen.getByTestId('ingresos-mic-error')).toBeTruthy());
    expect(screen.getByTestId('ingresos-mic-error')).toHaveTextContent('No se entendió el audio. Probá de nuevo.');
    expect(screen.queryByTestId('ingreso-form-concepto-input')).toBeNull();
    expect(registrarMock).not.toHaveBeenCalled();
  });

  it('«Anotar que me pagaron» sigue abriendo el alta EN BLANCO — el mic no le pisa el flujo manual', async () => {
    await montar();
    await waitFor(() => expect(screen.getByTestId('ingresos-nuevo')).toBeTruthy());

    await act(async () => {
      fireEvent.press(screen.getByTestId('ingresos-nuevo'));
    });

    await waitFor(() => expect(screen.getByTestId('ingreso-form-concepto-input')).toBeTruthy());
    expect(screen.getByTestId('ingreso-form-concepto-input').props.value).toBeFalsy();
    expect(transcribirMock).not.toHaveBeenCalled();
  });
});

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Gesture } from 'react-native-gesture-handler';

/**
 * Partial mock de `@copiloto/core`: sólo las funciones de red. `ApiError`, `formatearImporte` y
 * `esDecimalPositivo` se conservan REALES — el formulario hace `e instanceof ApiError`, y una clase
 * falsa declarada acá rompe ese chequeo (la factory corre antes de que la `class` salga de su zona
 * muerta temporal). Ya se pagó ese error una vez en esta sesión.
 */
jest.mock('@copiloto/core', () => {
  const actual = jest.requireActual('@copiloto/core');
  return {
    ...actual,
    listarGastos: jest.fn(),
    obtenerResumenGastos: jest.fn(),
    crearGasto: jest.fn(),
    obtenerGasto: jest.fn(),
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

import {
  crearGasto,
  listarGastos,
  obtenerGasto,
  obtenerResumenGastos,
  transcribir,
  type Gasto,
  type ResumenGastos,
} from '@copiloto/core';

import { ThemeProvider } from '../../theme/ThemeProvider';
import { PantallaGastos } from './PantallaGastos';

const mockListar = listarGastos as jest.MockedFunction<typeof listarGastos>;
const mockResumen = obtenerResumenGastos as jest.MockedFunction<typeof obtenerResumenGastos>;
const mockCrear = crearGasto as jest.MockedFunction<typeof crearGasto>;
const mockDetalle = obtenerGasto as jest.MockedFunction<typeof obtenerGasto>;
const mockTranscribir = transcribir as jest.MockedFunction<typeof transcribir>;

/** Dispara el ciclo completo del gesto de `BotonVoz` (apretar `MIN_HOLD_MS` y soltar) — mismo
 * mecanismo que `MicFuncion.test.tsx` (mobile): `Gesture.Pan` tiene que estar espiado DESDE ANTES
 * del `render` (el recognizer se crea al montar `MicFuncion`, que vive en el listado, no dentro del
 * formulario) — por eso el `jest.spyOn` se arma en `beforeEach`, no acá adentro. */
async function dictar(espiaPan: ReturnType<typeof jest.spyOn>) {
  const recognizer = espiaPan.mock.results[espiaPan.mock.results.length - 1]?.value as {
    handlers: { onBegin?: (e: unknown) => void; onFinalize?: (e: unknown, exito: boolean) => void };
  };
  let ahora = 1_000_000;
  const relojEspia = jest.spyOn(Date, 'now').mockImplementation(() => ahora);
  await act(async () => {
    recognizer.handlers.onBegin?.({});
  });
  ahora += 400; // supera DURACION_MINIMA_MS (350ms) de BotonVoz
  await act(async () => {
    recognizer.handlers.onFinalize?.({}, true);
  });
  relojEspia.mockRestore();
}

function gasto(over: Partial<Gasto> = {}): Gasto {
  return {
    id: 2,
    monto: '15000.50',
    montoSugerido: null,
    fecha: '2026-07-21',
    categoria: 'mercaderia',
    proveedor: 'Distribuidora Sur',
    medioPago: 'efectivo',
    descripcion: null,
    origen: 'manual',
    creadoEn: '2026-07-22T01:41:08.185511+00:00',
    ...over,
  };
}

function resumen(over: Partial<ResumenGastos> = {}): ResumenGastos {
  return {
    periodo: '2026-07',
    total: '15000.50',
    porCategoria: [{ categoria: 'mercaderia', total: '15000.50', porcentaje: 100 }],
    mesAnterior: null,
    ...over,
  };
}

/** 🔴 `render` es ASÍNCRONO en RNTL 14 + React 19 — sin `await` el árbol no existe todavía. */
async function montar() {
  return render(
    <ThemeProvider>
      <PantallaGastos />
    </ThemeProvider>,
  );
}

/** Escribir en un campo montado DESPUÉS del render inicial necesita su propio `act`. */
async function escribir(testID: string, texto: string) {
  await act(async () => {
    fireEvent.changeText(screen.getByTestId(`${testID}-input`), texto);
  });
}

describe('PantallaGastos', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockListar.mockResolvedValue({ status: 'ok', gastos: [gasto()], total: 1 });
    mockResumen.mockResolvedValue({ status: 'ok', resumen: resumen() });
    mockDetalle.mockResolvedValue({ status: 'ok', gasto: gasto() });
  });

  describe('detalle', () => {
    it('🔴 abre directo el gasto que llegó por la lista de actividad, buscándolo por id', async () => {
      // Quien navega acá sólo trae un número: el objeto puede no estar en la página cargada, o la
      // lista puede estar vieja. Por eso se busca, no se toma de lo que ya se tenía.
      await render(
        <ThemeProvider>
          <PantallaGastos gastoIdInicial={2} />
        </ThemeProvider>,
      );

      await waitFor(() => expect(mockDetalle).toHaveBeenCalledWith(2));
      await waitFor(() => expect(screen.getByTestId('detalle-gasto-monto')).toBeTruthy());
    });

    it('si el id no existe NO abre nada — queda el listado', async () => {
      mockDetalle.mockResolvedValue({ status: 'no_encontrado' });

      await render(
        <ThemeProvider>
          <PantallaGastos gastoIdInicial={99999} />
        </ThemeProvider>,
      );

      await waitFor(() => expect(screen.getByTestId('gastos-lista')).toBeTruthy());
      expect(screen.queryByTestId('detalle-gasto')).toBeNull();
    });

    it('tocar una card lo abre y lo RE-PIDE por id', async () => {
      // El listado puede estar viejo —el copiloto pudo registrar algo por voz mientras la pantalla
      // estaba abierta— y el detalle es justo donde uno mira el número con atención.
      await montar();
      await waitFor(() => expect(screen.getByTestId('gasto-2')).toBeTruthy());

      await act(async () => {
        fireEvent.press(screen.getByTestId('gasto-2'));
      });

      await waitFor(() => expect(mockDetalle).toHaveBeenCalledWith(2));
      expect(screen.getByTestId('detalle-gasto-monto')).toHaveTextContent('$15.000,50');
    });

    it('un 404 dice "no encontramos", no "no disponible"', async () => {
      mockDetalle.mockResolvedValue({ status: 'no_encontrado' });
      await montar();
      await waitFor(() => expect(screen.getByTestId('gasto-2')).toBeTruthy());

      await act(async () => {
        fireEvent.press(screen.getByTestId('gasto-2'));
      });

      await waitFor(() => expect(screen.getByTestId('detalle-gasto-no-encontrado')).toBeTruthy());
    });
  });

  it('pinta el resumen del mes y el listado', async () => {
    await montar();

    await waitFor(() => expect(screen.getByTestId('gastos-resumen-cifra')).toBeTruthy());
    // El importe se muestra formateado en argentino, no crudo del backend.
    expect(screen.getByTestId('gastos-resumen-cifra')).toHaveTextContent('$15.000,50');
    expect(screen.getByTestId('gasto-2-titulo')).toHaveTextContent('Distribuidora Sur');
    expect(screen.getByTestId('gasto-2-monto')).toHaveTextContent('$15.000,50');
  });

  it('un resumen caído NO tumba el listado', async () => {
    // Son dos endpoints. Tratarlos como uno haría que un fallo del agregado esconda los datos que sí
    // llegaron — y el usuario vería "no disponible" sobre gastos que existen.
    mockResumen.mockResolvedValue({ status: 'no_disponible' });

    await montar();

    await waitFor(() => expect(screen.getByTestId('gasto-2-titulo')).toBeTruthy());
    expect(screen.queryByTestId('gastos-resumen')).toBeNull();
  });

  it('el endpoint no desplegado avisa, no explota', async () => {
    mockListar.mockResolvedValue({ status: 'no_disponible' });

    await montar();

    await waitFor(() => expect(screen.getByTestId('gastos-no-disponible')).toBeTruthy());
  });

  it('sin gastos invita a usar la voz, sin parecer un error', async () => {
    mockListar.mockResolvedValue({ status: 'ok', gastos: [], total: 0 });
    mockResumen.mockResolvedValue({ status: 'ok', resumen: resumen({ total: '0.00', porCategoria: [] }) });

    await montar();

    await waitFor(() => expect(screen.getByTestId('gastos-vacio')).toBeTruthy());
    // `0.00` es un DATO ("no gastaste nada"), así que el resumen se muestra igual.
    expect(screen.getByTestId('gastos-resumen-cifra')).toHaveTextContent('$0,00');
  });

  it('avisa cuando la página muestra menos gastos que los que hay', async () => {
    mockListar.mockResolvedValue({ status: 'ok', gastos: [gasto()], total: 137 });

    await montar();

    await waitFor(() => expect(screen.getByTestId('gastos-total')).toBeTruthy());
    expect(screen.getByTestId('gastos-total')).toHaveTextContent('Mostrando 1 de 137 gastos.');
  });

  describe('alta manual', () => {
    async function abrirFormulario() {
      await montar();
      await waitFor(() => expect(screen.getByTestId('gastos-nuevo')).toBeTruthy());
      await act(async () => {
        fireEvent.press(screen.getByTestId('gastos-nuevo'));
      });
    }

    it('no deja guardar sin monto, y sí con monto', async () => {
      await abrirFormulario();

      expect(screen.getByTestId('gasto-guardar').props.accessibilityState?.disabled).toBe(true);

      await escribir('gasto-monto', '15000');

      expect(screen.getByTestId('gasto-guardar').props.accessibilityState?.disabled).toBe(false);
    });

    it('🔴 acepta el monto escrito con COMA y lo manda con punto', async () => {
      // El teclado numérico entrega coma en configuración regional argentina, y el backend hace
      // `Decimal("15000,50")` → InvalidOperation → 400. Sin esta normalización, el emprendedor
      // escribe el importe como lo escribe todo el país y la app le dice que está mal.
      mockCrear.mockResolvedValue({ status: 'ok', gasto: gasto() });
      await abrirFormulario();

      await escribir('gasto-monto', '15000,50');
      await act(async () => {
        fireEvent.press(screen.getByTestId('gasto-guardar'));
      });

      expect(mockCrear).toHaveBeenCalledWith(expect.objectContaining({ monto: '15000.50' }));
    });

    it('un monto en cero no habilita el botón — el backend lo rechaza con 400', async () => {
      await abrirFormulario();

      await escribir('gasto-monto', '0');

      expect(screen.getByTestId('gasto-guardar').props.accessibilityState?.disabled).toBe(true);
    });

    it('NO manda `fecha` — el backend pone hoy en hora de Argentina', async () => {
      // Calcularla acá con `new Date().toISOString()` daría el día siguiente después de las 21:00
      // ART, y movería el gasto de MES los días 30 y 31 — justo en el resumen.
      mockCrear.mockResolvedValue({ status: 'ok', gasto: gasto() });
      await abrirFormulario();

      await escribir('gasto-monto', '900');
      await act(async () => {
        fireEvent.press(screen.getByTestId('gasto-guardar'));
      });

      expect(mockCrear.mock.calls[0][0]).not.toHaveProperty('fecha');
    });

    it('no manda los opcionales vacíos como string vacío', async () => {
      // Mandar `""` guardaría un proveedor vacío en vez de nulo, y el listado mostraría una card con
      // el título en blanco.
      mockCrear.mockResolvedValue({ status: 'ok', gasto: gasto() });
      await abrirFormulario();

      await escribir('gasto-monto', '900');
      await act(async () => {
        fireEvent.press(screen.getByTestId('gasto-guardar'));
      });

      expect(mockCrear.mock.calls[0][0]).not.toHaveProperty('proveedor');
      expect(mockCrear.mock.calls[0][0]).not.toHaveProperty('medioPago');
    });

    it('manda origen "manual" desde el formulario del escritorio', async () => {
      mockCrear.mockResolvedValue({ status: 'ok', gasto: gasto() });
      await abrirFormulario();

      await escribir('gasto-monto', '900');
      await act(async () => {
        fireEvent.press(screen.getByTestId('gasto-guardar'));
      });

      expect(mockCrear).toHaveBeenCalledWith(expect.objectContaining({ origen: 'manual' }));
    });

    it('al crear vuelve al listado y RE-LEE lista y resumen', async () => {
      // El resumen es un agregado del backend: no se puede recalcular a mano sin hacer aritmética de
      // plata del lado del cliente. Y dos números que se contradicen en la misma pantalla destruyen
      // la confianza en el que importa.
      mockCrear.mockResolvedValue({ status: 'ok', gasto: gasto() });
      await abrirFormulario();

      await escribir('gasto-monto', '900');
      await act(async () => {
        fireEvent.press(screen.getByTestId('gasto-guardar'));
      });

      await waitFor(() => expect(screen.getByTestId('gastos-nuevo')).toBeTruthy());
      expect(mockListar).toHaveBeenCalledTimes(2);
      expect(mockResumen).toHaveBeenCalledTimes(2);
    });

    it('muestra el `detail` del backend tal cual cuando el alta falla', async () => {
      const { ApiError } = jest.requireActual('@copiloto/core');
      mockCrear.mockRejectedValue(new ApiError(400, 'falta monto', 'falta monto', { detail: 'falta monto' }));
      await abrirFormulario();

      await escribir('gasto-monto', '900');
      await act(async () => {
        fireEvent.press(screen.getByTestId('gasto-guardar'));
      });

      await waitFor(() => expect(screen.getByTestId('gasto-error')).toBeTruthy());
      expect(screen.getByTestId('gasto-error')).toHaveTextContent('falta monto');
    });
  });
});

describe('PantallaGastos — BL-J7/K-10 (mic en la fila del rótulo)', () => {
  let espiaPan: ReturnType<typeof jest.spyOn>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockListar.mockResolvedValue({ status: 'ok', gastos: [], total: 0 });
    mockResumen.mockResolvedValue({ status: 'ok', resumen: resumen({ total: '0.00', porCategoria: [] }) });
    mockVoz.fase = 'inactivo';
    mockVoz.niveles = [];
    mockVoz.iniciar.mockResolvedValue(true);
    mockVoz.detener.mockResolvedValue(undefined);
    mockVoz.descartar.mockResolvedValue(undefined);
    mockVoz.tomar.mockReset();
    // `Gesture.Pan` se espía DESDE ANTES del `render`: `MicFuncion` vive en el listado y crea el
    // recognizer al montar, no al abrir el formulario.
    espiaPan = jest.spyOn(Gesture, 'Pan');
  });

  afterEach(() => {
    espiaPan.mockRestore();
  });

  it('dictado → abre el alta con `descripcion` prellenada, y NO guarda nada solo (DoD FE2 §4)', async () => {
    mockVoz.tomar.mockReturnValue({ nombre: 'voz.m4a', mime: 'audio/m4a', datos: 'file:///cache/voz.m4a' });
    mockTranscribir.mockResolvedValue({ transcript: 'cuarenta litros de nafta' });

    await montar();
    await waitFor(() => expect(screen.getByTestId('gastos-nuevo')).toBeTruthy());

    await dictar(espiaPan);

    await waitFor(() => expect(screen.getByTestId('gasto-descripcion-input')).toBeTruthy());
    expect(screen.getByTestId('gasto-descripcion-input').props.value).toBe('cuarenta litros de nafta');
    expect(mockCrear).not.toHaveBeenCalled();
  });

  it('transcripción vacía NO abre el alta — se queda en el listado con el error del mic', async () => {
    mockVoz.tomar.mockReturnValue({ nombre: 'voz.m4a', mime: 'audio/m4a', datos: 'file:///cache/voz.m4a' });
    mockTranscribir.mockResolvedValue({ transcript: '   ' });

    await montar();
    await waitFor(() => expect(screen.getByTestId('gastos-nuevo')).toBeTruthy());

    await dictar(espiaPan);

    await waitFor(() => expect(screen.getByTestId('gastos-mic-error')).toBeTruthy());
    expect(screen.getByTestId('gastos-mic-error')).toHaveTextContent('No se entendió el audio. Probá de nuevo.');
    expect(screen.queryByTestId('gasto-descripcion-input')).toBeNull();
    expect(mockCrear).not.toHaveBeenCalled();
  });

  it('«Nuevo gasto» sigue abriendo el alta EN BLANCO — el mic no le pisa el flujo manual', async () => {
    await montar();
    await waitFor(() => expect(screen.getByTestId('gastos-nuevo')).toBeTruthy());

    await act(async () => {
      fireEvent.press(screen.getByTestId('gastos-nuevo'));
    });

    await waitFor(() => expect(screen.getByTestId('gasto-descripcion-input')).toBeTruthy());
    expect(screen.getByTestId('gasto-descripcion-input').props.value).toBeFalsy();
    expect(mockTranscribir).not.toHaveBeenCalled();
  });
});

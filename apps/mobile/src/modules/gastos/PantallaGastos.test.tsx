import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

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
  };
});

import {
  crearGasto,
  listarGastos,
  obtenerGasto,
  obtenerResumenGastos,
  type Gasto,
  type ResumenGastos,
} from '@copiloto/core';

import { ThemeProvider } from '../../theme/ThemeProvider';
import { PantallaGastos } from './PantallaGastos';

const mockListar = listarGastos as jest.MockedFunction<typeof listarGastos>;
const mockResumen = obtenerResumenGastos as jest.MockedFunction<typeof obtenerResumenGastos>;
const mockCrear = crearGasto as jest.MockedFunction<typeof crearGasto>;
const mockDetalle = obtenerGasto as jest.MockedFunction<typeof obtenerGasto>;

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

    await waitFor(() => expect(screen.getByTestId('gastos-resumen-total')).toBeTruthy());
    // El importe se muestra formateado en argentino, no crudo del backend.
    expect(screen.getByTestId('gastos-resumen-total')).toHaveTextContent('$15.000,50');
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
    expect(screen.getByTestId('gastos-resumen-total')).toHaveTextContent('$0,00');
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

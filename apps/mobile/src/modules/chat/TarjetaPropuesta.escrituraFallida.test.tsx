import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

// SM-D6 (#1008) — la MITAD del DoD que el camino feliz no cubre: qué dice la card cuando la escritura
// FALLA. «No lo anotamos.» sólo es verdad si el emprendedor la descartó; con un POST caído o rechazado
// la card tiene que seguir editable y decir el motivo, nunca pasar a «descartado» ni a «guardado».

/** Partial mock: sólo la red. `ApiError`, los parsers y los formateadores, REALES. */
jest.mock('@copiloto/core', () => {
  const actual = jest.requireActual('@copiloto/core');
  return { ...actual, registrarIngreso: jest.fn(), crearGasto: jest.fn() };
});
jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn() } }));

import {
  ApiError,
  crearGasto,
  leerGastoPropuesto,
  leerIngresoPropuesto,
  registrarIngreso,
  type Gasto,
  type Ingreso,
} from '@copiloto/core';

import { ThemeProvider } from '../../theme/ThemeProvider';
import { TarjetaGastoPropuesto } from './TarjetaGastoPropuesto';
import { TarjetaIngresoPropuesto } from './TarjetaIngresoPropuesto';

const mockRegistrar = registrarIngreso as jest.MockedFunction<typeof registrarIngreso>;
const mockCrear = crearGasto as jest.MockedFunction<typeof crearGasto>;

const ingreso = leerIngresoPropuesto({
  kind: 'ingreso_propuesto',
  data: {
    monto: '85000.00',
    medio: 'efectivo',
    cliente_nombre: 'Panadería La Esquina',
    concepto: 'pintura',
    fecha: '2026-07-23',
  },
});
const gasto = leerGastoPropuesto({
  kind: 'gasto_propuesto',
  data: {
    monto: '50000.00',
    fecha: '2026-07-20',
    categoria: 'mercaderia',
    proveedor: 'Distribuidora Sur',
    medio_pago: null,
    descripcion: 'mercadería',
    origen: 'voz',
  },
});
if (ingreso == null || gasto == null) throw new Error('las propuestas de prueba no deberían ser null');

const ingresoGuardado: Ingreso = {
  id: 9,
  monto: '85000.00',
  medio: 'efectivo',
  fecha: '2026-07-23',
  origen: 'manual',
  clienteNombre: 'Panadería La Esquina',
  concepto: 'pintura',
  comprobanteId: null,
  comprobanteNro: null,
  presupuestoRef: null,
  falta: [],
  borrable: true,
};
const gastoGuardado: Gasto = {
  id: 9,
  monto: '50000.00',
  montoSugerido: null,
  fecha: '2026-07-20',
  categoria: 'mercaderia',
  proveedor: 'Distribuidora Sur',
  medioPago: null,
  descripcion: null,
  origen: 'voz',
  creadoEn: '2026-07-22T02:00:00+00:00',
  imputacion: null,
};

function conTema(ui: React.ReactElement) {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
}

describe('SM-D6 — la card refleja el resultado REAL de la escritura', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('ingreso', () => {
    it('POST rechazado: se ve el motivo, la card sigue editable y NO dice «No lo anotamos.» ni «anotado»', async () => {
      mockRegistrar.mockResolvedValue({ status: 'rechazado', motivo: 'El monto es demasiado alto' });
      const onResolver = jest.fn();
      await conTema(<TarjetaIngresoPropuesto propuesta={ingreso} onResolver={onResolver} />);

      await act(async () => {
        fireEvent.press(screen.getByTestId('ingreso-propuesto-formulario-guardar'));
      });

      await waitFor(() => expect(screen.getByTestId('ingreso-propuesto-formulario-error')).toBeTruthy());
      expect(screen.getByTestId('ingreso-propuesto-formulario-error')).toHaveTextContent('El monto es demasiado alto');
      expect(screen.queryByTestId('ingreso-propuesto-descartado')).toBeNull();
      expect(screen.queryByTestId('ingreso-propuesto-guardado')).toBeNull();
      // Sigue editable: se puede reintentar.
      expect(screen.getByTestId('ingreso-propuesto-formulario-guardar')).toBeTruthy();
      // Y NO se persistió ningún estado terminal en el mensaje.
      expect(onResolver).not.toHaveBeenCalled();
    });

    it('POST caído (la promesa rechaza): mensaje de error, card editable, nada terminal persistido', async () => {
      mockRegistrar.mockRejectedValue(new Error('network'));
      const onResolver = jest.fn();
      await conTema(<TarjetaIngresoPropuesto propuesta={ingreso} onResolver={onResolver} />);

      await act(async () => {
        fireEvent.press(screen.getByTestId('ingreso-propuesto-formulario-guardar'));
      });

      await waitFor(() => expect(screen.getByTestId('ingreso-propuesto-formulario-error')).toBeTruthy());
      expect(screen.queryByTestId('ingreso-propuesto-descartado')).toBeNull();
      expect(screen.queryByTestId('ingreso-propuesto-guardado')).toBeNull();
      expect(onResolver).not.toHaveBeenCalled();
    });

    it('tras un fallo, reintentar y que ESCRIBA termina bien (control: la mitad buena sigue viva)', async () => {
      mockRegistrar
        .mockResolvedValueOnce({ status: 'rechazado', motivo: 'Probá de nuevo' })
        .mockResolvedValueOnce({ status: 'ok', ingreso: ingresoGuardado });
      await conTema(<TarjetaIngresoPropuesto propuesta={ingreso} />);

      await act(async () => {
        fireEvent.press(screen.getByTestId('ingreso-propuesto-formulario-guardar'));
      });
      await waitFor(() => expect(screen.getByTestId('ingreso-propuesto-formulario-error')).toBeTruthy());

      await act(async () => {
        fireEvent.press(screen.getByTestId('ingreso-propuesto-formulario-guardar'));
      });
      await waitFor(() => expect(screen.getByTestId('ingreso-propuesto-formulario-completo')).toBeTruthy());
      expect(screen.queryByTestId('ingreso-propuesto-formulario-error')).toBeNull();
      expect(screen.queryByTestId('ingreso-propuesto-descartado')).toBeNull();
      expect(mockRegistrar).toHaveBeenCalledTimes(2);
    });
  });

  describe('gasto', () => {
    it('POST rechazado con detalle del backend: se ve tal cual, card editable, ni «No lo anotamos.» ni «anotado»', async () => {
      mockCrear.mockRejectedValue(new ApiError(422, 'falta monto', 'falta monto', { detail: 'falta monto' }));
      const onResolver = jest.fn();
      await conTema(<TarjetaGastoPropuesto propuesta={gasto} onResolver={onResolver} />);

      await act(async () => {
        fireEvent.press(screen.getByTestId('gasto-guardar'));
      });

      await waitFor(() => expect(screen.getByTestId('gasto-error')).toBeTruthy());
      expect(screen.getByTestId('gasto-error')).toHaveTextContent('falta monto');
      expect(screen.queryByTestId('gasto-propuesto-descartado')).toBeNull();
      expect(screen.queryByTestId('gasto-propuesto-guardado')).toBeNull();
      expect(screen.getByTestId('gasto-guardar')).toBeTruthy();
      expect(onResolver).not.toHaveBeenCalled();
    });

    it('endpoint no disponible: lo dice y la card no se da por resuelta', async () => {
      mockCrear.mockResolvedValue({ status: 'no_disponible' });
      const onResolver = jest.fn();
      await conTema(<TarjetaGastoPropuesto propuesta={gasto} onResolver={onResolver} />);

      await act(async () => {
        fireEvent.press(screen.getByTestId('gasto-guardar'));
      });

      await waitFor(() => expect(screen.getByTestId('gasto-error')).toBeTruthy());
      expect(screen.queryByTestId('gasto-propuesto-descartado')).toBeNull();
      expect(screen.queryByTestId('gasto-propuesto-guardado')).toBeNull();
      expect(onResolver).not.toHaveBeenCalled();
    });

    it('tras un fallo, reintentar y que ESCRIBA termina en «Gasto anotado» (control positivo)', async () => {
      mockCrear
        .mockRejectedValueOnce(new ApiError(500, 'boom', 'boom', {}))
        .mockResolvedValueOnce({ status: 'ok', gasto: gastoGuardado });
      await conTema(<TarjetaGastoPropuesto propuesta={gasto} />);

      await act(async () => {
        fireEvent.press(screen.getByTestId('gasto-guardar'));
      });
      await waitFor(() => expect(screen.getByTestId('gasto-error')).toBeTruthy());

      await act(async () => {
        fireEvent.press(screen.getByTestId('gasto-guardar'));
      });
      await waitFor(() => expect(screen.getByTestId('gasto-propuesto-guardado')).toBeTruthy());
      expect(screen.getByTestId('gasto-propuesto-guardado')).toHaveTextContent('Gasto anotado: $50.000,00');
    });
  });
});

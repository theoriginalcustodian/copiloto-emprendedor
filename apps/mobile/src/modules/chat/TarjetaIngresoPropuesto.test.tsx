import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

/** Partial mock: sólo la red. `leerIngresoPropuesto` y los normalizadores, REALES. */
jest.mock('@copiloto/core', () => {
  const actual = jest.requireActual('@copiloto/core');
  return { ...actual, registrarIngreso: jest.fn() };
});

import { leerIngresoPropuesto, registrarIngreso, type Ingreso } from '@copiloto/core';

import { ThemeProvider } from '../../theme/ThemeProvider';
import { TarjetaIngresoPropuesto } from './TarjetaIngresoPropuesto';

const mockRegistrar = registrarIngreso as jest.MockedFunction<typeof registrarIngreso>;

function propuesta(over: Record<string, unknown> = {}) {
  const p = leerIngresoPropuesto({
    kind: 'ingreso_propuesto',
    data: {
      monto: '85000.00',
      medio: 'efectivo',
      cliente_nombre: 'Panadería La Esquina',
      concepto: 'pintura del local',
      fecha: '2026-07-23',
      ...over,
    },
  });
  if (p == null) throw new Error('la propuesta de prueba no debería ser null');
  return p;
}

function ingresoGuardado(over: Partial<Ingreso> = {}): Ingreso {
  return {
    id: 9, monto: '85000.00', medio: 'efectivo', fecha: '2026-07-23', origen: 'manual',
    clienteNombre: 'Panadería La Esquina', concepto: 'pintura del local', comprobanteId: null,
    comprobanteNro: null, presupuestoRef: null, falta: [], borrable: true, ...over,
  };
}

async function montar(p = propuesta()) {
  return render(
    <ThemeProvider>
      <TarjetaIngresoPropuesto propuesta={p} />
    </ThemeProvider>,
  );
}

describe('TarjetaIngresoPropuesto', () => {
  beforeEach(() => jest.clearAllMocks());

  it('dice explícitamente que TODAVÍA no se guardó', async () => {
    await montar();

    expect(screen.getByTestId('ingreso-propuesto-aviso')).toHaveTextContent(
      'Esto entendí. Revisalo y tocá Anotar — todavía no lo guardé.',
    );
  });

  it('muestra lo que se dictó, textual, para poder contrastarlo', async () => {
    await montar();

    expect(screen.getByTestId('ingreso-propuesto-dicho')).toHaveTextContent('«pintura del local»');
  });

  it('🔴 permite CORREGIR el monto mal transcripto antes de guardar', async () => {
    mockRegistrar.mockResolvedValue({ status: 'ok', ingreso: ingresoGuardado({ monto: '15000.00' }) });
    await montar();

    await act(async () => {
      fireEvent.changeText(screen.getByTestId('ingreso-propuesto-formulario-monto-input'), '15000');
    });
    await act(async () => {
      fireEvent.press(screen.getByTestId('ingreso-propuesto-formulario-guardar'));
    });

    expect(mockRegistrar).toHaveBeenCalledWith(expect.objectContaining({ monto: '15000' }));
  });

  it('🔴 guarda con `origen:"voz"` — sin esto, el ingreso dictado queda indistinguible de uno tipeado', async () => {
    mockRegistrar.mockResolvedValue({ status: 'ok', ingreso: ingresoGuardado({ origen: 'voz' }) });
    await montar();

    await act(async () => {
      fireEvent.press(screen.getByTestId('ingreso-propuesto-formulario-guardar'));
    });

    expect(mockRegistrar).toHaveBeenCalledWith(expect.objectContaining({ origen: 'voz' }));
  });

  it('manda la FECHA que resolvió el motor, no la de hoy — sin campo propio, silenciosa', async () => {
    mockRegistrar.mockResolvedValue({ status: 'ok', ingreso: ingresoGuardado() });
    await montar();

    await act(async () => {
      fireEvent.press(screen.getByTestId('ingreso-propuesto-formulario-guardar'));
    });

    expect(mockRegistrar).toHaveBeenCalledWith(expect.objectContaining({ fecha: '2026-07-23' }));
  });

  it('al guardar, el formulario sigue montado y muestra su propia confirmación', async () => {
    mockRegistrar.mockResolvedValue({ status: 'ok', ingreso: ingresoGuardado() });
    await montar();

    await act(async () => {
      fireEvent.press(screen.getByTestId('ingreso-propuesto-formulario-guardar'));
    });

    // `FormularioIngreso` ya sabe mostrar "completo" cuando `falta` viene vacío — la card no lo tapa.
    await waitFor(() => expect(screen.getByTestId('ingreso-propuesto-formulario-completo')).toBeTruthy());
    expect(screen.queryByTestId('ingreso-propuesto-formulario-guardar')).toBeNull();
  });

  it('regresión: "Así está bien" tras un guardado incompleto NO lo marca como descartado — ya se guardó', async () => {
    mockRegistrar.mockResolvedValue({ status: 'ok', ingreso: ingresoGuardado({ falta: ['medio'] }) });
    await montar();

    await act(async () => {
      fireEvent.press(screen.getByTestId('ingreso-propuesto-formulario-guardar'));
    });
    await waitFor(() => expect(screen.getByTestId('ingreso-propuesto-formulario-listo')).toBeTruthy());

    await act(async () => {
      fireEvent.press(screen.getByTestId('ingreso-propuesto-formulario-listo'));
    });

    // Bug real (mismo patrón cazado antes en la card web equivalente, PR #425): "Así está bien"
    // reusaba el mismo handler que "Cancelar" y la card terminaba en 'descartado' ("No lo anotamos")
    // sobre un ingreso que SÍ se había guardado (registrarIngreso ya había resuelto 201). Va al Tile
    // de ÉXITO, no al de descarte.
    expect(screen.getByTestId('ingreso-propuesto-guardado')).toBeTruthy();
    expect(screen.queryByTestId('ingreso-propuesto-descartado')).toBeNull();
    expect(screen.getByTestId('ingreso-propuesto-guardado')).toHaveTextContent('Ingreso anotado: $85.000,00');
    expect(mockRegistrar).toHaveBeenCalledTimes(1); // "Así está bien" no reintenta el POST
  });

  it('descartar no guarda nada', async () => {
    await montar();

    await act(async () => {
      fireEvent.press(screen.getByTestId('ingreso-propuesto-formulario-cancelar'));
    });

    expect(screen.getByTestId('ingreso-propuesto-descartado')).toBeTruthy();
    expect(mockRegistrar).not.toHaveBeenCalled();
  });
});

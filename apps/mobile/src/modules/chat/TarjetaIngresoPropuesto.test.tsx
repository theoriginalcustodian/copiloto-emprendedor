import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

/** Partial mock: sólo la red. `leerIngresoPropuesto` y los normalizadores, REALES. */
jest.mock('@copiloto/core', () => {
  const actual = jest.requireActual('@copiloto/core');
  return { ...actual, registrarIngreso: jest.fn() };
});

import { leerIngresoPropuesto, registrarIngreso, type ChatMessage, type Ingreso } from '@copiloto/core';

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

async function montar(
  p = propuesta(),
  opts: { resuelto?: ChatMessage['ingresoResuelto']; onResolver?: (patch: NonNullable<ChatMessage['ingresoResuelto']>) => void } = {},
) {
  return render(
    <ThemeProvider>
      <TarjetaIngresoPropuesto propuesta={p} resuelto={opts.resuelto} onResolver={opts.onResolver} />
    </ThemeProvider>,
  );
}

describe('TarjetaIngresoPropuesto', () => {
  beforeEach(() => jest.clearAllMocks());

  it('dice explícitamente que TODAVÍA no se guardó', async () => {
    await montar();

    // 14/11: la card pasó a resumen. El título nombra el registro y el aviso es el contrato, textual.
    expect(screen.getByTestId('ingreso-propuesto-titulo')).toHaveTextContent('Nuevo ingreso');
    expect(screen.getByTestId('ingreso-propuesto-aviso')).toHaveTextContent('Todavía no se guardó nada.');
  });

  it('muestra lo que entendió como RESUMEN: la cifra y una fila por dato, sin la cita de lo dictado', async () => {
    // 14/11 (Martin): la cita repetía lo que ya está en la burbuja del usuario y en la fila «Trabajo».
    await montar();

    expect(screen.queryByTestId('ingreso-propuesto-dicho')).toBeNull();
    expect(screen.getByTestId('ingreso-propuesto-formulario-monto-cifra')).toHaveTextContent('$85.000,00');
    expect(screen.getByTestId('ingreso-propuesto-formulario-cliente-cambiar')).toHaveTextContent(/Panadería La Esquina/);
    expect(screen.getByTestId('ingreso-propuesto-formulario-medio-cambiar')).toHaveTextContent(/efectivo/);
    expect(screen.getByTestId('ingreso-propuesto-formulario-concepto-cambiar')).toHaveTextContent(/pintura del local/);
    // Nada abierto de entrada, y sin «Agregar…»: no quedó ningún opcional vacío.
    expect(screen.queryByTestId('ingreso-propuesto-formulario-monto-input')).toBeNull();
    expect(screen.queryByTestId('ingreso-propuesto-formulario-mas-datos')).toBeNull();
  });

  it('los opcionales que no se dictaron quedan detrás de «Agregar…» y se abren al tocarlo', async () => {
    await montar(propuesta({ medio: null, cliente_nombre: null }));

    expect(screen.queryByTestId('ingreso-propuesto-formulario-medio-input')).toBeNull();
    await act(async () => {
      fireEvent.press(screen.getByTestId('ingreso-propuesto-formulario-mas-datos'));
    });
    expect(screen.getByTestId('ingreso-propuesto-formulario-medio-input')).toBeTruthy();
    expect(screen.getByTestId('ingreso-propuesto-formulario-cliente-input')).toBeTruthy();
  });

  it('una vez anotado, el encabezado deja de decir que no se guardó nada', async () => {
    mockRegistrar.mockResolvedValue({ status: 'ok', ingreso: ingresoGuardado({ falta: ['medio'] }) });
    await montar();

    await act(async () => {
      fireEvent.press(screen.getByTestId('ingreso-propuesto-formulario-guardar'));
    });

    await waitFor(() => expect(screen.getByTestId('ingreso-propuesto-aviso')).toHaveTextContent('Ya está anotado.'));
  });

  it('🔴 permite CORREGIR el monto mal transcripto antes de guardar', async () => {
    mockRegistrar.mockResolvedValue({ status: 'ok', ingreso: ingresoGuardado({ monto: '15000.00' }) });
    await montar();

    // En el resumen el monto es una cifra; tocarla abre el campo ahí mismo.
    await act(async () => {
      fireEvent.press(screen.getByTestId('ingreso-propuesto-formulario-monto-cambiar'));
    });
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

  /**
   * GUARDM parte 2 — guard cross-remount patrón B, mismo criterio que `TarjetaGastoPropuesto`. La
   * persistencia ocurre en el instante equivalente a `onListo` (ver docstring de la card), no en
   * `onGuardado` -- por eso el test de "al guardar" dispara TAMBIÉN "Así está bien" antes de verificar
   * `onResolver`.
   */
  describe('guard cross-remount (patrón B)', () => {
    it('control positivo: `resuelto: guardado` renderiza DIRECTO el terminal, sin el formulario', async () => {
      await montar(propuesta(), { resuelto: { estado: 'guardado', monto: '85000.00' } });

      expect(screen.getByTestId('ingreso-propuesto-guardado')).toHaveTextContent('Ingreso anotado: $85.000,00');
      expect(screen.queryByTestId('ingreso-propuesto-formulario-guardar')).toBeNull();
      expect(mockRegistrar).not.toHaveBeenCalled();
    });

    it('control positivo: `resuelto: descartado` renderiza DIRECTO el terminal de descarte', async () => {
      await montar(propuesta(), { resuelto: { estado: 'descartado' } });

      expect(screen.getByTestId('ingreso-propuesto-descartado')).toBeTruthy();
      expect(screen.queryByTestId('ingreso-propuesto-formulario-guardar')).toBeNull();
    });

    it('control negativo: sin `resuelto` sigue arrancando editable, como antes', async () => {
      await montar();

      // «Editable» = sigue ofreciendo guardar y cambiar; el campo del monto ya no está abierto de entrada.
      expect(screen.getByTestId('ingreso-propuesto-formulario-guardar')).toBeTruthy();
      expect(screen.getByTestId('ingreso-propuesto-formulario-monto-cambiar')).toBeTruthy();
      expect(screen.queryByTestId('ingreso-propuesto-guardado')).toBeNull();
    });

    it('al pasar por "Así está bien" (onListo), llama a `onResolver` con el monto guardado', async () => {
      // El botón "Así está bien" (`-listo`) sólo existe en la rama `falta.length > 0` de
      // `FormularioIngreso` (línea ~253) — con `falta: []` (el default de `ingresoGuardado()`) el
      // formulario cae directo en "-completo" y jamás dispara `onListo`. Por eso ACÁ, a diferencia
      // del resto del archivo, se fuerza un `falta` no vacío: es el único camino real hacia el botón
      // que este test necesita ejercitar.
      mockRegistrar.mockResolvedValue({ status: 'ok', ingreso: ingresoGuardado({ falta: ['medio'] }) });
      const onResolver = jest.fn();
      await montar(propuesta(), { onResolver });

      await act(async () => {
        fireEvent.press(screen.getByTestId('ingreso-propuesto-formulario-guardar'));
      });
      await waitFor(() => expect(screen.getByTestId('ingreso-propuesto-formulario-listo')).toBeTruthy());

      await act(async () => {
        fireEvent.press(screen.getByTestId('ingreso-propuesto-formulario-listo'));
      });

      expect(onResolver).toHaveBeenCalledWith({ estado: 'guardado', monto: '85000.00' });
    });

    it('al descartar, llama a `onResolver` con `descartado`', async () => {
      const onResolver = jest.fn();
      await montar(propuesta(), { onResolver });

      await act(async () => {
        fireEvent.press(screen.getByTestId('ingreso-propuesto-formulario-cancelar'));
      });

      expect(onResolver).toHaveBeenCalledWith({ estado: 'descartado' });
    });
  });
});

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

import { crearPresupuesto, leerPresupuestoPropuesto, type ChatMessage, type Presupuesto } from '@copiloto/core';

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

/** `resuelto` ya llega SINCRÓNICO (patrón B, vive en el mensaje) — pero `FormularioPresupuesto`
 *  sigue disparando `listarConceptos()` (red, async) sin gate en su propio mount (línea ~155-157).
 *  Sin esperar a que asiente, esa resolución de promesa cae FUERA de cualquier `act()` de este test
 *  y pisa el `screen` del próximo — mismo `waitFor` que usaba el `montar()` original (pre-migración,
 *  cuando lo que flusheaba era la lectura async de `AsyncStorage`), ahora sólo para el catálogo. */
async function montar(
  p = propuesta(),
  opts: { mensajeId?: string; resuelto?: ChatMessage['presupuestoResuelto']; onResolver?: (patch: NonNullable<ChatMessage['presupuestoResuelto']>) => void } = {},
) {
  const r = render(
    <ThemeProvider>
      <TarjetaPresupuestoPropuesto
        propuesta={p}
        mensajeId={opts.mensajeId ?? 'assistant-1'}
        resuelto={opts.resuelto}
        onResolver={opts.onResolver}
      />
    </ThemeProvider>,
  );
  await waitFor(() =>
    expect(
      screen.queryByTestId('presupuesto-propuesto') ??
        screen.queryByTestId('presupuesto-propuesto-guardado') ??
        screen.queryByTestId('presupuesto-propuesto-descartado'),
    ).toBeTruthy(),
  );
  return r;
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

  it('🔴 agregar/quitar filas YA está activo en la card — sin modo acotado (decisión del operador, se queda)', async () => {
    await montar();

    await act(async () => {
      fireEvent.press(screen.getByTestId('presupuesto-propuesto-formulario-agregar-item'));
    });
    expect(screen.getByTestId('presupuesto-propuesto-formulario-item-2-descripcion-input')).toBeTruthy();

    await act(async () => {
      fireEvent.press(screen.getByTestId('presupuesto-propuesto-formulario-item-2-quitar'));
    });
    expect(screen.queryByTestId('presupuesto-propuesto-formulario-item-2-descripcion-input')).toBeNull();
  });

  it('descartar no guarda nada', async () => {
    await montar();

    await act(async () => {
      fireEvent.press(screen.getByTestId('presupuesto-propuesto-formulario-cancelar'));
    });

    expect(screen.getByTestId('presupuesto-propuesto-descartado')).toBeTruthy();
    expect(mockCrear).not.toHaveBeenCalled();
  });

  it('🔴 tocar Guardar dos veces rápido NO dispara una segunda llamada, y manda la idem_key derivada del mensajeId', async () => {
    let resolver: (v: Awaited<ReturnType<typeof crearPresupuesto>>) => void = () => {};
    mockCrear.mockReturnValue(new Promise((r) => { resolver = r; }));
    await montar();

    await act(async () => {
      fireEvent.press(screen.getByTestId('presupuesto-propuesto-formulario-guardar'));
      fireEvent.press(screen.getByTestId('presupuesto-propuesto-formulario-guardar'));
    });

    expect(mockCrear).toHaveBeenCalledTimes(1);
    // BL-V32: ya no nace con el montaje (UUID) — se DERIVA del `mensajeId` de la card ('assistant-1',
    // ver `montar()` arriba), con el prefijo `presupuesto:` para no chocar con la idem_key de otra alta.
    expect(mockCrear.mock.calls[0]?.[0].idemKey).toBe('presupuesto:assistant-1');
    await act(async () => resolver({ status: 'ok', presupuesto: presupuestoGuardado(7) }));
  });

  it('K-01: un reintento tras error usa la MISMA idem_key (regenerarla anularía la protección)', async () => {
    mockCrear.mockRejectedValueOnce(new Error('red')).mockResolvedValueOnce({ status: 'ok', presupuesto: presupuestoGuardado(7) });
    await montar();

    await act(async () => {
      fireEvent.press(screen.getByTestId('presupuesto-propuesto-formulario-guardar'));
    });
    await act(async () => {
      fireEvent.press(screen.getByTestId('presupuesto-propuesto-formulario-guardar'));
    });

    expect(mockCrear).toHaveBeenCalledTimes(2);
    expect(mockCrear.mock.calls[1]?.[0].idemKey).toBe(mockCrear.mock.calls[0]?.[0].idemKey);
  });

  /**
   * GUARDM parte 2 — guard cross-remount MIGRADO de patrón A (`AsyncStorage`, K-01/BL-D1) a patrón B
   * (`resuelto`/`onResolver`, la marca vive DENTRO del mensaje). Control positivo/negativo mismo
   * criterio que `hitlRespondido` en `ListaMensajes.test.tsx`.
   */
  describe('guard cross-remount (patrón B)', () => {
    it('control positivo: `resuelto: guardado` renderiza DIRECTO el terminal, sin el formulario', async () => {
      await montar(propuesta(), { resuelto: { estado: 'guardado', numero: 7 } });

      expect(screen.getByTestId('presupuesto-propuesto-guardado')).toHaveTextContent(
        'Presupuesto anotado — N° 7',
      );
      expect(screen.queryByTestId('presupuesto-propuesto-formulario-guardar')).toBeNull();
      expect(mockCrear).not.toHaveBeenCalled();
    });

    it('control positivo: `resuelto: descartado` renderiza DIRECTO el terminal de descarte', async () => {
      await montar(propuesta(), { resuelto: { estado: 'descartado' } });

      expect(screen.getByTestId('presupuesto-propuesto-descartado')).toBeTruthy();
      expect(screen.queryByTestId('presupuesto-propuesto-formulario-guardar')).toBeNull();
    });

    it('control negativo: sin `resuelto` sigue arrancando editable, como antes', async () => {
      await montar();

      expect(screen.getByTestId('presupuesto-propuesto-formulario-guardar')).toBeTruthy();
    });

    it('al guardar, llama a `onResolver` con el número asignado', async () => {
      mockCrear.mockResolvedValue({ status: 'ok', presupuesto: presupuestoGuardado(7) });
      const onResolver = jest.fn();
      await montar(propuesta(), { onResolver });

      await act(async () => {
        fireEvent.press(screen.getByTestId('presupuesto-propuesto-formulario-guardar'));
      });

      await waitFor(() => expect(screen.getByTestId('presupuesto-propuesto-guardado')).toBeTruthy());
      expect(onResolver).toHaveBeenCalledWith({ estado: 'guardado', numero: 7 });
    });

    it('al descartar, llama a `onResolver` con `descartado`', async () => {
      const onResolver = jest.fn();
      await montar(propuesta(), { onResolver });

      await act(async () => {
        fireEvent.press(screen.getByTestId('presupuesto-propuesto-formulario-cancelar'));
      });

      expect(onResolver).toHaveBeenCalledWith({ estado: 'descartado' });
    });
  });
});

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

/** Partial mock: sólo la red. `leerFacturaPropuesta`, REAL. */
jest.mock('@copiloto/core', () => {
  const actual = jest.requireActual('@copiloto/core');
  return {
    ...actual,
    agregarItem: jest.fn(),
    cancelarFactura: jest.fn(),
    confirmarConTokenFresco: jest.fn(),
    esperarEcoDelSignal: jest.fn(),
    estadoFactura: jest.fn(),
    quitarItem: jest.fn(),
    setCliente: jest.fn(),
    setDatosVenta: jest.fn(),
  };
});

import {
  agregarItem,
  ApiError,
  cancelarFactura,
  confirmarConTokenFresco,
  esperarEcoDelSignal,
  estadoFactura,
  leerFacturaPropuesta,
  quitarItem,
  setCliente,
  setDatosVenta,
  type ChatMessage,
  type EstadoFacturaResp,
} from '@copiloto/core';

import { ThemeProvider } from '../../theme/ThemeProvider';
import { TarjetaFacturaPropuesta } from './TarjetaFacturaPropuesta';

const mockConfirmar = confirmarConTokenFresco as jest.MockedFunction<typeof confirmarConTokenFresco>;
const mockEstado = estadoFactura as jest.MockedFunction<typeof estadoFactura>;
const mockEco = esperarEcoDelSignal as jest.MockedFunction<typeof esperarEcoDelSignal>;
const mockCancelar = cancelarFactura as jest.MockedFunction<typeof cancelarFactura>;
const mockAgregar = agregarItem as jest.MockedFunction<typeof agregarItem>;
const mockQuitar = quitarItem as jest.MockedFunction<typeof quitarItem>;
const mockSetCliente = setCliente as jest.MockedFunction<typeof setCliente>;
const mockSetDatosVenta = setDatosVenta as jest.MockedFunction<typeof setDatosVenta>;

function propuesta(over: Record<string, unknown> = {}) {
  const p = leerFacturaPropuesta({
    kind: 'factura_propuesta',
    data: {
      factura_id: 'presu-12',
      faltantes: [],
      items: [{ descripcion: 'Service de aire', cantidad: 1, precio_unitario: 50000 }],
      // La forma REAL del wire (`tool_catalog.py`): `.name` del enum, no la letra ni un código. Con la
      // fixture vieja (`'C'`, `'CF'`) la card mostraba «Factura FACTURA_C» en producción y ningún test.
      cliente: { razon_social: 'Juan Pérez', cuit: '20304050607', condicion_iva: 'CONSUMIDOR_FINAL', del_registro: false },
      total: 50000,
      tipo_comprobante: 'FACTURA_C',
      ...over,
    },
  });
  if (p == null) throw new Error('la propuesta de prueba no debería ser null');
  return p;
}

/** El estado que devuelve el backend una vez emitida. `terminado: true` = el PDF y el Drive YA están. */
function emitida(over: Partial<EstadoFacturaResp> = {}): EstadoFacturaResp {
  return {
    estado: 'entregada',
    faltantes: [],
    items: [],
    total: '50000.00',
    tokenConfirmacion: null,
    resultado: {
      ok: true,
      duplicado: false,
      cae: '86294776469171',
      caeVto: '2026-09-28',
      nro: 8,
      tipoCbte: 11,
      puntoVenta: 6,
      id: null,
      alertaDobleEmision: false,
    },
    pdf: { url: 'https://afipsdk/f.pdf', nombre: 'f.pdf', expiraAt: null },
    drive: null,
    receptor: null,
    datosVenta: null,
    motivo: null,
    motivoCodigo: null,
    terminado: true,
    ...over,
  };
}

/** El borrador en el workflow, listo para confirmar: los mismos datos que trae `propuesta()`. */
function borrador(over: Partial<EstadoFacturaResp> = {}): EstadoFacturaResp {
  return emitida({
    estado: 'esperando_confirmacion',
    items: [{ descripcion: 'Service de aire', cantidad: '1', precioUnitario: '50000', subtotal: '50000.00' }],
    total: '50000',
    tokenConfirmacion: 'tok',
    resultado: null,
    pdf: null,
    receptor: { condicionIva: 5, tipoDoc: 80, nroDoc: '20304050607', nombre: 'Juan Pérez', domicilio: '' },
    datosVenta: { fecha: '2026-11-02', concepto: 1, condicionVenta: 'contado' },
    terminado: false,
    ...over,
  });
}

async function montar(
  p = propuesta(),
  opts: { resuelto?: ChatMessage['facturaResuelta']; onResolver?: () => void } = {},
) {
  return render(
    <ThemeProvider>
      <TarjetaFacturaPropuesta propuesta={p} resuelto={opts.resuelto} onResolver={opts.onResolver} />
    </ThemeProvider>,
  );
}

describe('TarjetaFacturaPropuesta', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockEstado.mockResolvedValue(borrador());
  });

  it('dice explícitamente que TODAVÍA no la mandó', async () => {
    await montar();

    expect(screen.getByTestId('factura-propuesta-aviso')).toHaveTextContent(
      'Esto entendí. Revisalo y tocá Emitir la factura — todavía no la mandé.',
    );
  });

  it('🔴 avisa ANTES de emitir que se anula con nota de crédito, no se borra (H-23)', async () => {
    await montar();

    expect(screen.getByTestId('factura-propuesta-aviso-anulacion')).toHaveTextContent(/nota de crédito/);
  });

  it('muestra cliente, ítems y total', async () => {
    await montar();

    expect(screen.getByTestId('factura-propuesta-cliente')).toHaveTextContent(/ClienteJuan Pérez · 20304050607/);
    expect(screen.getByTestId('factura-propuesta-item-0')).toHaveTextContent('Service de aire1 × 50000');
    expect(screen.getByTestId('factura-propuesta-total')).toHaveTextContent('Total: 50000');
  });

  it('`fact-hitl`: el encabezado dice el tipo de comprobante que manda el backend, no uno fijo', async () => {
    await montar(propuesta({ tipo_comprobante: 'FACTURA_B' }));

    expect(screen.getByTestId('factura-propuesta-tipo')).toHaveTextContent('Factura B · ARCA');
  });

  it('🔴 el encabezado muestra la LETRA, nunca el nombre del enum del backend', async () => {
    await montar();

    expect(screen.getByTestId('factura-propuesta-tipo')).toHaveTextContent('Factura C · ARCA');
    expect(screen.queryByText(/FACTURA_C/)).toBeNull();
  });

  describe('`cliente.del_registro` (D7): el CUIT que NO dictó la persona se marca', () => {
    const delRegistro = {
      razon_social: 'Panadería La Esquina',
      cuit: '30712345678',
      condicion_iva: 'RESPONSABLE_INSCRIPTO',
      del_registro: true,
    };

    it('del registro: se ve la marca y la condición de IVA del registro', async () => {
      mockEstado.mockRejectedValue(new Error('red')); // sin lectura, la card muestra el artifact
      await montar(propuesta({ cliente: delRegistro, tipo_comprobante: 'FACTURA_A' }));

      expect(screen.getByTestId('factura-propuesta-cliente-registro')).toHaveTextContent('De tu registro de clientes');
      expect(screen.getByTestId('factura-propuesta-cliente-condicion')).toHaveTextContent('Responsable Inscripto');
      expect(screen.getByTestId('factura-propuesta-tipo')).toHaveTextContent('Factura A · ARCA');
    });

    it('control negativo: dictado por la persona (`del_registro: false`) NO lleva la marca', async () => {
      await montar();

      expect(screen.queryByTestId('factura-propuesta-cliente-registro')).toBeNull();
      expect(screen.getByTestId('factura-propuesta-cliente-condicion')).toHaveTextContent('Consumidor Final');
    });

    it('una condición de IVA que la app no conoce no se pinta cruda (ni se inventa)', async () => {
      mockEstado.mockRejectedValue(new Error('red')); // sin lectura, la card muestra el artifact
      await montar(propuesta({ cliente: { ...delRegistro, condicion_iva: 'ALGO_NUEVO' } }));

      expect(screen.queryByTestId('factura-propuesta-cliente-condicion')).toBeNull();
      expect(screen.queryByText(/ALGO_NUEVO/)).toBeNull();
    });
  });

  it('control negativo: sin `tipo_comprobante` no se inventa el encabezado', async () => {
    await montar(propuesta({ tipo_comprobante: null }));

    expect(screen.queryByTestId('factura-propuesta-tipo')).toBeNull();
  });

  it('faltantes vacío → botón Emitir; al tocarlo, confía en `confirmarConTokenFresco`', async () => {
    mockConfirmar.mockResolvedValue({ emitida: true, estado: emitida() });
    await montar();

    // El rótulo es el del prototipo (`CARDS.factura.b`, index.html:2876) y el aviso lo nombra igual.
    expect(screen.getByTestId('factura-propuesta-emitir')).toHaveTextContent(/^Emitir la factura$/);
    await act(async () => {
      fireEvent.press(screen.getByTestId('factura-propuesta-emitir'));
    });

    expect(mockConfirmar).toHaveBeenCalledWith('presu-12');
    await waitFor(() => expect(screen.getByTestId('factura-propuesta-emitida')).toBeTruthy());
    expect(screen.getByTestId('factura-propuesta-emitida')).toHaveTextContent(/Factura emitida\./);
  });

  describe('SM-H1: Editar · Cancelar · Emitir sobre el mismo workflow', () => {
    function textoDe(testID: string) {
      return screen.getByTestId(testID);
    }

    async function tocar(testID: string) {
      await fireEvent.press(screen.getByTestId(testID));
    }

    it('los tres botones van en ese orden', async () => {
      await montar();

      const fila = screen.getByTestId('factura-propuesta-botones');
      const orden = fila.children.map((b) => (b as unknown as { props: { testID: string } }).props.testID);
      expect(orden).toEqual([
        'factura-propuesta-editar',
        'factura-propuesta-cancelar',
        'factura-propuesta-emitir',
      ]);
    });

    it('con faltantes no hay Emitir, y Editar abre el dato que falta sin salir del hilo', async () => {
      const faltante = { codigo: 'cliente', campo: 'receptor', mensaje: 'Falta el cliente' };
      mockEstado.mockResolvedValue(
        borrador({ estado: 'items_ok', faltantes: [faltante], receptor: null, tokenConfirmacion: null }),
      );
      await montar(propuesta({ faltantes: ['cliente'] }));

      await waitFor(() => expect(textoDe('factura-propuesta-faltantes')).toHaveTextContent('Falta el cliente'));
      expect(screen.queryByTestId('factura-propuesta-emitir')).toBeNull();
      await tocar('factura-propuesta-editar');

      expect(await screen.findByTestId('factura-propuesta-editar-cliente')).toBeTruthy();
      expect(mockConfirmar).not.toHaveBeenCalled();
    });

    it('la misma frase de varios faltantes se muestra una sola vez', async () => {
      const mensaje = 'ARCA exige el período del servicio';
      mockEstado.mockResolvedValue(
        borrador({
          estado: 'items_ok',
          faltantes: [
            { codigo: 'periodo', campo: 'fch_serv_desde', mensaje },
            { codigo: 'periodo', campo: 'fch_serv_hasta', mensaje },
            { codigo: 'cliente', campo: 'receptor', mensaje: 'Falta el cliente' },
          ],
          tokenConfirmacion: null,
        }),
      );
      await montar(propuesta({ faltantes: ['periodo'] }));

      await waitFor(() =>
        expect(textoDe('factura-propuesta-faltantes')).toHaveTextContent(`${mensaje} · Falta el cliente`),
      );
    });

    it('mientras Cancelar espera al servidor, el botón no dice «Emitiendo…»', async () => {
      await montar();
      let soltar: (v: { ok: true }) => void = () => undefined;
      mockCancelar.mockReturnValue(new Promise((r) => { soltar = r; }));

      await tocar('factura-propuesta-cancelar');

      await waitFor(() => expect(mockCancelar).toHaveBeenCalled());
      expect(textoDe('factura-propuesta-emitir')).toHaveTextContent('Emitir la factura');
      expect(screen.queryByText('Emitiendo…')).toBeNull();
      expect(mockConfirmar).not.toHaveBeenCalled();

      await act(async () => {
        soltar({ ok: true });
      });
    });

    describe('Cancelar', () => {
      it('cancela de verdad y deja un recibo sin botones', async () => {
        mockCancelar.mockResolvedValue({ ok: true });
        await montar();
        mockEstado.mockResolvedValue(borrador({ estado: 'cancelada', terminado: true, tokenConfirmacion: null }));

        await tocar('factura-propuesta-cancelar');

        await waitFor(() => expect(screen.getByTestId('factura-propuesta-cancelada')).toBeTruthy());
        expect(mockCancelar).toHaveBeenCalledWith('presu-12');
        expect(screen.getByTestId('factura-propuesta-cancelada')).toHaveTextContent(/Factura cancelada/);
        expect(screen.queryByTestId('factura-propuesta-emitir')).toBeNull();
        expect(screen.queryByText(/Confirmado|emitida\./)).toBeNull();
      });

      it('una factura ya emitida no se presenta como cancelada: el 409 lleva al comprobante', async () => {
        mockCancelar.mockRejectedValue(new ApiError(409, 'conflicto', undefined, { code: 'confirmacion_no_tomada' }));
        await montar();
        mockEstado.mockResolvedValue(emitida());

        await tocar('factura-propuesta-cancelar');

        await waitFor(() => expect(screen.getByTestId('factura-propuesta-emitida')).toBeTruthy());
        expect(screen.queryByTestId('factura-propuesta-cancelada')).toBeNull();
      });

      it('si falla y sigue abierta lo dice, y la factura sigue ahí', async () => {
        mockCancelar.mockRejectedValue(new Error('red'));
        await montar();

        await tocar('factura-propuesta-cancelar');

        await waitFor(() => expect(textoDe('factura-propuesta-error')).toHaveTextContent(/No pudimos cancelarla/));
        expect(screen.getByTestId('factura-propuesta-emitir')).toBeTruthy();
      });

      it('al recargar una factura cancelada no vuelven los botones', async () => {
        mockEstado.mockResolvedValue(borrador({ estado: 'cancelada', terminado: true, tokenConfirmacion: null }));
        await montar();

        await waitFor(() => expect(screen.getByTestId('factura-propuesta-cancelada')).toBeTruthy());
        expect(screen.queryByTestId('factura-propuesta-botones')).toBeNull();
      });

      it('cancelada por chat con la card en pantalla: la card se entera sola', async () => {
        jest.useFakeTimers();
        try {
          await montar();
          await act(async () => {
            await jest.advanceTimersByTimeAsync(0);
          });
          expect(screen.getByTestId('factura-propuesta-emitir')).toBeTruthy();

          mockEstado.mockResolvedValue(borrador({ estado: 'cancelada', terminado: true, tokenConfirmacion: null }));
          await act(async () => {
            await jest.advanceTimersByTimeAsync(5000);
          });

          expect(screen.getByTestId('factura-propuesta-cancelada')).toBeTruthy();
          expect(screen.queryByTestId('factura-propuesta-emitir')).toBeNull();
        } finally {
          jest.useRealTimers();
        }
      });

      it('rechazada por ARCA: no se presenta como emitida aunque esté marcada resuelta', async () => {
        mockEstado.mockResolvedValue(
          borrador({ estado: 'rechazada', motivo: 'CUIT inválido', motivoCodigo: 'rechazo_afip', terminado: true }),
        );
        await montar(propuesta(), { resuelto: true });

        await waitFor(() => expect(screen.getByTestId('factura-propuesta-rechazada')).toHaveTextContent(/CUIT inválido/));
        expect(screen.queryByTestId('factura-propuesta-emitida')).toBeNull();
      });

      it('el workflow ya no existe (404): lo dice, sin botones que no pueden andar', async () => {
        mockEstado.mockRejectedValue(new ApiError(404, 'no encontrada'));
        await montar();

        await waitFor(() => expect(screen.getByTestId('factura-propuesta-no-disponible')).toBeTruthy());
        expect(screen.queryByTestId('factura-propuesta-botones')).toBeNull();
      });
    });

    describe('Editar', () => {
      async function abrir(selector: string) {
        await tocar('factura-propuesta-editar');
        await tocar(selector);
      }

      it('cliente: arranca con lo cargado, manda el dato al mismo workflow y vuelve a la card', async () => {
        const nuevo = borrador({
          receptor: { condicionIva: 5, tipoDoc: 80, nroDoc: '20304050607', nombre: 'Lucía Gómez', domicilio: '' },
        });
        mockSetCliente.mockResolvedValue({ ok: true });
        mockEco.mockResolvedValue({ estado: nuevo, cambio: true });
        await montar();

        await abrir('factura-propuesta-menu-cliente');
        await screen.findByTestId('factura-propuesta-editar-cliente');
        await fireEvent.changeText(screen.getByDisplayValue('Juan Pérez'), 'Lucía Gómez');
        await tocar('factura-propuesta-editar-cliente-continuar');

        await waitFor(() => expect(textoDe('factura-propuesta-cliente')).toHaveTextContent(/Lucía Gómez/));
        expect(mockSetCliente).toHaveBeenCalledWith('presu-12', {
          condicionIva: 5,
          tipoDoc: 80,
          nroDoc: '20304050607',
          nombre: 'Lucía Gómez',
          domicilio: '',
        });
        // Editar no emite, y la vuelta deja los tres botones.
        expect(mockConfirmar).not.toHaveBeenCalled();
        expect(screen.getByTestId('factura-propuesta-emitir')).toBeTruthy();
      });

      it('datos de venta: arrancan con lo cargado y van por su señal', async () => {
        mockSetDatosVenta.mockResolvedValue({ ok: true });
        mockEco.mockResolvedValue({ estado: borrador(), cambio: false });
        await montar();

        await abrir('factura-propuesta-menu-datos-venta');
        await screen.findByTestId('factura-propuesta-editar-datos-venta');
        await tocar('factura-propuesta-editar-datos-venta-continuar');

        await waitFor(() =>
          expect(mockSetDatosVenta).toHaveBeenCalledWith(
            'presu-12',
            expect.objectContaining({ fecha: '2026-11-02', concepto: 1, condicionVenta: 'contado' }),
          ),
        );
      });

      it('🔴 cambiar el documento borra la marca «De tu registro»: ese dato ya no salió del registro', async () => {
        const conMarca = propuesta({
          cliente: { razon_social: 'Juan Pérez', cuit: '20304050607', condicion_iva: 'CONSUMIDOR_FINAL', del_registro: true },
        });
        await montar(conMarca);
        await waitFor(() => expect(screen.getByTestId('factura-propuesta-cliente-registro')).toBeTruthy());

        mockEstado.mockResolvedValue(
          borrador({ receptor: { condicionIva: 5, tipoDoc: 80, nroDoc: '27111111112', nombre: 'Otra', domicilio: '' } }),
        );
        await tocar('factura-propuesta-editar');

        await waitFor(() => expect(screen.queryByTestId('factura-propuesta-cliente-registro')).toBeNull());
      });

      it('ítem: se reemplaza agregando primero y quitando después, y la card muestra el total nuevo', async () => {
        const conLosDos = borrador({
          items: [
            { descripcion: 'Service de aire', cantidad: '1', precioUnitario: '50000', subtotal: '50000.00' },
            { descripcion: 'Service de aire', cantidad: '1', precioUnitario: '70000', subtotal: '70000.00' },
          ],
          total: '120000',
        });
        const final = borrador({
          items: [{ descripcion: 'Service de aire', cantidad: '1', precioUnitario: '70000', subtotal: '70000.00' }],
          total: '70000',
        });
        mockAgregar.mockResolvedValue({ ok: true });
        mockQuitar.mockResolvedValue({ ok: true });
        mockEco.mockResolvedValueOnce({ estado: conLosDos, cambio: true }).mockResolvedValueOnce({ estado: final, cambio: true });
        await montar();

        await abrir('factura-propuesta-menu-items');
        await tocar('factura-propuesta-editar-items-editar-0');
        await fireEvent.changeText(screen.getByDisplayValue('50000'), '70000');
        await tocar('factura-propuesta-editar-items-agregar');

        await waitFor(() => expect(mockQuitar).toHaveBeenCalledWith('presu-12', 0));
        expect(mockAgregar).toHaveBeenCalledWith(
          'presu-12',
          expect.objectContaining({ descripcion: 'Service de aire', cantidad: '1', precioUnitario: '70000' }),
        );
        expect(mockAgregar.mock.invocationCallOrder[0]!).toBeLessThan(mockQuitar.mock.invocationCallOrder[0]!);
        // La segunda espera compara contra el estado con los dos ítems, no contra el de antes de agregar.
        expect(mockEco.mock.calls[1]![1]).toBe(conLosDos);

        await tocar('factura-propuesta-editar-items-volver');
        expect(textoDe('factura-propuesta-total')).toHaveTextContent('Total: 70000');
      });

      it('si guardar falla lo dice y no vuelve a la card como si hubiera andado', async () => {
        mockSetCliente.mockRejectedValue(new Error('red'));
        await montar();

        await abrir('factura-propuesta-menu-cliente');
        await screen.findByTestId('factura-propuesta-editar-cliente');
        await tocar('factura-propuesta-editar-cliente-continuar');

        await waitFor(() => expect(textoDe('factura-propuesta-error')).toHaveTextContent(/No pudimos guardar/));
        expect(screen.getByTestId('factura-propuesta-editar-cliente')).toBeTruthy();
      });
    });

    it('🔴 si la factura cambió desde la última lectura, Emitir no emite: repinta y pide revisar', async () => {
      await montar();
      await waitFor(() => expect(mockEstado).toHaveBeenCalled());
      mockEstado.mockResolvedValue(
        borrador({
          items: [{ descripcion: 'Otro', cantidad: '1', precioUnitario: '99', subtotal: '99.00' }],
          total: '99',
        }),
      );

      await tocar('factura-propuesta-emitir');

      await waitFor(() => expect(textoDe('factura-propuesta-error')).toHaveTextContent(/cambió/));
      expect(mockConfirmar).not.toHaveBeenCalled();
      expect(textoDe('factura-propuesta-total')).toHaveTextContent('Total: 99');
    });
  });

  describe('el comprobante en el chat — CAE + abrir/compartir el PDF', () => {
    it('🔴 emitida y terminada: muestra el CAE y ofrece abrir y compartir el PDF', async () => {
      mockConfirmar.mockResolvedValue({ emitida: true, estado: emitida() });
      await montar();

      await act(async () => {
        fireEvent.press(screen.getByTestId('factura-propuesta-emitir'));
      });

      expect(screen.getByTestId('factura-propuesta-emitida-cae')).toHaveTextContent('CAE: 86294776469171');
      expect(screen.getByTestId('factura-propuesta-emitida')).toHaveTextContent(/Punto de venta 6 · N° 8/);
      expect(screen.getByTestId('factura-propuesta-emitida-guardar')).toBeTruthy();
      expect(screen.getByTestId('factura-propuesta-emitida-compartir')).toBeTruthy();
      expect(screen.getByTestId('factura-propuesta-emitida-aviso-24h')).toBeTruthy();
      expect(screen.queryByTestId('factura-propuesta-preparando-pdf')).toBeNull();
    });

    it('🔴 con copia en Drive ofrece ESE link, que no vence — misma precedencia que la pantalla', async () => {
      mockConfirmar.mockResolvedValue({
        emitida: true,
        estado: emitida({ drive: { guardado: true, fileId: '1tnAN', link: 'https://drive/uc?id=1tnAN', compartido: true } }),
      });
      await montar();

      await act(async () => {
        fireEvent.press(screen.getByTestId('factura-propuesta-emitir'));
      });

      expect(screen.getByTestId('factura-propuesta-emitida-aviso-drive')).toBeTruthy();
      expect(screen.queryByTestId('factura-propuesta-emitida-aviso-24h')).toBeNull();
    });

    it('🔴 sin PDF el CAE sigue siendo válido y el aviso NO se pinta como error', async () => {
      mockConfirmar.mockResolvedValue({ emitida: true, estado: emitida({ pdf: null }) });
      await montar();

      await act(async () => {
        fireEvent.press(screen.getByTestId('factura-propuesta-emitir'));
      });

      expect(screen.getByTestId('factura-propuesta-emitida-cae')).toHaveTextContent('CAE: 86294776469171');
      expect(screen.getByTestId('factura-propuesta-emitida-sin-pdf')).toBeTruthy();
      expect(screen.queryByTestId('factura-propuesta-emitida-guardar')).toBeNull();
    });

    it('🔴 CAE sin PDF todavía: NO dice que el PDF no existe — dice que lo está preparando, y repolea', async () => {
      mockConfirmar.mockResolvedValue({
        emitida: true,
        estado: emitida({ estado: 'emitida', pdf: null, terminado: false }),
      });
      jest.useFakeTimers();
      try {
        await montar();

        await act(async () => {
          fireEvent.press(screen.getByTestId('factura-propuesta-emitir'));
        });
        mockEstado.mockResolvedValue(emitida());

        // La ventana entre el CAE y el PDF: el CAE ya se muestra, el PDF se anuncia como en camino.
        expect(screen.getByTestId('factura-propuesta-emitida-cae')).toBeTruthy();
        expect(screen.getByTestId('factura-propuesta-preparando-pdf')).toBeTruthy();
        expect(screen.queryByTestId('factura-propuesta-emitida-sin-pdf')).toBeNull();

        await act(async () => {
          jest.advanceTimersByTime(1500);
        });

        expect(mockEstado).toHaveBeenCalledWith('presu-12');
        expect(screen.getByTestId('factura-propuesta-emitida-guardar')).toBeTruthy();
        expect(screen.queryByTestId('factura-propuesta-preparando-pdf')).toBeNull();
      } finally {
        jest.useRealTimers();
      }
    });
  });

  it('🔴 `emitida:false` (no-op del backend) NO pasa a terminal — muestra el motivo y se puede reintentar', async () => {
    mockConfirmar.mockResolvedValue({
      emitida: false,
      motivo: 'los datos cambiaron, revisá el resumen antes de confirmar',
    });
    await montar();

    await act(async () => {
      fireEvent.press(screen.getByTestId('factura-propuesta-emitir'));
    });

    expect(screen.queryByTestId('factura-propuesta-emitida')).toBeNull();
    expect(screen.getByTestId('factura-propuesta-error')).toHaveTextContent(
      'los datos cambiaron, revisá el resumen antes de confirmar',
    );
    expect(screen.getByTestId('factura-propuesta-emitir')).toBeTruthy();
  });

  /**
   * GUARDM parte 2 — guard cross-remount patrón B. Lo único que se persiste es `emitida` (emitir es
   * un acto fiscal irreversible; cancelada la dice el workflow en cada lectura). Al
   * rehidratar ya emitida, el comprobante NO viaja en el mensaje: se re-consulta con `estadoFactura`.
   */
  describe('guard cross-remount (patrón B)', () => {
    it('control positivo: `resuelto: true` re-consulta el estado y muestra el Recibo, sin pasar por Emitir', async () => {
      mockEstado.mockResolvedValue(emitida());
      await montar(propuesta(), { resuelto: true });

      await waitFor(() => expect(screen.getByTestId('factura-propuesta-emitida')).toBeTruthy());
      expect(mockEstado).toHaveBeenCalledWith('presu-12');
      expect(mockConfirmar).not.toHaveBeenCalled();
      expect(screen.queryByTestId('factura-propuesta-emitir')).toBeNull();
    });

    it('control negativo: sin `resuelto` sigue arrancando en "mostrando", como antes', async () => {
      await montar();

      expect(screen.getByTestId('factura-propuesta-emitir')).toBeTruthy();
      expect(screen.queryByTestId('factura-propuesta-emitida')).toBeNull();
    });

    it('al emitir con éxito, llama a `onResolver`', async () => {
      mockConfirmar.mockResolvedValue({ emitida: true, estado: emitida() });
      const onResolver = jest.fn();
      await montar(propuesta(), { onResolver });

      await act(async () => {
        fireEvent.press(screen.getByTestId('factura-propuesta-emitir'));
      });

      await waitFor(() => expect(screen.getByTestId('factura-propuesta-emitida')).toBeTruthy());
      expect(onResolver).toHaveBeenCalledTimes(1);
    });

    it('`emitida:false` NO llama a `onResolver` -- no es terminal, se puede reintentar', async () => {
      mockConfirmar.mockResolvedValue({ emitida: false, motivo: 'revisá el resumen' });
      const onResolver = jest.fn();
      await montar(propuesta(), { onResolver });

      await act(async () => {
        fireEvent.press(screen.getByTestId('factura-propuesta-emitir'));
      });

      expect(onResolver).not.toHaveBeenCalled();
    });
  });
});

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/** Partial mock: sólo la red — mismo arnés que `ClientesScreen.test.tsx`/`TarjetaClientePropuesto.test.tsx`. */
vi.mock('@copiloto/core', async (importOriginal) => {
  const original = await importOriginal<typeof import('@copiloto/core')>();
  return {
    ...original,
    agregarItem: vi.fn(),
    cancelarFactura: vi.fn(),
    confirmarConTokenFresco: vi.fn(),
    crearFactura: vi.fn(),
    estadoAfip: vi.fn(),
    esperarEcoDelSignal: vi.fn(),
    esperarEstadoEstable: vi.fn(),
    estadoFactura: vi.fn(),
    sendChat: vi.fn(),
    getReply: vi.fn(),
    quitarItem: vi.fn(),
    setCliente: vi.fn(),
    setDatosVenta: vi.fn(),
  };
});

import {
  confirmarConTokenFresco,
  crearFactura,
  estadoAfip,
  esperarEstadoEstable,
  getReply,
  sendChat,
  tomarPendiente,
  type EstadoAfip,
  type EstadoFacturaResp,
} from '@copiloto/core';

import { PantallaFacturacion } from './PantallaFacturacion';

const mockCrearFactura = vi.mocked(crearFactura);
const mockEstadoAfip = vi.mocked(estadoAfip);
const mockEsperarEstadoEstable = vi.mocked(esperarEstadoEstable);
const mockSendChat = vi.mocked(sendChat);
const mockGetReply = vi.mocked(getReply);
const mockConfirmar = vi.mocked(confirmarConTokenFresco);

function estadoMock(over: Partial<EstadoFacturaResp> = {}): EstadoFacturaResp {
  return {
    estado: 'borrador',
    faltantes: [],
    items: [],
    total: '0.00',
    tokenConfirmacion: null,
    resultado: null,
    pdf: null,
    drive: null,
    receptor: null,
    datosVenta: null,
    motivo: null,
    motivoCodigo: null,
    terminado: false,
    ...over,
  };
}

function estadoAfipMock(over: Partial<EstadoAfip> = {}): { status: 'ok' } & EstadoAfip {
  return {
    status: 'ok',
    cuit: '20111111112',
    conectado: true,
    wsAutorizados: ['wsfe'],
    perfilCompleto: true,
    puedeFacturar: true,
    ambiente: 'dev',
    onboarding: null,
    ...over,
  };
}

/**
 * 🔴 **El gap real que encontró la pasada de device de D12** (misma historia que el test hermano de
 * `apps/mobile`): `estadoFacturaActual` es un eco del backend, pero `clienteLocal` es un eco LOCAL que
 * sólo `guardarClienteYActualizar` alimentaba -- si el borrador llega de afuera (`facturaIdInicial`, p.
 * ej. "Facturar desde presupuesto") con `receptor` ya cargado, `PasoResumen` mostraba "no tenemos el
 * detalle del cliente" aunque el dato estuviera ahí, viajando en `EstadoFacturaResp.receptor`.
 *
 * Sin archivo de test propio hasta ahora en este árbol -- este es el primero, con el arnés mínimo para
 * el camino "adoptar un borrador externo" (`facturaIdInicial`), que es el que exhibe el gap.
 */
describe('PantallaFacturacion (web) — adoptar un borrador ya creado (facturaIdInicial)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEstadoAfip.mockResolvedValue(estadoAfipMock());
    mockCrearFactura.mockResolvedValue({ status: 'ok', ok: true, facturaId: 'factura-1' });
  });

  it('NO crea un borrador nuevo', async () => {
    mockEsperarEstadoEstable.mockResolvedValue({ convergio: true, estado: estadoMock() });

    render(<PantallaFacturacion facturaIdInicial="presu-12" />);

    await waitFor(() => expect(mockEsperarEstadoEstable).toHaveBeenCalledWith('presu-12'));
    expect(mockCrearFactura).not.toHaveBeenCalled();
  });

  it('con receptor ya cargado en el borrador -- siembra clienteLocal, PasoResumen lo muestra sin pedirlo de nuevo', async () => {
    mockEsperarEstadoEstable.mockResolvedValue({
      convergio: true,
      estado: estadoMock({
        estado: 'esperando_confirmacion',
        items: [{ descripcion: 'Mano de obra', cantidad: '1', precioUnitario: '30000.00', subtotal: '30000.00' }],
        total: '30000.00',
        tokenConfirmacion: 'tok-confirmar',
        receptor: {
          condicionIva: 1,
          tipoDoc: 80,
          nroDoc: '20111111112',
          nombre: 'Doña Repuestos SRL',
          domicilio: 'Av. Siempre Viva 742',
        },
      }),
    });

    render(<PantallaFacturacion facturaIdInicial="presu-12" />);

    await waitFor(() => expect(screen.getByText(/Doña Repuestos SRL/)).toBeInTheDocument());
    expect(screen.queryByTestId('facturacion-paso-resumen-cliente-no-disponible')).not.toBeInTheDocument();
    expect(mockCrearFactura).not.toHaveBeenCalled();
  });

  /**
   * 🔴 **Mismo gap que `clienteLocal`, mismo mecanismo.** `datosVentaLocal` también es un eco LOCAL
   * (ver docstring de `PasoResumen`): sin sembrarlo desde `estado.datosVenta` al adoptar un borrador
   * externo, `PasoResumen` mostraba "no tenemos el detalle de la venta" aunque el dato ya viajara en
   * `EstadoFacturaResp.datosVenta` (PR #457).
   */
  it('con datos_venta ya cargados en el borrador -- siembra datosVentaLocal, PasoResumen lo muestra sin pedirlo de nuevo', async () => {
    mockEsperarEstadoEstable.mockResolvedValue({
      convergio: true,
      estado: estadoMock({
        estado: 'esperando_confirmacion',
        items: [{ descripcion: 'Mano de obra', cantidad: '1', precioUnitario: '30000.00', subtotal: '30000.00' }],
        total: '30000.00',
        tokenConfirmacion: 'tok-confirmar',
        receptor: {
          condicionIva: 1,
          tipoDoc: 80,
          nroDoc: '20111111112',
          nombre: 'Doña Repuestos SRL',
          domicilio: 'Av. Siempre Viva 742',
        },
        datosVenta: {
          fecha: '2026-08-14',
          concepto: 1,
          condicionVenta: 'contado',
        },
      }),
    });

    render(<PantallaFacturacion facturaIdInicial="presu-12" />);

    await waitFor(() => expect(screen.getByTestId('facturacion-paso-resumen-datos-venta')).toBeInTheDocument());
    expect(screen.queryByTestId('facturacion-paso-resumen-datos-venta-no-disponible')).not.toBeInTheDocument();
    expect(mockCrearFactura).not.toHaveBeenCalled();
  });

  it('sin receptor en el borrador -- PasoResumen sigue mostrando "no disponible" (control diferencial)', async () => {
    mockEsperarEstadoEstable.mockResolvedValue({
      convergio: true,
      estado: estadoMock({
        estado: 'esperando_confirmacion',
        items: [{ descripcion: 'Mano de obra', cantidad: '1', precioUnitario: '30000.00', subtotal: '30000.00' }],
        total: '30000.00',
        tokenConfirmacion: 'tok-confirmar',
      }),
    });

    render(<PantallaFacturacion facturaIdInicial="presu-12" />);

    await waitFor(() =>
      expect(screen.getByTestId('facturacion-paso-resumen-cliente-no-disponible')).toBeInTheDocument(),
    );
  });
});

/**
 * 🔴 **H-A4-5 (auditoría 2026-09-22).** Antes de este fix, abrir la pantalla SIN un borrador externo
 * (`facturaIdInicial`) creaba uno solo -- el efecto 3 llamaba `crearFactura` apenas el gate resolvía
 * `puedeFacturar:true`, así que el aterrizaje era el wizard, no «Te deben»/«Últimas emitidas». El
 * mockup fuente (`Prototipo frontend/odobi-ui/mockups/05-facturacion/DECISIONES.md`) es explícito:
 * la pantalla standalone de Facturación es historial/listado, no flujo de creación -- crear vive en el
 * chat. Control negativo: con el código viejo, `mockCrearFactura` SÍ se llama sin ninguna acción del
 * usuario -- este test falla contra ese código.
 */
describe('PantallaFacturacion (web) — aterrizaje en listado, wizard detrás de "Nueva factura" (H-A4-5)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEstadoAfip.mockResolvedValue(estadoAfipMock());
    mockCrearFactura.mockResolvedValue({ status: 'ok', ok: true, facturaId: 'factura-1' });
  });

  it('sin facturaIdInicial -- aterriza en el listado y NO crea un borrador solo', async () => {
    render(<PantallaFacturacion />);

    // El pill "Nueva factura" (de «Últimas emitidas») es la señal de que el listado ya pintó.
    await waitFor(() => expect(screen.getByTestId('facturacion-nueva-factura-pill')).toBeInTheDocument());

    expect(mockCrearFactura).not.toHaveBeenCalled();
    expect(screen.queryByTestId('facturacion-paso-datos-venta')).not.toBeInTheDocument();
    expect(screen.queryByTestId('facturacion-cargando')).not.toBeInTheDocument();
  });

  it('tocar "Nueva factura" -- recién ahí crea el borrador y entra al wizard', async () => {
    mockEsperarEstadoEstable.mockResolvedValue({ convergio: true, estado: estadoMock() });

    render(<PantallaFacturacion />);

    await waitFor(() => expect(screen.getByTestId('facturacion-nueva-factura-pill')).toBeInTheDocument());
    expect(mockCrearFactura).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('facturacion-nueva-factura-pill'));

    // FACTID (2026-09-29): `crearFactura` ahora manda una `idem_key` -- ver el describe de abajo para
    // el ciclo de vida completo. Acá sólo importa que se llame con CUIT + alguna clave.
    await waitFor(() => expect(mockCrearFactura).toHaveBeenCalledWith('20111111112', expect.any(String)));
    await waitFor(() => expect(screen.getByTestId('facturacion-paso-datos-venta')).toBeInTheDocument());
  });
});

/**
 * FACTID (`contrato_planificacion-a-todos_FACTID-mitad-frontend-idem-key-en-nueva-factura`,
 * 2026-09-29, §2): la `idem_key` se genera al primer intento de crear el borrador, se REUSA mientras
 * el intento no terminó (reintento, remonte, segunda pestaña) y se BORRA en cuanto llega el
 * `facturaId` -- nunca al emitir. `localStorage` para sobrevivir al remonte, con TTL de 10 min.
 */
describe('PantallaFacturacion (web) — idem_key en "Nueva factura" (FACTID)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    mockEstadoAfip.mockResolvedValue(estadoAfipMock());
  });

  it('dos corridas del efecto SIN éxito mandan la MISMA clave (reintentoBorrador)', async () => {
    mockCrearFactura.mockResolvedValueOnce({ status: 'no_disponible' });
    render(<PantallaFacturacion />);

    await waitFor(() => expect(screen.getByTestId('facturacion-nueva-factura-pill')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('facturacion-nueva-factura-pill'));
    await waitFor(() => expect(screen.getByTestId('facturacion-error-borrador')).toBeInTheDocument());
    const claveInicial = mockCrearFactura.mock.calls[0]![1];
    expect(claveInicial).toEqual(expect.any(String));

    mockCrearFactura.mockResolvedValueOnce({ status: 'no_disponible' });
    fireEvent.click(screen.getByTestId('facturacion-error-borrador-reintentar'));

    await waitFor(() => expect(mockCrearFactura).toHaveBeenCalledTimes(2));
    expect(mockCrearFactura.mock.calls[1]![1]).toBe(claveInicial);
  });

  /**
   * 🔴 Control negativo obligatorio (§3 del contrato): sin esto, «se reusa la clave» pasa igual con una
   * constante hardcodeada -- que sería una clave fija para siempre, deduplicando TODAS las facturas del
   * tenant contra la primera.
   */
  it('después de un éxito, el intento siguiente manda una clave DISTINTA', async () => {
    mockCrearFactura.mockResolvedValueOnce({ status: 'ok', ok: true, facturaId: 'factura-1' });
    mockEsperarEstadoEstable.mockResolvedValueOnce({ convergio: true, estado: estadoMock() });
    render(<PantallaFacturacion />);

    await waitFor(() => expect(screen.getByTestId('facturacion-nueva-factura-pill')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('facturacion-nueva-factura-pill'));
    await waitFor(() => expect(mockCrearFactura).toHaveBeenCalledTimes(1));
    const claveInicial = mockCrearFactura.mock.calls[0]![1];

    mockCrearFactura.mockResolvedValueOnce({ status: 'ok', ok: true, facturaId: 'factura-2' });
    mockEsperarEstadoEstable.mockResolvedValueOnce({ convergio: true, estado: estadoMock() });
    fireEvent.click(screen.getByTestId('facturacion-nueva-factura-pill'));

    await waitFor(() => expect(mockCrearFactura).toHaveBeenCalledTimes(2));
    expect(mockCrearFactura.mock.calls[1]![1]).not.toBe(claveInicial);
  });

  it('la clave sobrevive a un remonte dentro del TTL -- mismo POST en vuelo, mismo borrador', async () => {
    mockCrearFactura.mockImplementation(() => new Promise(() => {})); // nunca resuelve: intento en vuelo
    const { unmount } = render(<PantallaFacturacion />);

    await waitFor(() => expect(screen.getByTestId('facturacion-nueva-factura-pill')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('facturacion-nueva-factura-pill'));
    await waitFor(() => expect(mockCrearFactura).toHaveBeenCalledTimes(1));
    const claveInicial = mockCrearFactura.mock.calls[0]![1];
    unmount();

    mockCrearFactura.mockClear();
    mockCrearFactura.mockImplementation(() => new Promise(() => {}));
    render(<PantallaFacturacion />);

    await waitFor(() => expect(screen.getByTestId('facturacion-nueva-factura-pill')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('facturacion-nueva-factura-pill'));
    await waitFor(() => expect(mockCrearFactura).toHaveBeenCalledTimes(1));
    expect(mockCrearFactura.mock.calls[0]![1]).toBe(claveInicial);
  });

  it('la clave NO sobrevive fuera del TTL -- se genera una nueva', async () => {
    window.localStorage.setItem(
      'copiloto-facturacion-idem-key',
      JSON.stringify({ clave: 'clave-vieja-huerfana', ts: Date.now() - 11 * 60 * 1000 }),
    );
    mockCrearFactura.mockResolvedValueOnce({ status: 'ok', ok: true, facturaId: 'factura-1' });
    mockEsperarEstadoEstable.mockResolvedValueOnce({ convergio: true, estado: estadoMock() });
    render(<PantallaFacturacion />);

    await waitFor(() => expect(screen.getByTestId('facturacion-nueva-factura-pill')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('facturacion-nueva-factura-pill'));

    await waitFor(() => expect(mockCrearFactura).toHaveBeenCalledTimes(1));
    expect(mockCrearFactura.mock.calls[0]![1]).not.toBe('clave-vieja-huerfana');
  });
});

/**
 * SM-P7 — el dock del pie va SIEMPRE (decisión del operador 2026-11-04): con el gate bloqueado y con el
 * wizard abierto también. Antes un test afirmaba lo contrario (gate listo Y vista listado) y estaba
 * verde POR la condición que había que eliminar.
 */
describe('PantallaFacturacion (web) — SM-P7: el dock del pie va siempre', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCrearFactura.mockResolvedValue({ status: 'ok', ok: true, facturaId: 'factura-1' });
  });

  it('gate listo + listado: hay dock y el campo se puede escribir', async () => {
    mockEstadoAfip.mockResolvedValue(estadoAfipMock());
    render(<PantallaFacturacion />);
    await waitFor(() => expect(screen.getByTestId('facturacion-nueva-factura-pill')).toBeInTheDocument());

    expect(screen.getByPlaceholderText('Pedile una factura al copiloto…')).not.toBeDisabled();
  });

  it('gate bloqueado: el dock sigue estando', async () => {
    mockEstadoAfip.mockResolvedValue(estadoAfipMock({ puedeFacturar: false, motivoNoPuedeFacturar: null }));
    render(<PantallaFacturacion onConfigurar={() => {}} />);
    await waitFor(() => expect(screen.getByTestId('facturacion-cta-configurar')).toBeInTheDocument());

    expect(screen.getByTestId('dock-funcion')).toBeInTheDocument();
  });

  it('wizard abierto (borrador externo): el dock sigue estando', async () => {
    mockEstadoAfip.mockResolvedValue(estadoAfipMock());
    mockEsperarEstadoEstable.mockResolvedValue({ convergio: true, estado: estadoMock() });
    render(<PantallaFacturacion facturaIdInicial="factura-1" />);
    await waitFor(() => expect(screen.getByTestId('facturacion-paso-datos-venta')).toBeInTheDocument());

    expect(screen.getByTestId('dock-funcion')).toBeInTheDocument();
  });
});

/**
 * SM-P13 — Facturación PRELLENA como las otras cuatro funciones: lo dictado NO va al chat, viaja a `/chat`
 * con `kind="dictado:factura"` y la card `factura_propuesta` se pinta ACÁ. El backend propone, nunca emite.
 * Los `waitFor` esperan el sondeo real de `dictarPorChat` (1 s por tick).
 */
describe('PantallaFacturacion (web) — SM-P13: dictado de factura prellena, no manda al chat', () => {
  const EFECTIVA = 'dictado:factura:sid-1';
  const ESPERA = { timeout: 5000 };

  const cardFactura = (faltantes: string[]) => ({
    kind: 'factura_propuesta',
    data: {
      factura_id: 'fac-7',
      faltantes,
      items: [{ descripcion: 'Instalación', cantidad: 1, precio_unitario: 150000 }],
      cliente: { razon_social: 'Panadería La Esquina', cuit: '30712345678', condicion_iva: 'RESPONSABLE_INSCRIPTO', del_registro: false },
      total: 150000,
      tipo_comprobante: 'FACTURA_C',
    },
  });

  function dictar(texto: string) {
    const campo = screen.getByPlaceholderText('Pedile una factura al copiloto…');
    fireEvent.change(campo, { target: { value: texto } });
    fireEvent.keyDown(campo, { key: 'Enter' });
  }

  beforeEach(() => {
    vi.clearAllMocks();
    tomarPendiente();
    mockEstadoAfip.mockResolvedValue(estadoAfipMock());
    mockSendChat.mockResolvedValue({ wf_id: 'wf-1', accepted: true, session_id: EFECTIVA });
    mockEsperarEstadoEstable.mockResolvedValue({ convergio: true, estado: estadoMock() });
  });

  it('caso COMPLETO: manda kind="dictado:factura", pinta la card prellenada y NO emite ni va al chat', async () => {
    mockGetReply.mockResolvedValue({ next_id: 3, replies: [{ id: 3, text: '', card: cardFactura([]) as never }] });
    render(<PantallaFacturacion />);
    await waitFor(() => expect(screen.getByTestId('facturacion-nueva-factura-pill')).toBeInTheDocument());

    dictar('facturale 150 mil a la panadería');

    expect(await screen.findByTestId('factura-propuesta', undefined, ESPERA)).toBeInTheDocument();
    expect(mockSendChat).toHaveBeenCalledWith(
      expect.objectContaining({ text: 'facturale 150 mil a la panadería', kind: 'dictado:factura' }),
    );
    expect(screen.getByTestId('factura-propuesta-total')).toHaveTextContent('150000');
    expect(screen.getByTestId('factura-propuesta-emitir')).toBeInTheDocument();
    // Prellenar no es emitir: el gate sigue en manos de quien toca «Emitir la factura».
    expect(mockConfirmar).not.toHaveBeenCalled();
    expect(mockCrearFactura).not.toHaveBeenCalled();
    expect(tomarPendiente()).toBeNull();
  });

  it('caso INCOMPLETO: el 1er turno es una PREGUNTA SIN CARD (nada que prellenar) y el 2º, por el MISMO hilo, trae la card', async () => {
    mockGetReply
      .mockResolvedValueOnce({ next_id: 2, replies: [{ id: 2, text: '¿A quién le facturo?' }] })
      .mockResolvedValueOnce({ next_id: 5, replies: [{ id: 5, text: '', card: cardFactura(['receptor']) as never }] });
    render(<PantallaFacturacion />);
    await waitFor(() => expect(screen.getByTestId('facturacion-nueva-factura-pill')).toBeInTheDocument());

    dictar('facturá 150 mil');

    // La pregunta se ve y NO hay card (ni vacía).
    expect(await screen.findByText('¿A quién le facturo?', undefined, ESPERA)).toBeInTheDocument();
    expect(screen.queryByTestId('factura-propuesta')).not.toBeInTheDocument();

    dictar('a la panadería');

    expect(await screen.findByTestId('factura-propuesta', undefined, ESPERA)).toBeInTheDocument();
    // Misma sesión y lectura DESDE el cursor del turno 1: sin eso relee la pregunta vieja.
    expect(mockSendChat).toHaveBeenCalledTimes(2);
    expect(mockSendChat.mock.calls[1]![0].session_id).toBe(mockSendChat.mock.calls[0]![0].session_id);
    expect(mockGetReply).toHaveBeenLastCalledWith(EFECTIVA, 2);
    // Incompleta: no se ofrece emitir; se ofrece completar a mano sobre el mismo borrador.
    expect(screen.queryByTestId('factura-propuesta-emitir')).not.toBeInTheDocument();
    expect(screen.getByTestId('factura-propuesta-completar')).toBeInTheDocument();
    expect(mockConfirmar).not.toHaveBeenCalled();
  });

  it('«Completar a mano» sigue sobre el MISMO borrador, en el wizard', async () => {
    mockGetReply.mockResolvedValue({ next_id: 3, replies: [{ id: 3, text: '', card: cardFactura(['receptor']) as never }] });
    render(<PantallaFacturacion />);
    await waitFor(() => expect(screen.getByTestId('facturacion-nueva-factura-pill')).toBeInTheDocument());

    dictar('facturá 150 mil');
    fireEvent.click(await screen.findByTestId('factura-propuesta-completar', undefined, ESPERA));

    await waitFor(() => expect(mockEsperarEstadoEstable).toHaveBeenCalledWith('fac-7'));
    expect(await screen.findByTestId('facturacion-paso-datos-venta')).toBeInTheDocument();
    expect(screen.queryByTestId('factura-propuesta')).not.toBeInTheDocument();
    expect(mockCrearFactura).not.toHaveBeenCalled();
  });

  it('si el backend no responde: aviso visible y ninguna card (no se degrada en silencio)', async () => {
    mockSendChat.mockRejectedValue(new Error('red'));
    render(<PantallaFacturacion />);
    await waitFor(() => expect(screen.getByTestId('facturacion-nueva-factura-pill')).toBeInTheDocument());

    dictar('facturá 150 mil');

    expect(await screen.findByText('No pude consultar al asistente. Probá de nuevo.', undefined, ESPERA)).toBeInTheDocument();
    expect(screen.queryByTestId('factura-propuesta')).not.toBeInTheDocument();
  });
});

describe('PantallaFacturacion (web) — SM-E1: puedeFacturar:false por condición IVA NO es «configurá»', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Responsable Inscripto con perfil cargado: explica que A/B no está disponible y NO ofrece configurar', async () => {
    mockEstadoAfip.mockResolvedValue(
      estadoAfipMock({ puedeFacturar: false, motivoNoPuedeFacturar: 'condicion_iva_no_soportada' }),
    );
    render(<PantallaFacturacion onConfigurar={() => {}} />);

    await waitFor(() => expect(screen.getByTestId('facturacion-no-puede-facturar')).toBeInTheDocument());
    expect(screen.getByTestId('facturacion-no-puede-facturar')).toHaveTextContent(/Responsables Inscriptos/);
    expect(screen.queryByTestId('facturacion-cta-configurar')).not.toBeInTheDocument();
    expect(screen.queryByText(/Todavía no configuraste/)).not.toBeInTheDocument();
    expect(mockCrearFactura).not.toHaveBeenCalled();
  });

  it('control del par: SIN motivo (falta configurar) sí muestra el CTA y no el aviso', async () => {
    mockEstadoAfip.mockResolvedValue(estadoAfipMock({ puedeFacturar: false, motivoNoPuedeFacturar: null }));
    render(<PantallaFacturacion onConfigurar={() => {}} />);

    await waitFor(() => expect(screen.getByTestId('facturacion-cta-configurar')).toBeInTheDocument());
    expect(screen.getByText(/Todavía no configuraste/)).toBeInTheDocument();
    expect(screen.queryByTestId('facturacion-no-puede-facturar')).not.toBeInTheDocument();
  });

  it('un motivo que la app no conoce NO cae en «configurá» (sería el mismo lazo)', async () => {
    mockEstadoAfip.mockResolvedValue(
      estadoAfipMock({ puedeFacturar: false, motivoNoPuedeFacturar: 'desconocido' }),
    );
    render(<PantallaFacturacion onConfigurar={() => {}} />);

    await waitFor(() => expect(screen.getByTestId('facturacion-no-puede-facturar')).toBeInTheDocument());
    expect(screen.queryByTestId('facturacion-cta-configurar')).not.toBeInTheDocument();
  });
});

/**
 * SM-N44 (contrato de NO-DIVERGENCIA con mobile). En mobile el gate se CORRIGE con `cuitVinculado` porque
 * mobile CACHEA el CUIT en el teléfono y lo manda al backend: un CUIT cacheado que no es del tenant se
 * re-escribía a sí mismo para siempre. Web NO tiene esa caché y por eso NO necesita esa corrección: pregunta
 * `estadoAfip()` SIN parámetro y el backend resuelve el CUIT del propio tenant (`primer_cuit()`,
 * afip_web.py:709), así que `res.cuit` ya es suyo. Esto lo sostenía sólo un comentario; si alguien le agrega
 * un CUIT a la llamada «para ser consistente con mobile», revive el defecto y nada lo frenaba.
 */
describe('PantallaFacturacion (web) — SM-N44: el gate pregunta SIN CUIT (no hay caché que corregir)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('llama estadoAfip() sin argumentos aunque la respuesta traiga cuitVinculado', async () => {
    mockEstadoAfip.mockResolvedValue(estadoAfipMock({ cuit: '20111111112', cuitVinculado: '27999999995' }));
    render(<PantallaFacturacion />);

    await waitFor(() => expect(mockEstadoAfip).toHaveBeenCalled());
    // Invariante: web nunca manda un CUIT en el gate. Con argumento, el backend podría rechazarlo.
    expect(mockEstadoAfip.mock.calls.every((c) => c.length === 0)).toBe(true);
    // Y el gate llega a «listo» con `res.cuit` (el del tenant): no se re-pregunta con el `cuitVinculado`.
    await waitFor(() => expect(screen.getByTestId('facturacion-nueva-factura-pill')).toBeInTheDocument());
  });
});

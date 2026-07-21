import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

// Jest (jest-expo) -- describe/it/expect/jest son globales. `render`/`fireEvent` de RNTL 14 son
// ASYNC acá (devuelven Promise) -- hay que `await`-earlos, mismo criterio que
// `PantallaPrincipal.test.tsx:66` y el resto de la suite.

/**
 * Mock de `expo-router` -- mismo criterio que `PantallaPrincipal.test.tsx`: el CTA de "Configurar
 * facturación" navega vía `empujarUnaVez` (que llama `router.push`), y `MarcoGlass` usa `router.back`
 * en su gesto de cierre. Sin este mock, ambos tocan el módulo real de expo-router fuera de un
 * `NavigationContainer` montado por el harness de test.
 */
jest.mock('expo-router', () => {
  const { useEffect } = require('react');
  return {
    router: { push: jest.fn(), back: jest.fn() },
    // Ejecuta el callback, no lo ignora: es lo que reabre la puerta de `empujarUnaVez`. Un
    // `() => {}` acá dejaría el test verde con el CTA muerto, que es justo el defecto que se cazó
    // en device.
    useFocusEffect: (cb: () => void) => useEffect(cb, [cb]),
  };
});

/** Partial mock de `../../adapters/almacen` -- mismo patrón que `PantallaSkins.test.tsx`/
 *  `ChatView.test.tsx`: reemplaza el ADAPTADOR, no `AsyncStorage` (que ya está mockeado globalmente en
 *  `jest.setup.js`), para poder controlar determinísticamente qué CUIT "encuentra" `cuitCache.ts`. */
jest.mock('../../adapters/almacen', () => ({
  almacenClave: {
    leer: jest.fn(),
    guardar: jest.fn(),
    borrar: jest.fn(),
  },
}));

/**
 * Partial mock de `@copiloto/core`: se reemplazan las funciones de `/afip/*` que
 * `PantallaFacturacion`/`SeccionMisComprobantes` llaman DIRECTO.
 *
 * 🔴 **`esperarEstadoEstable`/`confirmarConTokenFresco` se mockean DIRECTO, no compuestos desde
 * `estadoFactura`/`confirmarFactura` mockeados.** Son funciones COMPUESTAS: `afip.ts` las define
 * llamando a `estadoFactura`/`confirmarFactura` como referencias LOCALES al módulo, no a través del
 * barrel de `@copiloto/core` -- así que reemplazar el export del barrel NO cambia a qué función llaman
 * por dentro. Si se dejaran como `actual` (heredadas de `jest.requireActual`), terminarían pegándole a
 * `apiClient.get`/`fetch` de verdad. Mockearlas directo evita ese hueco.
 */
jest.mock('@copiloto/core', () => {
  const actual = jest.requireActual('@copiloto/core');
  return {
    ...actual,
    estadoAfip: jest.fn(),
    crearFactura: jest.fn(),
    esperarEstadoEstable: jest.fn(),
    estadoFactura: jest.fn(),
    setDatosVenta: jest.fn(),
    agregarItem: jest.fn(),
    quitarItem: jest.fn(),
    setCliente: jest.fn(),
    confirmarConTokenFresco: jest.fn(),
    cancelarFactura: jest.fn(),
    listarComprobantes: jest.fn(),
    anularComprobante: jest.fn(),
    estadoAnulacion: jest.fn(),
    confirmarAnulacion: jest.fn(),
  };
});

import { router } from 'expo-router';

import {
  agregarItem,
  anularComprobante,
  cancelarFactura,
  confirmarAnulacion,
  confirmarConTokenFresco,
  crearFactura,
  estadoAfip,
  estadoAnulacion,
  estadoFactura,
  esperarEstadoEstable,
  listarComprobantes,
  quitarItem,
  setCliente,
  setDatosVenta,
  type Comprobante,
  type EstadoAfip,
  type EstadoFacturaResp,
} from '@copiloto/core';

import { almacenClave } from '../../adapters/almacen';
import { ThemeProvider } from '../../theme/ThemeProvider';
import { empujarUnaVez } from '../../navegacion/empujarUnaVez';
import { CLAVE_CUIT_AFIP } from '../afip/cuitCache';
import { PantallaFacturacion } from './PantallaFacturacion';

const CUIT = '20111111112';

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
    motivo: null,
    motivoCodigo: null,
    terminado: false,
    ...over,
  };
}

function estadoAfipMock(over: Partial<EstadoAfip> = {}): { status: 'ok' } & EstadoAfip {
  return {
    status: 'ok',
    conectado: true,
    wsAutorizados: ['wsfe'],
    perfilCompleto: true,
    puedeFacturar: true,
    onboarding: null,
    ...over,
  };
}

function comprobanteMock(over: Partial<Comprobante> = {}): Comprobante {
  return {
    cuit: CUIT,
    tipoCbte: 11,
    puntoVenta: 6,
    nro: 8,
    cae: '86294776469171',
    caeVto: '2026-08-01',
    fechaEmision: '2026-07-21T00:00:00Z',
    total: '1000.00',
    estado: 'emitida',
    pdfUrl: null,
    cbteAsocNro: null,
    // Los comprobantes viejos vienen así del backend: el receptor y la copia en Drive no existían
    // antes del 2026-07-21. El default los deja en `null` a propósito — es el caso que la UI tiene
    // que tolerar, no la excepción.
    driveFileId: null,
    driveLink: null,
    receptorNombre: null,
    docTipo: null,
    docNro: null,
    ...over,
  };
}

async function montar() {
  return render(
    <ThemeProvider>
      <PantallaFacturacion />
    </ThemeProvider>,
  );
}

describe('PantallaFacturacion', () => {
  beforeEach(() => {
    jest.mocked(almacenClave.leer).mockReset().mockResolvedValue(CUIT);
    jest.mocked(almacenClave.guardar).mockReset().mockResolvedValue(undefined);
    jest.mocked(almacenClave.borrar).mockReset().mockResolvedValue(undefined);

    jest.mocked(estadoAfip).mockReset().mockResolvedValue(estadoAfipMock());
    jest.mocked(crearFactura).mockReset().mockResolvedValue({ status: 'ok', ok: true, facturaId: 'factura-1' });
    jest.mocked(esperarEstadoEstable).mockReset().mockResolvedValue({ estado: estadoMock(), convergio: true });
    jest.mocked(estadoFactura).mockReset().mockResolvedValue(estadoMock());
    jest.mocked(setDatosVenta).mockReset().mockResolvedValue({ ok: true });
    jest.mocked(agregarItem).mockReset().mockResolvedValue({ ok: true });
    jest.mocked(quitarItem).mockReset().mockResolvedValue({ ok: true });
    jest.mocked(setCliente).mockReset().mockResolvedValue({ ok: true });
    jest.mocked(confirmarConTokenFresco).mockReset().mockResolvedValue({ emitida: true });
    jest.mocked(cancelarFactura).mockReset().mockResolvedValue({ ok: true });
    jest.mocked(listarComprobantes).mockReset().mockResolvedValue({ status: 'ok', comprobantes: [] });
    jest.mocked(anularComprobante).mockReset().mockResolvedValue({ status: 'ok', ok: true, anulacionId: 'anulacion-1' });
    jest.mocked(estadoAnulacion).mockReset().mockResolvedValue({
      paso: 'esperando_confirmacion',
      original: null,
      errores: [],
      resultado: null,
      motivo: null,
      terminado: false,
    });
    jest.mocked(confirmarAnulacion).mockReset().mockResolvedValue({ ok: true });

    jest.mocked(router.push).mockClear();
  });

  /**
   * 🔴 **Sin caché local NO se corta: se le pregunta al backend.**
   *
   * Este test afirmaba lo contrario hasta el 2026-07-21, cuando la caché local era la única fuente
   * posible del CUIT. Desde que el backend resuelve `primer_cuit()` en `GET /afip/estado` sin
   * parámetro (pedido §2), cortar acá sería el defecto que ese pedido vino a arreglar: quien cambia de
   * teléfono no tiene caché, y vería *"configurá tu facturación"* sobre un perfil que existe en la
   * base — el peor error posible en esta pantalla, porque lo empuja a rehacer el alta.
   */
  it('sin CUIT cacheado -- igual le pregunta al backend, que lo resuelve solo', async () => {
    jest.mocked(almacenClave.leer).mockResolvedValueOnce(null);
    jest.mocked(estadoAfip).mockResolvedValueOnce({
      status: 'ok',
      cuit: '20111222339',
      conectado: true,
      wsAutorizados: ['wsfe'],
      perfilCompleto: true,
      puedeFacturar: true,
      onboarding: null,
    });

    await montar();

    await waitFor(() => expect(estadoAfip).toHaveBeenCalledWith(undefined));
    await waitFor(() => expect(crearFactura).toHaveBeenCalledWith('20111222339'));
  });

  /** Sin caché Y sin CUIT del backend sí es el estado inicial legítimo: el tenant no vinculó nada. */
  it('sin CUIT en ningún lado -- muestra el CTA de configurar y no crea borrador', async () => {
    jest.mocked(almacenClave.leer).mockResolvedValueOnce(null);
    jest.mocked(estadoAfip).mockResolvedValueOnce({
      status: 'ok',
      cuit: null,
      conectado: false,
      wsAutorizados: [],
      perfilCompleto: false,
      puedeFacturar: false,
      onboarding: null,
    });

    await montar();

    await waitFor(() => expect(screen.getByTestId('facturacion-cta-configurar')).toBeTruthy());
    expect(crearFactura).not.toHaveBeenCalled();
  });

  it('lee el CUIT de la MISMA clave que usa cuitCache.ts (contrato compartido con F5)', async () => {
    await montar();

    await waitFor(() => expect(almacenClave.leer).toHaveBeenCalledWith(CLAVE_CUIT_AFIP));
  });

  it('puedeFacturar:false -- muestra el CTA de configurar y NUNCA llama a crearFactura', async () => {
    jest.mocked(estadoAfip).mockResolvedValueOnce(estadoAfipMock({ puedeFacturar: false }));

    await montar();

    await waitFor(() => expect(screen.getByTestId('facturacion-cta-configurar')).toBeTruthy());
    expect(crearFactura).not.toHaveBeenCalled();
  });

  it('el CTA de configurar navega a /ajustes-afip con empujarUnaVez', async () => {
    jest.mocked(estadoAfip).mockResolvedValueOnce(estadoAfipMock({ puedeFacturar: false }));

    await montar();
    await waitFor(() => expect(screen.getByTestId('facturacion-cta-configurar-boton')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('facturacion-cta-configurar-boton'));

    expect(router.push).toHaveBeenCalledWith('/ajustes-afip');
  });

  /**
   * 🔴 **El test de arriba pasaba verde CON el defecto, y por eso existe éste.**
   *
   * Verificado en device el 2026-07-21: en la app real el CTA no hacía nada. La causa es que
   * `empujarUnaVez` cierra su puerta al lanzar y sólo la reabre la pantalla lanzadora al ganar foco —
   * el escritorio la cerró al abrir `/facturacion`, así que desde adentro el `push` era un no-op
   * silencioso. El test de arriba no lo veía porque monta la pantalla con la puerta ABIERTA (el flag
   * de módulo arranca en `true`): nunca ejercitaba la condición real.
   *
   * Éste reproduce la secuencia de verdad — cerrar la puerta primero, como haría el escritorio — y
   * verifica que Facturación la reabre por su cuenta al montar. El control que aisló la causa en
   * device fue tocar "Volver" (que usa `router.back`, no la puerta): respondía, así que los toques
   * llegaban y lo roto no era el botón.
   */
  it('el CTA funciona aunque el escritorio haya cerrado la puerta al lanzar esta pantalla', async () => {
    // Simula exactamente lo que pasa en la app: el escritorio lanzó /facturacion y cerró la puerta.
    empujarUnaVez('/facturacion');
    jest.mocked(router.push).mockClear();

    jest.mocked(estadoAfip).mockResolvedValueOnce(estadoAfipMock({ puedeFacturar: false }));

    await montar();
    await waitFor(() => expect(screen.getByTestId('facturacion-cta-configurar-boton')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('facturacion-cta-configurar-boton'));

    expect(router.push).toHaveBeenCalledWith('/ajustes-afip');
  });

  it.each([
    ['borrador', 'facturacion-paso-datos-venta'],
    ['datos_venta_ok', 'facturacion-paso-items'],
    ['items_ok', 'facturacion-paso-cliente'],
    ['cliente_ok', 'facturacion-paso-cliente'],
    ['esperando_confirmacion', 'facturacion-paso-resumen'],
    ['emitida', 'facturacion-comprobante'],
    ['entregada', 'facturacion-comprobante'],
    ['cancelada', 'facturacion-cancelada'],
  ] as const)('estado=%s -> renderiza %s', async (estado, testIdEsperado) => {
    jest.mocked(esperarEstadoEstable).mockResolvedValueOnce({
      estado: estadoMock({ estado, terminado: estado === 'emitida' || estado === 'entregada' || estado === 'cancelada' }),
      convergio: true,
    });

    await montar();

    await waitFor(() => expect(screen.getByTestId(testIdEsperado)).toBeTruthy());
  });

  it('rechazada con un motivoCodigo fiscal real (no sin_certificado_afip) -> paso de rechazo, con el motivo', async () => {
    jest.mocked(esperarEstadoEstable).mockResolvedValueOnce({
      estado: estadoMock({
        estado: 'rechazada',
        motivo: 'todavía faltan datos para emitir',
        motivoCodigo: 'faltan_datos',
        terminado: true,
      }),
      convergio: true,
    });

    await montar();

    await waitFor(() => expect(screen.getByTestId('facturacion-rechazada')).toBeTruthy());
    expect(screen.getByText('todavía faltan datos para emitir')).toBeTruthy();
  });

  it('rechazada + motivoCodigo=sin_certificado_afip -- muestra el CTA de configurar, NUNCA "rechazo fiscal"', async () => {
    jest.mocked(esperarEstadoEstable).mockResolvedValueOnce({
      estado: estadoMock({
        estado: 'rechazada',
        motivo: 'sin_certificado_afip',
        motivoCodigo: 'sin_certificado_afip',
        terminado: true,
      }),
      convergio: true,
    });

    await montar();

    await waitFor(() => expect(screen.getByTestId('facturacion-cta-configurar')).toBeTruthy());
    expect(screen.queryByTestId('facturacion-rechazada')).toBeNull();
  });

  it('el resumen muestra los TRES botones: Confirmar, Cancelar, Editar y confirmar', async () => {
    jest.mocked(esperarEstadoEstable).mockResolvedValueOnce({
      estado: estadoMock({ estado: 'esperando_confirmacion' }),
      convergio: true,
    });

    await montar();

    await waitFor(() => expect(screen.getByTestId('facturacion-paso-resumen-confirmar')).toBeTruthy());
    expect(screen.getByTestId('facturacion-paso-resumen-cancelar')).toBeTruthy();
    expect(screen.getByTestId('facturacion-paso-resumen-editar')).toBeTruthy();
  });

  it('confirmarConTokenFresco no-op -- re-muestra el resumen con el motivo, no avanza de pantalla', async () => {
    const enResumen = estadoMock({ estado: 'esperando_confirmacion' });
    jest.mocked(esperarEstadoEstable).mockResolvedValueOnce({ estado: enResumen, convergio: true });
    jest.mocked(confirmarConTokenFresco).mockResolvedValueOnce({
      emitida: false,
      motivo: 'los datos cambiaron, revisá el resumen antes de confirmar',
      estado: enResumen,
    });

    await montar();
    await waitFor(() => expect(screen.getByTestId('facturacion-paso-resumen-confirmar')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('facturacion-paso-resumen-confirmar'));

    await waitFor(() => expect(screen.getByTestId('facturacion-paso-resumen-aviso-no-op')).toBeTruthy());
    expect(screen.getByText('los datos cambiaron, revisá el resumen antes de confirmar')).toBeTruthy();
    // Sigue en el resumen -- un no-op no puede saltar a "emitiendo"/comprobante.
    expect(screen.getByTestId('facturacion-paso-resumen')).toBeTruthy();
  });

  it('emitida SIN pdf se muestra como ÉXITO con el CAE visible -- la palabra "falló" nunca aparece', async () => {
    jest.mocked(esperarEstadoEstable).mockResolvedValueOnce({
      estado: estadoMock({
        estado: 'emitida',
        terminado: true,
        pdf: null,
        motivo: 'la factura se emitió (CAE 86294776469171) pero falló el PDF: timeout',
        motivoCodigo: 'emitida_sin_pdf',
        resultado: { ok: true, duplicado: false, cae: '86294776469171', caeVto: '2026-08-01', nro: 8, tipoCbte: 11, puntoVenta: 6 },
      }),
      convergio: true,
    });

    await montar();

    await waitFor(() => expect(screen.getByTestId('facturacion-comprobante-sin-pdf')).toBeTruthy());
    expect(screen.getByTestId('facturacion-comprobante-cae')).toHaveTextContent('86294776469171', { exact: false });
    // Ni en el aviso propio ni en ningún otro texto de la pantalla aparece "falló"/"falla".
    expect(screen.queryByText(/fall[oó]/i)).toBeNull();
  });

  it('el aviso de 24 h está presente cuando el PDF SÍ está disponible', async () => {
    jest.mocked(esperarEstadoEstable).mockResolvedValueOnce({
      estado: estadoMock({
        estado: 'emitida',
        terminado: true,
        pdf: { url: 'https://copiloto.example/facturas/f1.pdf', nombre: 'factura.pdf', expiraAt: '2026-07-22T00:00:00Z' },
        resultado: { ok: true, duplicado: false, cae: '86294776469171', caeVto: '2026-08-01', nro: 8, tipoCbte: 11, puntoVenta: 6 },
      }),
      convergio: true,
    });

    await montar();

    await waitFor(() => expect(screen.getByTestId('facturacion-comprobante-aviso-24h')).toBeTruthy());
    expect(screen.getByTestId('facturacion-comprobante-aviso-24h')).toHaveTextContent('24 horas', { exact: false });
  });

  it('la confirmación de anular un comprobante NOMBRA la nota de crédito, no dice que se borra', async () => {
    jest.mocked(listarComprobantes).mockResolvedValueOnce({ status: 'ok', comprobantes: [comprobanteMock()] });

    await montar();

    const clave = '11-6-8'; // tipoCbte-puntoVenta-nro del `comprobanteMock()`.
    await waitFor(() => expect(screen.getByTestId(`facturacion-mis-comprobantes-anular-${clave}`)).toBeTruthy());
    await fireEvent.press(screen.getByTestId(`facturacion-mis-comprobantes-anular-${clave}`));

    await waitFor(() =>
      expect(screen.getByTestId(`facturacion-mis-comprobantes-anulacion-${clave}-aviso`)).toBeTruthy(),
    );
    expect(screen.getByText(/nota de crédito/i)).toBeTruthy();
    expect(anularComprobante).not.toHaveBeenCalled(); // todavía no tocó "Sí, anular".
  });

  /**
   * 🔴 **El bug que reportó el operador el 2026-07-21: "no tengo ninguna factura 18, solo veo hasta
   * la 15".** La lista se cargaba UNA vez al montar y no volvía a preguntar nunca. El control por
   * HTTP contra la base mostró que el backend sí tenía las 24 filas, con la 18 primera: lo que
   * estaba viejo era la pantalla, no el dato.
   *
   * El test miente si sólo cuenta llamadas — hay que ver el comprobante NUEVO en pantalla. Por eso
   * la primera respuesta no lo trae y la segunda sí: sin recarga, la N° 18 no aparece jamás.
   */
  it('al terminar una emisión, "Mis comprobantes" vuelve a preguntar y muestra la factura nueva', async () => {
    jest.mocked(esperarEstadoEstable).mockResolvedValue({
      estado: estadoMock({ estado: 'entregada', terminado: true }),
      convergio: true,
    });
    jest.mocked(listarComprobantes)
      .mockResolvedValueOnce({ status: 'ok', comprobantes: [comprobanteMock({ nro: 15 })] })
      .mockResolvedValue({ status: 'ok', comprobantes: [comprobanteMock({ nro: 18 }), comprobanteMock({ nro: 15 })] });

    await montar();

    await waitFor(() => expect(screen.getByTestId('facturacion-mis-comprobantes-fila-11-6-18')).toBeTruthy());
  });

  /**
   * 🔴 **El único camino para lo que cambió AFUERA.** Si la factura se emitió desde otro teléfono, la
   * web, o el agente por chat, esta app no ejecutó ninguna acción que pudiera disparar un refresco —
   * ningún "recargar después de X" alcanza, porque nunca hubo X. El tirón es lo que le devuelve al
   * usuario la capacidad de preguntar.
   *
   * ⚠️ **Lo que este test NO prueba.** Dispara el `onRefresh` por la prop porque el `RefreshControl`
   * no es un nodo del árbol —es una prop del `ScrollView`, así que no hay `testID` que consultar—, y
   * porque jsdom no tiene gesto táctil. Verifica el CABLEADO (tirar vuelve a pedir y repinta), no que
   * el arrastre funcione en el teléfono. Eso último sólo lo dice el device.
   */
  it('el tirón-para-actualizar vuelve a pedir la lista', async () => {
    jest.mocked(listarComprobantes)
      .mockResolvedValueOnce({ status: 'ok', comprobantes: [comprobanteMock({ nro: 15 })] })
      .mockResolvedValue({ status: 'ok', comprobantes: [comprobanteMock({ nro: 18 }), comprobanteMock({ nro: 15 })] });

    await montar();
    await waitFor(() => expect(screen.getByTestId('facturacion-mis-comprobantes-fila-11-6-15')).toBeTruthy());
    expect(screen.queryByTestId('facturacion-mis-comprobantes-fila-11-6-18')).toBeNull();

    const refresco = screen.getByTestId('facturacion-lista').props.refreshControl;
    expect(refresco.props.refreshing).toBe(false);
    await act(async () => {
      await refresco.props.onRefresh();
    });

    await waitFor(() => expect(screen.getByTestId('facturacion-mis-comprobantes-fila-11-6-18')).toBeTruthy());
  });
});

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AppState, Linking } from 'react-native';

jest.mock('@copiloto/core', () => {
  const actual = jest.requireActual('@copiloto/core');
  return {
    ...actual,
    listarCatalogo: jest.fn(),
    pedirLinkDeVinculacion: jest.fn(),
    desconectarServicio: jest.fn(),
  };
});

import { desconectarServicio, listarCatalogo, pedirLinkDeVinculacion, type ServicioCatalogo } from '@copiloto/core';

import { ThemeProvider } from '../../theme/ThemeProvider';
import { PantallaApps } from './PantallaApps';

function servicioMock(over: Partial<ServicioCatalogo> = {}): ServicioCatalogo {
  return {
    key: 'googledrive',
    nombre: 'Google Drive',
    etiquetaTrabajo: 'Archivos',
    categoria: 'Archivos',
    kind: 'composio',
    descripcion: 'Creá y buscá archivos en tu Google Drive.',
    capacidades: ['Crear archivo'],
    conectado: false,
    connectPath: '/composio/connect?service=googledrive',
    ...over,
  };
}

async function envolver() {
  return render(
    <ThemeProvider>
      <PantallaApps />
    </ThemeProvider>,
  );
}

describe('PantallaApps', () => {
  beforeEach(() => {
    jest.mocked(listarCatalogo).mockReset().mockResolvedValue({ status: 'ok', servicios: [servicioMock()] });
    jest.mocked(pedirLinkDeVinculacion).mockReset().mockResolvedValue({
      status: 'ok', url: 'https://connect.composio.dev/link/lk_abc',
    });
    jest.mocked(desconectarServicio).mockReset().mockResolvedValue({ status: 'ok' });
    jest.spyOn(Linking, 'canOpenURL').mockReset().mockResolvedValue(true);
    jest.spyOn(Linking, 'openURL').mockReset().mockResolvedValue(undefined as never);
  });

  /**
   * Devuelve el listener que la pantalla registró en `AppState`, para poder emitir el cambio a
   * `active` a mano: el mock de `AppState` de jest-expo no expone `emit`, así que se lo captura
   * del `addEventListener`. Es el evento REAL que usa la pantalla, no un atajo por otra puerta.
   */
  function capturarListenerDeAppState() {
    const suscripciones: Array<(estado: string) => void> = [];
    jest.spyOn(AppState, 'addEventListener').mockImplementation(((_evento: string, cb: (e: string) => void) => {
      suscripciones.push(cb);
      return { remove: () => {} };
    }) as never);
    return () => {
      for (const cb of suscripciones) cb('active');
    };
  }

  /**
   * 🔴 **La lista sale del BACKEND, no de una constante local.** Hasta el 2026-07-21 esta pantalla
   * tenía los ocho servicios hardcodeados: se veía idéntica mientras coincidiera con la policy real
   * y habría mentido en silencio el día que divergiera. El test usa a propósito un servicio que NO
   * estaba en aquella lista — si alguien vuelve a hardcodearla, esto falla.
   */
  it('lista lo que devuelve el catálogo, incluso un servicio que la app no conoce', async () => {
    jest.mocked(listarCatalogo).mockResolvedValue({
      status: 'ok',
      servicios: [servicioMock({ key: 'servicio_nuevo', nombre: 'Servicio Nuevo' })],
    });

    await envolver();

    await waitFor(() => expect(screen.getByText('Servicio Nuevo')).toBeTruthy());
    // Y aparece con ícono por defecto en vez de omitirse: fail-open, nunca fail-closed.
    expect(screen.getByTestId('app-servicio_nuevo')).toBeTruthy();
  });

  it('un servicio conectado lo DICE y no ofrece conectarlo; uno sin conectar ofrece el botón', async () => {
    jest.mocked(listarCatalogo).mockResolvedValue({
      status: 'ok',
      servicios: [
        servicioMock({ key: 'gmail', nombre: 'Gmail', conectado: true }),
        servicioMock({ key: 'googledrive', conectado: false }),
      ],
    });

    await envolver();

    await waitFor(() => expect(screen.getByTestId('app-gmail-conectada')).toBeTruthy());
    expect(screen.queryByTestId('app-gmail-conectar')).toBeNull();
    expect(screen.getByTestId('app-googledrive-conectar')).toBeTruthy();
    expect(screen.queryByTestId('app-googledrive-conectada')).toBeNull();
  });

  /**
   * 🔴 El `connectPath` se usa TAL CUAL como lo mandó el backend. Reconstruirlo en el cliente
   * ("`/composio/connect?service=` + key") duplicaría una regla que ya tiene dueño — y se rompería
   * con MercadoPago, que no es Composio y va por `/mp/connect`.
   */
  it('conectar pide el link con el connectPath del backend y abre ESA url', async () => {
    jest.mocked(listarCatalogo).mockResolvedValue({
      status: 'ok',
      servicios: [servicioMock({ key: 'mercadopago', nombre: 'Mercado Pago', kind: 'payments', connectPath: '/mp/connect' })],
    });

    await envolver();
    await waitFor(() => expect(screen.getByTestId('app-mercadopago-conectar')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('app-mercadopago-conectar'));

    await waitFor(() => expect(pedirLinkDeVinculacion).toHaveBeenCalledWith('/mp/connect'));
    await waitFor(() => expect(Linking.openURL).toHaveBeenCalledWith('https://connect.composio.dev/link/lk_abc'));
  });

  /**
   * 🔴 **Abrir el navegador NO es haber conectado.** El usuario puede autorizar, abandonar o fallar,
   * y la app no se entera de cuál de las tres. Pintar "Conectada" al volver sería afirmar un hecho
   * por haber iniciado la acción que lo produciría — el error que este repo ya pagó dos veces esta
   * semana. Lo correcto es re-preguntar y creerle al backend.
   */
  it('al volver del navegador re-consulta el catálogo y pinta lo que diga el backend', async () => {
    jest.mocked(listarCatalogo)
      .mockResolvedValueOnce({ status: 'ok', servicios: [servicioMock({ conectado: false })] })
      .mockResolvedValue({ status: 'ok', servicios: [servicioMock({ conectado: true })] });

    const volverAPrimerPlano = capturarListenerDeAppState();

    await envolver();
    await waitFor(() => expect(screen.getByTestId('app-googledrive-conectar')).toBeTruthy());

    // La app vuelve a primer plano — es lo que ocurre al cerrar el navegador.
    await act(async () => {
      volverAPrimerPlano();
    });

    await waitFor(() => expect(screen.getByTestId('app-googledrive-conectada')).toBeTruthy());
    expect(screen.queryByTestId('app-googledrive-conectar')).toBeNull();
  });

  it('un fallo al pedir el link se dice, no se traga', async () => {
    jest.mocked(pedirLinkDeVinculacion).mockRejectedValue(new Error('red'));

    await envolver();
    await waitFor(() => expect(screen.getByTestId('app-googledrive-conectar')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('app-googledrive-conectar'));

    await waitFor(() => expect(screen.getByTestId('apps-error-vinculo')).toBeTruthy());
    expect(Linking.openURL).not.toHaveBeenCalled();
  });

  describe('desconectar', () => {
    function conectado(over: Partial<ServicioCatalogo> = {}) {
      return servicioMock({ conectado: true, capacidades: ['Crear archivo', 'Buscar archivo'], ...over });
    }

    /**
     * 🔴 **La confirmación NOMBRA lo que se pierde.** Un "¿estás seguro?" pelado no le da al usuario
     * con qué decidir. Las capacidades salen del catálogo, así que el aviso es específico del
     * servicio y no una frase de molde — mismo criterio que la anulación de comprobantes, que dice
     * "esto emite una nota de crédito" en vez de "¿anular?".
     */
    it('pide confirmación diciendo qué deja de poder hacer el copiloto', async () => {
      jest.mocked(listarCatalogo).mockResolvedValue({ status: 'ok', servicios: [conectado()] });

      await envolver();
      await waitFor(() => expect(screen.getByTestId('app-googledrive-desconectar')).toBeTruthy());
      await fireEvent.press(screen.getByTestId('app-googledrive-desconectar'));

      await waitFor(() => expect(screen.getByTestId('app-googledrive-baja-aviso')).toBeTruthy());
      expect(screen.getByTestId('app-googledrive-baja-aviso')).toHaveTextContent('crear archivo', { exact: false });
      // Y no desconectó nada todavía: falta confirmar.
      expect(desconectarServicio).not.toHaveBeenCalled();
    });

    /** Drive arrastra una consecuencia que no está en sus `capabilities`: la facturación. */
    it('avisa que las facturas dejan de archivarse al desconectar Drive', async () => {
      jest.mocked(listarCatalogo).mockResolvedValue({ status: 'ok', servicios: [conectado()] });

      await envolver();
      await waitFor(() => expect(screen.getByTestId('app-googledrive-desconectar')).toBeTruthy());
      await fireEvent.press(screen.getByTestId('app-googledrive-desconectar'));

      await waitFor(() => expect(screen.getByTestId('app-googledrive-baja-consecuencia')).toBeTruthy());
      expect(screen.getByTestId('app-googledrive-baja-consecuencia')).toHaveTextContent('facturas', { exact: false });
    });

    it('decir que no cierra la confirmación sin desconectar', async () => {
      jest.mocked(listarCatalogo).mockResolvedValue({ status: 'ok', servicios: [conectado()] });

      await envolver();
      await waitFor(() => expect(screen.getByTestId('app-googledrive-desconectar')).toBeTruthy());
      await fireEvent.press(screen.getByTestId('app-googledrive-desconectar'));
      await waitFor(() => expect(screen.getByTestId('app-googledrive-baja-no')).toBeTruthy());
      await fireEvent.press(screen.getByTestId('app-googledrive-baja-no'));

      await waitFor(() => expect(screen.queryByTestId('app-googledrive-confirmar-baja')).toBeNull());
      expect(desconectarServicio).not.toHaveBeenCalled();
      expect(screen.getByTestId('app-googledrive-conectada')).toBeTruthy();
    });

    /**
     * 🔴 **Que el DELETE devuelva ok NO es que la conexión ya no exista.** Se re-consulta el catálogo
     * y se pinta lo que diga `conectado`. Si el backend fallara a medias, pintar optimista dejaría al
     * usuario creyendo que desconectó algo que sigue vivo — y en una acción de seguridad, esa mentira
     * es la peor de todas.
     */
    it('al confirmar, re-consulta el catálogo y pinta lo que diga el backend', async () => {
      jest.mocked(listarCatalogo)
        .mockResolvedValueOnce({ status: 'ok', servicios: [conectado()] })
        .mockResolvedValue({ status: 'ok', servicios: [conectado({ conectado: false })] });

      await envolver();
      await waitFor(() => expect(screen.getByTestId('app-googledrive-desconectar')).toBeTruthy());
      await fireEvent.press(screen.getByTestId('app-googledrive-desconectar'));
      await waitFor(() => expect(screen.getByTestId('app-googledrive-baja-si')).toBeTruthy());
      await fireEvent.press(screen.getByTestId('app-googledrive-baja-si'));

      await waitFor(() => expect(desconectarServicio).toHaveBeenCalled());
      await waitFor(() => expect(screen.getByTestId('app-googledrive-conectar')).toBeTruthy());
      expect(screen.queryByTestId('app-googledrive-conectada')).toBeNull();
    });

    /** El endpoint todavía no existe (pedido al backend el 2026-07-21): eso se DICE, no se traga. */
    it('si el endpoint no está desplegado, lo dice en vez de fingir que desconectó', async () => {
      jest.mocked(listarCatalogo).mockResolvedValue({ status: 'ok', servicios: [conectado()] });
      jest.mocked(desconectarServicio).mockResolvedValue({ status: 'no_disponible' });

      await envolver();
      await waitFor(() => expect(screen.getByTestId('app-googledrive-desconectar')).toBeTruthy());
      await fireEvent.press(screen.getByTestId('app-googledrive-desconectar'));
      await waitFor(() => expect(screen.getByTestId('app-googledrive-baja-si')).toBeTruthy());
      await fireEvent.press(screen.getByTestId('app-googledrive-baja-si'));

      await waitFor(() => expect(screen.getByTestId('apps-error-vinculo')).toBeTruthy());
      // Y sigue mostrándose como conectada, que es la verdad.
      expect(screen.getByTestId('app-googledrive-conectada')).toBeTruthy();
    });
  });

  /**
   * 🔴 Invariante invertido con la convergencia a `MarcoGlass` (2026-07-21). Antes esta pantalla se
   * montaba dentro de `CapaFuncion`, que aportaba el título — así que `PantallaApps` NO podía
   * repetirlo. `CapaFuncion` se borró: ahora es esta misma pantalla la que trae su propio
   * `MarcoGlass`, así que el título tiene que aparecer — pero UNA sola vez, nunca duplicado por el
   * contenido propio.
   */
  it('el título "Apps" lo aporta el MarcoGlass propio, una sola vez', async () => {
    await envolver();
    expect(screen.getByTestId('glass-titulo').props.children).toBe('Apps');
    expect(screen.getAllByText('Apps')).toHaveLength(1);
  });
});

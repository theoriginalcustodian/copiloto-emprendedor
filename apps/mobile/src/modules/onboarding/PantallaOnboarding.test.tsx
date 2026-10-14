import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AppState, Linking } from 'react-native';

jest.mock('@copiloto/core', () => ({
  ...jest.requireActual('@copiloto/core'),
  listarCatalogo: jest.fn(),
  pedirLinkDeVinculacion: jest.fn(),
  leerPortada: jest.fn(),
  completarOnboarding: jest.fn(),
  leerPerfilNegocio: jest.fn(),
  guardarPerfilNegocio: jest.fn(),
}));

import {
  completarOnboarding,
  guardarPerfilNegocio,
  leerPerfilNegocio,
  leerPortada,
  listarCatalogo,
  pedirLinkDeVinculacion,
  PEDIDO_DETALLE_POR_COBRAR,
  tomarPendiente,
  ApiError,
  type ServicioCatalogo,
} from '@copiloto/core';

import { ThemeProvider } from '../../theme/ThemeProvider';
import { PantallaOnboarding } from './PantallaOnboarding';

const servicio = (over: Partial<ServicioCatalogo> = {}): ServicioCatalogo => ({
  key: 'gmail',
  nombre: 'Gmail',
  etiquetaTrabajo: 'Mail',
  categoria: 'Mail',
  kind: 'composio',
  descripcion: '',
  capacidades: [],
  acciones: [],
  conectado: false,
  estado: 'nunca_conectado',
  connectPath: '/composio/connect?service=gmail',
  ...over,
});
const mp = (conectado: boolean) => servicio({ key: 'mercadopago', kind: 'payments', connectPath: '/mp/connect', conectado });
const portada = (total: string | null, vencido: string | null = null) =>
  ({
    status: 'ok',
    portada: { caja: {}, mes: {}, serieMensual: [], mejoresClientes: [], porCobrar: { total, vencido } },
  }) as never;

async function montar(onTerminar = jest.fn()) {
  await render(
    <ThemeProvider>
      <PantallaOnboarding onTerminar={onTerminar} />
    </ThemeProvider>,
  );
  return onTerminar;
}

describe('PantallaOnboarding (K-14 / BL-X8)', () => {
  beforeEach(() => {
    jest.mocked(listarCatalogo).mockReset().mockResolvedValue({ status: 'ok', servicios: [mp(false), servicio()] });
    jest.mocked(pedirLinkDeVinculacion).mockReset().mockResolvedValue({ status: 'ok', url: 'https://connect.example/lk' });
    jest.mocked(leerPortada).mockReset();
    jest.mocked(completarOnboarding).mockReset().mockResolvedValue({ ok: true });
    tomarPendiente(); // el buzón es un módulo con estado: un test no hereda el pedido del anterior
    jest.spyOn(Linking, 'canOpenURL').mockReset().mockResolvedValue(true);
    jest.spyOn(Linking, 'openURL').mockReset().mockResolvedValue(undefined as never);
  });

  it('muestra la promesa con los DOS permisos y el alcance dicho antes', async () => {
    await montar();
    expect(await screen.findByTestId('onboarding-conectar-mercadopago')).toBeTruthy();
    expect(screen.getByTestId('onboarding-conectar-google')).toBeTruthy();
    expect(screen.getByTestId('onboarding-alcance')).toHaveTextContent(/Cada permiso se corta cuando quieras/);
  });

  it('«Después» no bloquea: marca el onboarding y cierra sin conectar nada', async () => {
    const onTerminar = await montar();
    fireEvent.press(await screen.findByTestId('onboarding-despues'));
    await waitFor(() => expect(onTerminar).toHaveBeenCalled());
    expect(completarOnboarding).toHaveBeenCalledTimes(1);
    expect(pedirLinkDeVinculacion).not.toHaveBeenCalled();
  });

  it('«Después» cierra aunque no se pueda marcar (fail-soft)', async () => {
    jest.mocked(completarOnboarding).mockResolvedValue({ ok: false, perfilIncompleto: false });
    const onTerminar = await montar();
    fireEvent.press(await screen.findByTestId('onboarding-despues'));
    await waitFor(() => expect(onTerminar).toHaveBeenCalled());
  });

  it('sin catálogo la promesa igual se ve y «Después» sigue disponible', async () => {
    jest.mocked(listarCatalogo).mockResolvedValue({ status: 'no_disponible' });
    await montar();
    expect(screen.getByTestId('onboarding-despues')).toBeTruthy();
  });

  it('un permiso ya conectado no se vuelve a pedir; el otro sí', async () => {
    jest.mocked(listarCatalogo).mockResolvedValue({ status: 'ok', servicios: [mp(true), servicio()] });
    await montar();
    expect(await screen.findByTestId('onboarding-conectado-mercadopago')).toBeTruthy();
    expect(screen.queryByTestId('onboarding-conectar-mercadopago')).toBeNull();
    expect(screen.getByTestId('onboarding-conectar-google')).toBeTruthy();
  });

  it('conectar pide el link del servicio del catálogo y abre el navegador', async () => {
    await montar();
    fireEvent.press(await screen.findByTestId('onboarding-conectar-google'));
    await waitFor(() => expect(pedirLinkDeVinculacion).toHaveBeenCalledWith('/composio/connect?service=gmail'));
    await waitFor(() => expect(Linking.openURL).toHaveBeenCalledWith('https://connect.example/lk'));
    await screen.findByText('Conectar Google'); // el botón vuelve a su etiqueta al terminar de abrir
  });

  it('con los dos permisos ya dados salta al recibo con la cifra real', async () => {
    jest.mocked(listarCatalogo).mockResolvedValue({ status: 'ok', servicios: [mp(true), servicio({ conectado: true })] });
    jest.mocked(leerPortada).mockResolvedValue(portada('147000.00', '63000.00'));
    await montar();
    const texto = await screen.findByTestId('onboarding-insight');
    expect(texto).toHaveTextContent(/facturados sin cobrar/);
    expect(texto).toHaveTextContent(/147\.000/);
    expect(texto).toHaveTextContent(/63\.000.*vencidos/);
  });

  it('el recibo NO inventa una cifra cuando por cobrar viene en cero', async () => {
    jest.mocked(listarCatalogo).mockResolvedValue({ status: 'ok', servicios: [mp(true), servicio({ conectado: true })] });
    jest.mocked(leerPortada).mockResolvedValue(portada('0.00'));
    await montar();
    const texto = await screen.findByTestId('onboarding-insight');
    expect(texto).toHaveTextContent(/Todavía no tenés facturas pendientes/);
    expect(texto).not.toHaveTextContent(/\$/);
  });

  // Fila `onb-cumplida`, divergencia #2: el recibo de servicios es el `Recibo` real del chat, no una píldora.
  it('«Servicios conectados» es el Recibo del chat: título + detalle «Mercado Pago · Google»', async () => {
    jest.mocked(listarCatalogo).mockResolvedValue({ status: 'ok', servicios: [mp(true), servicio({ conectado: true })] });
    jest.mocked(leerPortada).mockResolvedValue(portada('10.00'));
    await montar();
    await screen.findByTestId('onboarding-insight');
    expect(screen.getByTestId('onboarding-recibo-servicios-titulo')).toHaveTextContent('Servicios conectados');
    expect(screen.getByTestId('onboarding-recibo-servicios-detalle-0')).toHaveTextContent('Mercado Pago · Google');
  });

  it('el recibo con la portada caída dice lo mismo que sin datos', async () => {
    jest.mocked(listarCatalogo).mockResolvedValue({ status: 'ok', servicios: [mp(true), servicio({ conectado: true })] });
    jest.mocked(leerPortada).mockRejectedValue(new Error('red'));
    await montar();
    expect(await screen.findByTestId('onboarding-insight')).toHaveTextContent(/Todavía no tenés facturas pendientes/);
  });

  it('«Entrar» del recibo marca el onboarding y cierra el hilo', async () => {
    jest.mocked(listarCatalogo).mockResolvedValue({ status: 'ok', servicios: [mp(true), servicio({ conectado: true })] });
    jest.mocked(leerPortada).mockResolvedValue(portada('10.00'));
    const onTerminar = await montar();
    await screen.findByTestId('onboarding-insight');
    fireEvent.press(screen.getByTestId('onboarding-entrar'));
    await waitFor(() => expect(onTerminar).toHaveBeenCalled());
    expect(completarOnboarding).toHaveBeenCalledTimes(1);
  });

  // BL-X8 resto (contrato fila 3, ANEXO) — «el onboarding es una conversación en el hilo, no una
  // pantalla»: la promesa se dibuja con burbujas de asistente (`Burbuja`) y la tarjeta real del chat
  // (`CristalVidrio nivel="informe"`, mismo nivel que `TarjetaConfirmacion`), no el formulario viejo.
  it('la promesa se dibuja con burbujas de asistente y la tarjeta real del hilo, no un formulario', async () => {
    await montar();
    await screen.findByTestId('onboarding-conectar-google');
    expect(screen.getByText('Laburo así: vos me hablás, yo resuelvo. Pero primero necesito ver tu negocio.')).toBeTruthy();
    expect(screen.getByText('¿Conectamos tus servicios? Son dos minutos y te digo algo que no sabés.')).toBeTruthy();
    expect(screen.getByTestId('onboarding-tarjeta-servicios')).toBeTruthy();
  });

  it('la promesa cumplida trae la pregunta cerrada y el chip «Armame el detalle» sólo si hay dato real', async () => {
    jest.mocked(listarCatalogo).mockResolvedValue({ status: 'ok', servicios: [mp(true), servicio({ conectado: true })] });
    jest.mocked(leerPortada).mockResolvedValue(portada('147000.00'));
    await montar();
    await waitFor(() => expect(screen.getByTestId('onboarding-insight')).toHaveTextContent(/facturados sin cobrar/));
    expect(screen.getByText('¿Querés que te arme el detalle de quiénes son?')).toBeTruthy();
    expect(screen.getByTestId('onboarding-chip-detalle')).toBeTruthy();
  });

  it('sin dato real (0/vacío) NO hay pregunta cerrada ni chip — no se inventa una', async () => {
    jest.mocked(listarCatalogo).mockResolvedValue({ status: 'ok', servicios: [mp(true), servicio({ conectado: true })] });
    jest.mocked(leerPortada).mockResolvedValue(portada('0.00'));
    await montar();
    await waitFor(() => expect(screen.getByTestId('onboarding-insight')).toHaveTextContent(/Todavía no tenés facturas pendientes/));
    expect(screen.queryByTestId('onboarding-chip-detalle')).toBeNull();
  });

  it('el chip «Armame el detalle» entra al hilo real y marca el onboarding UNA sola vez (idempotente)', async () => {
    jest.mocked(listarCatalogo).mockResolvedValue({ status: 'ok', servicios: [mp(true), servicio({ conectado: true })] });
    jest.mocked(leerPortada).mockResolvedValue(portada('147000.00'));
    const onTerminar = await montar();
    fireEvent.press(await screen.findByText('Armame el detalle'));
    await waitFor(() => expect(onTerminar).toHaveBeenCalledTimes(1));
    expect(completarOnboarding).toHaveBeenCalledTimes(1);
  });

  // Fila `onb-cumplida`, divergencia #5: el chip prometía «el detalle» y sólo cerraba el onboarding.
  it('🔴 el chip deja el pedido del detalle en el buzón del chat principal, UNA sola vez', async () => {
    jest.mocked(listarCatalogo).mockResolvedValue({ status: 'ok', servicios: [mp(true), servicio({ conectado: true })] });
    jest.mocked(leerPortada).mockResolvedValue(portada('147000.00'));
    const onTerminar = await montar();
    fireEvent.press(await screen.findByText('Armame el detalle'));
    await waitFor(() => expect(onTerminar).toHaveBeenCalledTimes(1));
    expect(tomarPendiente()).toBe(PEDIDO_DETALLE_POR_COBRAR);
    expect(tomarPendiente()).toBeNull(); // tomar lo vacía: el chat no lo reenvía solo al volver a tomar foco
  });

  it('«Entrar» NO deja ningún pedido: el emprendedor entra al hilo sin que nadie hable por él', async () => {
    jest.mocked(listarCatalogo).mockResolvedValue({ status: 'ok', servicios: [mp(true), servicio({ conectado: true })] });
    jest.mocked(leerPortada).mockResolvedValue(portada('147000.00'));
    const onTerminar = await montar();
    await screen.findByTestId('onboarding-insight');
    fireEvent.press(screen.getByTestId('onboarding-entrar'));
    await waitFor(() => expect(onTerminar).toHaveBeenCalledTimes(1));
    expect(tomarPendiente()).toBeNull();
  });
});

// SM-C3 DoD 2-4 — el paso del perfil mínimo. El control de acceso (`queVende` y `nombreComercial`
// obligatorios) exige el caso HOSTIL, no sólo el feliz: con uno vacío NO se entra. El happy-path pasa
// igual si el gate no existe; sólo estos tests lo distinguen.
describe('PantallaOnboarding — SM-C3: el paso del perfil mínimo', () => {
  const PERFIL_INCOMPLETO = { ok: false, perfilIncompleto: true, faltantes: ['queVende', 'nombreComercial'] } as const;

  beforeEach(() => {
    jest.mocked(listarCatalogo).mockReset().mockResolvedValue({ status: 'ok', servicios: [mp(false), servicio()] });
    jest.mocked(leerPortada).mockReset();
    jest.mocked(completarOnboarding).mockReset().mockResolvedValue(PERFIL_INCOMPLETO);
    jest.mocked(leerPerfilNegocio).mockReset().mockResolvedValue({ status: 'ok', perfil: null });
    jest.mocked(guardarPerfilNegocio).mockReset().mockResolvedValue({ status: 'ok', perfil: {} as never });
    tomarPendiente();
  });

  // `fireEvent` de RNTL es ASÍNCRONO: sin `await` el press/changeText sigue corriendo cuando el test termina
  // y deja los `act` solapados para el que sigue (un test verde pasaba y el siguiente no encontraba nada).
  async function presionar(nodo: ReturnType<typeof screen.getByTestId>) {
    await fireEvent.press(nodo); // RNTL async: espera el `act` y lo que el press dispara
  }

  const vaciarMicrotareas = () => act(async () => { await Promise.resolve(); });

  async function irAlPaso(onTerminar = jest.fn()) {
    await montar(onTerminar);
    await presionar(await screen.findByTestId('onboarding-despues'));
    await screen.findByTestId('onboarding-perfil');
    await vaciarMicrotareas(); // el pre-llenado (`leerPerfilNegocio`) resuelve acá, no en el test que sigue
    return onTerminar;
  }

  const escribir = async (id: string, texto: string) => {
    await fireEvent.changeText(screen.getByTestId(`onboarding-perfil-${id}-input`), texto);
  };

  it('🔴 el backend rechaza por perfil incompleto: el hilo NO se cierra y aparecen los dos campos', async () => {
    const onTerminar = await irAlPaso();
    expect(screen.getByTestId('onboarding-perfil-que-vende')).toBeTruthy();
    expect(screen.getByTestId('onboarding-perfil-nombre-comercial')).toBeTruthy();
    expect(onTerminar).not.toHaveBeenCalled();
  });

  it('🔴 adversarial: con UNO de los dos vacío no entra, no llama al server y dice cuál falta', async () => {
    const onTerminar = await irAlPaso();
    await escribir('nombre-comercial', 'Panadería La Esquina');

    await presionar(screen.getByTestId('onboarding-perfil-guardar'));

    expect(await screen.findByTestId('onboarding-perfil-que-vende-error')).toHaveTextContent('Falta qué vendés');
    expect(screen.queryByTestId('onboarding-perfil-nombre-comercial-error')).toBeNull();
    expect(guardarPerfilNegocio).not.toHaveBeenCalled();
    expect(completarOnboarding).toHaveBeenCalledTimes(1); // sólo el que abrió el paso
    expect(onTerminar).not.toHaveBeenCalled();
  });

  it('🔴 adversarial: «sólo espacios» cuenta como vacío (igual que el backend)', async () => {
    const onTerminar = await irAlPaso();
    await escribir('que-vende', '   ');
    await escribir('nombre-comercial', '  ');

    await presionar(screen.getByTestId('onboarding-perfil-guardar'));

    expect(await screen.findByTestId('onboarding-perfil-que-vende-error')).toBeTruthy();
    expect(screen.getByTestId('onboarding-perfil-nombre-comercial-error')).toBeTruthy();
    expect(guardarPerfilNegocio).not.toHaveBeenCalled();
    expect(onTerminar).not.toHaveBeenCalled();
  });

  it('control positivo: con los dos llenos guarda (sin espacios de más), completa y entra', async () => {
    jest.mocked(completarOnboarding).mockResolvedValueOnce(PERFIL_INCOMPLETO).mockResolvedValueOnce({ ok: true });
    const onTerminar = await irAlPaso();
    await escribir('que-vende', '  Pan y facturas  ');
    await escribir('nombre-comercial', 'Panadería La Esquina');

    await presionar(screen.getByTestId('onboarding-perfil-guardar'));

    await waitFor(() => expect(onTerminar).toHaveBeenCalledTimes(1));
    expect(guardarPerfilNegocio).toHaveBeenCalledWith({ queVende: 'Pan y facturas', nombreComercial: 'Panadería La Esquina' });
    expect(completarOnboarding).toHaveBeenCalledTimes(2);
  });

  it('🔴 si el backend rechaza OTRA vez, el hilo sigue abierto y nombra lo que falta (no un error genérico)', async () => {
    jest
      .mocked(completarOnboarding)
      .mockResolvedValueOnce(PERFIL_INCOMPLETO)
      .mockResolvedValueOnce({ ok: false, perfilIncompleto: true, faltantes: ['nombreComercial'] });
    const onTerminar = await irAlPaso();
    await escribir('que-vende', 'Pan');
    await escribir('nombre-comercial', 'La Esquina');

    await presionar(screen.getByTestId('onboarding-perfil-guardar'));

    expect(await screen.findByTestId('onboarding-perfil-error')).toHaveTextContent('Todavía falta el nombre comercial.');
    expect(onTerminar).not.toHaveBeenCalled();
  });

  it('si guardar el perfil falla (400/red) se ve el motivo y no se cierra', async () => {
    jest.mocked(guardarPerfilNegocio).mockRejectedValue(new ApiError(400, 'bad', 'El nombre es demasiado largo'));
    const onTerminar = await irAlPaso();
    await escribir('que-vende', 'Pan');
    await escribir('nombre-comercial', 'La Esquina');

    await presionar(screen.getByTestId('onboarding-perfil-guardar'));

    expect(await screen.findByTestId('onboarding-perfil-error')).toHaveTextContent('El nombre es demasiado largo');
    expect(onTerminar).not.toHaveBeenCalled();
    expect(completarOnboarding).toHaveBeenCalledTimes(1);
  });

  it('pre-llena con lo que el perfil ya tiene (alguien que cargó uno de los dos)', async () => {
    jest.mocked(leerPerfilNegocio).mockResolvedValue({ status: 'ok', perfil: { queVende: 'Pan', nombreComercial: '' } as never });
    await irAlPaso();
    await waitFor(() => expect(screen.getByTestId('onboarding-perfil-que-vende-input').props.value).toBe('Pan'));
    expect(screen.getByTestId('onboarding-perfil-nombre-comercial-input').props.value).toBe('');
  });

  it('volver del navegador (AppState active) con el paso abierto NO lo devuelve al recibo', async () => {
    jest.mocked(listarCatalogo).mockResolvedValue({ status: 'ok', servicios: [mp(true), servicio({ conectado: true })] });
    jest.mocked(leerPortada).mockResolvedValue(portada('10.00'));
    let alCambiar: ((s: string) => void) | undefined;
    const espia = jest.spyOn(AppState, 'addEventListener').mockImplementation(((_: string, cb: (s: string) => void) => {
      alCambiar = cb;
      return { remove: jest.fn() };
    }) as never);
    await montar();
    await presionar(await screen.findByTestId('onboarding-entrar'));
    await screen.findByTestId('onboarding-perfil');
    await vaciarMicrotareas();

    // Dentro de `act` y esperando que la relectura RESUELVA: el `setPaso` ocurre después del `await` de
    // `listarCatalogo`, no cuando se lo llama (un `waitFor` sobre las llamadas pasaba antes de que pisara).
    await act(async () => {
      alCambiar?.('active');
    });
    expect(listarCatalogo).toHaveBeenCalledTimes(2);

    expect(screen.getByTestId('onboarding-perfil')).toBeTruthy();
    expect(screen.queryByTestId('onboarding-recibo')).toBeNull();
    espia.mockRestore();
  });
});

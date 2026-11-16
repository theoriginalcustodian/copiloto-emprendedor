import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AppState, Linking, StyleSheet, type ViewStyle } from 'react-native';

jest.mock('@copiloto/core', () => ({
  ...jest.requireActual('@copiloto/core'),
  listarCatalogo: jest.fn(),
  pedirLinkDeVinculacion: jest.fn(),
  completarOnboarding: jest.fn(),
  leerPerfilNegocio: jest.fn(),
  guardarPerfilNegocio: jest.fn(),
}));

import {
  completarOnboarding,
  guardarPerfilNegocio,
  leerPerfilNegocio,
  listarCatalogo,
  pedirLinkDeVinculacion,
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
async function montar(onTerminar = jest.fn()) {
  await render(
    <ThemeProvider>
      <PantallaOnboarding onTerminar={onTerminar} />
    </ThemeProvider>,
  );
  return onTerminar;
}

const PERFIL_COMPLETO = { status: 'ok', perfil: { queVende: 'Pan', nombreComercial: 'Los Tilos' } } as never;
const PERFIL_VACIO = { status: 'ok', perfil: null } as never;

beforeEach(() => {
  jest.mocked(listarCatalogo).mockReset().mockResolvedValue({ status: 'ok', servicios: [mp(false), servicio()] });
  jest.mocked(pedirLinkDeVinculacion).mockReset().mockResolvedValue({ status: 'ok', url: 'https://connect.example/lk' });
  jest.mocked(completarOnboarding).mockReset().mockResolvedValue({ ok: true });
  jest.mocked(leerPerfilNegocio).mockReset().mockResolvedValue(PERFIL_VACIO);
  jest.mocked(guardarPerfilNegocio).mockReset().mockResolvedValue({ status: 'ok', perfil: {} as never });
  tomarPendiente(); // el buzón del chat es un módulo con estado: un test no hereda el pedido del anterior
  jest.spyOn(Linking, 'canOpenURL').mockReset().mockResolvedValue(true);
  jest.spyOn(Linking, 'openURL').mockReset().mockResolvedValue(undefined as never);
});

async function presionar(nodo: ReturnType<typeof screen.getByTestId>) {
  await act(async () => {
    fireEvent.press(nodo);
  });
}

/** Conectar → «Después» con el perfil vacío deja en el paso del perfil. */
async function hastaElPerfil(onTerminar = jest.fn()) {
  await montar(onTerminar);
  await presionar(await screen.findByTestId('onboarding-despues'));
  await screen.findByTestId('onboarding-perfil');
  return onTerminar;
}

async function escribir(id: 'que-vende' | 'nombre-comercial', texto: string) {
  await fireEvent.changeText(screen.getByTestId(`onboarding-perfil-${id}-input`), texto);
}

// Martin 13/11/2026: el onboarding deja de ser una conversación. Es la configuración inicial, en tres
// pantallas y en este orden: Conectar → Perfil; después entra a la app, donde lo recibe el tutorial
// (`shell/TutorialPrimerIngreso`). Ver el docstring de `PantallaOnboarding.tsx`.
describe('Configuración inicial · 1 Conectar', () => {
  it('es una pantalla de configuración: rótulo, título en la voz de Odobi y bajada, sin burbujas', async () => {
    await montar();
    await screen.findByTestId('onboarding-conectar-google');
    expect(screen.getByTestId('onboarding-rotulo')).toHaveTextContent('Configuración inicial');
    expect(screen.getByTestId('onboarding-titulo')).toHaveTextContent(/Conectá tus cuentas\.\s+Del resto\s+me ocupo yo\./);
    expect(screen.getByTestId('onboarding-bajada')).toHaveTextContent(/uno, los dos o ninguno/);
    expect(screen.queryByText(/¿Conectamos tus servicios\?/)).toBeNull();
  });

  it('muestra los DOS permisos y el alcance dicho antes de pedir', async () => {
    await montar();
    expect(await screen.findByTestId('onboarding-conectar-mercadopago')).toBeTruthy();
    expect(screen.getByTestId('onboarding-conectar-google')).toBeTruthy();
    expect(screen.getByTestId('onboarding-alcance')).toHaveTextContent(/Cada permiso se corta cuando quieras/);
  });

  // Venía de un bug del `CristalVidrio` (cuerpo en `flex: 1` colapsaba a 4 px). La lista ya no usa vidrio,
  // pero la regla sigue: mide su contenido, no se estira ni se colapsa dentro del scroll.
  it('🔴 la lista de servicios mide su contenido: no lleva `flex`', async () => {
    await montar();
    const lista = await screen.findByTestId('onboarding-tarjeta-servicios');
    expect(StyleSheet.flatten(lista.props.style as ViewStyle).flex).toBeUndefined();
  });

  it('sin catálogo la pantalla igual se ve y «Después» sigue disponible', async () => {
    jest.mocked(listarCatalogo).mockRejectedValue(new Error('red'));
    await montar();
    expect(await screen.findByTestId('onboarding-despues')).toHaveTextContent('Después');
  });

  it('un permiso ya conectado no se vuelve a pedir; el otro sí, y la salida pasa a «Seguir»', async () => {
    jest.mocked(listarCatalogo).mockResolvedValue({ status: 'ok', servicios: [mp(true), servicio()] });
    await montar();
    expect(await screen.findByTestId('onboarding-conectado-mercadopago')).toBeTruthy();
    expect(screen.queryByTestId('onboarding-conectar-mercadopago')).toBeNull();
    expect(screen.getByTestId('onboarding-conectar-google')).toBeTruthy();
    expect(screen.getByTestId('onboarding-despues')).toHaveTextContent('Seguir');
  });

  it('conectar pide el link del servicio del catálogo y abre el navegador', async () => {
    await montar();
    fireEvent.press(await screen.findByTestId('onboarding-conectar-google'));
    await waitFor(() => expect(pedirLinkDeVinculacion).toHaveBeenCalledWith('/composio/connect?service=gmail'));
    await waitFor(() => expect(Linking.openURL).toHaveBeenCalledWith('https://connect.example/lk'));
    await waitFor(() => expect(screen.queryByText('Abriendo…')).toBeNull()); // vuelve a su etiqueta
    expect(screen.getByLabelText('Conectar Google')).toBeTruthy();
  });

  it('con los dos conectados NO salta sola: la persona decide cuándo seguir', async () => {
    jest.mocked(listarCatalogo).mockResolvedValue({ status: 'ok', servicios: [mp(true), servicio({ conectado: true })] });
    await montar();
    await screen.findByTestId('onboarding-conectado-google');
    expect(screen.getByTestId('onboarding')).toBeTruthy();
    expect(completarOnboarding).not.toHaveBeenCalled();
  });

  it('🔴 «Después» nunca bloquea ni completa el onboarding: sólo avanza (acá, al perfil que falta)', async () => {
    const onTerminar = await hastaElPerfil();
    expect(completarOnboarding).not.toHaveBeenCalled();
    expect(onTerminar).not.toHaveBeenCalled();
  });

  it('con el perfil ya cargado saltea el paso: completa y entra, UNA sola vez', async () => {
    jest.mocked(leerPerfilNegocio).mockResolvedValue(PERFIL_COMPLETO);
    const onTerminar = await montar();
    await presionar(await screen.findByTestId('onboarding-despues'));
    await waitFor(() => expect(onTerminar).toHaveBeenCalledTimes(1));
    expect(completarOnboarding).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('onboarding-perfil')).toBeNull();
    expect(tomarPendiente()).toBeNull(); // entra sin que nadie hable por él
  });

  it('entra aunque no se pueda marcar (fail-soft: se reintenta al próximo arranque)', async () => {
    jest.mocked(leerPerfilNegocio).mockResolvedValue(PERFIL_COMPLETO);
    jest.mocked(completarOnboarding).mockResolvedValue({ ok: false, perfilIncompleto: false });
    const onTerminar = await montar();
    await presionar(await screen.findByTestId('onboarding-despues'));
    await waitFor(() => expect(onTerminar).toHaveBeenCalledTimes(1));
  });

  it('🔴 si el perfil parecía completo pero el backend lo rechaza, NO entra: pide el perfil y nombra lo que falta', async () => {
    jest.mocked(leerPerfilNegocio).mockResolvedValue(PERFIL_COMPLETO);
    jest.mocked(completarOnboarding).mockResolvedValue({ ok: false, perfilIncompleto: true, faltantes: ['nombreComercial'] });
    const onTerminar = await montar();
    await presionar(await screen.findByTestId('onboarding-despues'));
    expect(await screen.findByTestId('onboarding-perfil-error')).toHaveTextContent('Todavía falta el nombre comercial.');
    expect(onTerminar).not.toHaveBeenCalled();
  });

  it('🔴 no poder LEER el perfil no es «está completo»: se pide igual (fail-closed)', async () => {
    jest.mocked(leerPerfilNegocio).mockRejectedValue(new Error('red'));
    await montar();
    await presionar(await screen.findByTestId('onboarding-despues'));
    expect(await screen.findByTestId('onboarding-perfil')).toBeTruthy();
  });
});

describe('Configuración inicial · 2 Perfil (SM-C3: el perfil mínimo)', () => {
  it('pide los dos campos, con el encabezado de la configuración', async () => {
    await hastaElPerfil();
    expect(screen.getByTestId('onboarding-perfil-que-vende')).toBeTruthy();
    expect(screen.getByTestId('onboarding-perfil-nombre-comercial')).toBeTruthy();
    expect(screen.getByTestId('onboarding-titulo')).toHaveTextContent(/Contame\s+de tu negocio\./);
  });

  it('SM-K8: al abrir el paso NO hay errores de campo — recién aparecen al intentar avanzar', async () => {
    await hastaElPerfil();
    expect(screen.queryByTestId('onboarding-perfil-que-vende-error')).toBeNull();
    expect(screen.queryByTestId('onboarding-perfil-nombre-comercial-error')).toBeNull();
    expect(screen.queryByTestId('onboarding-perfil-error')).toBeNull();
  });

  it('🔴 adversarial: con UNO de los dos vacío no avanza, no llama al server y dice cuál falta', async () => {
    await hastaElPerfil();
    await escribir('nombre-comercial', 'Panadería Los Tilos');
    await presionar(screen.getByTestId('onboarding-perfil-guardar'));
    expect(await screen.findByTestId('onboarding-perfil-que-vende-error')).toHaveTextContent('Falta qué vendés');
    expect(screen.queryByTestId('onboarding-perfil-nombre-comercial-error')).toBeNull();
    expect(guardarPerfilNegocio).not.toHaveBeenCalled();
    expect(completarOnboarding).not.toHaveBeenCalled();
  });

  it('🔴 adversarial: «sólo espacios» cuenta como vacío (igual que el backend)', async () => {
    await hastaElPerfil();
    await escribir('que-vende', '   ');
    await escribir('nombre-comercial', '  ');
    await presionar(screen.getByTestId('onboarding-perfil-guardar'));
    expect(await screen.findByTestId('onboarding-perfil-que-vende-error')).toBeTruthy();
    expect(screen.getByTestId('onboarding-perfil-nombre-comercial-error')).toBeTruthy();
    expect(guardarPerfilNegocio).not.toHaveBeenCalled();
  });

  it('control positivo: con los dos llenos guarda (sin espacios de más), completa y entra', async () => {
    const onTerminar = await hastaElPerfil();
    await escribir('que-vende', '  Pan y facturas ');
    await escribir('nombre-comercial', ' Los Tilos ');
    await presionar(screen.getByTestId('onboarding-perfil-guardar'));
    await waitFor(() => expect(onTerminar).toHaveBeenCalledTimes(1));
    expect(guardarPerfilNegocio).toHaveBeenCalledWith({ queVende: 'Pan y facturas', nombreComercial: 'Los Tilos' });
    expect(completarOnboarding).toHaveBeenCalledTimes(1);
  });

  it('🔴 si el backend rechaza OTRA vez tras guardar, sigue en el perfil y nombra lo que falta', async () => {
    const onTerminar = await hastaElPerfil();
    jest.mocked(completarOnboarding).mockResolvedValue({ ok: false, perfilIncompleto: true, faltantes: ['nombreComercial'] });
    await escribir('que-vende', 'Pan');
    await escribir('nombre-comercial', 'Los Tilos');
    await presionar(screen.getByTestId('onboarding-perfil-guardar'));
    expect(await screen.findByTestId('onboarding-perfil-error')).toHaveTextContent('Todavía falta el nombre comercial.');
    expect(onTerminar).not.toHaveBeenCalled();
  });

  it('tocar un rubro completa «Qué vendés» y se guarda ese texto', async () => {
    await hastaElPerfil();
    await presionar(screen.getByTestId('onboarding-perfil-rubro-Carpintería'));
    expect(screen.getByTestId('onboarding-perfil-que-vende-input').props.value).toBe('Carpintería');
    await escribir('nombre-comercial', 'Maderas Sur');
    await presionar(screen.getByTestId('onboarding-perfil-guardar'));
    await waitFor(() => expect(guardarPerfilNegocio).toHaveBeenCalledWith({ queVende: 'Carpintería', nombreComercial: 'Maderas Sur' }));
  });

  it('el rubro es un atajo, no una jaula: se le suma detalle y sigue marcado; texto propio no marca ninguno', async () => {
    await hastaElPerfil();
    await presionar(screen.getByTestId('onboarding-perfil-rubro-Electricidad'));
    await escribir('que-vende', 'Electricidad en casas y locales');
    expect(screen.getByTestId('onboarding-perfil-rubro-Electricidad').props.accessibilityState.selected).toBe(true);
    await escribir('que-vende', 'Paseo perros');
    expect(screen.getByTestId('onboarding-perfil-rubro-Electricidad').props.accessibilityState.selected).toBe(false);
    expect(screen.queryByTestId('onboarding-perfil-rubro-ayuda')).toBeNull();
  });

  it('si guardar el perfil falla (400/red) se ve el motivo y no avanza', async () => {
    await hastaElPerfil();
    jest.mocked(guardarPerfilNegocio).mockRejectedValue(new ApiError(400, 'El nombre es demasiado largo'));
    await escribir('que-vende', 'Pan');
    await escribir('nombre-comercial', 'Los Tilos');
    await presionar(screen.getByTestId('onboarding-perfil-guardar'));
    expect(await screen.findByTestId('onboarding-perfil-error')).toHaveTextContent('El nombre es demasiado largo');
    expect(completarOnboarding).not.toHaveBeenCalled();
  });

  it('pre-llena con lo que el perfil ya tiene (alguien que cargó uno de los dos)', async () => {
    jest.mocked(leerPerfilNegocio).mockResolvedValue({ status: 'ok', perfil: { queVende: 'Pan', nombreComercial: '' } } as never);
    await hastaElPerfil();
    await waitFor(() => expect(screen.getByTestId('onboarding-perfil-que-vende-input').props.value).toBe('Pan'));
    expect(screen.getByTestId('onboarding-perfil-nombre-comercial-input').props.value).toBe('');
  });

  it('volver del navegador (AppState active) con el paso abierto NO lo saca del perfil', async () => {
    const escuchas: ((s: string) => void)[] = [];
    jest.spyOn(AppState, 'addEventListener').mockImplementation(((_e: string, cb: (s: string) => void) => {
      escuchas.push(cb);
      return { remove: jest.fn() };
    }) as never);
    await hastaElPerfil();
    await act(async () => {
      escuchas.forEach((cb) => cb('active'));
    });
    expect(screen.getByTestId('onboarding-perfil')).toBeTruthy();
  });
});

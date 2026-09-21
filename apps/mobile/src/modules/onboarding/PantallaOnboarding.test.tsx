import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Linking } from 'react-native';

jest.mock('@copiloto/core', () => ({
  ...jest.requireActual('@copiloto/core'),
  listarCatalogo: jest.fn(),
  pedirLinkDeVinculacion: jest.fn(),
  leerPortada: jest.fn(),
  completarOnboarding: jest.fn(),
}));

import {
  completarOnboarding,
  leerPortada,
  listarCatalogo,
  pedirLinkDeVinculacion,
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
    jest.mocked(completarOnboarding).mockReset().mockResolvedValue(true);
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
    jest.mocked(completarOnboarding).mockResolvedValue(false);
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
});

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCatalogo = vi.fn();
const mockLink = vi.fn();
const mockPortada = vi.fn();
const mockCompletar = vi.fn();
vi.mock('@copiloto/core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@copiloto/core')>()),
  listarCatalogo: (...a: unknown[]) => mockCatalogo(...a),
  pedirLinkDeVinculacion: (...a: unknown[]) => mockLink(...a),
  leerPortada: (...a: unknown[]) => mockPortada(...a),
  completarOnboarding: (...a: unknown[]) => mockCompletar(...a),
}));

import { Onboarding } from './Onboarding';

const servicio = (over: Record<string, unknown>) => ({
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
const portada = (total: string | null, vencido: string | null = null) => ({
  status: 'ok',
  portada: { caja: {}, mes: {}, serieMensual: [], mejoresClientes: [], porCobrar: { total, vencido } },
});

describe('Onboarding (K-14 / BL-X8)', () => {
  beforeEach(() => {
    mockCatalogo.mockReset();
    mockLink.mockReset();
    mockPortada.mockReset();
    mockCompletar.mockReset().mockResolvedValue(true);
  });

  it('muestra la promesa con los DOS permisos y el alcance dicho antes', async () => {
    mockCatalogo.mockResolvedValue({ status: 'ok', servicios: [mp(false), servicio({})] });
    render(<Onboarding onTerminar={() => {}} />);
    expect(await screen.findByTestId('onboarding-conectar-mercadopago')).toBeInTheDocument();
    expect(screen.getByTestId('onboarding-conectar-google')).toBeInTheDocument();
    expect(screen.getByTestId('onboarding-alcance')).toHaveTextContent(/Cada permiso se corta cuando quieras/);
  });

  it('«Después» no bloquea: marca el onboarding y cierra sin conectar nada', async () => {
    mockCatalogo.mockResolvedValue({ status: 'ok', servicios: [mp(false), servicio({})] });
    const onTerminar = vi.fn();
    render(<Onboarding onTerminar={onTerminar} />);
    fireEvent.click(await screen.findByTestId('onboarding-despues'));
    await waitFor(() => expect(onTerminar).toHaveBeenCalled());
    expect(mockCompletar).toHaveBeenCalledTimes(1);
    expect(mockLink).not.toHaveBeenCalled();
  });

  it('«Después» cierra aunque no se pueda marcar (fail-soft)', async () => {
    mockCatalogo.mockResolvedValue({ status: 'ok', servicios: [mp(false), servicio({})] });
    mockCompletar.mockResolvedValue(false);
    const onTerminar = vi.fn();
    render(<Onboarding onTerminar={onTerminar} />);
    fireEvent.click(await screen.findByTestId('onboarding-despues'));
    await waitFor(() => expect(onTerminar).toHaveBeenCalled());
  });

  it('sin catálogo (no desplegado) la promesa igual se ve y «Después» sigue disponible', async () => {
    mockCatalogo.mockResolvedValue({ status: 'no_disponible' });
    render(<Onboarding onTerminar={() => {}} />);
    expect(screen.getByTestId('onboarding-despues')).toBeInTheDocument();
  });

  it('un permiso ya conectado no se vuelve a pedir; el otro sí', async () => {
    mockCatalogo.mockResolvedValue({ status: 'ok', servicios: [mp(true), servicio({})] });
    render(<Onboarding onTerminar={() => {}} />);
    expect(await screen.findByTestId('onboarding-conectado-mercadopago')).toBeInTheDocument();
    expect(screen.queryByTestId('onboarding-conectar-mercadopago')).not.toBeInTheDocument();
    expect(screen.getByTestId('onboarding-conectar-google')).toBeInTheDocument();
  });

  it('conectar pide el link del servicio del catálogo (no uno nuevo)', async () => {
    mockCatalogo.mockResolvedValue({ status: 'ok', servicios: [mp(false), servicio({})] });
    mockLink.mockResolvedValue({ status: 'no_disponible' });
    render(<Onboarding onTerminar={() => {}} />);
    fireEvent.click(await screen.findByTestId('onboarding-conectar-google'));
    await waitFor(() => expect(mockLink).toHaveBeenCalledWith('/composio/connect?service=gmail'));
    expect(await screen.findByTestId('onboarding-error')).toHaveTextContent(/todavía no está disponible/);
  });

  it('con los dos permisos ya dados salta al recibo con la cifra real', async () => {
    mockCatalogo.mockResolvedValue({ status: 'ok', servicios: [mp(true), servicio({ conectado: true })] });
    mockPortada.mockResolvedValue(portada('147000.00', '63000.00'));
    render(<Onboarding onTerminar={() => {}} />);
    const texto = await screen.findByTestId('onboarding-insight');
    await waitFor(() => expect(texto).toHaveTextContent(/facturados sin cobrar/));
    expect(texto).toHaveTextContent(/147\.000/);
    expect(texto).toHaveTextContent(/63\.000.*vencidos/);
  });

  it('el recibo NO inventa una cifra cuando por cobrar viene vacío o en cero', async () => {
    mockCatalogo.mockResolvedValue({ status: 'ok', servicios: [mp(true), servicio({ conectado: true })] });
    mockPortada.mockResolvedValue(portada('0.00'));
    render(<Onboarding onTerminar={() => {}} />);
    await waitFor(() => expect(screen.getByTestId('onboarding-insight')).toHaveTextContent(/Todavía no tenés facturas pendientes/));
    expect(screen.getByTestId('onboarding-insight')).not.toHaveTextContent(/\$/);
  });

  it('el recibo con la portada caída dice lo mismo que sin datos', async () => {
    mockCatalogo.mockResolvedValue({ status: 'ok', servicios: [mp(true), servicio({ conectado: true })] });
    mockPortada.mockRejectedValue(new Error('red'));
    render(<Onboarding onTerminar={() => {}} />);
    await waitFor(() => expect(screen.getByTestId('onboarding-insight')).toHaveTextContent(/Todavía no tenés facturas pendientes/));
  });

  it('«Entrar» del recibo marca el onboarding y cierra el hilo', async () => {
    mockCatalogo.mockResolvedValue({ status: 'ok', servicios: [mp(true), servicio({ conectado: true })] });
    mockPortada.mockResolvedValue(portada('10.00'));
    const onTerminar = vi.fn();
    render(<Onboarding onTerminar={onTerminar} />);
    await waitFor(() => expect(screen.getByTestId('onboarding-entrar')).not.toBeDisabled());
    fireEvent.click(screen.getByTestId('onboarding-entrar'));
    await waitFor(() => expect(onTerminar).toHaveBeenCalled());
    expect(mockCompletar).toHaveBeenCalledTimes(1);
  });

  // BL-X8 resto (contrato fila 3) — «el onboarding es una conversación en el hilo, no una
  // pantalla»: la promesa se pinta con burbujas de asistente (`.chat-bubble--assistant`) y la
  // tarjeta de permisos con las clases HITL reales (`.hitl-card`), NO con el formulario viejo.
  it('la promesa se dibuja con burbujas de asistente y la tarjeta HITL real, no un formulario', async () => {
    mockCatalogo.mockResolvedValue({ status: 'ok', servicios: [mp(false), servicio({})] });
    const { container } = render(<Onboarding onTerminar={() => {}} />);
    await screen.findByTestId('onboarding-conectar-google');
    expect(container.querySelectorAll('.chat-bubble--assistant').length).toBeGreaterThanOrEqual(2);
    expect(container.querySelector('.hitl-card')).toBeInTheDocument();
    expect(screen.getByText('¿Conectamos tus servicios? Son dos minutos y te digo algo que no sabés.')).toBeInTheDocument();
  });

  it('la promesa cumplida trae la pregunta cerrada y el chip «Armame el detalle» sólo si hay dato real', async () => {
    mockCatalogo.mockResolvedValue({ status: 'ok', servicios: [mp(true), servicio({ conectado: true })] });
    mockPortada.mockResolvedValue(portada('147000.00'));
    render(<Onboarding onTerminar={() => {}} />);
    await waitFor(() => expect(screen.getByTestId('onboarding-insight')).toHaveTextContent(/facturados sin cobrar/));
    expect(screen.getByText('¿Querés que te arme el detalle?')).toBeInTheDocument();
    expect(screen.getByTestId('onboarding-chip-detalle')).toBeInTheDocument();
  });

  it('sin dato real (0/vacío) NO hay pregunta cerrada ni chip — no se inventa una', async () => {
    mockCatalogo.mockResolvedValue({ status: 'ok', servicios: [mp(true), servicio({ conectado: true })] });
    mockPortada.mockResolvedValue(portada('0.00'));
    render(<Onboarding onTerminar={() => {}} />);
    await waitFor(() => expect(screen.getByTestId('onboarding-insight')).toHaveTextContent(/Todavía no tenés facturas pendientes/));
    expect(screen.queryByTestId('onboarding-chip-detalle')).not.toBeInTheDocument();
  });

  it('el chip «Armame el detalle» entra al hilo real y marca el onboarding UNA sola vez (idempotente)', async () => {
    mockCatalogo.mockResolvedValue({ status: 'ok', servicios: [mp(true), servicio({ conectado: true })] });
    mockPortada.mockResolvedValue(portada('147000.00'));
    const onTerminar = vi.fn();
    render(<Onboarding onTerminar={onTerminar} />);
    fireEvent.click(await screen.findByText('Armame el detalle'));
    await waitFor(() => expect(onTerminar).toHaveBeenCalledTimes(1));
    expect(mockCompletar).toHaveBeenCalledTimes(1);
  });
});

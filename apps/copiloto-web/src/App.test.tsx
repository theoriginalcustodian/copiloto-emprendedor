import { fireEvent, render, screen } from '@testing-library/react';
import { useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * `App.tsx` es SOLO el router raíz (qué pantalla montar por `status` + el toggle local
 * login/signup) — el CONTENIDO de cada pantalla ya tiene su propio test file. Acá se mockea
 * `useSession` (controla `status`) y `ResponsiveShell` (stub que expone `initialTab` como
 * atributo, sin montar todo el shell real) para probar SOLO la lógica de ruteo.
 */

const mockUseSession = vi.fn();
vi.mock('./auth/useSession', async (importOriginal) => {
  // `SessionProvider` (montado real por `App`) también importa `SessionContext` de este mismo
  // módulo para construir el Provider -- mockear sólo `useSession` sin preservarlo rompe el árbol
  // real con "No SessionContext export is defined".
  const actual = await importOriginal<typeof import('./auth/useSession')>();
  return { ...actual, useSession: () => mockUseSession() };
});

vi.mock('./shell/ResponsiveShell', () => ({
  ResponsiveShell: ({ initialTab }: { initialTab?: string }) => (
    <div data-testid="responsive-shell-stub" data-initial-tab={initialTab ?? ''} />
  ),
}));

vi.mock('./modules/onboarding', () => ({
  Onboarding: ({ onTerminar }: { onTerminar: () => void }) => (
    <button type="button" data-testid="onboarding-stub" onClick={onTerminar} />
  ),
}));

// BL-X10: `Splash`/`EntradaDiaria` corren por tiempo real (6,8 s / 1,5 s) -- acá se stubean
// auto-disparando `onFin` en un `useEffect` (sin timers) para que `render()`/`rerender()` de RTL,
// que flushea los efectos, deje la MISMA aserción de siempre disponible sin tocar cada test de
// `authed`. `identidadCalls` registra CUÁL de los dos montó (el testid solo no alcanza: el efecto
// ya disparó `onFin` y desmontó el stub para cuando `render()` vuelve).
const identidadCalls: string[] = [];
vi.mock('./modules/splash', () => ({
  Splash: ({ onFin }: { onFin: () => void }) => {
    identidadCalls.push('splash');
    useEffect(onFin, [onFin]);
    return <div data-testid="splash-stub" />;
  },
  EntradaDiaria: ({ onFin }: { onFin: () => void }) => {
    identidadCalls.push('entrada');
    useEffect(onFin, [onFin]);
    return <div data-testid="entrada-stub" />;
  },
}));

vi.mock('./lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./lib/api')>();
  return {
    ...actual,
    api: { ...actual.api, login: vi.fn(), signup: vi.fn(), me: vi.fn() },
  };
});

import '../src/design-system/themes.css';
import { App } from './App';
import { api } from './lib/api';

function setUrl(search: string) {
  window.history.pushState({}, '', `/${search}`);
}

describe('App (router raíz)', () => {
  beforeEach(() => {
    mockUseSession.mockReturnValue({ status: 'anon', login: vi.fn(), logout: vi.fn() });
    setUrl('');
    identidadCalls.length = 0;
  });

  afterEach(() => {
    setUrl('');
  });

  it('anon sin ?signup=1 -> LoginScreen', () => {
    render(<App />);
    expect(screen.getByTestId('login-screen')).toBeInTheDocument();
    expect(screen.queryByTestId('signup-screen')).not.toBeInTheDocument();
  });

  it('anon con ?signup=1 -> SignupScreen (BETA-4b, reachable sólo por ruta directa)', () => {
    setUrl('?signup=1');
    render(<App />);
    expect(screen.getByTestId('signup-screen')).toBeInTheDocument();
    expect(screen.queryByTestId('login-screen')).not.toBeInTheDocument();
  });

  it('desde SignupScreen, "Iniciá sesión." vuelve a LoginScreen sin recargar', () => {
    setUrl('?signup=1');
    render(<App />);
    expect(screen.getByTestId('signup-screen')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Iniciá sesión.' }));

    expect(screen.getByTestId('login-screen')).toBeInTheDocument();
    expect(screen.queryByTestId('signup-screen')).not.toBeInTheDocument();
  });

  it('authed -> ResponsiveShell con initialTab vacío (no vino de un signup)', () => {
    mockUseSession.mockReturnValue({ status: 'authed', login: vi.fn(), logout: vi.fn() });
    render(<App />);
    expect(screen.getByTestId('responsive-shell-stub')).toHaveAttribute('data-initial-tab', '');
  });

  it('BETA-4b: `recienFirmado` sobrevive la transición anon->authed y llega como initialTab', async () => {
    // `recienFirmado` vive en `AppRouter` (dentro de `App`) — la única forma de probar que
    // sobrevive la transición de `status` es la MISMA instancia de componente cambiando de props
    // (rerender), no un render nuevo: un render nuevo perdería el estado igual que un remount real.
    vi.mocked(api.signup).mockResolvedValueOnce({
      cliente_id: 'c-nuevo',
      auth_user_id: 'u-nuevo',
      email: 'nueva@a.com',
    });
    const loginMock = vi.fn().mockResolvedValue({ ok: true });
    mockUseSession.mockReturnValue({ status: 'anon', login: loginMock, logout: vi.fn() });
    setUrl('?signup=1');

    const { rerender } = render(<App />);
    expect(screen.getByTestId('signup-screen')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'nueva@a.com' } });
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'unaClaveLarga1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));

    await vi.waitFor(() => expect(loginMock).toHaveBeenCalledWith('nueva@a.com', 'unaClaveLarga1'));

    // El backend (vía SessionProvider real) ya habría pasado `status` a 'authed' acá — se simula
    // reconfigurando el mock y re-renderizando la MISMA instancia.
    mockUseSession.mockReturnValue({ status: 'authed', login: loginMock, logout: vi.fn() });
    rerender(<App />);

    expect(screen.getByTestId('responsive-shell-stub')).toHaveAttribute(
      'data-initial-tab',
      'connections',
    );
  });

  it('checking -> splash, ni Login ni Shell', () => {
    mockUseSession.mockReturnValue({ status: 'checking', login: vi.fn(), logout: vi.fn() });
    render(<App />);
    expect(screen.getByTestId('app-shell-splash')).toBeInTheDocument();
    expect(screen.queryByTestId('login-screen')).not.toBeInTheDocument();
    expect(screen.queryByTestId('responsive-shell-stub')).not.toBeInTheDocument();
  });

  // BL-X10: `origenSesion` decide CUÁL identidad se muestra antes del shell.
  it('checking con origenSesion restaurada (default) -> EntradaDiaria, no Splash', () => {
    mockUseSession.mockReturnValue({
      status: 'checking',
      origenSesion: 'restaurada',
      login: vi.fn(),
      logout: vi.fn(),
    });
    render(<App />);
    expect(identidadCalls).toEqual(['entrada']);
  });

  it('authed con origenSesion recien-autenticada -> Splash, no EntradaDiaria, y llega al shell', () => {
    mockUseSession.mockReturnValue({
      status: 'authed',
      me: { cliente_id: 't', onboarding_completado: true },
      origenSesion: 'recien-autenticada',
      login: vi.fn(),
      logout: vi.fn(),
    });
    render(<App />);
    expect(identidadCalls).toEqual(['splash']);
    expect(screen.getByTestId('responsive-shell-stub')).toBeInTheDocument();
  });

  // K-14 / BL-X8: el hilo de bienvenida sólo con `onboarding_completado: false` EXPLÍCITO.
  it('authed con onboarding_completado=false -> Onboarding; al terminar entra al shell', () => {
    mockUseSession.mockReturnValue({ status: 'authed', me: { cliente_id: 't', onboarding_completado: false }, login: vi.fn(), logout: vi.fn() });
    render(<App />);
    expect(screen.queryByTestId('responsive-shell-stub')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('onboarding-stub'));
    expect(screen.getByTestId('responsive-shell-stub')).toBeInTheDocument();
  });

  it('authed con onboarding_completado=true o ausente (backend anterior) -> directo al shell', () => {
    mockUseSession.mockReturnValue({ status: 'authed', me: { cliente_id: 't', onboarding_completado: true }, login: vi.fn(), logout: vi.fn() });
    const { unmount } = render(<App />);
    expect(screen.getByTestId('responsive-shell-stub')).toBeInTheDocument();
    unmount();
    mockUseSession.mockReturnValue({ status: 'authed', me: { cliente_id: 't' }, login: vi.fn(), logout: vi.fn() });
    render(<App />);
    expect(screen.queryByTestId('onboarding-stub')).not.toBeInTheDocument();
    expect(screen.getByTestId('responsive-shell-stub')).toBeInTheDocument();
  });
});

import { fireEvent, render, screen } from '@testing-library/react';
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
});

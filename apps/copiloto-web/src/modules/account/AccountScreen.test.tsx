import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/api')>();
  return {
    ...actual,
    api: {
      login: vi.fn(),
      me: vi.fn(),
      catalog: vi.fn(),
      connect: vi.fn(),
      sendChat: vi.fn(),
      getReply: vi.fn(),
    },
  };
});

import '../../design-system/themes.css';
import { api } from '../../lib/api';
import { getToken, setToken } from '../../auth/session';
import { SessionProvider } from '../../auth/SessionProvider';
import { ThemeProvider, THEMES } from '../../design-system/ThemeProvider';
import { AccountScreen } from './AccountScreen';

/**
 * Integración real (providers reales, solo `lib/api` mockeado — mismo criterio que
 * ConnectionsScreen.test.tsx/useSession.test.ts): ejercita `useTheme`/`useSession` de verdad en
 * vez de mockear los hooks, así el test cubre el cableado real, no una promesa de que existe.
 */
function renderAccountScreen() {
  return render(
    <ThemeProvider>
      <SessionProvider>
        <AccountScreen />
      </SessionProvider>
    </ThemeProvider>,
  );
}

describe('AccountScreen', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.mocked(api.me).mockReset();
  });

  it('muestra "Tu cuenta" cuando todavía no hay /me resuelto (sin token)', () => {
    renderAccountScreen();
    expect(screen.getByTestId('account-screen')).toBeInTheDocument();
    expect(screen.getByText('Tu cuenta')).toBeInTheDocument();
  });

  it('con sesión resuelta muestra un identificador derivado de cliente_id', async () => {
    setToken('tok-valido');
    vi.mocked(api.me).mockResolvedValueOnce({
      cliente_id: 'cliente-123',
      mp_connected: false,
      composio_connected: [],
    });

    renderAccountScreen();

    await waitFor(() => expect(screen.getByText(/Cuenta #/)).toBeInTheDocument());
    expect(screen.getByText('Cuenta #cliente-')).toBeInTheDocument();
  });

  it('el selector de tema cambia el theme activo y persiste en localStorage', () => {
    renderAccountScreen();

    fireEvent.click(screen.getByTestId('theme-pill-daylight'));

    expect(document.documentElement.getAttribute('data-theme')).toBe('daylight');
    expect(window.localStorage.getItem('copiloto-theme')).toBe('daylight');
    expect(screen.getByTestId('theme-pill-daylight')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('theme-pill-ai')).toHaveAttribute('aria-pressed', 'false');
  });

  it('renderiza los 4 nombres de tema es-AR', () => {
    renderAccountScreen();
    expect(screen.getByText('Aurora')).toBeInTheDocument();
    expect(screen.getByText('Amanecer')).toBeInTheDocument();
    expect(screen.getByText('Refinado')).toBeInTheDocument();
    expect(screen.getByText('IA')).toBeInTheDocument();
  });

  it('la card de durabilidad muestra el copy de continuidad', () => {
    renderAccountScreen();
    expect(screen.getByTestId('account-durability-card')).toBeInTheDocument();
    expect(screen.getByText('Tu copiloto sigue activo')).toBeInTheDocument();
  });

  it('muestra las filas "Plan" e "Idioma" (fiel al diseño, valores estáticos hasta que /me los exponga)', () => {
    renderAccountScreen();
    expect(screen.getByText('Plan')).toBeInTheDocument();
    expect(screen.getByText('Profesional')).toBeInTheDocument();
    expect(screen.getByText('Idioma')).toBeInTheDocument();
    expect(screen.getByText('Español (AR)')).toBeInTheDocument();
  });

  it('"Privacidad del historial" es una fila simple (sin hint "Próximamente") y no hay fila de recuperar contraseña', () => {
    renderAccountScreen();
    expect(screen.getByText('Privacidad del historial')).toBeInTheDocument();
    expect(screen.queryByText('Próximamente')).not.toBeInTheDocument();
    expect(screen.queryByText('¿Olvidaste tu contraseña?')).not.toBeInTheDocument();
  });

  it('el toggle de notificaciones cambia de estado (visual, sin backend)', () => {
    renderAccountScreen();
    const toggle = screen.getByRole('switch', { name: 'Notificaciones' });
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-checked', 'false');
  });

  it('Cerrar sesión llama a useSession().logout y limpia el token', async () => {
    setToken('tok-valido');
    vi.mocked(api.me).mockResolvedValueOnce({
      cliente_id: 'cliente-123',
      mp_connected: false,
      composio_connected: [],
    });

    renderAccountScreen();
    await waitFor(() => expect(screen.getByText(/Cuenta #/)).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));

    expect(getToken()).toBeNull();
    await waitFor(() => expect(screen.getByText('Tu cuenta')).toBeInTheDocument());
  });

  it.each(THEMES)('renderiza sin romper bajo el tema "%s"', (theme) => {
    document.documentElement.setAttribute('data-theme', theme);
    renderAccountScreen();
    expect(screen.getByTestId('account-screen')).toBeInTheDocument();
  });
});

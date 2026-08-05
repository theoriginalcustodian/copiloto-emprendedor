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

  it('con sesión resuelta pero sin email en el claim, dice explícitamente que no hay email asociado', async () => {
    setToken('tok-valido');
    vi.mocked(api.me).mockResolvedValueOnce({
      cliente_id: 'cliente-123',
      mp_connected: false,
      composio_connected: [],
    });

    renderAccountScreen();

    await waitFor(() =>
      expect(screen.getByText('Tu cuenta no tiene un email asociado.')).toBeInTheDocument(),
    );
  });

  it('con email real en /me, lo muestra tal cual (no un identificador derivado)', async () => {
    setToken('tok-valido');
    vi.mocked(api.me).mockResolvedValueOnce({
      cliente_id: 'cliente-123',
      email: 'emprendedor@ejemplo.com',
      mp_connected: false,
      composio_connected: [],
    });

    renderAccountScreen();

    await waitFor(() =>
      expect(screen.getByText('emprendedor@ejemplo.com')).toBeInTheDocument(),
    );
  });

  it('el selector de tema cambia el theme activo y persiste en localStorage', () => {
    renderAccountScreen();

    fireEvent.click(screen.getByTestId('theme-pill-oscuro'));

    expect(document.documentElement.getAttribute('data-theme')).toBe('oscuro');
    expect(window.localStorage.getItem('copiloto-theme')).toBe('oscuro');
    expect(screen.getByTestId('theme-pill-oscuro')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('theme-pill-claro')).toHaveAttribute('aria-pressed', 'false');
  });

  it('renderiza los 3 nombres de piel ODOBI', () => {
    renderAccountScreen();
    expect(screen.getByText('Claro')).toBeInTheDocument();
    expect(screen.getByText('Oscuro')).toBeInTheDocument();
    expect(screen.getByText('Nocturno')).toBeInTheDocument();
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

  it('la fila "No molestar" está presente, inerte (sin onClick)', () => {
    renderAccountScreen();
    const fila = screen.getByTestId('account-no-molestar');
    expect(fila).toBeInTheDocument();
    expect(screen.getByText('No molestar')).toBeInTheDocument();
    expect(fila.tagName).not.toBe('BUTTON');
  });

  it('Cerrar sesión pide confirmación antes de cerrar la sesión', async () => {
    setToken('tok-valido');
    vi.mocked(api.me).mockResolvedValueOnce({
      cliente_id: 'cliente-123',
      email: 'emprendedor@ejemplo.com',
      mp_connected: false,
      composio_connected: [],
    });

    renderAccountScreen();
    await waitFor(() => expect(screen.getByText('emprendedor@ejemplo.com')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('account-cerrar-sesion'));

    expect(screen.getByTestId('account-confirmar-salida')).toBeInTheDocument();
    expect(getToken()).not.toBeNull();
  });

  it('"No" en la confirmación cancela sin cerrar sesión', async () => {
    setToken('tok-valido');
    vi.mocked(api.me).mockResolvedValueOnce({
      cliente_id: 'cliente-123',
      mp_connected: false,
      composio_connected: [],
    });

    renderAccountScreen();
    await waitFor(() => screen.getByTestId('account-cerrar-sesion'));
    fireEvent.click(screen.getByTestId('account-cerrar-sesion'));
    fireEvent.click(screen.getByTestId('account-cerrar-sesion-no'));

    expect(screen.queryByTestId('account-confirmar-salida')).not.toBeInTheDocument();
    expect(getToken()).not.toBeNull();
  });

  it('"Sí, cerrar sesión" llama a useSession().logout y limpia el token', async () => {
    setToken('tok-valido');
    vi.mocked(api.me).mockResolvedValueOnce({
      cliente_id: 'cliente-123',
      mp_connected: false,
      composio_connected: [],
    });

    renderAccountScreen();
    await waitFor(() => screen.getByTestId('account-cerrar-sesion'));
    fireEvent.click(screen.getByTestId('account-cerrar-sesion'));
    fireEvent.click(screen.getByTestId('account-cerrar-sesion-si'));

    expect(getToken()).toBeNull();
    await waitFor(() => expect(screen.getByText('Tu cuenta')).toBeInTheDocument());
  });

  it.each(THEMES)('renderiza sin romper bajo el tema "%s"', (theme) => {
    document.documentElement.setAttribute('data-theme', theme);
    renderAccountScreen();
    expect(screen.getByTestId('account-screen')).toBeInTheDocument();
  });
});

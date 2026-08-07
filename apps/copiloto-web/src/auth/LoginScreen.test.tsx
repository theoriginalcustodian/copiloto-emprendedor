import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/api')>();
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

import '../design-system/themes.css';
import { api, ForbiddenError, UnauthorizedError } from '../lib/api';
import { THEMES } from '../design-system/ThemeProvider';
import { SessionProvider } from './SessionProvider';
import { LoginScreen } from './LoginScreen';

function renderLoginScreen() {
  return render(
    <SessionProvider>
      <LoginScreen />
    </SessionProvider>,
  );
}

async function fillAndSubmit(email: string, password: string) {
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: email } });
  fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: password } });
  fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));
}

describe('LoginScreen', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.mocked(api.login).mockReset();
    vi.mocked(api.me).mockReset();
  });

  it('renderiza el form in-theme con marca y campos', async () => {
    renderLoginScreen();
    await waitFor(() => expect(screen.getByTestId('login-screen')).toBeInTheDocument());
    expect(screen.getByText('Odobi')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Contraseña')).toBeInTheDocument();
  });

  it('login exitoso no muestra error (useSession pasa a authed)', async () => {
    vi.mocked(api.login).mockResolvedValueOnce({
      access_token: 'tok',
      token_type: 'bearer',
      expires_in: 3600,
      refresh_token: 'r',
      user: {},
    });
    vi.mocked(api.me).mockResolvedValueOnce({
      cliente_id: 'c1',
      mp_connected: false,
      composio_connected: [],
      es_admin: false,
    });

    renderLoginScreen();
    await waitFor(() => expect(screen.getByTestId('login-screen')).toBeInTheDocument());

    await fillAndSubmit('a@a.com', 'secreta');

    await waitFor(() => expect(api.login).toHaveBeenCalledWith('a@a.com', 'secreta'));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('401 -> muestra error de credenciales', async () => {
    vi.mocked(api.login).mockRejectedValueOnce(new UnauthorizedError('bad creds'));

    renderLoginScreen();
    await waitFor(() => expect(screen.getByTestId('login-screen')).toBeInTheDocument());

    await fillAndSubmit('a@a.com', 'mala');

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Email o contraseña incorrectos'),
    );
  });

  it('403 -> muestra aviso de cuenta no habilitada', async () => {
    vi.mocked(api.login).mockResolvedValueOnce({
      access_token: 'tok',
      token_type: 'bearer',
      expires_in: 3600,
      refresh_token: 'r',
      user: {},
    });
    vi.mocked(api.me).mockRejectedValueOnce(new ForbiddenError('sin tenant'));

    renderLoginScreen();
    await waitFor(() => expect(screen.getByTestId('login-screen')).toBeInTheDocument());

    await fillAndSubmit('a@a.com', 'secreta');

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('todavía no está habilitada'),
    );
  });

  it('error de red -> muestra aviso genérico', async () => {
    vi.mocked(api.login).mockRejectedValueOnce(new Error('network down'));

    renderLoginScreen();
    await waitFor(() => expect(screen.getByTestId('login-screen')).toBeInTheDocument());

    await fillAndSubmit('a@a.com', 'secreta');

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('No pudimos conectarnos'));
  });

  it('muestra la derivación admin-mediada (sin flujo de reset por email)', async () => {
    renderLoginScreen();
    await waitFor(() => expect(screen.getByTestId('login-screen')).toBeInTheDocument());
    expect(screen.getByText(/¿Olvidaste tu contraseña\?/)).toBeInTheDocument();
    expect(screen.getByText(/¿No tenés cuenta\?/)).toBeInTheDocument();
  });

  it.each(THEMES)('renderiza sin romper bajo el tema "%s"', async (theme) => {
    document.documentElement.setAttribute('data-theme', theme);
    renderLoginScreen();
    await waitFor(() => expect(screen.getByTestId('login-screen')).toBeInTheDocument());
  });
});

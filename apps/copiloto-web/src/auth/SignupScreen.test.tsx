import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/api')>();
  return {
    ...actual,
    api: {
      login: vi.fn(),
      signup: vi.fn(),
      me: vi.fn(),
      catalog: vi.fn(),
      connect: vi.fn(),
      sendChat: vi.fn(),
      getReply: vi.fn(),
    },
  };
});

import '../design-system/themes.css';
import { api } from '../lib/api';
import { THEMES } from '../design-system/ThemeProvider';
import { SessionProvider } from './SessionProvider';
import { SignupScreen } from './SignupScreen';

function renderSignupScreen(overrides?: {
  onVolverALogin?: () => void;
  onSignupExitoso?: () => void;
}) {
  const onVolverALogin = overrides?.onVolverALogin ?? vi.fn();
  const onSignupExitoso = overrides?.onSignupExitoso ?? vi.fn();
  const utils = render(
    <SessionProvider>
      <SignupScreen onVolverALogin={onVolverALogin} onSignupExitoso={onSignupExitoso} />
    </SessionProvider>,
  );
  return { ...utils, onVolverALogin, onSignupExitoso };
}

async function fillAndSubmit(email: string, password: string) {
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: email } });
  fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: password } });
  fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));
}

describe('SignupScreen', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.mocked(api.signup).mockReset();
    vi.mocked(api.login).mockReset();
    vi.mocked(api.me).mockReset();
  });

  it('renderiza el form con marca y campos', async () => {
    renderSignupScreen();
    await waitFor(() => expect(screen.getByTestId('signup-screen')).toBeInTheDocument());
    expect(screen.getByText('Copiloto del Emprendedor')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Contraseña')).toBeInTheDocument();
  });

  it('signup + login exitosos -> llama onSignupExitoso, sin error visible', async () => {
    vi.mocked(api.signup).mockResolvedValueOnce({
      cliente_id: 'c-nuevo',
      auth_user_id: 'u-nuevo',
      email: 'nueva@a.com',
    });
    vi.mocked(api.login).mockResolvedValueOnce({
      access_token: 'tok',
      token_type: 'bearer',
      expires_in: 3600,
      refresh_token: 'r',
      user: {},
    });
    vi.mocked(api.me).mockResolvedValueOnce({
      cliente_id: 'c-nuevo',
      mp_connected: false,
      composio_connected: [],
    });

    const { onSignupExitoso } = renderSignupScreen();
    await waitFor(() => expect(screen.getByTestId('signup-screen')).toBeInTheDocument());

    await fillAndSubmit('nueva@a.com', 'unaClaveLarga1');

    await waitFor(() => expect(api.signup).toHaveBeenCalledWith('nueva@a.com', 'unaClaveLarga1'));
    await waitFor(() => expect(api.login).toHaveBeenCalledWith('nueva@a.com', 'unaClaveLarga1'));
    await waitFor(() => expect(onSignupExitoso).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('signup OK pero login falla (email ya existía con otra password) -> aviso específico', async () => {
    vi.mocked(api.signup).mockResolvedValueOnce({
      cliente_id: 'c-viejo',
      auth_user_id: 'u-viejo',
      email: 'ya@existe.com',
    });
    vi.mocked(api.login).mockRejectedValueOnce(new Error('401'));

    const { onSignupExitoso } = renderSignupScreen();
    await waitFor(() => expect(screen.getByTestId('signup-screen')).toBeInTheDocument());

    await fillAndSubmit('ya@existe.com', 'claveEquivocada1');

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Ya existe una cuenta con ese email'),
    );
    expect(onSignupExitoso).not.toHaveBeenCalled();
  });

  it('signup falla (red/servidor) -> aviso genérico, no llama a login', async () => {
    vi.mocked(api.signup).mockRejectedValueOnce(new Error('network down'));

    renderSignupScreen();
    await waitFor(() => expect(screen.getByTestId('signup-screen')).toBeInTheDocument());

    await fillAndSubmit('nueva@a.com', 'unaClaveLarga1');

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('No pudimos crear tu cuenta'),
    );
    expect(api.login).not.toHaveBeenCalled();
  });

  it('"Iniciá sesión" llama onVolverALogin', async () => {
    const { onVolverALogin } = renderSignupScreen();
    await waitFor(() => expect(screen.getByTestId('signup-screen')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Iniciá sesión.' }));
    expect(onVolverALogin).toHaveBeenCalledTimes(1);
  });

  it('BETA-2.a: "Términos y Condiciones" abre LegalScreen(tos) y "Volver" restaura el form', async () => {
    renderSignupScreen();
    await waitFor(() => expect(screen.getByTestId('signup-screen')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'nueva@a.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Términos y Condiciones' }));

    expect(screen.getByTestId('legal-screen-tos')).toBeInTheDocument();
    expect(screen.queryByTestId('signup-screen')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Volver' }));

    // El form vuelve con lo que ya se había tipeado -- mismo componente, mismo useState.
    expect(screen.getByTestId('signup-screen')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveValue('nueva@a.com');
  });

  it('BETA-2.a: "Política de Privacidad" abre LegalScreen(privacidad)', async () => {
    renderSignupScreen();
    await waitFor(() => expect(screen.getByTestId('signup-screen')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Política de Privacidad' }));
    expect(screen.getByTestId('legal-screen-privacidad')).toBeInTheDocument();
  });

  it.each(THEMES)('renderiza sin romper bajo el tema "%s"', async (theme) => {
    document.documentElement.setAttribute('data-theme', theme);
    renderSignupScreen();
    await waitFor(() => expect(screen.getByTestId('signup-screen')).toBeInTheDocument());
  });
});

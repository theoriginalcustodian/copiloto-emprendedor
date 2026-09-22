import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EntradaSesion } from './EntradaSesion';
import { SessionContext, type UseSessionResult } from './useSession';

function sesion(over: Partial<UseSessionResult> = {}): UseSessionResult {
  return {
    status: 'anon',
    origenSesion: 'restaurada',
    login: vi.fn(),
    logout: vi.fn(),
    ...over,
  };
}

function montar(valor: UseSessionResult) {
  return render(
    <SessionContext.Provider value={valor}>
      <EntradaSesion />
    </SessionContext.Provider>,
  );
}

describe('EntradaSesion (BL-X12w)', () => {
  beforeEach(() => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: true, // reducido -> reveal en estado final, sin depender de timers
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })) as unknown as typeof window.matchMedia;
  });

  it('tras un logout a propósito aterriza en el reveal con "Entrar" y "Entrar con otra cuenta"', () => {
    montar(sesion({ cierreVoluntario: { email: 'ana@x.com' } }));
    expect(screen.getByTestId('identidad-entrada')).toBeInTheDocument();
    expect(screen.getByText('Entrar')).toBeInTheDocument();
    expect(screen.getByText('Entrar con otra cuenta')).toBeInTheDocument();
    expect(screen.queryByTestId('login-screen')).not.toBeInTheDocument();
  });

  it('"Entrar" va al formulario con el mail de la cuenta que salió precargado', () => {
    montar(sesion({ cierreVoluntario: { email: 'ana@x.com' } }));
    fireEvent.click(screen.getByText('Entrar'));
    expect(screen.getByTestId('login-screen')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveValue('ana@x.com');
  });

  it('"Entrar con otra cuenta" va al formulario en blanco', () => {
    montar(sesion({ cierreVoluntario: { email: 'ana@x.com' } }));
    fireEvent.click(screen.getByText('Entrar con otra cuenta'));
    expect(screen.getByLabelText('Email')).toHaveValue('');
  });

  it('control negativo: primer arranque o sesión caída sola NO muestran el reveal (directo al formulario)', () => {
    montar(sesion());
    expect(screen.getByTestId('login-screen')).toBeInTheDocument();
    expect(screen.queryByTestId('identidad-entrada')).not.toBeInTheDocument();
  });
});

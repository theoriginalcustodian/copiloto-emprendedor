import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EntradaSesion } from './EntradaSesion';
import { SessionContext, type UseSessionResult } from './useSession';

function sesion(over: Partial<UseSessionResult> = {}): UseSessionResult {
  return {
    status: 'anon',
    origenSesion: 'restaurada',
    primeraVez: false,
    login: vi.fn(),
    logout: vi.fn(),
    ...over,
  };
}

function montar(valor: UseSessionResult, props: { onCrearCuenta?: () => void } = {}) {
  return render(
    <SessionContext.Provider value={valor}>
      <EntradaSesion {...props} />
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

  // SM-C2 (2026-10-15) — hasta hoy acá había un test que afirmaba que «Crear una nueva cuenta» NO
  // se dibujaba, con la razón «BETA-4b: sin alta pública». Esa razón venció el 2026-10-14
  // (`f3b60672`, PR #1206: se retiró el gate `invite_token` de `POST /auth/signup`), y mientras el
  // test siguiera verde la puerta no podía nacer sin «romper un test» — el síntoma de la premisa
  // vuelto inmortal (`memoria/un-test-que-afirma-el-sintoma-del-defecto-lo-vuelve-inmortal.md`).
  it('primer arranque (primeraVez) aterriza en el reveal con "Empecemos" y la puerta al alta', () => {
    montar(sesion({ primeraVez: true }), { onCrearCuenta: vi.fn() });
    expect(screen.getByTestId('identidad-entrada')).toBeInTheDocument();
    expect(screen.getByText('Empecemos')).toBeInTheDocument();
    expect(screen.getByText('Crear una nueva cuenta')).toBeInTheDocument();
    expect(screen.queryByTestId('login-screen')).not.toBeInTheDocument();
  });

  it('"Crear una nueva cuenta" va al ALTA, no al formulario de login', () => {
    const onCrearCuenta = vi.fn();
    montar(sesion({ primeraVez: true }), { onCrearCuenta });
    fireEvent.click(screen.getByText('Crear una nueva cuenta'));
    expect(onCrearCuenta).toHaveBeenCalledTimes(1);
    // Lo que distingue el fix del bug fácil: el slot del secundario es el MISMO en los dos
    // caminos del reveal, así que cablearlo mal manda «crear cuenta» al login en blanco y nadie
    // lo nota (el formulario aparece igual).
    expect(screen.queryByTestId('login-screen')).not.toBeInTheDocument();
  });

  it('control negativo: en primeraVez SIN camino al alta el secundario no se dibuja', () => {
    // Un botón que no lleva a ninguna parte es peor que su ausencia. Éste es el caso viejo, con
    // su razón corregida: no se dibuja por falta de destino, no por «no hay alta en la app».
    montar(sesion({ primeraVez: true }));
    expect(screen.getByText('Empecemos')).toBeInTheDocument();
    expect(screen.queryByText('Crear una nueva cuenta')).not.toBeInTheDocument();
  });

  it('el secundario de "volver" sigue siendo login en blanco y NO el alta', () => {
    // Control de que el fix no colapsó los dos significados del mismo slot.
    const onCrearCuenta = vi.fn();
    montar(sesion({ cierreVoluntario: { email: 'ana@x.com' } }), { onCrearCuenta });
    fireEvent.click(screen.getByText('Entrar con otra cuenta'));
    expect(onCrearCuenta).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Email')).toHaveValue('');
  });

  it('el formulario alcanzado desde el reveal también ofrece la puerta al alta', () => {
    montar(sesion({ cierreVoluntario: { email: 'ana@x.com' } }), { onCrearCuenta: vi.fn() });
    fireEvent.click(screen.getByText('Entrar'));
    expect(screen.getByTestId('login-ir-a-signup')).toBeInTheDocument();
  });

  it('"Empecemos" del primer arranque va al formulario en blanco', () => {
    montar(sesion({ primeraVez: true }));
    fireEvent.click(screen.getByText('Empecemos'));
    expect(screen.getByTestId('login-screen')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveValue('');
  });

  it('control negativo: sesión caída sola (CTA5, ni primeraVez ni cierreVoluntario) va directo al formulario', () => {
    montar(sesion());
    expect(screen.getByTestId('login-screen')).toBeInTheDocument();
    expect(screen.queryByTestId('identidad-entrada')).not.toBeInTheDocument();
  });

  it('la sesión caída sola — el camino MÁS frecuente — también llega al alta', () => {
    // El reveal es el caso excepcional: sin ninguno de los dos flags se va derecho al formulario,
    // que es por donde entra casi todo el mundo. Si la puerta viviera sólo en el reveal, el
    // 100% de este camino seguiría necesitando `?signup=1`.
    montar(sesion(), { onCrearCuenta: vi.fn() });
    expect(screen.getByTestId('login-ir-a-signup')).toBeInTheDocument();
  });
});

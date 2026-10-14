import { render, screen, waitFor, act } from '@testing-library/react';
import { useEffect, useLayoutEffect } from 'react';
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

import { api } from '../lib/api';
import { setToken } from './session';
import { SessionProvider } from './SessionProvider';
import { useSession } from './useSession';
import { LEGAL_VERSION } from '@copiloto/core';

/**
 * BL-X12w — `cierreVoluntario`, gemelo del de mobile (`modules/auth/SessionProvider.tsx`).
 * Integración real (`SessionProvider` real, sólo `lib/api` mockeado), mismo criterio que
 * `AccountScreen.test.tsx`/`useSession.test.ts`.
 */
function Sonda() {
  const { status, me, cierreVoluntario, logout } = useSession();
  return (
    <div>
      <span data-testid="sonda-status">{status}</span>
      {/* BL-X12w (X12WESPERA): expone `me.email` para que el test pueda esperar el sujeto que
          realmente lee en :69 (`cierreVoluntario`, derivado de `me` vía ref) — no un proxy (`status`)
          que puede committear un render antes. */}
      <span data-testid="sonda-email">{me?.email ?? ''}</span>
      <span data-testid="sonda-cierre">{cierreVoluntario ? cierreVoluntario.email : 'null'}</span>
      <button type="button" data-testid="sonda-logout" onClick={logout}>
        salir
      </button>
    </div>
  );
}

describe('SessionProvider — cierreVoluntario (BL-X12w)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.mocked(api.me).mockReset();
  });

  it('logout con sesión válida deja cierreVoluntario con el mail de la cuenta que salió', async () => {
    setToken('tok-valido');
    vi.mocked(api.me).mockResolvedValueOnce({
      cliente_id: 'c1',
      email: 'ana@x.com',
      mp_connected: false,
      composio_connected: [],
      es_admin: false,
      legal_aceptado: true, legal_version_aceptada: LEGAL_VERSION,
    });
    render(
      <SessionProvider>
        <Sonda />
      </SessionProvider>,
    );
    // X12WESPERA: esperar `status` solo no alcanza — `:69` lee `cierreVoluntario`, derivado de `me`
    // vía ref durante el render. Si `me` y `status` no commitean en el mismo render, el click llega
    // un render antes de tiempo y el logout guarda `{ email: null }`. Se espera el sujeto que se lee.
    await waitFor(() => {
      expect(screen.getByTestId('sonda-status')).toHaveTextContent('authed');
      expect(screen.getByTestId('sonda-email')).toHaveTextContent('ana@x.com');
    });

    act(() => screen.getByTestId('sonda-logout').click());

    expect(screen.getByTestId('sonda-status')).toHaveTextContent('anon');
    expect(screen.getByTestId('sonda-cierre')).toHaveTextContent('ana@x.com');
  });

  // Reproductor DETERMINISTA del flaky de #1149 (run 38553332206, `Received: null` en :79). El
  // mecanismo NO es que el click lea la ref vacía (`emailRef` se asigna en el render, antes de que el
  // click sea posible): es que el passive effect de `[status]` que corría `setCierreVoluntario(undefined)`
  // queda PENDIENTE tras el commit de `authed`, y si el logout cae en esa ventana React lo vacía antes de
  // procesar el click → su update queda DESPUÉS del `{ email }` del logout y lo pisa. En producción: un
  // logout dentro de la ventana entre el commit de `authed` y su passive effect perdía el cierre.
  //
  // Sin azar ni temporizadores: el click se dispara desde un LAYOUT effect, que React corre dentro del
  // commit de `authed` y SIEMPRE antes que cualquier passive effect de ese mismo commit. Es la ventana,
  // abierta por construcción. (El primer intento la abría con un render lento + MutationObserver y
  // dependía del scheduler: abría en la corrida aislada y se cerraba dentro del archivo completo.)
  it('logout dentro de la ventana commit(authed) → passive effect NO pierde el cierre voluntario', async () => {
    const pasivosAuthedAlClick: boolean[] = [];
    const pasivos: string[] = [];
    let clicks = 0;
    function SondaEnVentana() {
      const { status, me, cierreVoluntario, logout } = useSession();
      useEffect(() => {
        pasivos.push(status);
      }, [status]);
      useLayoutEffect(() => {
        if (status !== 'authed' || clicks > 0) return;
        clicks += 1;
        pasivosAuthedAlClick.push(pasivos.includes('authed'));
        screen.getByTestId('sonda-logout').click();
      }, [status]);
      return (
        <div>
          <span data-testid="sonda-status">{status}</span>
          <span data-testid="sonda-email">{me?.email ?? ''}</span>
          <span data-testid="sonda-cierre">{cierreVoluntario ? cierreVoluntario.email : 'null'}</span>
          <button type="button" data-testid="sonda-logout" onClick={logout}>
            salir
          </button>
        </div>
      );
    }

    setToken('tok-valido');
    vi.mocked(api.me).mockResolvedValueOnce({
      cliente_id: 'c1',
      email: 'ana@x.com',
      mp_connected: false,
      composio_connected: [],
      es_admin: false,
      legal_aceptado: true,
      legal_version_aceptada: LEGAL_VERSION,
    });
    render(
      <SessionProvider>
        <SondaEnVentana />
      </SessionProvider>,
    );
    await waitFor(() => expect(clicks).toBe(1));

    // Control de ceguera: el click cayó en la ventana (el passive effect de `authed` aún no había
    // corrido). Si no, el test pasaría por ausencia de la condición que dice probar.
    expect(pasivosAuthedAlClick).toEqual([false]);
    expect(screen.getByTestId('sonda-status')).toHaveTextContent('anon');
    // `toHaveTextContent('ana@x.com')` falla si el sujeto está vacío o es la cadena 'null'.
    expect(screen.getByTestId('sonda-cierre')).toHaveTextContent('ana@x.com');
  });

  it('control negativo: arranque limpio (sin token) nunca tiene cierreVoluntario', async () => {
    render(
      <SessionProvider>
        <Sonda />
      </SessionProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('sonda-status')).toHaveTextContent('anon'));
    expect(screen.getByTestId('sonda-cierre')).toHaveTextContent('null');
  });
});

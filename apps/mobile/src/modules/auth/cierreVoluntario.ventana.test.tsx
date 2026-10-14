import { render, waitFor } from '@testing-library/react-native';
import { useEffect, useLayoutEffect } from 'react';
import { Text } from 'react-native';

// Jest (jest-expo) — describe/it/expect/jest son globales, no se importan de vitest.

/**
 * CIERREVOLGEMELO — gemelo mobile del flaky de #1149 / fix web #1152. Reproductor DETERMINISTA.
 *
 * Mecanismo (medido en web, aplicado acá): el `useEffect` pasivo de `[estado]` que corría
 * `setCierreVoluntario(undefined)` queda PENDIENTE tras el commit de `autenticado`. Un `logout` que
 * cae en esa ventana hace `setCierreVoluntario({ email })` y React, antes de procesar ese update,
 * vacía el effect pendiente: su `undefined` queda DESPUÉS del `{ email }` y lo pisa. El usuario que
 * salió a propósito veía «se te cayó la sesión» en vez de «volvé a entrar».
 *
 * Sin azar ni temporizadores: el logout se dispara desde un LAYOUT effect, que React corre dentro
 * del commit de `autenticado` y SIEMPRE antes que cualquier passive effect de ese commit. La
 * ventana queda abierta por construcción. Control de ceguera: se asienta si el passive effect de
 * `autenticado` ya había corrido en el momento del logout (tiene que ser `false`).
 */
jest.mock('@copiloto/core', () => {
  const actual = jest.requireActual('@copiloto/core');
  return {
    ...actual,
    apiReal: { ...actual.apiReal, login: jest.fn(), me: jest.fn() },
  };
});

jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: { configure: jest.fn(), hasPlayServices: jest.fn().mockResolvedValue(true), signIn: jest.fn() },
  isSuccessResponse: (r: { type: string }) => r.type === 'success',
}));

import { apiReal as api } from '@copiloto/core';

import { almacenTokens } from '../../adapters/almacen';
import { SessionProvider } from './SessionProvider';
import { useSession } from './useSession';

const ME = {
  cliente_id: 'cli-1',
  email: 'ana@x.com',
  es_admin: false,
  mp_connected: false,
  composio_connected: [],
  legal_aceptado: false,
  legal_version_aceptada: null,
};

describe('SessionProvider — cierreVoluntario en la ventana commit(autenticado) → passive effect', () => {
  beforeEach(async () => {
    await almacenTokens.limpiar();
    jest.mocked(api.me).mockReset();
  });

  it('un logout dentro de la ventana NO pierde el cierre voluntario', async () => {
    const pasivos: string[] = [];
    const pasivosAutenticadoAlLogout: boolean[] = [];
    let salidas = 0;
    let lecturas: Array<{ estado: string; cierre: string }> = [];

    function SondaEnVentana() {
      const { estado, cierreVoluntario, logout } = useSession();
      useEffect(() => {
        pasivos.push(estado);
      }, [estado]);
      useLayoutEffect(() => {
        if (estado !== 'autenticado' || salidas > 0) return;
        salidas += 1;
        pasivosAutenticadoAlLogout.push(pasivos.includes('autenticado'));
        logout();
      }, [estado, logout]);
      lecturas = [...lecturas, { estado, cierre: cierreVoluntario ? String(cierreVoluntario.email) : 'null' }];
      return <Text testID="sonda">{`${estado}|${cierreVoluntario ? cierreVoluntario.email : 'null'}`}</Text>;
    }

    await almacenTokens.guardarToken('tok-valido');
    jest.mocked(api.me).mockResolvedValueOnce(ME);
    const { getByTestId } = await render(
      <SessionProvider>
        <SondaEnVentana />
      </SessionProvider>,
    );

    await waitFor(() => expect(salidas).toBe(1));
    // Control de ceguera: el logout cayó ANTES del passive effect de `autenticado`.
    expect(pasivosAutenticadoAlLogout).toEqual([false]);
    await waitFor(() => expect(getByTestId('sonda').props.children).toMatch(/^anon\|/));
    // `ana@x.com` falla si el sujeto quedó vacío o es la cadena 'null'.
    expect(getByTestId('sonda').props.children).toBe('anon|ana@x.com');
    expect(lecturas.at(-1)).toEqual({ estado: 'anon', cierre: 'ana@x.com' });
  });
});

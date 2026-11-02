import { renderHook, waitFor } from '@testing-library/react-native';

jest.mock('expo-router', () => {
  const { useEffect } = require('react');
  return { useFocusEffect: (cb: () => void) => useEffect(cb, [cb]) };
});

jest.mock('@copiloto/core', () => ({
  ...jest.requireActual('@copiloto/core'),
  leerPerfilNegocio: jest.fn(),
}));

let mockMe: { cliente_id: string; email?: string | null } | null = null;
jest.mock('../auth/useSession', () => ({ useSession: () => ({ me: mockMe }) }));

import { leerPerfilNegocio } from '@copiloto/core';

import { inicialDeCuenta, useInicialCuenta } from './useInicialCuenta';

const leer = leerPerfilNegocio as jest.MockedFunction<typeof leerPerfilNegocio>;

function perfilCon(nombreComercial: string) {
  return { status: 'ok', perfil: { nombreComercial } } as never;
}

describe('inicialDeCuenta', () => {
  it.each([
    ['el galpón', 'otro@copiloto.test', 'E'],
    ['  ', 'mostrador@copiloto.test', 'M'],
    ['', null, ''],
    ['', undefined, ''],
  ])('nombre %j y mail %j dan %j', (nombre, email, esperada) => {
    expect(inicialDeCuenta(nombre, email)).toBe(esperada);
  });
});

describe('useInicialCuenta', () => {
  beforeEach(() => {
    leer.mockReset();
    mockMe = { cliente_id: 'tenant-a', email: 'a@copiloto.test' };
  });

  it('usa el nombre comercial que devuelve el backend, no un literal', async () => {
    leer.mockResolvedValue(perfilCon('Galpón'));
    const { result } = await renderHook(() => useInicialCuenta());
    await waitFor(() => expect(result.current).toBe('G'));
  });

  it('si el perfil no responde cae al mail y no rompe', async () => {
    leer.mockRejectedValue(new Error('caído'));
    const { result } = await renderHook(() => useInicialCuenta());
    await waitFor(() => expect(leer).toHaveBeenCalled());
    expect(result.current).toBe('A');
  });

  it('🔴 adversarial: el nombre del tenant A no se muestra a B aunque la lectura de B falle', async () => {
    leer.mockResolvedValueOnce(perfilCon('Zapatería de A'));
    const { result, rerender } = await renderHook(() => useInicialCuenta());
    await waitFor(() => expect(result.current).toBe('Z'));

    leer.mockRejectedValueOnce(new Error('caído'));
    mockMe = { cliente_id: 'tenant-b', email: 'b@copiloto.test' };
    await rerender(undefined);
    await waitFor(() => expect(leer).toHaveBeenCalledTimes(2));

    expect(result.current).toBe('B');
  });

  it('🔴 adversarial: la respuesta tardía de A no se escribe sobre la sesión de B', async () => {
    let resolverA: (v: never) => void = () => undefined;
    leer.mockReturnValueOnce(new Promise((r) => (resolverA = r)) as never);
    const { result, rerender } = await renderHook(() => useInicialCuenta());

    leer.mockResolvedValueOnce(perfilCon('Bodega de B'));
    mockMe = { cliente_id: 'tenant-b', email: 'b@copiloto.test' };
    await rerender(undefined);
    await waitFor(() => expect(result.current).toBe('B'));

    resolverA(perfilCon('Zapatería de A'));
    await new Promise((r) => setTimeout(r, 0));
    expect(result.current).toBe('B');
  });

  it('sin sesión no pide nada', async () => {
    mockMe = null;
    const { result } = await renderHook(() => useInicialCuenta());
    expect(leer).not.toHaveBeenCalled();
    expect(result.current).toBe('');
  });
});

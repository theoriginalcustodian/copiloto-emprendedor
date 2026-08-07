/**
 * CTA5 — el aviso de sesión muerta, en el core.
 *
 * Lo que estos tests protegen no es "que se llame al callback": es **cuándo**. El aviso tiene que
 * salir exactamente en el 401 que mata la sesión —el mismo que limpia los tokens— y **no** en el
 * 401 de credenciales mal escritas del login, que no tiene ninguna sesión que invalidar. Sin ese
 * segundo control, un aviso disparado de más mandaría al login a alguien que ya está en el login,
 * con un mensaje de "tu sesión venció" que es falso.
 */
import { beforeEach, describe, expect, it } from 'vitest';

import { apiClient } from './client';
import { configurarApi } from './config';
import { UnauthorizedError } from './errors';
import type { HttpPort, RespuestaHttp } from './http';
import { alExpirarSesion, notificarSesionExpirada } from './sesion';
import type { AlmacenTokens } from './tokens';

function almacen(inicial: { token?: string | null; refresh?: string | null }) {
  const estado = { token: inicial.token ?? null, refresh: inicial.refresh ?? null };
  const tokens: AlmacenTokens = {
    async leerToken() { return estado.token; },
    async guardarToken(t) { estado.token = t; },
    async leerRefresh() { return estado.refresh; },
    async guardarRefresh(t) { estado.refresh = t; },
    async limpiar() { estado.token = null; estado.refresh = null; },
  };
  return tokens;
}

let responder: () => RespuestaHttp;
const httpFake: HttpPort = { async enviar() { return responder(); } };

beforeEach(() => {
  responder = () => ({ ok: true, status: 200, json: async () => ({}) });
});

describe('alExpirarSesion / notificarSesionExpirada', () => {
  it('avisa a todos los suscriptores y la desuscripción corta el aviso', () => {
    const vistos: string[] = [];
    const baja = alExpirarSesion(() => vistos.push('a'));
    alExpirarSesion(() => vistos.push('b'));

    notificarSesionExpirada();
    expect(vistos).toEqual(['a', 'b']);

    baja();
    notificarSesionExpirada();
    expect(vistos).toEqual(['a', 'b', 'b']); // 'a' se dio de baja; 'b' sigue
  });

  it('un suscriptor que tira NO impide que los demás se enteren', () => {
    // Sin el aislamiento, el primer listener con un bug apagaría el aviso para toda la app — y el
    // síntoma sería "a veces no me manda al login", que es imposible de diagnosticar.
    const vistos: string[] = [];
    alExpirarSesion(() => { throw new Error('bug del suscriptor'); });
    alExpirarSesion(() => vistos.push('sobreviviente'));

    expect(() => notificarSesionExpirada()).not.toThrow();
    expect(vistos).toEqual(['sobreviviente']);
  });
});

describe('cuándo lo dispara el cliente HTTP', () => {
  it('EL QUE IMPORTA: 401 que mata la sesión → limpia tokens Y avisa', async () => {
    let avisos = 0;
    const baja = alExpirarSesion(() => { avisos += 1; });
    configurarApi({ http: httpFake, tokens: almacen({ token: 'tok', refresh: null }), apiBase: '' });
    responder = () => ({ ok: false, status: 401, json: async () => ({ detail: 'Not enough segments' }) });

    await expect(apiClient.get('/clientes')).rejects.toBeInstanceOf(UnauthorizedError);

    expect(avisos).toBe(1);
    baja();
  });

  it('control: el 401 del LOGIN (auth:false) NO avisa — no hay sesión que haya expirado', async () => {
    // Sin este control, el test de arriba pasaría igual con un aviso incondicional en todo 401: el
    // usuario que escribe mal la contraseña vería "tu sesión venció", que es mentira.
    let avisos = 0;
    const baja = alExpirarSesion(() => { avisos += 1; });
    configurarApi({ http: httpFake, tokens: almacen({}), apiBase: '' });
    responder = () => ({ ok: false, status: 401, json: async () => ({ detail: 'credenciales inválidas' }) });

    await expect(
      apiClient.post('/auth/login', { email: 'a@a.com', password: 'mal' }, { auth: false }),
    ).rejects.toBeInstanceOf(UnauthorizedError);

    expect(avisos).toBe(0);
    baja();
  });

  it('control: un 403 (cuenta suspendida) tampoco avisa — la credencial anda, la cuenta no opera', async () => {
    let avisos = 0;
    const baja = alExpirarSesion(() => { avisos += 1; });
    configurarApi({ http: httpFake, tokens: almacen({ token: 'tok' }), apiBase: '' });
    responder = () => ({ ok: false, status: 403, json: async () => ({ detail: 'cuenta suspendida' }) });

    await expect(apiClient.get('/clientes')).rejects.toThrow();
    expect(avisos).toBe(0);
    baja();
  });
});

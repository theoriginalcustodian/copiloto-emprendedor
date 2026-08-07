/**
 * CTA7 — **la sesión no se tiene que morir.**
 *
 * El operador quedó afuera de la app con el refresh token sano en el bolsillo. La causa no fue que
 * el access token venciera —para eso ya existía el refresh-on-401— sino que **desapareció**: el
 * backend contestó `missing or malformed Authorization header`, que es el mensaje de header AUSENTE,
 * no el de token inválido (`invalid token: Not enough segments`). Y con el header ausente el cliente
 * no intentaba renovar nada: `sentBearer` era false, así que iba derecho al 401 → limpiar tokens →
 * logout. Peor: ese limpiado se llevaba puesto el refresh token que podría haber salvado la sesión.
 *
 * Estos tests cubren las tres reglas que salen de ahí, y cada uno dice qué hay que romper para
 * verlo en rojo — un test de sesión que pasa con el fix revertido no prueba nada, porque el estado
 * "deslogueado" se parece demasiado a un estado legítimo.
 */
import { beforeEach, describe, expect, it } from 'vitest';

import { apiClient } from './client';
import { configurarApi } from './config';
import { UnauthorizedError } from './errors';
import type { HttpPort, PeticionHttp, RespuestaHttp } from './http';
import type { AlmacenTokens } from './tokens';

let peticiones: PeticionHttp[] = [];
let responder: (p: PeticionHttp) => RespuestaHttp | Promise<RespuestaHttp>;

const httpFake: HttpPort = {
  async enviar(p) {
    peticiones.push(p);
    return responder(p);
  },
};

/** Almacén en memoria que además CUENTA los limpiados: "no borró los tokens" es media assert. */
function almacen(inicial: { token?: string | null; refresh?: string | null }) {
  const estado = { token: inicial.token ?? null, refresh: inicial.refresh ?? null, limpiados: 0 };
  const tokens: AlmacenTokens = {
    async leerToken() { return estado.token; },
    async guardarToken(t) { estado.token = t; },
    async leerRefresh() { return estado.refresh; },
    async guardarRefresh(t) { estado.refresh = t; },
    async limpiar() { estado.limpiados += 1; estado.token = null; estado.refresh = null; },
  };
  return { estado, tokens };
}

/** ¿Cuántas veces se pidió renovar? Es el numerador del single-flight. */
function refrescos(): number {
  return peticiones.filter((p) => p.path === '/auth/refresh').length;
}

beforeEach(() => {
  peticiones = [];
  responder = () => ({ ok: true, status: 200, json: async () => ({}) });
});

describe('access token AUSENTE con refresh guardado — el caso que dejó al operador afuera', () => {
  it('EL QUE IMPORTA: renueva ANTES de mandar la request y la acción funciona', async () => {
    // Revertí `bearerVigente` (leer el token y listo) y esto se pone rojo: sin Bearer el fake
    // contesta 401 y `sentBearer` false hace que ni se intente el refresh.
    const { estado, tokens } = almacen({ token: null, refresh: 'rt-vivo' });
    configurarApi({ http: httpFake, tokens, apiBase: '' });
    responder = (p) => {
      if (p.path === '/auth/refresh') {
        return { ok: true, status: 200, json: async () => ({ access_token: 'tok-nuevo', refresh_token: 'rt-rotado' }) };
      }
      if (p.headers?.Authorization !== 'Bearer tok-nuevo') {
        return { ok: false, status: 401, json: async () => ({ detail: 'missing or malformed Authorization header' }) };
      }
      return { ok: true, status: 200, json: async () => ({ items: [] }) };
    };

    await expect(apiClient.get('/clientes')).resolves.toEqual({ items: [] });

    expect(refrescos()).toBe(1);
    expect(estado.limpiados).toBe(0);          // la sesión NO se tocó
    expect(estado.refresh).toBe('rt-rotado');  // GoTrue rota: se persistió el nuevo
  });

  it('si el refresh TAMBIÉN está muerto → UnauthorizedError y ahí sí se limpia (logout real)', async () => {
    const { estado, tokens } = almacen({ token: null, refresh: 'rt-muerto' });
    configurarApi({ http: httpFake, tokens, apiBase: '' });
    responder = (p) =>
      p.path === '/auth/refresh'
        ? { ok: false, status: 401, json: async () => ({ detail: 'refresh vencido' }) }
        : { ok: false, status: 401, json: async () => ({ detail: 'missing or malformed Authorization header' }) };

    await expect(apiClient.get('/clientes')).rejects.toBeInstanceOf(UnauthorizedError);
    expect(estado.limpiados).toBe(1); // esta es la única situación que autoriza a borrar
  });

  it('control: sin NADA guardado (nunca logueado) no se pide refresh ni se limpia de gusto', async () => {
    // Sin este control, el test de arriba pasaría igual con un `limpiar()` incondicional: borrar
    // siempre satisface "borró cuando había que borrar".
    const { estado, tokens } = almacen({ token: null, refresh: null });
    configurarApi({ http: httpFake, tokens, apiBase: '' });
    responder = () => ({ ok: false, status: 401, json: async () => ({ detail: 'no logueado' }) });

    await expect(apiClient.get('/clientes')).rejects.toBeInstanceOf(UnauthorizedError);
    expect(refrescos()).toBe(0);
    expect(estado.limpiados).toBe(0);
  });
});

describe('un 401 sólo destruye la sesión cuando la sesión es el problema', () => {
  it('401 que persiste DESPUÉS de un refresh exitoso → NO borra los tokens', async () => {
    // El access token tiene un instante de vida: si el endpoint igual contesta 401, el problema es
    // del endpoint. Antes (`limpiarTokens: auth`) cualquier 401 deslogueaba, y el usuario se
    // encontraba en el login sin haber hecho nada.
    const { estado, tokens } = almacen({ token: 'tok-viejo', refresh: 'rt-vivo' });
    configurarApi({ http: httpFake, tokens, apiBase: '' });
    responder = (p) =>
      p.path === '/auth/refresh'
        ? { ok: true, status: 200, json: async () => ({ access_token: 'tok-nuevo', refresh_token: 'rt-rotado' }) }
        : { ok: false, status: 401, json: async () => ({ detail: 'algo raro de este endpoint' }) };

    await expect(apiClient.get('/algo')).rejects.toBeInstanceOf(UnauthorizedError);

    expect(refrescos()).toBe(1);
    expect(estado.limpiados).toBe(0);
    expect(estado.refresh).toBe('rt-rotado'); // la sesión sigue viva y usable
  });

  it('control positivo del mismo mecanismo: token vencido + refresh sano → renueva, reintenta y resuelve', async () => {
    // Si el reintento se rompiera, el test de arriba pasaría igual (sigue habiendo un 401 final).
    const { estado, tokens } = almacen({ token: 'tok-viejo', refresh: 'rt-vivo' });
    configurarApi({ http: httpFake, tokens, apiBase: '' });
    responder = (p) => {
      if (p.path === '/auth/refresh') {
        return { ok: true, status: 200, json: async () => ({ access_token: 'tok-nuevo', refresh_token: 'rt-rotado' }) };
      }
      return p.headers?.Authorization === 'Bearer tok-nuevo'
        ? { ok: true, status: 200, json: async () => ({ ok: true }) }
        : { ok: false, status: 401, json: async () => ({ detail: 'expirado' }) };
    };

    await expect(apiClient.get('/algo')).resolves.toEqual({ ok: true });
    expect(estado.limpiados).toBe(0);
  });
});

describe('single-flight del refresh — el mecanismo YA existía y no tenía quien lo probara', () => {
  it('EL QUE IMPORTA: 3 requests concurrentes con el token vencido disparan UN solo /auth/refresh', async () => {
    // GoTrue ROTA el refresh en cada uso: dos renovaciones simultáneas dejan a la segunda con un
    // token ya consumido → logout espurio y silencioso. Quitá el `refreshInFlight` de `client.ts`
    // y este test pasa a contar 3.
    const { estado, tokens } = almacen({ token: 'tok-viejo', refresh: 'rt-vivo' });
    configurarApi({ http: httpFake, tokens, apiBase: '' });
    responder = (p) => {
      if (p.path === '/auth/refresh') {
        return { ok: true, status: 200, json: async () => ({ access_token: 'tok-nuevo', refresh_token: 'rt-rotado' }) };
      }
      return p.headers?.Authorization === 'Bearer tok-nuevo'
        ? { ok: true, status: 200, json: async () => ({ ok: true }) }
        : { ok: false, status: 401, json: async () => ({ detail: 'expirado' }) };
    };

    const todas = await Promise.all([
      apiClient.get('/a'),
      apiClient.get('/b'),
      apiClient.get('/c'),
    ]);

    expect(todas).toEqual([{ ok: true }, { ok: true }, { ok: true }]);
    expect(refrescos()).toBe(1); // ← el guard
    expect(estado.limpiados).toBe(0);
  });

  it('y el mismo guard aplica al token AUSENTE: 3 requests concurrentes, un solo refresh', async () => {
    // Camino nuevo: la renovación proactiva de `bearerVigente` también tiene que compartir la
    // promesa, si no el fix de CTA7 introduciría la carrera que el guard viejo ya evitaba.
    const { tokens } = almacen({ token: null, refresh: 'rt-vivo' });
    configurarApi({ http: httpFake, tokens, apiBase: '' });
    responder = (p) =>
      p.path === '/auth/refresh'
        ? { ok: true, status: 200, json: async () => ({ access_token: 'tok-nuevo', refresh_token: 'rt-rotado' }) }
        : { ok: true, status: 200, json: async () => ({ ok: true }) };

    await Promise.all([apiClient.get('/a'), apiClient.get('/b'), apiClient.get('/c')]);

    expect(refrescos()).toBe(1);
  });
});

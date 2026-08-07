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
import { alExpirarSesion, marcarSesionViva, notificarSesionExpirada } from './sesion';
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
  // El candado de "una muerte, un aviso" es estado de MÓDULO: sin rearmarlo entre tests, el primero
  // que dispare deja mudos a todos los siguientes y el archivo pasa a medir el orden de ejecución.
  marcarSesionViva();
});

describe('alExpirarSesion / notificarSesionExpirada', () => {
  it('avisa a todos los suscriptores y la desuscripción corta el aviso', () => {
    const vistos: string[] = [];
    const baja = alExpirarSesion(() => vistos.push('a'));
    alExpirarSesion(() => vistos.push('b'));

    notificarSesionExpirada();
    expect(vistos).toEqual(['a', 'b']);

    baja();
    // `marcarSesionViva()` porque el aviso es idempotente POR MUERTE de sesión: sin rearmar, esta
    // segunda notificación no saldría y el test mediría el candado en vez de la desuscripción.
    marcarSesionViva();
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

describe('una MUERTE, un AVISO — la tormenta de 401', () => {
  it('EL QUE IMPORTA: tres 401 concurrentes → el escucha se invoca UNA sola vez', async () => {
    // Revertí el `if (yaAvisado) return;` de `notificarSesionExpirada` y esto se pone rojo con 3.
    //
    // Por qué el single-flight del refresh NO alcanza: las tres requests esperan la MISMA renovación,
    // y las tres reciben el mismo "falló" — así que las tres llegan igual al punto que avisa. El
    // candado tiene que estar en el aviso, no en el refresh.
    //
    // Este defecto no da síntoma en desarrollo, donde casi siempre hay una sola request en vuelo:
    // aparece en la pantalla del emprendedor, que abre tres llamadas de una.
    let avisos = 0;
    const baja = alExpirarSesion(() => { avisos += 1; });
    configurarApi({ http: httpFake, tokens: almacen({ token: 'tok', refresh: null }), apiBase: '' });
    responder = () => ({ ok: false, status: 401, json: async () => ({ detail: 'jwt expired' }) });

    await Promise.all([
      apiClient.get('/clientes').catch(() => undefined),
      apiClient.get('/gastos').catch(() => undefined),
      apiClient.get('/me').catch(() => undefined),
    ]);

    expect(avisos).toBe(1);
    baja();
  });

  it('control: tras entrar de nuevo, la SEGUNDA muerte vuelve a avisar (el candado no es de por vida)', async () => {
    // Sin este control, "avisos === 1" del test de arriba lo cumpliría igual un candado que se cierra
    // para siempre — y el emprendedor que vuelve a entrar y se le cae la sesión otra vez se quedaría
    // sin ningún aviso, con el defecto original intacto a partir del segundo uso.
    let avisos = 0;
    const baja = alExpirarSesion(() => { avisos += 1; });
    const tokens = almacen({ token: 'tok', refresh: null });
    configurarApi({ http: httpFake, tokens, apiBase: '' });
    responder = () => ({ ok: false, status: 401, json: async () => ({ detail: 'jwt expired' }) });

    await apiClient.get('/clientes').catch(() => undefined);
    expect(avisos).toBe(1);

    // El emprendedor entra de nuevo: hay token guardado otra vez Y el candado se rearma. Las dos
    // cosas, porque el primer 401 dejó el almacén VACÍO — y sin token guardado el cliente no tiene
    // ninguna sesión que declarar muerta (con razón: no la hay).
    await tokens.guardarToken('tok-nuevo');
    marcarSesionViva();
    await apiClient.get('/clientes').catch(() => undefined);

    expect(avisos).toBe(2);
    baja();
  });

  it('control: un refresh EXITOSO rearma solo — nadie tiene que acordarse', async () => {
    // El rearme no puede depender de que cada consumidor llame a `marcarSesionViva()`: el camino más
    // común de "hay sesión viva otra vez" es una renovación silenciosa que el usuario ni ve.
    let avisos = 0;
    const baja = alExpirarSesion(() => { avisos += 1; });
    const tokens = almacen({ token: null, refresh: 'rt-vivo' });
    configurarApi({ http: httpFake, tokens, apiBase: '' });

    notificarSesionExpirada(); // una muerte previa dejó el candado cerrado
    expect(avisos).toBe(1);

    // Ahora una renovación que SÍ funciona, seguida de la request real.
    let llamada = 0;
    responder = () => {
      llamada += 1;
      if (llamada === 1) {
        return { ok: true, status: 200, json: async () => ({ access_token: 'nuevo', refresh_token: 'rt2' }) };
      }
      return { ok: true, status: 200, json: async () => ({ items: [] }) };
    };
    await apiClient.get('/clientes');

    notificarSesionExpirada(); // la sesión se cae otra vez, más tarde
    expect(avisos).toBe(2);
    baja();
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

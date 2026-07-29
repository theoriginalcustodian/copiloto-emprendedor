/**
 * El `fetch` sin timeout no falla: cuelga.
 *
 * Si la red se muere a mitad de una request —el caso normal en un celular: wifi a datos, ascensor,
 * subte— la promesa nunca resuelve ni rechaza. La pantalla se queda con el spinner puesto para
 * siempre: sin error, sin reintento, sin nada que tocar salvo matar la app. Es el peor modo de fallo
 * posible porque no se parece a un fallo.
 *
 * Los adaptadores cortan con `AbortController`; acá se verifica la otra mitad: que el corte llegue a
 * la app como un error del dominio (`ApiError` 408) y no como un `AbortError` crudo del navegador que
 * cada pantalla tendría que aprender a reconocer.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { apiClient, postMultipart } from './client';
import { configurarApi } from './config';
import { ApiError } from './errors';
import type { HttpPort, PeticionHttp, RespuestaHttp } from './http';
import { TIMEOUT_HTTP_MS } from './http';
import type { AlmacenTokens } from './tokens';

let peticiones: PeticionHttp[] = [];
let responder: () => RespuestaHttp | Promise<RespuestaHttp>;

function tokensFake(): AlmacenTokens {
  return {
    async leerToken() {
      return null;
    },
    async guardarToken() {},
    async leerRefresh() {
      return null;
    },
    async guardarRefresh() {},
    async limpiar() {},
  };
}

const httpFake: HttpPort = {
  async enviar(p) {
    peticiones.push(p);
    return responder();
  },
};

function abortError(): Error {
  const e = new Error('The operation was aborted');
  e.name = 'AbortError';
  return e;
}

beforeEach(() => {
  peticiones = [];
  responder = () => ({ ok: true, status: 200, json: async () => ({}) });
  configurarApi({ http: httpFake, tokens: tokensFake(), apiBase: '' });
});

afterEach(() => {
  peticiones = [];
});

describe('corte por tiempo', () => {
  it('EL QUE IMPORTA: el aborto llega como ApiError 408, no como AbortError crudo', async () => {
    responder = () => {
      throw abortError();
    };

    const error = await apiClient.get('/afip/comprobantes').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(408);
    expect((error as ApiError).detail).toBe('timeout');
  });

  it('control: un error de red que NO es aborto se repropaga tal cual', async () => {
    // Si esto se convirtiera en 408, un bug del adaptador se leería como "la red anduvo lenta" y
    // nadie lo miraría.
    const red = new Error('Network request failed');
    responder = () => {
      throw red;
    };

    await expect(apiClient.get('/afip/comprobantes')).rejects.toBe(red);
  });

  it('control positivo: una respuesta normal sigue pasando', async () => {
    responder = () => ({ ok: true, status: 200, json: async () => ({ ok: true }) });

    await expect(apiClient.get('/afip/comprobantes')).resolves.toEqual({ ok: true });
  });

  it('el multipart pide 0 (sin corte) — abortarlo perdería una grabación ya hecha', async () => {
    await postMultipart('/chat/audio', { session_id: 's1' }, 'archivo', {
      nombre: 'voz.m4a',
      mime: 'audio/m4a',
      datos: 'file:///tmp/voz.m4a',
    });

    expect(peticiones[0]!.timeoutMs).toBe(0);
  });

  it('el timeout canónico es un número usable, no cero', () => {
    // Control del propio contrato: si alguien pusiera `TIMEOUT_HTTP_MS = 0` "para desactivarlo
    // mientras debuggea", TODAS las requests quedarían sin corte y este archivo entero pasaría igual.
    expect(TIMEOUT_HTTP_MS).toBeGreaterThan(1000);
  });
});

describe('postMultipart — refresh-on-401 (EL QUE IMPORTA: sin esto, un dictado con token vencido desloguea sin reintentar)', () => {
  it('401 en el multipart → refresca y reintenta CON el mismo archivo → resuelve', async () => {
    let llamada = 0;
    responder = () => {
      llamada += 1;
      if (llamada === 1) return { ok: false, status: 401, json: async () => ({ detail: 'expirado' }) };
      if (llamada === 2) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ access_token: 'tok-nuevo', refresh_token: 'rt-nuevo' }),
        };
      }
      return { ok: true, status: 200, json: async () => ({ wf_id: 'wf-1' }) };
    };
    configurarApi({
      http: httpFake,
      tokens: {
        ...tokensFake(),
        async leerRefresh() { return 'rt-viejo'; },
        async leerToken() { return 'tok-viejo'; },
      },
      apiBase: '',
    });

    const resultado = await postMultipart('/chat/audio', { session_id: 's1' }, 'archivo', {
      nombre: 'voz.m4a',
      mime: 'audio/m4a',
      datos: 'file:///tmp/voz.m4a',
    });

    expect(resultado).toEqual({ wf_id: 'wf-1' });
    expect(peticiones).toHaveLength(3); // original 401 + /auth/refresh + reintento
    // El reintento debe llevar el MISMO multipart (mismo archivo), no perder la grabación.
    expect(peticiones[2]!.multipart?.archivo.nombre).toBe('voz.m4a');
  });

  it('401 y el refresh también falla → propaga UnauthorizedError (no cuelga ni pierde el audio en silencio)', async () => {
    responder = () => ({ ok: false, status: 401, json: async () => ({ detail: 'expirado' }) });
    configurarApi({
      http: httpFake,
      tokens: {
        ...tokensFake(),
        async leerRefresh() { return 'rt-viejo'; },
        async leerToken() { return 'tok-viejo'; },
      },
      apiBase: '',
    });

    await expect(
      postMultipart('/chat/audio', { session_id: 's1' }, 'archivo', {
        nombre: 'voz.m4a',
        mime: 'audio/m4a',
        datos: 'file:///tmp/voz.m4a',
      }),
    ).rejects.toBeInstanceOf(ApiError);
  });
});

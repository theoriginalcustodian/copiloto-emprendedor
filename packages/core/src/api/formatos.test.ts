import { beforeEach, describe, expect, it } from 'vitest';

import { configurarApi } from './config';
import { obtenerFormatosNota } from './formatos';
import type { HttpPort, PeticionHttp, RespuestaHttp } from './http';
import type { AlmacenTokens } from './tokens';

function respuesta(status: number, body: unknown): RespuestaHttp {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

function crearTokensFake(token: string | null = 'tok-123'): AlmacenTokens {
  return {
    async leerToken() {
      return token;
    },
    async guardarToken() {},
    async leerRefresh() {
      return null;
    },
    async guardarRefresh() {},
    async limpiar() {},
  };
}

describe('formatos.ts', () => {
  let peticiones: PeticionHttp[];
  let responder: (p: PeticionHttp) => RespuestaHttp;

  beforeEach(() => {
    peticiones = [];
    responder = () => respuesta(200, { formatos: [] });
    const http: HttpPort = {
      async enviar(p) {
        peticiones.push(p);
        return responder(p);
      },
    };
    configurarApi({ http, tokens: crearTokensFake() });
  });

  it('obtenerFormatosNota — GET /nota/formatos, devuelve el catálogo tal cual lo manda el backend', async () => {
    const catalogo = { formatos: [{ codigo: 'evolucion', etiqueta: 'Evolución' }] };
    responder = () => respuesta(200, catalogo);

    const result = await obtenerFormatosNota();

    expect(result).toEqual(catalogo);
    expect(peticiones[0]).toMatchObject({ metodo: 'GET', path: '/nota/formatos' });
  });
});

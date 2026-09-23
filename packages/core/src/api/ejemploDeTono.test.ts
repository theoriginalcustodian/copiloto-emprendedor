import { beforeEach, describe, expect, it } from 'vitest';

import { configurarApi } from './config';
import type { HttpPort, PeticionHttp, RespuestaHttp } from './http';
import { leerEjemploDeTono } from './perfilNegocio';
import type { AlmacenTokens } from './tokens';

const respuesta = (status: number, body: unknown): RespuestaHttp => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

const tokens: AlmacenTokens = {
  async leerToken() { return 'tok'; },
  async guardarToken() {},
  async leerRefresh() { return null; },
  async guardarRefresh() {},
  async limpiar() {},
};

describe('leerEjemploDeTono (K-15 / BL-X7)', () => {
  let peticiones: PeticionHttp[];
  let responder: (p: PeticionHttp) => RespuestaHttp;

  beforeEach(() => {
    peticiones = [];
    responder = () => respuesta(200, {});
    const http: HttpPort = { async enviar(p) { peticiones.push(p); return responder(p); } };
    configurarApi({ http, tokens });
  });

  it('pide la combinación al backend y devuelve el ejemplo', async () => {
    responder = () => respuesta(200, { ejemplo: 'Dale, ya te dejo el presupuesto listo.' });
    expect(await leerEjemploDeTono('cercano', 'breve')).toBe('Dale, ya te dejo el presupuesto listo.');
    expect(peticiones[0]?.path).toBe('/perfil-negocio/ejemplo?formalidad=cercano&largo_respuesta=breve');
  });

  it('fail-soft: 404 o respuesta rara → null, nunca un ejemplo inventado', async () => {
    responder = () => respuesta(404, {});
    expect(await leerEjemploDeTono('formal', 'detallado')).toBeNull();
    responder = () => respuesta(200, { ejemplo: 5 });
    expect(await leerEjemploDeTono('formal', 'detallado')).toBeNull();
  });
});

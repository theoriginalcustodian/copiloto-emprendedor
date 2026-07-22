import { beforeEach, describe, expect, it } from 'vitest';

import { configurarApi } from './config';
import { ApiError } from './errors';
import type { HttpPort, PeticionHttp, RespuestaHttp } from './http';
import { listarActividad } from './actividad';
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

describe('actividad.ts', () => {
  let peticiones: PeticionHttp[];
  let responder: (p: PeticionHttp) => RespuestaHttp;

  beforeEach(() => {
    peticiones = [];
    responder = () => respuesta(200, { items: [], cursor_siguiente: null, truncado: false });
    const http: HttpPort = {
      async enviar(p) {
        peticiones.push(p);
        return responder(p);
      },
    };
    configurarApi({ http, tokens: crearTokensFake() });
  });

  it('normaliza el shape crudo (snake_case) a camelCase', async () => {
    responder = () =>
      respuesta(200, {
        items: [
          {
            entrada_id: 'e1',
            cliente_id: 'c1',
            cliente_nombre: 'Ana',
            tipo_operacion: 'nota',
            created_at: '2026-07-20T00:00:00Z',
            extracto: 'texto',
          },
        ],
        cursor_siguiente: 'cur-2',
        truncado: false,
      });

    const result = await listarActividad();

    expect(result).toEqual({
      status: 'ok',
      items: [
        {
          entrada_id: 'e1',
          cliente_id: 'c1',
          cliente_nombre: 'Ana',
          tipo_operacion: 'nota',
          created_at: '2026-07-20T00:00:00Z',
          extracto: 'texto',
        },
      ],
      cursorSiguiente: 'cur-2',
      truncado: false,
    });
  });

  it('404 (ruta todavía no desplegada) -> {status: no_disponible}, no relanza', async () => {
    responder = () => respuesta(404, { detail: 'not found' });

    const result = await listarActividad();

    expect(result).toEqual({ status: 'no_disponible' });
  });

  it('501 (stub explícito del backend) -> {status: no_disponible}, mismo criterio que 404', async () => {
    responder = () => respuesta(501, { detail: 'not implemented' });

    const result = await listarActividad();

    expect(result).toEqual({ status: 'no_disponible' });
  });

  it('otro status (ej. 500) SÍ se relanza como ApiError', async () => {
    responder = () => respuesta(500, { detail: 'boom' });

    const error = (await listarActividad().catch((e: unknown) => e)) as ApiError;

    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(500);
  });

  it('manda q/cursor/limit como querystring', async () => {
    await listarActividad({ q: 'ana', cursor: 'cur-1', limit: 5 });

    expect(peticiones[0]).toMatchObject({ metodo: 'GET' });
    expect(peticiones[0]!.path).toBe('/actividad?q=ana&cursor=cur-1&limit=5');
  });

  it('usa el límite default (20) si no se especifica', async () => {
    await listarActividad();

    expect(peticiones[0]!.path).toBe('/actividad?limit=20');
  });

  it('un 200 con el HTML del SPA es no_disponible, no una excepción de parseo', async () => {
    // 🔴 Medido en prod el 2026-07-22: `GET /actividad` -> `200 <!doctype html>`, porque la ruta no
    // está desplegada y el catch-all `@app.get("/{full_path}")` sirve el SPA. Antes de esta guarda,
    // `res.json()` explotaba con SyntaxError y la pantalla mostraba un ERROR donde debía decir
    // "todavía no está disponible" — pese a que el docstring del módulo afirmaba lo contrario.
    responder = () => ({
      ok: true,
      status: 200,
      json: async () => { throw new SyntaxError('Unexpected token < in JSON at position 0'); },
    });

    await expect(listarActividad()).resolves.toEqual({ status: 'no_disponible' });
  });

  it('un 200 con un JSON que NO trae `items` tampoco se pinta como actividad', async () => {
    responder = () => respuesta(200, { detail: 'otra cosa' });

    await expect(listarActividad()).resolves.toEqual({ status: 'no_disponible' });
  });
});

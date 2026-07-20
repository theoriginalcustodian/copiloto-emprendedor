import { beforeEach, describe, expect, it } from 'vitest';

import { configurarApi } from './config';
import { ApiError, GeneroInvalidoError } from './errors';
import type { HttpPort, PeticionHttp, RespuestaHttp } from './http';
import { actualizarCliente, crearCliente, obtenerOpcionesCliente, obtenerCliente } from './clientes';
import type { AlmacenTokens } from './tokens';

/**
 * Tests de la capa `/clientes` contra un `HttpPort` FAKE (no `fetch` real) — este paquete compila
 * SIN `lib.dom` a propósito (gate cero-DOM), así que no hay `Response`/`fetch` acá, sólo los puertos
 * agnósticos de plataforma (`HttpPort`/`AlmacenTokens`) que ya usa el resto del core.
 */

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

describe('clientes.ts', () => {
  let peticiones: PeticionHttp[];
  let responder: (p: PeticionHttp) => RespuestaHttp;

  beforeEach(() => {
    peticiones = [];
    responder = () => respuesta(200, {});
    const http: HttpPort = {
      async enviar(p) {
        peticiones.push(p);
        return responder(p);
      },
    };
    configurarApi({ http, tokens: crearTokensFake() });
  });

  describe('obtenerOpcionesCliente — GET /clientes/opciones', () => {
    it('devuelve el catálogo tal cual lo manda el backend, sin hardcodear valores', async () => {
      const catalogo = { generos: [{ codigo: 'no_binario', etiqueta: 'No binario' }] };
      responder = () => respuesta(200, catalogo);

      const result = await obtenerOpcionesCliente();

      expect(result).toEqual(catalogo);
      expect(peticiones[0]).toMatchObject({ metodo: 'GET', path: '/clientes/opciones' });
    });
  });

  describe('actualizarCliente — PATCH /clientes/{id} (parcial de verdad)', () => {
    it('EL TEST CENTRAL: un PATCH que sólo manda genero NO incluye la clave "notas" en el body', async () => {
      responder = () =>
        respuesta(200, {
          id: 'p1',
          nombre: 'Juan Pérez',
          fecha_nacimiento: null,
          estado: 'activo',
          genero: 'otro',
          notas: 'notas preexistentes que NO deben tocarse',
        });

      await actualizarCliente('p1', { genero: 'otro' });

      expect(peticiones).toHaveLength(1);
      const { metodo, path, cuerpoJson } = peticiones[0]!;
      expect(metodo).toBe('PATCH');
      expect(path).toBe('/clientes/p1');
      // JSON.stringify es el criterio real: `undefined` no se serializa nunca, `null` sí. Se valida
      // contra el JSON serializado (no contra el objeto JS in-memory) porque ES el contrato que viaja.
      const serializado = JSON.parse(JSON.stringify(cuerpoJson)) as Record<string, unknown>;
      expect(serializado).toEqual({ genero: 'otro' });
      expect('notas' in serializado).toBe(false);
    });

    it('un PATCH con notas:null SÍ manda la clave "notas" en null (borrado explícito, no ausencia)', async () => {
      responder = () =>
        respuesta(200, {
          id: 'p1',
          nombre: 'Juan Pérez',
          fecha_nacimiento: null,
          estado: 'activo',
          genero: null,
          notas: null,
        });

      await actualizarCliente('p1', { notas: null });

      const serializado = JSON.parse(JSON.stringify(peticiones[0]!.cuerpoJson)) as Record<string, unknown>;
      expect('notas' in serializado).toBe(true);
      expect(serializado.notas).toBeNull();
      expect('genero' in serializado).toBe(false);
    });

    it('manda ambos campos cuando el caller manda ambos', async () => {
      responder = () =>
        respuesta(200, {
          id: 'p1',
          nombre: 'Juan Pérez',
          fecha_nacimiento: null,
          estado: 'activo',
          genero: 'femenino',
          notas: 'texto',
        });

      await actualizarCliente('p1', { genero: 'femenino', notas: 'texto' });

      const serializado = JSON.parse(JSON.stringify(peticiones[0]!.cuerpoJson)) as Record<string, unknown>;
      expect(serializado).toEqual({ genero: 'femenino', notas: 'texto' });
    });

    it('devuelve el ClienteDetalle actualizado (genero + notas)', async () => {
      responder = () =>
        respuesta(200, {
          id: 'p1',
          nombre: 'Juan Pérez',
          fecha_nacimiento: null,
          estado: 'activo',
          genero: 'otro',
          notas: 'x',
        });

      const result = await actualizarCliente('p1', { genero: 'otro' });

      expect(result.genero).toBe('otro');
      expect(result.notas).toBe('x');
    });

    it('400 genero_invalido → GeneroInvalidoError con el catálogo adjunto (detail envuelto por FastAPI)', async () => {
      responder = () =>
        respuesta(400, {
          detail: {
            motivo: 'genero_invalido',
            genero: 'marciano',
            generos: [{ codigo: 'otro', etiqueta: 'Otro' }],
          },
        });

      const error = (await actualizarCliente('p1', { genero: 'marciano' }).catch((e: unknown) => e)) as GeneroInvalidoError;

      expect(error).toBeInstanceOf(GeneroInvalidoError);
      expect(error.status).toBe(400);
      expect(error.genero).toBe('marciano');
      expect(error.generos).toEqual([{ codigo: 'otro', etiqueta: 'Otro' }]);
    });

    it('404 (cliente ajeno o inexistente, indistinguible a propósito) → ApiError genérico', async () => {
      responder = () => respuesta(404, { detail: 'cliente no encontrado' });

      const error = (await actualizarCliente('ajeno', { genero: 'otro' }).catch((e: unknown) => e)) as ApiError;

      expect(error).toBeInstanceOf(ApiError);
      expect(error).not.toBeInstanceOf(GeneroInvalidoError);
      expect(error.status).toBe(404);
    });
  });

  describe('obtenerCliente — GET /clientes/{id} devuelve ClienteDetalle (genero + notas)', () => {
    it('incluye genero y notas en la respuesta', async () => {
      responder = () =>
        respuesta(200, {
          id: 'p1',
          nombre: 'Juan Pérez',
          fecha_nacimiento: null,
          dni: '30111222',
          estado: 'activo',
          genero: 'femenino',
          notas: 'preferencia de contacto: whatsapp',
        });

      const result = await obtenerCliente('p1');

      expect(result.genero).toBe('femenino');
      expect(result.notas).toBe('preferencia de contacto: whatsapp');
    });
  });

  describe('crearCliente — pasa genero/notas y mapea el 400 de género inválido', () => {
    it('incluye genero y notas en el body cuando el caller los manda', async () => {
      responder = () => respuesta(201, { id: 'p2', nombre: 'Ana', fecha_nacimiento: null, estado: 'activo' });

      await crearCliente({ nombre: 'Ana', genero: 'femenino', notas: 'preferencia de contacto: whatsapp' });

      const serializado = JSON.parse(JSON.stringify(peticiones[0]!.cuerpoJson)) as Record<string, unknown>;
      expect(serializado.genero).toBe('femenino');
      expect(serializado.notas).toBe('preferencia de contacto: whatsapp');
    });

    it('400 genero_invalido → GeneroInvalidoError (mismo contrato que el PATCH)', async () => {
      responder = () =>
        respuesta(400, {
          detail: { motivo: 'genero_invalido', genero: 'x', generos: [] },
        });

      const error = (await crearCliente({ nombre: 'Ana', genero: 'x' }).catch((e: unknown) => e)) as GeneroInvalidoError;

      expect(error).toBeInstanceOf(GeneroInvalidoError);
      expect(error.genero).toBe('x');
      expect(error.generos).toEqual([]);
    });
  });
});

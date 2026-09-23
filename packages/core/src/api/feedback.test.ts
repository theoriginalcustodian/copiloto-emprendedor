import { beforeEach, describe, expect, it } from 'vitest';

import { configurarApi } from './config';
import { ApiError } from './errors';
import { enviarFeedback, enviarFeedbackAudio, listarFeedbackPropio } from './feedback';
import type { HttpPort, PeticionHttp, RespuestaHttp } from './http';
import type { AlmacenTokens } from './tokens';

/** Molde: `gastos.test.ts` — `HttpPort` FAKE, sin `fetch` real. */
function respuesta(status: number, body: unknown): RespuestaHttp {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

function crearTokensFake(): AlmacenTokens {
  return {
    async leerToken() {
      return 'tok-123';
    },
    async guardarToken() {},
    async leerRefresh() {
      return null;
    },
    async guardarRefresh() {},
    async limpiar() {},
  };
}

describe('feedback.ts', () => {
  let peticiones: PeticionHttp[];
  let responder: (p: PeticionHttp) => RespuestaHttp;

  beforeEach(() => {
    peticiones = [];
    responder = () => respuesta(200, { id: 1, ok: true });
    const http: HttpPort = {
      async enviar(p) {
        peticiones.push(p);
        return responder(p);
      },
    };
    configurarApi({ http, tokens: crearTokensFake() });
  });

  describe('enviarFeedback (texto)', () => {
    it('manda POST /feedback con el texto — sin contexto no lo manda', async () => {
      const res = await enviarFeedback('me encantó el picker de fotos');
      expect(peticiones).toHaveLength(1);
      expect(peticiones[0]!.metodo).toBe('POST');
      expect(peticiones[0]!.path).toBe('/feedback');
      expect(peticiones[0]!.cuerpoJson).toEqual({ texto: 'me encantó el picker de fotos' });
      expect(res).toEqual({ id: 1, ok: true });
    });

    it('manda `contexto` cuando se pasa', async () => {
      await enviarFeedback('algo raro', 'PantallaGastos');
      expect(peticiones[0]!.cuerpoJson).toEqual({ texto: 'algo raro', contexto: 'PantallaGastos' });
    });

    it('propaga el 422 (texto vacío) con su `detail`, mostrable tal cual', async () => {
      responder = () => respuesta(422, { detail: 'texto vacío' });
      await expect(enviarFeedback('')).rejects.toMatchObject({ status: 422, detail: 'texto vacío' });
    });

    it('propaga el 422 de texto demasiado largo', async () => {
      responder = () => respuesta(422, { detail: 'feedback demasiado largo (máx 2000 caracteres)' });
      await expect(enviarFeedback('x'.repeat(2001))).rejects.toBeInstanceOf(ApiError);
    });
  });

  describe('enviarFeedbackAudio (voz)', () => {
    const archivo = { nombre: 'voz.m4a', mime: 'audio/mp4', datos: 'file:///cache/voz.m4a' };

    it('manda POST /feedback/audio multipart con el campo `audio`', async () => {
      responder = () => respuesta(200, { id: 2, ok: true, transcripcion: 'me encantó la app' });
      const res = await enviarFeedbackAudio(archivo);
      expect(peticiones).toHaveLength(1);
      expect(peticiones[0]!.path).toBe('/feedback/audio');
      expect(peticiones[0]!.multipart?.campoArchivo).toBe('audio');
      expect(peticiones[0]!.multipart?.archivo).toEqual(archivo);
      expect(peticiones[0]!.multipart?.campos).toEqual({});
      expect(res).toEqual({ id: 2, ok: true, transcripcion: 'me encantó la app' });
    });

    it('manda `contexto` como campo del multipart cuando se pasa', async () => {
      await enviarFeedbackAudio(archivo, 'PantallaCuenta');
      expect(peticiones[0]!.multipart?.campos).toEqual({ contexto: 'PantallaCuenta' });
    });

    it('propaga el 413 (audio muy grande) — mismos códigos que /chat/audio', async () => {
      responder = () => respuesta(413, { detail: 'audio demasiado grande' });
      await expect(enviarFeedbackAudio(archivo)).rejects.toMatchObject({ status: 413 });
    });

    it('propaga el 422 (transcripción vacía)', async () => {
      responder = () => respuesta(422, { detail: 'no se entendió el audio' });
      await expect(enviarFeedbackAudio(archivo)).rejects.toMatchObject({ status: 422 });
    });
  });

  describe('listarFeedbackPropio (K-08, BL-J12) — GET /feedback', () => {
    it('normaliza los items y respeta el estado escuchado', async () => {
      responder = () =>
        respuesta(200, {
          items: [
            { id: 42, tipo: 'texto', texto: 'más rápido', contexto: 'chat', created_at: '2026-09-20T14:00:00Z', escuchado: true, escuchado_en: '2026-09-21T09:00:00Z' },
            { id: 41, tipo: 'voz', texto: 'agregar dark', contexto: null, created_at: '2026-09-19T10:00:00Z', escuchado: false, escuchado_en: null },
          ],
        });
      const items = await listarFeedbackPropio();
      expect(peticiones[0]!.metodo).toBe('GET');
      expect(peticiones[0]!.path).toBe('/feedback');
      expect(items).toEqual([
        { id: 42, tipo: 'texto', texto: 'más rápido', contexto: 'chat', creadoEn: '2026-09-20T14:00:00Z', escuchado: true, escuchadoEn: '2026-09-21T09:00:00Z' },
        { id: 41, tipo: 'voz', texto: 'agregar dark', contexto: null, creadoEn: '2026-09-19T10:00:00Z', escuchado: false, escuchadoEn: null },
      ]);
    });

    it('un item sin `escuchado` NO cuenta como escuchado; uno sin id/texto se descarta', async () => {
      responder = () => respuesta(200, { items: [{ id: 1, texto: 'a' }, { texto: 'sin id' }, { id: 2 }] });
      const items = await listarFeedbackPropio();
      expect(items).toHaveLength(1);
      expect(items[0]).toMatchObject({ id: 1, escuchado: false, escuchadoEn: null, tipo: 'texto' });
    });

    it('lista vacía o body sin items → []', async () => {
      responder = () => respuesta(200, {});
      expect(await listarFeedbackPropio()).toEqual([]);
    });

    it('propaga el error del backend (ApiError) para que la UI degrade sola', async () => {
      responder = () => respuesta(500, { detail: 'boom' });
      await expect(listarFeedbackPropio()).rejects.toBeInstanceOf(ApiError);
    });
  });
});

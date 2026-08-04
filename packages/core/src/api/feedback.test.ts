import { beforeEach, describe, expect, it } from 'vitest';

import { configurarApi } from './config';
import { ApiError } from './errors';
import { enviarFeedback, enviarFeedbackAudio } from './feedback';
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
});

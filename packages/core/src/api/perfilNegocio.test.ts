import { beforeEach, describe, expect, it } from 'vitest';

import { configurarApi } from './config';
import { ApiError } from './errors';
import type { HttpPort, PeticionHttp, RespuestaHttp } from './http';
import type { AlmacenTokens } from './tokens';
import { guardarPerfilNegocio, leerPerfilNegocio } from './perfilNegocio';

function respuesta(status: number, body: unknown): RespuestaHttp {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

/** El catch-all del SPA: `200` con HTML, `res.json()` explota. Ver `presupuestos.test.ts`. */
function respuestaHtmlDelSpa(): RespuestaHttp {
  return {
    ok: true,
    status: 200,
    json: async () => {
      throw new SyntaxError('Unexpected token < in JSON at position 0');
    },
  };
}

function crearTokensFake(): AlmacenTokens {
  return {
    async leerToken() { return 'tok-123'; },
    async guardarToken() {},
    async leerRefresh() { return null; },
    async guardarRefresh() {},
    async limpiar() {},
  };
}

function perfilCrudo(over: Record<string, unknown> = {}) {
  return {
    que_vende: 'Instalaciones eléctricas domiciliarias',
    a_quien: 'ambos',
    nombre_comercial: 'Electricidad Pérez',
    horario_atencion: 'Lunes a viernes de 8 a 17',
    formalidad: 'cercano',
    largo_respuesta: 'breve',
    nombre_copiloto: 'Copi',
    actualizado_en: '2026-07-21T22:14:03.120Z',
    ...over,
  };
}

describe('perfilNegocio.ts', () => {
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

  describe('leerPerfilNegocio', () => {
    it('normaliza a camelCase', async () => {
      responder = () => respuesta(200, { perfil: perfilCrudo() });

      const res = await leerPerfilNegocio();

      expect(res.status).toBe('ok');
      if (res.status !== 'ok') return;
      expect(res.perfil).toEqual({
        queVende: 'Instalaciones eléctricas domiciliarias',
        aQuien: 'ambos',
        nombreComercial: 'Electricidad Pérez',
        horarioAtencion: 'Lunes a viernes de 8 a 17',
        formalidad: 'cercano',
        largoRespuesta: 'breve',
        nombreCopiloto: 'Copi',
        actualizadoEn: '2026-07-21T22:14:03.120Z',
      });
    });

    it('🔴 perfil:null es OK con perfil null — el estado normal del primer día, no un error', async () => {
      responder = () => respuesta(200, { perfil: null });

      const res = await leerPerfilNegocio();

      // Las tres ramas son distintas a propósito: colapsar esta con `no_disponible` haría que el
      // tenant nuevo —el caso MÁS común— viera "todavía no está disponible" en vez del formulario.
      expect(res.status).toBe('ok');
      if (res.status === 'ok') expect(res.perfil).toBeNull();
    });

    it('un campo de texto vacío es válido: un perfil a medio llenar no bloquea nada', async () => {
      responder = () => respuesta(200, { perfil: perfilCrudo({ nombre_comercial: '', horario_atencion: '' }) });

      const res = await leerPerfilNegocio();

      expect(res.status).toBe('ok');
      if (res.status === 'ok') expect(res.perfil?.nombreComercial).toBe('');
    });

    it('un enum desconocido cae al default en vez de romper o mostrarse crudo', async () => {
      // Si el backend suma mañana un cuarto valor, esta app —ya desplegada— tiene que seguir
      // mostrando algo coherente, no un identificador interno en la pantalla.
      responder = () => respuesta(200, { perfil: perfilCrudo({ a_quien: 'marcianos', formalidad: 'gritado' }) });

      const res = await leerPerfilNegocio();

      expect(res.status).toBe('ok');
      if (res.status !== 'ok') return;
      expect(res.perfil?.aQuien).toBe('ambos');
      expect(res.perfil?.formalidad).toBe('cercano');
    });

    it('🔴 un 200 con el HTML del SPA es "no desplegado"', async () => {
      responder = () => respuestaHtmlDelSpa();
      expect((await leerPerfilNegocio()).status).toBe('no_disponible');
    });

    it('un 405 es "no desplegado"', async () => {
      responder = () => respuesta(405, { detail: 'Method Not Allowed' });
      expect((await leerPerfilNegocio()).status).toBe('no_disponible');
    });

    it('un 500 se propaga', async () => {
      responder = () => respuesta(500, { detail: 'boom' });
      await expect(leerPerfilNegocio()).rejects.toBeInstanceOf(ApiError);
    });
  });

  describe('guardarPerfilNegocio', () => {
    it('🔴 manda SÓLO las claves presentes — es lo que hace parcial a la actualización', async () => {
      responder = () => respuesta(200, { perfil: perfilCrudo() });

      await guardarPerfilNegocio({ formalidad: 'formal', nombreCopiloto: 'Asistente' });

      // Si viajaran las 7 claves, guardar "Personalidad" pisaría lo que el usuario escribió en
      // "Negocio" — las dos secciones se guardan por separado.
      expect(peticiones[0].cuerpoJson).toEqual({ formalidad: 'formal', nombre_copiloto: 'Asistente' });
    });

    it('un string vacío SÍ viaja: es como se vacía un campo a propósito', async () => {
      responder = () => respuesta(200, { perfil: perfilCrudo() });

      await guardarPerfilNegocio({ nombreComercial: '' });

      // Omitirlo lo dejaría como estaba; mandarlo vacío lo borra. La diferencia es del usuario.
      expect(peticiones[0].cuerpoJson).toEqual({ nombre_comercial: '' });
    });

    it('devuelve el perfil COMPLETO ya actualizado — no hace falta re-hacer el GET', async () => {
      responder = () => respuesta(200, { perfil: perfilCrudo({ formalidad: 'formal' }) });

      const res = await guardarPerfilNegocio({ formalidad: 'formal' });

      expect(res.status).toBe('ok');
      if (res.status === 'ok') {
        expect(res.perfil.formalidad).toBe('formal');
        expect(res.perfil.queVende).toBe('Instalaciones eléctricas domiciliarias');
      }
      expect(peticiones).toHaveLength(1);
    });

    it('un 400 de validación se propaga con su detail', async () => {
      responder = () => respuesta(400, { detail: 'no mandaste ningún campo' });
      await expect(guardarPerfilNegocio({})).rejects.toMatchObject({
        status: 400,
        detail: 'no mandaste ningún campo',
      });
    });
  });
});

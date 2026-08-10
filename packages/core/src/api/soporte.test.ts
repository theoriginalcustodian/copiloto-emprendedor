import { beforeEach, describe, expect, it } from 'vitest';

import { configurarApi } from './config';
import type { HttpPort, PeticionHttp, RespuestaHttp } from './http';
import { sendSoporteChat } from './soporte';
import type { AlmacenTokens } from './tokens';

/** Molde: `feedback.test.ts` — `HttpPort` FAKE, sin `fetch` real. */
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

describe('soporte.ts (SOP5, shape corregido 2026-08-10 — funcion pasó a ser obligatorio)', () => {
  let peticiones: PeticionHttp[];
  let responder: (p: PeticionHttp) => RespuestaHttp;

  beforeEach(() => {
    peticiones = [];
    responder = () => respuesta(200, { wf_id: 'wf-1', accepted: true, session_id: 'soporte:soporte_tecnico:sop:abc' });
    const http: HttpPort = {
      async enviar(p) {
        peticiones.push(p);
        return responder(p);
      },
    };
    configurarApi({ http, tokens: crearTokensFake() });
  });

  it('manda POST /soporte/chat — NO /chat', async () => {
    await sendSoporteChat({ session_id: 'sop:abc', text: 'no me deja facturar', funcion: 'soporte_tecnico', kind: 'text' });
    expect(peticiones).toHaveLength(1);
    expect(peticiones[0]!.metodo).toBe('POST');
    expect(peticiones[0]!.path).toBe('/soporte/chat');
  });

  it('el body es EXACTAMENTE {session_id, text, funcion, kind} — control diferencial del tipo angosto', async () => {
    // Si `SoporteChatRequest` alguna vez se reemplaza por el `ChatRequest` ancho (mode/payload/
    // contenido), este `toEqual` — que compara el objeto COMPLETO, no un subset — se pone rojo: es
    // la razón de ser de este test, no un detalle de implementación.
    await sendSoporteChat({ session_id: 'sop:abc', text: 'hola', funcion: 'como_uso_la_app', kind: 'text' });
    expect(peticiones[0]!.cuerpoJson).toEqual({
      session_id: 'sop:abc',
      text: 'hola',
      funcion: 'como_uso_la_app',
      kind: 'text',
    });
  });

  it('devuelve {wf_id, accepted, session_id} — el session_id es el channel_ref del SERVIDOR, no el que mandó el cliente', async () => {
    responder = () =>
      respuesta(200, { wf_id: 'wf-9', accepted: true, session_id: 'soporte:soporte_tecnico:sop:abc' });
    const res = await sendSoporteChat({ session_id: 'sop:abc', text: 'y', funcion: 'soporte_tecnico', kind: 'text' });
    // El namespacing (`soporte:{funcion}:{session_id}`) lo arma el backend -- el cliente NO lo
    // reconstruye, sólo lo usa tal cual llega para el próximo GET /reply.
    expect(res).toEqual({ wf_id: 'wf-9', accepted: true, session_id: 'soporte:soporte_tecnico:sop:abc' });
    expect(res.session_id).not.toBe('sop:abc'); // distinto del que se mandó -- si coincidiera, sería casualidad
  });

  it('propaga un error del servidor (5xx) sin tragarlo', async () => {
    responder = () => respuesta(500, { detail: 'error interno' });
    await expect(
      sendSoporteChat({ session_id: 'sop:x', text: 'y', funcion: 'soporte_tecnico', kind: 'text' }),
    ).rejects.toMatchObject({ status: 500 });
  });

  it('propaga el 400 de función inválida — CANALES_VALIDOS es cerrado server-side', async () => {
    responder = () => respuesta(400, { detail: "función inválida: 'otra_cosa'" });
    await expect(
      // @ts-expect-error -- el 400 es la red de seguridad server-side; el tipo ya lo impide en compile-time
      sendSoporteChat({ session_id: 'sop:x', text: 'y', funcion: 'otra_cosa', kind: 'text' }),
    ).rejects.toMatchObject({ status: 400 });
  });
});

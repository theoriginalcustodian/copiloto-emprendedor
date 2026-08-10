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

describe('soporte.ts (SOP5)', () => {
  let peticiones: PeticionHttp[];
  let responder: (p: PeticionHttp) => RespuestaHttp;

  beforeEach(() => {
    peticiones = [];
    responder = () => respuesta(200, { wf_id: 'wf-1', accepted: true });
    const http: HttpPort = {
      async enviar(p) {
        peticiones.push(p);
        return responder(p);
      },
    };
    configurarApi({ http, tokens: crearTokensFake() });
  });

  it('manda POST /soporte/chat — NO /chat', async () => {
    await sendSoporteChat({ session_id: 'sop:abc', text: 'no me deja facturar', kind: 'text' });
    expect(peticiones).toHaveLength(1);
    expect(peticiones[0]!.metodo).toBe('POST');
    expect(peticiones[0]!.path).toBe('/soporte/chat');
  });

  it('el body es EXACTAMENTE {session_id, text, kind} — control diferencial del tipo angosto', async () => {
    // Si `SoporteChatRequest` alguna vez se reemplaza por el `ChatRequest` ancho (mode/payload/
    // contenido), este `toEqual` — que compara el objeto COMPLETO, no un subset — se pone rojo: es
    // la razón de ser de este test, no un detalle de implementación.
    await sendSoporteChat({ session_id: 'sop:abc', text: 'hola', kind: 'text' });
    expect(peticiones[0]!.cuerpoJson).toEqual({ session_id: 'sop:abc', text: 'hola', kind: 'text' });
  });

  it('devuelve {wf_id, accepted} tal cual llega', async () => {
    responder = () => respuesta(200, { wf_id: 'wf-9', accepted: true });
    const res = await sendSoporteChat({ session_id: 'sop:x', text: 'y', kind: 'text' });
    expect(res).toEqual({ wf_id: 'wf-9', accepted: true });
  });

  it('propaga un error del servidor (5xx) sin tragarlo', async () => {
    responder = () => respuesta(500, { detail: 'error interno' });
    await expect(
      sendSoporteChat({ session_id: 'sop:x', text: 'y', kind: 'text' }),
    ).rejects.toMatchObject({ status: 500 });
  });
});

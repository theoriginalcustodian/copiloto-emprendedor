import { TIMEOUT_HTTP_MS } from '@copiloto/core';
import type { HttpPort, PeticionHttp, RespuestaHttp } from '@copiloto/core';

const BASE = import.meta.env.VITE_API_BASE ?? '';

/**
 * `HttpPort` de `@copiloto/core` (ADR-010) para `copiloto-web` — port directo de
 * `apps/mobile/src/adapters/http.web.ts` (mismo `HttpPort`, mismo caso Blob/multipart real de
 * navegador, mismo corte por timeout vía `AbortController`). Único cambio: `import.meta.env` (Vite)
 * en vez de `process.env` (Expo/Metro) para la base URL.
 */
export const httpWeb: HttpPort = {
  async enviar(p: PeticionHttp): Promise<RespuestaHttp> {
    let body: string | FormData | undefined;

    if (p.multipart) {
      const form = new FormData();
      for (const [k, v] of Object.entries(p.multipart.campos)) form.append(k, v);
      const { nombre, datos } = p.multipart.archivo;
      if (!(datos instanceof Blob)) {
        throw new Error(
          `httpWeb.enviar: se esperaba un Blob/File real en archivo.datos para el multipart, se ` +
            `recibió ${typeof datos === 'string' ? `un string ("${datos}")` : typeof datos} en su lugar.`,
        );
      }
      form.append(p.multipart.campoArchivo, datos, nombre);
      body = form;
      // NO seteamos Content-Type a mano -- el browser pone el boundary del multipart él mismo.
    } else if (p.cuerpoJson !== undefined) {
      body = JSON.stringify(p.cuerpoJson);
    }

    const corteMs = p.timeoutMs ?? TIMEOUT_HTTP_MS;
    const controlador = new AbortController();
    const alarma = corteMs > 0 ? setTimeout(() => controlador.abort(), corteMs) : undefined;
    try {
      const res = await fetch(`${BASE}${p.path}`, {
        method: p.metodo,
        headers: p.headers,
        body,
        signal: controlador.signal,
      });
      return { ok: res.ok, status: res.status, json: () => res.json() };
    } finally {
      if (alarma !== undefined) clearTimeout(alarma);
    }
  },
};

export default httpWeb;

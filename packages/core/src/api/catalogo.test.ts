import { beforeEach, describe, expect, it } from 'vitest';

import { listarCatalogo, pedirLinkDeVinculacion } from './catalogo';
import { configurarApi } from './config';
import type { HttpPort, PeticionHttp, RespuestaHttp } from './http';
import type { AlmacenTokens } from './tokens';

/** Molde: `afip.test.ts` — `HttpPort` FAKE, sin `fetch` real. */
function respuesta(status: number, body: unknown): RespuestaHttp {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
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

/** El shape REAL de una entrada, tomado de `catalog._entry` y verificado contra el servicio vivo. */
function servicioCrudo(over: Record<string, unknown> = {}) {
  return {
    key: 'googledrive',
    display_name: 'Google Drive',
    work_label: 'Archivos',
    category: 'Archivos',
    kind: 'composio',
    description: 'Creá y buscá archivos en tu Google Drive.',
    capabilities: ['Crear archivo', 'Buscar archivo'],
    connected: false,
    connect_path: '/composio/connect?service=googledrive',
    ...over,
  };
}

describe('catalogo.ts', () => {
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

  describe('listarCatalogo — GET /catalog', () => {
    it('normaliza a camelCase y conserva connected/connect_path', async () => {
      responder = () => respuesta(200, { services: [servicioCrudo({ connected: true })] });

      const res = await listarCatalogo();

      expect(res).toMatchObject({ status: 'ok' });
      const ok = res as Extract<typeof res, { status: 'ok' }>;
      expect(ok.servicios[0]).toEqual({
        key: 'googledrive',
        nombre: 'Google Drive',
        etiquetaTrabajo: 'Archivos',
        categoria: 'Archivos',
        kind: 'composio',
        descripcion: 'Creá y buscá archivos en tu Google Drive.',
        capacidades: ['Crear archivo', 'Buscar archivo'],
        conectado: true,
        connectPath: '/composio/connect?service=googledrive',
      });
    });

    /**
     * 🔴 **El `connect_path` NO se reconstruye en el cliente.** MercadoPago no es Composio y va por
     * `/mp/connect`: si alguien "simplificara" armando el path desde la `key`, este caso rompería —
     * y rompería justo en el servicio que cobra.
     */
    it('respeta el connect_path de MercadoPago, que no sigue el patrón de Composio', async () => {
      responder = () =>
        respuesta(200, {
          services: [servicioCrudo({ key: 'mercadopago', kind: 'payments', connect_path: '/mp/connect' })],
        });

      const res = await listarCatalogo();
      const ok = res as Extract<typeof res, { status: 'ok' }>;
      expect(ok.servicios[0]!.connectPath).toBe('/mp/connect');
    });

    it('un servicio sin capabilities no revienta: queda como lista vacía', async () => {
      responder = () => respuesta(200, { services: [{ ...servicioCrudo(), capabilities: undefined }] });

      const res = await listarCatalogo();
      const ok = res as Extract<typeof res, { status: 'ok' }>;
      expect(ok.servicios[0]!.capacidades).toEqual([]);
    });

    it('404 -> no_disponible (la ruta no existe en este deploy)', async () => {
      responder = () => respuesta(404, { detail: 'Not Found' });

      expect(await listarCatalogo()).toEqual({ status: 'no_disponible' });
    });
  });

  describe('pedirLinkDeVinculacion — GET del connect_path', () => {
    it('pide el path EXACTO que le dieron y devuelve la url', async () => {
      responder = () => respuesta(200, { url: 'https://connect.composio.dev/link/lk_abc' });

      const res = await pedirLinkDeVinculacion('/composio/connect?service=googledrive');

      expect(res).toEqual({ status: 'ok', url: 'https://connect.composio.dev/link/lk_abc' });
      expect(peticiones[0]!.path).toBe('/composio/connect?service=googledrive');
    });

    /**
     * ⚠️ El 400 de un toolkit inválido NO es `no_disponible`: el backend es fail-closed a propósito
     * (verificado en vivo el 2026-07-21 con un servicio inventado). Tratarlo como "todavía no está
     * disponible" ocultaría un bug del cliente —pedir un servicio que no existe— detrás de un copy
     * que dice "próximamente".
     */
    it('un 400 se propaga como error, no se disfraza de "no disponible"', async () => {
      responder = () => respuesta(400, { detail: 'unsupported toolkit' });

      await expect(pedirLinkDeVinculacion('/composio/connect?service=inventado')).rejects.toThrow();
    });
  });
});

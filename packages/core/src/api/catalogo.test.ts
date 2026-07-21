import { beforeEach, describe, expect, it } from 'vitest';

import { desconectarServicio, listarCatalogo, pedirLinkDeVinculacion, type ServicioCatalogo } from './catalogo';
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

  describe('desconectarServicio — DELETE', () => {
    function servicio(over: Partial<ServicioCatalogo> = {}): ServicioCatalogo {
      return {
        key: 'googledrive',
        nombre: 'Google Drive',
        etiquetaTrabajo: 'Archivos',
        categoria: 'Archivos',
        kind: 'composio',
        descripcion: '…',
        capacidades: [],
        conectado: true,
        connectPath: '/composio/connect?service=googledrive',
        ...over,
      };
    }

    /**
     * 🔴 **El `connection_id` NO viaja desde el cliente, y este test lo fija.**
     *
     * Mandar el id permitiría revocar la conexión de OTRO tenant probando ids (BOLA / OWASP
     * API1:2023) — quién es la conexión tiene que resolverlo el backend desde el JWT. El slug no
     * identifica nada ajeno, así que es lo único que puede viajar.
     *
     * Este repo ya pagó una vez que un guard cross-tenant se especificara y nunca se codificara
     * (ADR-013 §3.3.4, ~2 meses en prod). Acá el control vive en el test, no en la intención.
     */
    it('manda el SLUG, nunca un connection_id', async () => {
      responder = () => respuesta(200, { desconectado: true });

      await desconectarServicio(servicio());

      expect(peticiones[0]!.metodo).toBe('DELETE');
      expect(peticiones[0]!.path).toContain('service=googledrive');
      // Ni el path ni el cuerpo llevan un identificador de conexión.
      expect(peticiones[0]!.path).not.toMatch(/ca_|connection_id|conn_/);
      expect(peticiones[0]!.cuerpoJson).toBeUndefined();
    });

    /**
     * El path asumido es el ÚNICO supuesto del flujo, y deja de usarse solo en cuanto el backend
     * mande `disconnect_path` en el catálogo. Este test fija esa precedencia: si mañana acuerdan
     * otra forma, el cliente la toma sin tocar una línea de UI.
     */
    it('prefiere el disconnectPath del backend sobre el path asumido', async () => {
      responder = () => respuesta(200, { desconectado: true });

      await desconectarServicio(servicio({ disconnectPath: '/otra/forma/que/acordemos' }));

      expect(peticiones[0]!.path).toBe('/otra/forma/que/acordemos');
    });

    it('MercadoPago no sigue el patrón de Composio ni siquiera en el fallback', async () => {
      responder = () => respuesta(200, { desconectado: true });

      await desconectarServicio(servicio({ key: 'mercadopago', kind: 'payments' }));

      expect(peticiones[0]!.path).toBe('/mp/connection');
    });

    /**
     * 🔴 **El 404 al desconectar es ÉXITO idempotente, NO "no desplegado".** Verificado contra el
     * servicio vivo el 2026-07-21: el backend devuelve `404 "el tenant no tiene X conectado"` cuando
     * no había nada que revocar. El estado deseado —desconectado— ya se cumple, así que forzar al
     * usuario a "probá de nuevo" sobre una baja que de hecho está hecha sería mentirle. Pasa de
     * verdad cuando otro dispositivo ya desconectó el servicio.
     */
    it('404 -> ok: no había nada conectado, la baja es idempotente', async () => {
      responder = () => respuesta(404, { detail: "el tenant no tiene 'googledrive' conectado" });

      expect(await desconectarServicio(servicio())).toEqual({ status: 'ok' });
    });

    /**
     * 🔴 **El 405 sí es "el endpoint no existe en este deploy".** El front-door monta un catch-all
     * sólo GET para servir el SPA, así que una ruta no desplegada matchea ese handler y FastAPI
     * contesta 405 a un DELETE — nunca 404. Medido contra el servicio vivo. Es la distinción exacta
     * que separa "ya está desconectado" (404, éxito) de "no puedo desconectar acá" (405).
     */
    it('405 -> no_disponible: el catch-all del front-door, endpoint no desplegado', async () => {
      responder = () => respuesta(405, { detail: 'Method Not Allowed' });

      expect(await desconectarServicio(servicio())).toEqual({ status: 'no_disponible' });
    });

    /** Un slug inválido es 400 y NO es ninguno de los dos: se propaga como error de verdad. */
    it('400 (slug inválido) se propaga, no se disfraza de éxito ni de no-disponible', async () => {
      responder = () => respuesta(400, { detail: 'service inválido o desconocido' });

      await expect(desconectarServicio(servicio())).rejects.toThrow();
    });

    it('un 500 se propaga: desconectar no puede fallar en silencio', async () => {
      responder = () => respuesta(500, { detail: 'boom' });

      await expect(desconectarServicio(servicio())).rejects.toThrow();
    });
  });
});

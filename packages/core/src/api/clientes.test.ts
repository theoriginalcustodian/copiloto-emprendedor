import { beforeEach, describe, expect, it } from 'vitest';

import { configurarApi } from './config';
import type { HttpPort, PeticionHttp, RespuestaHttp } from './http';
import type { AlmacenTokens } from './tokens';
import { listarClientes, obtenerCliente } from './clientes';

/** Molde: `gastos.test.ts` — `HttpPort` FAKE, sin `fetch` real. */
function respuesta(status: number, body: unknown): RespuestaHttp {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

/** El catch-all del SPA: `200` con HTML, y `res.json()` **explota**. */
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

/** Forma medida contra el vivo el 2026-07-22 (`avance_backend..._clientes-hito1`). */
function clienteCrudo(over: Record<string, unknown> = {}) {
  return {
    id: 12,
    nombre: 'Panadería Los Tilos',
    doc_tipo: 80,
    doc_nro: '30712345678',
    condicion_iva: 1,
    domicilio: null,
    contacto: null,
    notas: null,
    origen: 'derivado',
    creado_en: '2026-07-22T10:00:00+00:00',
    ...over,
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

  describe('listarClientes', () => {
    it('normaliza a camelCase y lee `creado_en`, no `creado_at`', async () => {
      // El contrato decía `creado_at` y se corrigió antes de que existiera el código. Si el backend
      // volviera a mandar `creado_at`, este campo quedaría vacío SIN error — por eso está aserido.
      responder = () => respuesta(200, { clientes: [clienteCrudo()], total: 1 });

      const res = await listarClientes();

      expect(res.status).toBe('ok');
      if (res.status !== 'ok') return;
      const c = res.clientes[0];
      expect(c.creadoEn).toBe('2026-07-22T10:00:00+00:00');
      expect(c.docTipo).toBe(80);
      expect(c.docNro).toBe('30712345678');
      expect(c.origen).toBe('derivado');
    });

    it('una cartera vacía es `ok` con [], no un error — es el estado del primer día', async () => {
      responder = () => respuesta(200, { clientes: [], total: 0 });

      await expect(listarClientes()).resolves.toEqual({ status: 'ok', clientes: [], total: 0 });
    });

    it('manda `q` sólo si hay búsqueda', async () => {
      responder = () => respuesta(200, { clientes: [], total: 0 });

      await listarClientes({ q: 'panaderia' });
      expect(peticiones[0].path).toBe('/clientes?q=panaderia');

      await listarClientes({ q: '' });
      expect(peticiones[1].path).toBe('/clientes');
    });

    it('un 200 con el HTML del SPA es no_disponible, no una excepción de parseo', async () => {
      responder = () => respuestaHtmlDelSpa();

      await expect(listarClientes()).resolves.toEqual({ status: 'no_disponible' });
    });
  });

  describe('obtenerCliente', () => {
    it('404 es NO ENCONTRADO — semántico — y nunca "no disponible"', async () => {
      responder = () => respuesta(404, { detail: 'cliente no encontrado' });

      await expect(obtenerCliente(999999)).resolves.toEqual({ status: 'no_encontrado' });
    });

    it('las secciones vacías son un DATO, no un error ni un "no disponible"', async () => {
      // Llegan `[]` hasta el hito 3 del backend. Pintarlas como error haría que la ficha parezca
      // rota durante todo el tiempo que dure ese hito.
      responder = () =>
        respuesta(200, { cliente: clienteCrudo(), presupuestos: [], facturas: [] });

      const res = await obtenerCliente(12);

      expect(res.status).toBe('ok');
      if (res.status !== 'ok') return;
      expect(res.ficha.presupuestos).toEqual([]);
      expect(res.ficha.facturas).toEqual([]);
      expect(res.ficha.cliente.nombre).toBe('Panadería Los Tilos');
    });

    it('una operación sin `detalle` cae al concepto o al número, nunca a un renglón en blanco', async () => {
      responder = () =>
        respuesta(200, {
          cliente: clienteCrudo(),
          presupuestos: [{ id: 3, fecha: '2026-07-01', total: '45000.00', concepto: 'Instalación' }],
          facturas: [{ id: 7, fecha: '2026-07-02', total: '45000.00', numero: 14 }],
        });

      const res = await obtenerCliente(12);

      expect(res.status).toBe('ok');
      if (res.status !== 'ok') return;
      expect(res.ficha.presupuestos[0].detalle).toBe('Instalación');
      expect(res.ficha.facturas[0].detalle).toBe('N° 14');
      // Los totales siguen siendo STRING: es plata.
      expect(res.ficha.facturas[0].total).toBe('45000.00');
    });

    it('un 200 sin `cliente` es no_disponible', async () => {
      responder = () => respuesta(200, { detail: 'otra cosa' });

      await expect(obtenerCliente(12)).resolves.toEqual({ status: 'no_disponible' });
    });
  });
});

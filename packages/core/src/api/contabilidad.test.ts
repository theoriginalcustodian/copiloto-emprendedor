import { beforeEach, describe, expect, it } from 'vitest';

import { configurarApi } from './config';
import type { HttpPort, PeticionHttp, RespuestaHttp } from './http';
import type { AlmacenTokens } from './tokens';
import { obtenerResumenContabilidad } from './contabilidad';

/** Molde: `gastos.test.ts` — `HttpPort` FAKE, sin `fetch` real. */
function respuesta(status: number, body: unknown): RespuestaHttp {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

/** El catch-all del SPA: `200` con HTML, `res.json()` explota. Es el estado REAL hoy — el endpoint
 *  todavía no está desplegado. */
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

/** Forma del §4 del contrato — `data` NO está medida contra el vivo (el endpoint no existe todavía). */
function resumenCrudo(over: Record<string, unknown> = {}) {
  return {
    periodo: '2026-07',
    caja: { entro: '150000.00', salio: '45000.00', queda: '105000.00', mes_anterior: null },
    gastos: { por_categoria: [{ categoria: 'mercaderia', total: '30000.00', porcentaje: 66.6 }] },
    facturado: { periodo: '80000.00', doce_meses: '400000.00', tope: null },
    clientes: [{ cliente_ref: 12, nombre: 'Juan Pérez', total: '80000.00' }],
    ...over,
  };
}

describe('contabilidad', () => {
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

  describe('obtenerResumenContabilidad', () => {
    it('normaliza las 4 secciones a camelCase, con la plata como STRING', async () => {
      responder = () => respuesta(200, resumenCrudo());

      const res = await obtenerResumenContabilidad();

      expect(res.status).toBe('ok');
      if (res.status !== 'ok') return;
      expect(res.resumen.periodo).toBe('2026-07');
      expect(res.resumen.caja).toEqual({ entro: '150000.00', salio: '45000.00', queda: '105000.00', mesAnterior: null });
      expect(res.resumen.gastos.porCategoria[0]).toEqual({ categoria: 'mercaderia', total: '30000.00', porcentaje: 66.6 });
      expect(res.resumen.facturado).toEqual({ periodo: '80000.00', doceMeses: '400000.00', tope: null });
      expect(res.resumen.clientes[0]).toEqual({ clienteRef: 12, nombre: 'Juan Pérez', total: '80000.00' });
      expect(typeof res.resumen.caja.queda).toBe('string');
    });

    it('`queda` NEGATIVO se transporta tal cual — un mes en rojo es información, no un error', async () => {
      responder = () => respuesta(200, resumenCrudo({ caja: { entro: '10000.00', salio: '50000.00', queda: '-40000.00' } }));

      const res = await obtenerResumenContabilidad();

      expect(res.status).toBe('ok');
      if (res.status !== 'ok') return;
      expect(res.resumen.caja.queda).toBe('-40000.00');
    });

    it('`mes_anterior` se normaliza si viene, y queda `null` si no', async () => {
      responder = () => respuesta(
        200,
        resumenCrudo({ caja: { entro: '1', salio: '2', queda: '-1', mes_anterior: { entro: '5', salio: '3', queda: '2' } } }),
      );

      const res = await obtenerResumenContabilidad();

      expect(res.status).toBe('ok');
      if (res.status !== 'ok') return;
      expect(res.resumen.caja.mesAnterior).toEqual({ entro: '5', salio: '3', queda: '2' });
    });

    it('🔴 sin escala vigente, `tope: null` — y el resumen sigue en 200, no se cae', async () => {
      responder = () => respuesta(200, resumenCrudo({ facturado: { periodo: '1', doce_meses: '2', tope: null } }));

      const res = await obtenerResumenContabilidad();

      expect(res.status).toBe('ok');
      if (res.status !== 'ok') return;
      expect(res.resumen.facturado.tope).toBeNull();
    });

    it('con escala vigente, `tope` trae valor/porcentaje/semáforo', async () => {
      responder = () => respuesta(
        200,
        resumenCrudo({ facturado: { periodo: '1', doce_meses: '2', tope: { valor: '30000000', porcentaje: 40, semaforo: 'verde' } } }),
      );

      const res = await obtenerResumenContabilidad();

      expect(res.status).toBe('ok');
      if (res.status !== 'ok') return;
      expect(res.resumen.facturado.tope).toEqual({ valor: '30000000', porcentaje: 40, semaforo: 'verde' });
    });

    it('sin datos, el backend responde 200 con secciones vacías — nunca 404', async () => {
      responder = () => respuesta(200, {
        periodo: '2026-07',
        caja: { entro: '0.00', salio: '0.00', queda: '0.00', mes_anterior: null },
        gastos: { por_categoria: [] },
        facturado: { periodo: '0.00', doce_meses: '0.00', tope: null },
        clientes: [],
      });

      const res = await obtenerResumenContabilidad();

      expect(res.status).toBe('ok');
      if (res.status !== 'ok') return;
      expect(res.resumen.gastos.porCategoria).toEqual([]);
      expect(res.resumen.clientes).toEqual([]);
    });

    it('`clientes: []` cuando la función de Clientes no está desplegada — no rompe las otras 3 secciones', async () => {
      responder = () => respuesta(200, resumenCrudo({ clientes: [] }));

      const res = await obtenerResumenContabilidad();

      expect(res.status).toBe('ok');
      if (res.status !== 'ok') return;
      expect(res.resumen.clientes).toEqual([]);
      expect(res.resumen.caja.entro).toBe('150000.00');
    });

    it('una categoría desconocida cae en "otros", igual que en gastos', async () => {
      responder = () => respuesta(200, resumenCrudo({ gastos: { por_categoria: [{ categoria: 'cripto', total: '1', porcentaje: 100 }] } }));

      const res = await obtenerResumenContabilidad();

      expect(res.status).toBe('ok');
      if (res.status !== 'ok') return;
      expect(res.resumen.gastos.porCategoria[0].categoria).toBe('otros');
    });

    it('🔴 el endpoint todavía no existe: un 200 con HTML del SPA es "no disponible", no una excepción', async () => {
      responder = () => respuestaHtmlDelSpa();

      await expect(obtenerResumenContabilidad()).resolves.toEqual({ status: 'no_disponible' });
    });

    it('un 405 es "no disponible" (ruta no desplegada)', async () => {
      responder = () => respuesta(405, { detail: 'Method Not Allowed' });

      await expect(obtenerResumenContabilidad()).resolves.toEqual({ status: 'no_disponible' });
    });

    it('manda `?periodo=` cuando se pide, y nada cuando no', async () => {
      responder = () => respuesta(200, resumenCrudo());

      await obtenerResumenContabilidad('2026-06');
      expect(peticiones[0].path).toBe('/contabilidad/resumen?periodo=2026-06');

      await obtenerResumenContabilidad();
      expect(peticiones[1].path).toBe('/contabilidad/resumen');
    });
  });
});

import { beforeEach, describe, expect, it } from 'vitest';

import { configurarApi } from './config';
import { ApiError } from './errors';
import type { HttpPort, PeticionHttp, RespuestaHttp } from './http';
import type { AlmacenTokens } from './tokens';
import {
  CATEGORIAS_GASTO,
  crearGasto,
  esCategoriaValida,
  listarGastos,
  obtenerGasto,
  obtenerResumenGastos,
} from './gastos';

/** Molde: `presupuestos.test.ts` — `HttpPort` FAKE, sin `fetch` real. */
function respuesta(status: number, body: unknown): RespuestaHttp {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

/**
 * El catch-all del SPA: `200` con HTML. `res.json()` **explota** — no devuelve un objeto raro.
 * Simularlo devolviendo `{}` probaría una rama que en producción no ocurre.
 */
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

/** Forma EXACTA medida contra el vivo el 2026-07-21 (`scratchpad/sonda_gastos.py`, 28/28). */
function gastoCrudo(over: Record<string, unknown> = {}) {
  return {
    id: 2,
    monto: '15000.50',
    monto_sugerido: null,
    fecha: '2026-07-21',
    categoria: 'mercaderia',
    proveedor: 'Distribuidora Sur',
    medio_pago: 'efectivo',
    descripcion: 'quince mil de mercadería en la distribuidora',
    origen: 'voz',
    // ⚠️ Con offset, NO con `Z` — así llega del backend real. El ejemplo del contrato decía `Z`.
    creado_en: '2026-07-22T01:41:08.185511+00:00',
    ...over,
  };
}

describe('gastos.ts', () => {
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

  describe('categorías', () => {
    it('son ocho y cerradas', () => {
      expect(CATEGORIAS_GASTO).toHaveLength(8);
      expect(esCategoriaValida('mercaderia')).toBe(true);
    });

    it('rechaza una categoría inventada — el backend devuelve 400 y acá no se la deja pasar', () => {
      // Si el cliente admitiera valores libres, «mercadería» y «stock» quedarían como rubros
      // distintos y el resumen dejaría de responder «¿en qué se me va la plata?».
      expect(esCategoriaValida('stock')).toBe(false);
      expect(esCategoriaValida('')).toBe(false);
    });
  });

  describe('listarGastos', () => {
    it('normaliza a camelCase con el monto como STRING y el id entero', async () => {
      responder = () => respuesta(200, { gastos: [gastoCrudo()], total: 37 });

      const res = await listarGastos();

      expect(res.status).toBe('ok');
      if (res.status !== 'ok') return;
      const g = res.gastos[0];
      expect(g.id).toBe(2);
      // 🔴 El monto NO se convierte a número en ningún punto del camino.
      expect(g.monto).toBe('15000.50');
      expect(typeof g.monto).toBe('string');
      expect(g.medioPago).toBe('efectivo');
      expect(g.origen).toBe('voz');
      expect(g.montoSugerido).toBeNull();
      expect(g.creadoEn).toBe('2026-07-22T01:41:08.185511+00:00');
    });

    it('`total` es el conteo del TENANT, no el largo de la página', async () => {
      // Una página de 1 con 37 gastos en total: confundirlos haría que la pantalla diga "1 gasto"
      // cuando hay 37, y nadie lo notaría porque el número existe y es plausible.
      responder = () => respuesta(200, { gastos: [gastoCrudo()], total: 37 });

      const res = await listarGastos({ limit: 1 });

      expect(res.status).toBe('ok');
      if (res.status !== 'ok') return;
      expect(res.gastos).toHaveLength(1);
      expect(res.total).toBe(37);
      expect(peticiones[0].path).toBe('/gastos?limit=1');
    });

    it('un tenant sin gastos devuelve [] y eso NO es un error', async () => {
      responder = () => respuesta(200, { gastos: [], total: 0 });

      const res = await listarGastos();

      expect(res.status).toBe('ok');
      if (res.status !== 'ok') return;
      expect(res.gastos).toEqual([]);
      expect(res.total).toBe(0);
    });

    it('una categoría desconocida del backend cae en "otros" en vez de romper la pantalla', async () => {
      responder = () => respuesta(200, { gastos: [gastoCrudo({ categoria: 'cripto' })], total: 1 });

      const res = await listarGastos();

      expect(res.status).toBe('ok');
      if (res.status !== 'ok') return;
      expect(res.gastos[0].categoria).toBe('otros');
    });

    it('un 200 con el HTML del SPA es "no disponible", no una excepción de parseo', async () => {
      // El catch-all `@app.get("/{full_path}")` sirve el SPA sobre cualquier ruta inexistente: el
      // status diría 200 y la pantalla explotaría en `res.json()` en vez de avisar.
      responder = () => respuestaHtmlDelSpa();

      await expect(listarGastos()).resolves.toEqual({ status: 'no_disponible' });
    });

    it('un 405 es "no disponible" (ruta no desplegada)', async () => {
      responder = () => respuesta(405, { detail: 'Method Not Allowed' });

      await expect(listarGastos()).resolves.toEqual({ status: 'no_disponible' });
    });
  });

  describe('obtenerGasto', () => {
    it('404 es NO ENCONTRADO — semántico — y nunca "no disponible"', async () => {
      // Es la distinción que el contrato §7 marca en rojo: en este endpoint el 404 significa "no
      // existe para este tenant" (incluye el id de otro). Tratarlo como "no desplegado" le diría
      // «todavía no está disponible» sobre un endpoint vivo contestando bien.
      responder = () => respuesta(404, { detail: 'no encontrado' });

      await expect(obtenerGasto(999)).resolves.toEqual({ status: 'no_encontrado' });
    });

    it('devuelve el gasto normalizado', async () => {
      responder = () => respuesta(200, { gasto: gastoCrudo() });

      const res = await obtenerGasto(2);

      expect(res.status).toBe('ok');
      if (res.status !== 'ok') return;
      expect(res.gasto.proveedor).toBe('Distribuidora Sur');
    });
  });

  describe('crearGasto', () => {
    it('manda sólo monto y origen cuando no hay más datos — y NO manda `fecha`', async () => {
      // 🔴 Omitir `fecha` es lo que deja que el backend ponga HOY EN ARGENTINA. Mandar `null` o una
      // fecha calculada del lado del cliente reintroduce el bug de zona horaria: a las 21:30 de
      // Argentina, `new Date().toISOString()` ya es mañana, y los días 30/31 caen en el mes
      // siguiente — o sea, en el resumen, que es la recompensa de la función.
      responder = () => respuesta(201, { gasto: gastoCrudo() });

      await crearGasto({ monto: '15000.50', origen: 'manual' });

      expect(peticiones[0].cuerpoJson).toEqual({ monto: '15000.50', origen: 'manual' });
      expect(peticiones[0].cuerpoJson).not.toHaveProperty('fecha');
    });

    it('traduce a snake_case sólo las claves presentes', async () => {
      responder = () => respuesta(201, { gasto: gastoCrudo() });

      await crearGasto({
        monto: '900.00',
        origen: 'foto',
        categoria: 'transporte',
        medioPago: 'tarjeta',
        montoSugerido: '899.00',
      });

      expect(peticiones[0].cuerpoJson).toEqual({
        monto: '900.00',
        origen: 'foto',
        categoria: 'transporte',
        medio_pago: 'tarjeta',
        monto_sugerido: '899.00',
      });
    });

    it('propaga el 400 con su detail, que es mostrable tal cual', async () => {
      // El backend valida a mano justamente para dar `"falta monto"` en vez del array de pydantic.
      responder = () => respuesta(400, { detail: 'falta monto' });

      await expect(crearGasto({ monto: '', origen: 'manual' })).rejects.toBeInstanceOf(ApiError);
    });

    it('405 es "no disponible" y no se confunde con un error de validación', async () => {
      responder = () => respuesta(405, { detail: 'Method Not Allowed' });

      await expect(crearGasto({ monto: '1', origen: 'manual' })).resolves.toEqual({
        status: 'no_disponible',
      });
    });
  });

  describe('obtenerResumenGastos', () => {
    it('normaliza el resumen con los totales como string y el porcentaje como número', async () => {
      responder = () =>
        respuesta(200, {
          periodo: '2026-07',
          total: '340000.00',
          por_categoria: [
            { categoria: 'mercaderia', total: '136000.00', porcentaje: 40 },
            { categoria: 'servicios', total: '68000.00', porcentaje: 20 },
          ],
          mes_anterior: '295000.00',
        });

      const res = await obtenerResumenGastos();

      expect(res.status).toBe('ok');
      if (res.status !== 'ok') return;
      expect(res.resumen.total).toBe('340000.00');
      expect(typeof res.resumen.total).toBe('string');
      expect(res.resumen.porCategoria[0].porcentaje).toBe(40);
      expect(res.resumen.mesAnterior).toBe('295000.00');
    });

    it('un mes sin gastos es 200 con total "0.00" — un DATO, no una ausencia', async () => {
      responder = () =>
        respuesta(200, { periodo: '2026-07', total: '0.00', por_categoria: [], mes_anterior: null });

      const res = await obtenerResumenGastos();

      expect(res.status).toBe('ok');
      if (res.status !== 'ok') return;
      expect(res.resumen.total).toBe('0.00');
      expect(res.resumen.porCategoria).toEqual([]);
      expect(res.resumen.mesAnterior).toBeNull();
    });

    it('NO normaliza los porcentajes: los devuelve tal cual aunque no sumen 100', async () => {
      // Tres categorías iguales dan 33.3 tres veces = 99.9. El contrato avisa que no está
      // garantizado que cierren; normalizar acá escondería el hueco y quien dibuje barras creería
      // que puede confiar. La normalización es decisión de quien dibuja, con el dato a la vista.
      responder = () =>
        respuesta(200, {
          periodo: '2026-07',
          total: '300.00',
          por_categoria: [
            { categoria: 'mercaderia', total: '100.00', porcentaje: 33.3 },
            { categoria: 'servicios', total: '100.00', porcentaje: 33.3 },
            { categoria: 'otros', total: '100.00', porcentaje: 33.3 },
          ],
          mes_anterior: null,
        });

      const res = await obtenerResumenGastos();

      expect(res.status).toBe('ok');
      if (res.status !== 'ok') return;
      const suma = res.resumen.porCategoria.reduce((a, c) => a + c.porcentaje, 0);
      expect(suma).toBeCloseTo(99.9, 5);
    });

    it('un 200 que NO trae "periodo" es no_disponible — el caso del 422 int_parsing', async () => {
      // Si `/gastos/resumen` se declarara DESPUÉS de `/gastos/{gasto_id}`, el segmento "resumen"
      // caería en la ruta del id. Validar por forma evita mostrar basura si eso regresa.
      responder = () =>
        respuesta(200, { detail: [{ type: 'int_parsing', loc: ['path', 'gasto_id'] }] });

      await expect(obtenerResumenGastos()).resolves.toEqual({ status: 'no_disponible' });
    });

    it('pasa el período por query cuando se pide uno', async () => {
      responder = () =>
        respuesta(200, { periodo: '2026-06', total: '0.00', por_categoria: [], mes_anterior: null });

      await obtenerResumenGastos('2026-06');

      expect(peticiones[0].path).toBe('/gastos/resumen?periodo=2026-06');
    });
  });
});

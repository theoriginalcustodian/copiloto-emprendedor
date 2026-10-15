import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it } from 'vitest';

import { configurarApi } from './config';
import type { HttpPort, PeticionHttp, RespuestaHttp } from './http';
import type { AlmacenTokens } from './tokens';
import { etiquetaDeDestino, listarTrabajosImputables, mismoTrabajo } from './trabajos';

/** Molde: `gastos.test.ts` — `HttpPort` FAKE, sin `fetch` real. */
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

function presupuestoCrudo(over: Record<string, unknown> = {}) {
  return {
    id: 12,
    numero: 7,
    fecha: '2026-10-01T10:00:00+00:00',
    concepto: 'Panaderia del barrio',
    receptor: { nombre: 'Panaderia', documento: null },
    items: [],
    cantidad_items: 3,
    total: '90000.00',
    moneda: 'ARS',
    doc_link: null,
    doc_id: null,
    sheet_fila: null,
    reemplaza_a: null,
    reemplazado_por: null,
    factura_id: null,
    facturado: false,
    ...over,
  };
}

/**
 * `listarTrabajosImputables` — **la lista que hace elegible un trabajo**, y la unica capa que sabe
 * que no existe `GET /trabajos`.
 *
 * Lo que estos tests fijan no es el formato: es que **ninguna de las dos fuentes alcanza sola**. El
 * generador del grafico de margen devuelve solo los trabajos *«con al menos un cobro o un gasto
 * imputado»* (`apps/copiloto/inteligencia_queries.py:481`), o sea deja afuera el presupuesto nuevo
 * al que se le quiere imputar el PRIMER gasto — el caso principal. Un selector construido con una
 * sola fuente sale vacio justo cuando se lo necesita, y vacio se lee como «no tenes trabajos».
 */
describe('listarTrabajosImputables -- dos fuentes porque ninguna alcanza sola', () => {
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

  it('🔴 un presupuesto SIN cobro ni gasto imputado se puede elegir: el grafico de margen no lo trae', async () => {
    responder = (p) => {
      if (p.path.startsWith('/presupuestos')) return respuesta(200, { presupuestos: [presupuestoCrudo()] });
      // Exactamente lo que devuelve el backend para un tenant cuyo unico trabajo no tiene
      // movimiento: la lista vacia. Si esta fuera la unica fuente, el selector estaria vacio.
      return respuesta(200, { tipo: 'barras', trabajos: [], sin_ingreso: [] });
    };

    const res = await listarTrabajosImputables();

    expect(res.status).toBe('ok');
    if (res.status !== 'ok') return;
    expect(res.trabajos).toEqual([
      { eslabon: 'presupuesto', ref: 12, etiqueta: 'Panaderia del barrio · #7' },
    ]);
  });

  it('🔴 una factura suelta (sin presupuesto) tambien se puede elegir: esa la trae SOLO el grafico', async () => {
    responder = (p) => {
      if (p.path.startsWith('/presupuestos')) return respuesta(200, { presupuestos: [] });
      return respuesta(200, {
        tipo: 'barras',
        trabajos: [{ eslabon: 'comprobante', ref: 90, etiqueta: 'Factura B 0001-00000090', cobrado: '50000.00', gastado: '0.00', margen: '50000.00', gastos_imputados: 0 }],
        sin_ingreso: [{ eslabon: 'cobro', ref: 4, etiqueta: 'Cobro suelto', gastado: '1000.00', gastos_imputados: 1 }],
      });
    };

    const res = await listarTrabajosImputables();

    expect(res.status).toBe('ok');
    if (res.status !== 'ok') return;
    // Los sin-ingreso TAMBIEN son destinos validos: imputar un gasto no exige que el trabajo haya
    // cobrado — al contrario, es el caso en que el margen todavia se puede corregir.
    expect(res.trabajos.map((t) => `${t.eslabon}:${t.ref}`)).toEqual(['comprobante:90', 'cobro:4']);
  });

  it('el mismo trabajo en las dos fuentes aparece UNA vez, y gana la etiqueta del presupuesto', async () => {
    responder = (p) => {
      if (p.path.startsWith('/presupuestos')) return respuesta(200, { presupuestos: [presupuestoCrudo()] });
      return respuesta(200, {
        tipo: 'barras',
        trabajos: [{ eslabon: 'presupuesto', ref: 12, etiqueta: 'Panaderia · 2026-10-01', cobrado: '90000.00', gastado: '0.00', margen: '90000.00', gastos_imputados: 0 }],
        sin_ingreso: [],
      });
    };

    const res = await listarTrabajosImputables();

    expect(res.status).toBe('ok');
    if (res.status !== 'ok') return;
    expect(res.trabajos).toHaveLength(1);
    expect(res.trabajos[0]!.etiqueta).toBe('Panaderia del barrio · #7');
  });

  it('🔴 un presupuesto REEMPLAZADO no se ofrece: cuatro filas del mismo trabajo y ninguna forma de saber cual vale', async () => {
    responder = (p) => {
      if (p.path.startsWith('/presupuestos')) {
        return respuesta(200, {
          presupuestos: [
            presupuestoCrudo({ id: 12, numero: 7, reemplazado_por: 13 }),
            presupuestoCrudo({ id: 13, numero: 8, concepto: 'Panaderia del barrio', reemplaza_a: 12 }),
          ],
        });
      }
      return respuesta(200, { tipo: 'barras', trabajos: [], sin_ingreso: [] });
    };

    const res = await listarTrabajosImputables();

    expect(res.status).toBe('ok');
    if (res.status !== 'ok') return;
    expect(res.trabajos.map((t) => t.ref)).toEqual([13]);
  });

  it('con UNA fuente caida devuelve lo que la otra tiene -- media lista es util', async () => {
    responder = (p) => {
      if (p.path.startsWith('/presupuestos')) return respuesta(200, { presupuestos: [presupuestoCrudo()] });
      // 503: el modulo de inteligencia no esta en este deploy.
      return respuesta(503, { detail: 'no disponible' });
    };

    const res = await listarTrabajosImputables();

    expect(res.status).toBe('ok');
    if (res.status !== 'ok') return;
    expect(res.trabajos).toHaveLength(1);
  });

  it('🔴 con las DOS caidas es no_disponible, no una lista vacia', async () => {
    // La diferencia importa: `[]` se muestra como «no tenes trabajos todavia» —una afirmacion sobre
    // los datos del emprendedor— y `no_disponible` como «no pudimos traerlos». Decir lo primero
    // cuando pasa lo segundo es inventar.
    responder = () => respuesta(503, { detail: 'no disponible' });

    await expect(listarTrabajosImputables()).resolves.toEqual({ status: 'no_disponible' });
  });

  it('una etiqueta vacia del wire cae al nombre corto: una fila sin texto no se puede elegir', async () => {
    responder = (p) => {
      if (p.path.startsWith('/presupuestos')) return respuesta(200, { presupuestos: [] });
      return respuesta(200, {
        tipo: 'barras',
        trabajos: [{ eslabon: 'cobro', ref: 5, etiqueta: '   ', cobrado: '1.00', gastado: '0.00', margen: '1.00', gastos_imputados: 0 }],
        sin_ingreso: [],
      });
    };

    const res = await listarTrabajosImputables();

    expect(res.status).toBe('ok');
    if (res.status !== 'ok') return;
    expect(res.trabajos[0]!.etiqueta).toBe('Cobro #5');
  });

  it('pide los presupuestos VIGENTES y el grafico sin filtro de periodo', async () => {
    responder = (p) =>
      p.path.startsWith('/presupuestos')
        ? respuesta(200, { presupuestos: [] })
        : respuesta(200, { tipo: 'barras', trabajos: [], sin_ingreso: [] });

    await listarTrabajosImputables();

    const paths = peticiones.map((p) => p.path).sort();
    // 200 = LIMITE_LISTADO_PRESUPUESTOS (el máximo del backend). Con 50 un emprendedor con más de 50
    // presupuestos vigentes no veía los demás como opción y nadie se lo decía.
    expect(paths).toEqual(['/inteligencia/graficos/margen-trabajo', '/presupuestos?limit=200']);
  });

  it('🔴 `truncado` avisa cuando los presupuestos NO entraron todos: «hay 1 de 3», no «hay 1»', async () => {
    responder = (p) =>
      p.path.startsWith('/presupuestos')
        ? respuesta(200, { presupuestos: [presupuestoCrudo()], total: 3 })
        : respuesta(200, { tipo: 'barras', trabajos: [], sin_ingreso: [] });

    const res = await listarTrabajosImputables();

    expect(res.status).toBe('ok');
    if (res.status !== 'ok') return;
    expect(res.trabajos).toHaveLength(1);
    expect(res.truncado).toBe(true);
  });

  it('`truncado` es false cuando el total coincide, aunque la página esté llena', async () => {
    responder = (p) =>
      p.path.startsWith('/presupuestos')
        ? respuesta(200, { presupuestos: [presupuestoCrudo()], total: 1 })
        : respuesta(200, { tipo: 'barras', trabajos: [], sin_ingreso: [] });

    const res = await listarTrabajosImputables();

    expect(res.status === 'ok' && res.truncado).toBe(false);
  });

  it('`truncado` es false si la fuente de presupuestos cayó: no hay nada contra qué comparar', async () => {
    responder = (p) =>
      p.path.startsWith('/presupuestos')
        ? respuesta(503, { detail: 'no disponible' })
        : respuesta(200, { tipo: 'barras', trabajos: [], sin_ingreso: [] });

    const res = await listarTrabajosImputables();

    expect(res.status === 'ok' && res.truncado).toBe(false);
  });
});

describe('etiquetaDeDestino / mismoTrabajo', () => {
  it('nombra los tres eslabones con la palabra que el emprendedor usa', () => {
    expect(etiquetaDeDestino({ eslabon: 'presupuesto', ref: 12 })).toBe('Presupuesto #12');
    // «comprobante» es la palabra del backend; la del emprendedor es «factura» (ver CONTEXT.md).
    expect(etiquetaDeDestino({ eslabon: 'comprobante', ref: 90 })).toBe('Factura #90');
    expect(etiquetaDeDestino({ eslabon: 'cobro', ref: 4 })).toBe('Cobro #4');
  });

  it('compara por eslabon Y ref -- el mismo numero en dos eslabones NO es el mismo trabajo', () => {
    expect(mismoTrabajo({ eslabon: 'presupuesto', ref: 12 }, { eslabon: 'presupuesto', ref: 12 })).toBe(true);
    expect(mismoTrabajo({ eslabon: 'presupuesto', ref: 12 }, { eslabon: 'comprobante', ref: 12 })).toBe(false);
    expect(mismoTrabajo(null, null)).toBe(true);
    expect(mismoTrabajo({ eslabon: 'cobro', ref: 1 }, null)).toBe(false);
  });
});

describe('trabajos.ts -- el tope del listado NO es un literal (SM-D2 punto 3)', () => {
  // Un `limit: 50` hardcodeado ya cortó en silencio los trabajos del 51 en adelante (los mas viejos, justo
  // los que la alerta «se enfria» existe para encontrar). El tope tiene UN dueño: LIMITE_LISTADO_PRESUPUESTOS.
  const LITERAL_DE_TOPE = /\blimit\s*:\s*\d+/;
  const fuente = readFileSync(fileURLToPath(new URL('./trabajos.ts', import.meta.url)), 'utf-8');

  it('control positivo: el detector SI caza un literal de tope inyectado', () => {
    expect(LITERAL_DE_TOPE.test("listarPresupuestos({ limit: 50 })")).toBe(true);
    expect(LITERAL_DE_TOPE.test("listarPresupuestos({ limit:200 })")).toBe(true);
  });

  it('trabajos.ts no pide un tope con numero literal y usa el importado', () => {
    expect(LITERAL_DE_TOPE.test(fuente)).toBe(false);
    expect(fuente).toContain('limit: LIMITE_LISTADO_PRESUPUESTOS');
  });
});

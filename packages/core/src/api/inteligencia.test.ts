import { beforeEach, describe, expect, it } from 'vitest';

import {
  leerGraficoCategorias,
  leerGraficoEntroVsSalio,
  leerGraficoFacturacion,
  leerGraficoMargenTrabajo,
  leerPortada,
  preguntarInteligencia,
} from './inteligencia';
import { configurarApi } from './config';
import type { HttpPort, PeticionHttp, RespuestaHttp } from './http';
import type { AlmacenTokens } from './tokens';

/**
 * `GET /inteligencia/portada` — el resumen del negocio. Molde del arnés: `conceptos.test.ts`.
 *
 * **[CONNECT] — el endpoint NO está publicado todavía.** Estos tests fijan el contrato §3.1 y, sobre
 * todo, las tres cosas que un cliente de KPIs no puede hacer mal: (1) no confundir *«no desplegado»*
 * con *«negocio en cero»*, (2) no pintar `null` como `0`, (3) tratar la plata como string.
 */
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

let responder: (p: PeticionHttp) => RespuestaHttp;

const PORTADA_VIVA = {
  caja: { saldo: '184000.00', moneda: 'ARS' },
  mes: { ingresos: '95000.00', gastos: '31000.00', rentabilidad: '64000.00', facturado: '120000.00', cobrado: '90000.00' },
  serie_mensual: [
    { mes: '2026-03', ingresos: '80000.00', gastos: '20000.00' },
    { mes: '2026-04', ingresos: '95000.00', gastos: '31000.00' },
  ],
  mejores_clientes: [
    { cliente: 'Panadería Los Tilos', total: '48000.00' },
    { cliente: 'Kiosco 24hs', total: '22000.00' },
  ],
  por_cobrar: { total: '30000.00', vencido: '12000.00' },
};

beforeEach(() => {
  responder = () => respuesta(200, {});
  const http: HttpPort = { async enviar(p) { return responder(p); } };
  configurarApi({ http, tokens: crearTokensFake() });
});

describe('leerPortada — el camino bueno', () => {
  it('trae los cinco números del mes, la serie y los mejores clientes, con la plata como string', async () => {
    responder = () => respuesta(200, PORTADA_VIVA);

    const res = await leerPortada();

    expect(res.status).toBe('ok');
    if (res.status !== 'ok') return;
    expect(res.portada.caja.saldo).toBe('184000.00');
    expect(res.portada.caja.moneda).toBe('ARS');
    expect(res.portada.mes.rentabilidad).toBe('64000.00');
    expect(res.portada.serieMensual.map((p) => p.mes)).toEqual(['2026-03', '2026-04']);
    expect(res.portada.mejoresClientes[0].cliente).toBe('Panadería Los Tilos');
    expect(res.portada.porCobrar.vencido).toBe('12000.00');
    // La plata NUNCA sale como número: el float pierde precisión.
    expect(typeof res.portada.mes.ingresos).toBe('string');
  });

  it('acepta importes NUMÉRICOS del wire sin perderlos — la costura con el §3.1', async () => {
    // El contrato los escribe como números; el resto de la API usa strings. Mientras se confirma en el
    // connect, no se rompe si vienen números: se convierten a string en vez de quedar como `null`.
    responder = () => respuesta(200, { ...PORTADA_VIVA, caja: { saldo: 184000, moneda: 'ARS' } });

    const res = await leerPortada();

    if (res.status === 'ok') expect(res.portada.caja.saldo).toBe('184000');
  });
});

describe('leerPortada — lo que NO inventa', () => {
  it('🔴 un `200` con el HTML del SPA es `no_disponible`, NO una portada en cero', async () => {
    // El endpoint todavía no está desplegado: el front-door devuelve el SPA. Sin el guard de forma,
    // esto sería «tu negocio está en $0» — una mentira tranquilizadora sobre la ausencia del dato.
    responder = () => respuesta(200, '<!doctype html><html><body>app</body></html>');

    expect((await leerPortada()).status).toBe('no_disponible');
  });

  it('🔴 CONTROL — una portada REAL con ceros sí es `ok`', async () => {
    // El par del anterior: un emprendedor nuevo tiene todo en cero de verdad, y eso es un dato, no una
    // ausencia. Sin este caso, el guard podría rechazar todo y el test de arriba pasaría igual.
    responder = () =>
      respuesta(200, { caja: { saldo: '0', moneda: 'ARS' }, mes: {}, serie_mensual: [], mejores_clientes: [], por_cobrar: {} });

    const res = await leerPortada();
    expect(res.status).toBe('ok');
    if (res.status === 'ok') expect(res.portada.caja.saldo).toBe('0');
  });

  it('🔴 un importe AUSENTE queda en `null`, jamás en "0"', async () => {
    // «No sé cuánto facturó» y «facturó cero» son cosas distintas y sólo una es cierta. La pantalla
    // decide qué mostrar con `null` (un «—»); un cero por default sería un KPI que miente.
    responder = () => respuesta(200, { caja: { moneda: 'ARS' }, mes: { ingresos: '95000.00' }, por_cobrar: {} });

    const res = await leerPortada();
    if (res.status === 'ok') {
      expect(res.portada.caja.saldo).toBeNull();
      expect(res.portada.mes.facturado).toBeNull();
      expect(res.portada.mes.ingresos).toBe('95000.00');
    }
  });

  it('mejores clientes degrada a [] si Clientes no está — la card muestra vacío, no rompe', async () => {
    responder = () => respuesta(200, { caja: { saldo: '0', moneda: 'ARS' }, mejores_clientes: undefined });

    const res = await leerPortada();
    if (res.status === 'ok') expect(res.portada.mejoresClientes).toEqual([]);
  });

  it('🔴 un punto de la serie SIN mes se descarta — no se pinta en una posición inventada', async () => {
    responder = () =>
      respuesta(200, {
        caja: { saldo: '0', moneda: 'ARS' },
        serie_mensual: [{ mes: '2026-04', ingresos: '5' }, { ingresos: '9' }, { mes: '', gastos: '3' }],
      });

    const res = await leerPortada();
    if (res.status === 'ok') expect(res.portada.serieMensual.map((p) => p.mes)).toEqual(['2026-04']);
  });

  it('si la red explota degrada a `no_disponible`, no propaga', async () => {
    responder = () => { throw new Error('red caída'); };
    expect((await leerPortada()).status).toBe('no_disponible');
  });
});

describe('preguntarInteligencia — el chat de IN (§3.3, [PROVISIONAL — grafo])', () => {
  it('manda la pregunta por POST a /inteligencia/chat y devuelve respuesta + fuentes', async () => {
    let capturada: PeticionHttp | null = null;
    responder = (p) => {
      capturada = p;
      return respuesta(200, {
        respuesta: 'Gastaste $12.000 en nafta este mes.',
        fuentes: [{ tipo: 'gasto', ref: 'gasto-42' }],
      });
    };

    const res = await preguntarInteligencia('¿cuánto gasté en nafta este mes?');

    expect(capturada!.metodo).toBe('POST');
    expect(capturada!.path).toBe('/inteligencia/chat');
    expect(capturada!.cuerpoJson).toEqual({ pregunta: '¿cuánto gasté en nafta este mes?' });
    expect(res.status).toBe('ok');
    if (res.status !== 'ok') return;
    expect(res.respuesta.respuesta).toBe('Gastaste $12.000 en nafta este mes.');
    expect(res.respuesta.fuentes).toEqual([{ tipo: 'gasto', ref: 'gasto-42' }]);
  });

  it('🔴 405 (la ruta no está montada) → `no_disponible`, no un chat roto', async () => {
    responder = () => respuesta(405, { detail: 'Method Not Allowed' });
    expect((await preguntarInteligencia('x')).status).toBe('no_disponible');
  });

  it('🔴 CONTROL — un 500 (desplegado pero fallando) se PROPAGA, no se disfraza de ausencia', async () => {
    // El par del anterior: «la función todavía no existe» y «la función existe y se rompió» son cosas
    // distintas. Colapsarlas escondería un backend caído detrás de «todavía no está disponible».
    responder = () => respuesta(500, { detail: 'boom' });
    await expect(preguntarInteligencia('x')).rejects.toThrow();
  });

  it('una fuente sin `ref` se descarta; `tipo` ausente queda en ""', async () => {
    responder = () =>
      respuesta(200, {
        respuesta: 'ok',
        fuentes: [{ tipo: 'gasto', ref: 'g-1' }, { tipo: 'sin-ref' }, { ref: 'g-2' }],
      });

    const res = await preguntarInteligencia('x');
    if (res.status !== 'ok') return;
    expect(res.respuesta.fuentes).toEqual([{ tipo: 'gasto', ref: 'g-1' }, { tipo: '', ref: 'g-2' }]);
  });

  it('una respuesta sin texto queda en "", no en null — la burbuja siempre muestra algo', async () => {
    responder = () => respuesta(200, { fuentes: [] });
    const res = await preguntarInteligencia('x');
    if (res.status === 'ok') expect(res.respuesta.respuesta).toBe('');
  });

  it('si la red explota (no ApiError) degrada a `no_disponible`', async () => {
    responder = () => { throw new Error('red caída'); };
    expect((await preguntarInteligencia('x')).status).toBe('no_disponible');
  });
});

describe('leerGraficoFacturacion — gráfico 1 (VIVO desde PR #69)', () => {
  it('trae la serie agregada por mes', async () => {
    responder = () =>
      respuesta(200, {
        tipo: 'barras',
        periodo: '2026-02..2026-07',
        serie: [{ mes: '2026-02', total: '0.00', cantidad: 0 }, { mes: '2026-07', total: '45000.00', cantidad: 3 }],
      });

    const res = await leerGraficoFacturacion();
    expect(res.status).toBe('ok');
    if (res.status !== 'ok' || res.modo !== 'serie') return;
    expect(res.periodo).toBe('2026-02..2026-07');
    expect(res.serie).toEqual([
      { mes: '2026-02', total: '0.00', cantidad: 0 },
      { mes: '2026-07', total: '45000.00', cantidad: 3 },
    ]);
  });

  it('con `detalle` manda `?detalle=<mes>` y trae las filas de ESE mes, no el agregado', async () => {
    let capturada: PeticionHttp | null = null;
    responder = (p) => {
      capturada = p;
      return respuesta(200, {
        mes: '2026-07',
        filas: [{ id: 1, numero: '0001-00000012', fecha: '2026-07-05', cliente: 'Panadería', total: '0.00' }],
      });
    };

    const res = await leerGraficoFacturacion({ detalle: '2026-07' });
    expect(capturada!.path).toBe('/inteligencia/graficos/facturacion?detalle=2026-07');
    expect(res.status).toBe('ok');
    if (res.status !== 'ok' || res.modo !== 'detalle') return;
    expect(res.mes).toBe('2026-07');
    expect(res.filas[0].numero).toBe('0001-00000012');
  });

  it('una fila del detalle SIN `id` se descarta — no hay a dónde navegar', async () => {
    responder = () => respuesta(200, { mes: '2026-07', filas: [{ numero: 'x' }, { id: 2, numero: 'y' }] });
    const res = await leerGraficoFacturacion({ detalle: '2026-07' });
    if (res.status === 'ok' && res.modo === 'detalle') expect(res.filas.map((f) => f.id)).toEqual([2]);
  });

  it('🔴 un `200` con el HTML del SPA es `no_disponible`, no un gráfico en cero', async () => {
    responder = () => respuesta(200, '<!doctype html><html></html>');
    expect((await leerGraficoFacturacion()).status).toBe('no_disponible');
  });

  it('si la red explota degrada a `no_disponible`', async () => {
    responder = () => { throw new Error('red caída'); };
    expect((await leerGraficoFacturacion()).status).toBe('no_disponible');
  });
});

describe('leerGraficoEntroVsSalio — gráfico 2 (VIVO desde PR #69)', () => {
  it('trae la serie de barras enfrentadas', async () => {
    responder = () =>
      respuesta(200, {
        tipo: 'barras_enfrentadas',
        periodo: '2026-02..2026-07',
        serie: [{ mes: '2026-07', entro: '95000.00', salio: '31000.00' }],
      });

    const res = await leerGraficoEntroVsSalio();
    if (res.status !== 'ok' || res.modo !== 'serie') throw new Error('esperaba modo serie');
    expect(res.tipo).toBe('barras_enfrentadas');
    expect(res.serie[0].entro).toBe('95000.00');
  });

  it('`?detalle=<mes>:entro` distingue por `origen` — no por el string que se mandó', async () => {
    let capturada: PeticionHttp | null = null;
    responder = (p) => {
      capturada = p;
      return respuesta(200, {
        mes: '2026-07',
        filas: [{ id: 1, fecha: '2026-07-03', monto: '5000.00', origen: 'mercadopago', detalle: 'Cobro' }],
      });
    };

    const res = await leerGraficoEntroVsSalio({ detalle: '2026-07:entro' });
    expect(capturada!.path).toBe('/inteligencia/graficos/entro-vs-salio?detalle=2026-07%3Aentro');
    if (res.status !== 'ok' || res.modo !== 'detalle_entro') throw new Error('esperaba modo detalle_entro');
    expect(res.filas[0].origen).toBe('mercadopago');
  });

  it('`?detalle=<mes>:salio` trae filas con `categoria`, no `origen`', async () => {
    responder = () =>
      respuesta(200, { mes: '2026-07', filas: [{ id: 9, fecha: '2026-07-10', monto: '3000.00', categoria: 'transporte', detalle: 'Nafta' }] });

    const res = await leerGraficoEntroVsSalio({ detalle: '2026-07:salio' });
    if (res.status !== 'ok' || res.modo !== 'detalle_salio') throw new Error('esperaba modo detalle_salio');
    expect(res.filas[0].categoria).toBe('transporte');
  });

  it('un `origen` desconocido queda en `null`, nunca se inventa uno de los tres válidos', async () => {
    responder = () => respuesta(200, { mes: '2026-07', filas: [{ id: 1, origen: 'otro-nuevo' }] });
    const res = await leerGraficoEntroVsSalio({ detalle: '2026-07:entro' });
    if (res.status === 'ok' && res.modo === 'detalle_entro') expect(res.filas[0].origen).toBeNull();
  });

  it('si la red explota degrada a `no_disponible`', async () => {
    responder = () => { throw new Error('red caída'); };
    expect((await leerGraficoEntroVsSalio()).status).toBe('no_disponible');
  });
});

describe('leerGraficoCategorias — gráfico 3 (VIVO desde PR #69)', () => {
  it('trae la torta con las categorías del mes', async () => {
    responder = () =>
      respuesta(200, { tipo: 'torta', periodo: '2026-07', serie: [{ categoria: 'mercaderia', total: '12000.00' }] });

    const res = await leerGraficoCategorias();
    if (res.status !== 'ok' || res.modo !== 'serie') throw new Error('esperaba modo serie');
    expect(res.tipo).toBe('torta');
    expect(res.serie[0].categoria).toBe('mercaderia');
  });

  it('`?mes=` cambia el período; `?detalle=<categoria>` trae las filas de esa categoría', async () => {
    let capturada: PeticionHttp | null = null;
    responder = (p) => {
      capturada = p;
      return respuesta(200, { categoria: 'transporte', filas: [{ id: 1, fecha: '2026-06-10', monto: '3000.00', detalle: 'Nafta' }] });
    };

    const res = await leerGraficoCategorias({ mes: '2026-06', detalle: 'transporte' });
    expect(capturada!.path).toBe('/inteligencia/graficos/categorias?mes=2026-06&detalle=transporte');
    if (res.status !== 'ok' || res.modo !== 'detalle') throw new Error('esperaba modo detalle');
    expect(res.categoria).toBe('transporte');
    expect(res.filas[0].detalle).toBe('Nafta');
  });

  it('una categoría SIN nombre se descarta — un string abierto sigue necesitando una etiqueta', async () => {
    responder = () => respuesta(200, { periodo: '2026-07', serie: [{ total: '100' }, { categoria: 'otros', total: '50' }] });
    const res = await leerGraficoCategorias();
    if (res.status === 'ok' && res.modo === 'serie') expect(res.serie.map((p) => p.categoria)).toEqual(['otros']);
  });

  it('si la red explota degrada a `no_disponible`', async () => {
    responder = () => { throw new Error('red caída'); };
    expect((await leerGraficoCategorias()).status).toBe('no_disponible');
  });
});

describe('leerGraficoMargenTrabajo — gráfico 4 (VIVO desde PR #70)', () => {
  it('trae `trabajos` y `sin_ingreso` por separado, camelCase, sin mezclarlos', async () => {
    responder = () =>
      respuesta(200, {
        tipo: 'barras',
        trabajos: [{ eslabon: 'presupuesto', ref: 12, etiqueta: 'Panadería · 2026-06-10', cobrado: '9000.00', gastado: '3000.00', margen: '6000.00', gastos_imputados: 2 }],
        sin_ingreso: [{ eslabon: 'presupuesto', ref: 7, etiqueta: 'Kiosco · 2026-06-15', gastado: '1500.00', gastos_imputados: 3 }],
      });

    const res = await leerGraficoMargenTrabajo();
    if (res.status !== 'ok' || res.modo !== 'lista') throw new Error('esperaba modo lista');
    expect(res.trabajos).toEqual([
      { eslabon: 'presupuesto', ref: 12, etiqueta: 'Panadería · 2026-06-10', cobrado: '9000.00', gastado: '3000.00', margen: '6000.00', gastosImputados: 2 },
    ]);
    expect(res.sinIngreso).toEqual([
      { eslabon: 'presupuesto', ref: 7, etiqueta: 'Kiosco · 2026-06-15', gastado: '1500.00', gastosImputados: 3 },
    ]);
    // `TrabajoSinIngreso` no tiene `margen` en el tipo: nunca se calcula ni se muestra para éstos.
    expect((res.sinIngreso[0] as unknown as { margen?: unknown }).margen).toBeUndefined();
  });

  it('no manda `mes` — el gráfico no tiene filtro de período', async () => {
    let capturada: PeticionHttp | null = null;
    responder = (p) => {
      capturada = p;
      return respuesta(200, { tipo: 'barras', trabajos: [], sin_ingreso: [] });
    };
    await leerGraficoMargenTrabajo();
    expect(capturada!.path).toBe('/inteligencia/graficos/margen-trabajo');
  });

  it('`?detalle=<eslabon>:<ref>` trae el mismo objeto que /trabajos/.../margen', async () => {
    let capturada: PeticionHttp | null = null;
    responder = (p) => {
      capturada = p;
      return respuesta(200, {
        trabajo: { presupuesto: 12, comprobante: null, cobros: [] },
        cobrado: '9000.00', gastado: '3000.00', margen: '6000.00', gastos_imputados: 2,
      });
    };

    const res = await leerGraficoMargenTrabajo({ detalle: 'presupuesto:12' });
    expect(capturada!.path).toBe('/inteligencia/graficos/margen-trabajo?detalle=presupuesto%3A12');
    if (res.status !== 'ok' || res.modo !== 'detalle') throw new Error('esperaba modo detalle');
    expect(res.margen).toBe('6000.00');
    expect(res.trabajo).toEqual({ presupuesto: 12, comprobante: null, cobros: [] });
  });

  it('un `eslabon` desconocido descarta la fila — no se inventa uno de los tres válidos', async () => {
    responder = () => respuesta(200, { tipo: 'barras', trabajos: [{ eslabon: 'factura', ref: 1 }], sin_ingreso: [] });
    const res = await leerGraficoMargenTrabajo();
    if (res.status === 'ok' && res.modo === 'lista') expect(res.trabajos).toEqual([]);
  });

  it('si la red explota degrada a `no_disponible`', async () => {
    responder = () => { throw new Error('red caída'); };
    expect((await leerGraficoMargenTrabajo()).status).toBe('no_disponible');
  });
});

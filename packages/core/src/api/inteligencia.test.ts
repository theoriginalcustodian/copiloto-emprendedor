import { beforeEach, describe, expect, it } from 'vitest';

import { leerPortada } from './inteligencia';
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

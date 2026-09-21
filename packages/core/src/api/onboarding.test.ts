import { beforeEach, describe, expect, it } from 'vitest';

import type { ServicioCatalogo } from './catalogo';
import { configurarApi } from './config';
import type { HttpPort, PeticionHttp, RespuestaHttp } from './http';
import type { Portada } from './inteligencia';
import { completarOnboarding, debeMostrarOnboarding, permisosCompletos, permisosDelHilo, primerInsight, textoDelInsight } from './onboarding';
import type { AlmacenTokens } from './tokens';

const tokens: AlmacenTokens = {
  async leerToken() { return 'tok'; },
  async guardarToken() {},
  async leerRefresh() { return null; },
  async guardarRefresh() {},
  async limpiar() {},
};

const servicio = (over: Partial<ServicioCatalogo>): ServicioCatalogo => ({
  key: 'gmail',
  nombre: 'Gmail',
  etiquetaTrabajo: 'Mail',
  categoria: 'Mail',
  kind: 'composio',
  descripcion: '',
  capacidades: [],
  conectado: false,
  estado: 'nunca_conectado',
  connectPath: '/composio/connect?service=gmail',
  ...over,
});

const portada = (total: string | null, vencido: string | null = null): Portada => ({
  caja: { saldo: null, moneda: 'ARS', fechaCorte: null, variacionPct: null, incompleta: false },
  mes: { ingresos: null, gastos: null, rentabilidad: null, facturado: null, cobrado: null },
  serieMensual: [],
  mejoresClientes: [],
  porCobrar: { total, vencido },
});

describe('debeMostrarOnboarding (K-14 / BL-X8)', () => {
  it('sólo con `false` explícito', () => {
    expect(debeMostrarOnboarding({ onboarding_completado: false })).toBe(true);
    expect(debeMostrarOnboarding({ onboarding_completado: true })).toBe(false);
  });

  it('un backend anterior (campo ausente) o sin /me NO dispara el hilo', () => {
    expect(debeMostrarOnboarding({})).toBe(false);
    expect(debeMostrarOnboarding(undefined)).toBe(false);
    expect(debeMostrarOnboarding(null)).toBe(false);
  });
});

describe('completarOnboarding', () => {
  let peticiones: PeticionHttp[];
  let responder: (p: PeticionHttp) => RespuestaHttp;

  beforeEach(() => {
    peticiones = [];
    responder = () => ({ ok: true, status: 200, json: async () => ({ onboarding_completado: true }) });
    const http: HttpPort = { async enviar(p) { peticiones.push(p); return responder(p); } };
    configurarApi({ http, tokens });
  });

  it('POST sin body a /me/onboarding/completar', async () => {
    expect(await completarOnboarding()).toBe(true);
    expect(peticiones[0]?.metodo).toBe('POST');
    expect(peticiones[0]?.path).toBe('/me/onboarding/completar');
    expect(peticiones[0]?.cuerpoJson).toBeUndefined();
  });

  it('un fallo devuelve false y no lanza (el hilo se cierra igual)', async () => {
    responder = () => ({ ok: false, status: 500, json: async () => ({}) });
    expect(await completarOnboarding()).toBe(false);
  });
});

describe('permisosDelHilo', () => {
  it('reduce el catálogo a 2 permisos; Google está conectado si CUALQUIER toolkit lo está', () => {
    const [mp, google] = permisosDelHilo([
      servicio({ key: 'mercadopago', kind: 'payments', connectPath: '/mp/connect', conectado: true }),
      servicio({ key: 'gmail' }),
      servicio({ key: 'googledrive', conectado: true }),
      servicio({ key: 'hubspot' }),
    ]);
    expect(mp).toMatchObject({ id: 'mercadopago', conectado: true });
    expect(google).toMatchObject({ id: 'google', conectado: true });
    expect(google.servicio?.key).toBe('gmail');
  });

  it('vincula gmail si está; si no, el primer toolkit de Google sin conectar', () => {
    const [, google] = permisosDelHilo([servicio({ key: 'googlecalendar' }), servicio({ key: 'googledrive' })]);
    expect(google.servicio?.key).toBe('googlecalendar');
  });

  it('un catálogo sin esos servicios devuelve permisos sin servicio ni conexión (no inventa)', () => {
    const permisos = permisosDelHilo([servicio({ key: 'hubspot' })]);
    expect(permisos.map((p) => p.servicio)).toEqual([null, null]);
    expect(permisosCompletos(permisos)).toBe(false);
  });

  it('permisosCompletos: ambos conectados', () => {
    const permisos = permisosDelHilo([
      servicio({ key: 'mercadopago', kind: 'payments', conectado: true }),
      servicio({ key: 'gmail', conectado: true }),
    ]);
    expect(permisosCompletos(permisos)).toBe(true);
  });
});

describe('primerInsight', () => {
  it('con por cobrar > 0 devuelve el dato y el vencido sólo si es > 0', () => {
    expect(primerInsight(portada('147000.00', '63000.00'))).toEqual({ tipo: 'dato', porCobrar: '147000.00', vencido: '63000.00' });
    expect(primerInsight(portada('147000.00', '0.00'))).toEqual({ tipo: 'dato', porCobrar: '147000.00', vencido: null });
  });

  it('«0.00», ausente o sin portada → sin_dato: nunca una cifra inventada', () => {
    expect(primerInsight(portada('0.00'))).toEqual({ tipo: 'sin_dato' });
    expect(primerInsight(portada(null))).toEqual({ tipo: 'sin_dato' });
    expect(primerInsight(null)).toEqual({ tipo: 'sin_dato' });
    expect(primerInsight(undefined)).toEqual({ tipo: 'sin_dato' });
  });
});

describe('textoDelInsight', () => {
  it('con dato dice la cifra formateada; con vencido lo suma', () => {
    expect(textoDelInsight({ tipo: 'dato', porCobrar: '147000.00', vencido: null })).toMatch(/^Tenés \$\s?147\.000.* facturados sin cobrar\.$/);
    expect(textoDelInsight({ tipo: 'dato', porCobrar: '147000.00', vencido: '63000.00' })).toMatch(/63\.000.* ya vencidos\.$/);
  });

  it('sin dato no nombra ninguna cifra', () => {
    expect(textoDelInsight({ tipo: 'sin_dato' })).toBe('Todavía no tenés facturas pendientes.');
  });
});

import { beforeEach, describe, expect, it } from 'vitest';

import type { ServicioCatalogo } from './catalogo';
import { configurarApi } from './config';
import type { HttpPort, PeticionHttp, RespuestaHttp } from './http';
import type { Portada } from './inteligencia';
import {
  completarOnboarding,
  faltantesDelPerfilMinimo,
  perfilMinimoCompleto,
  debeMostrarOnboarding,
  PEDIDO_DETALLE_POR_COBRAR,
  permisosCompletos,
  permisosDelHilo,
  primerInsight,
  textoDelInsight,
} from './onboarding';
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
  acciones: [],
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
    expect(await completarOnboarding()).toEqual({ ok: true });
    expect(peticiones[0]?.metodo).toBe('POST');
    expect(peticiones[0]?.path).toBe('/me/onboarding/completar');
    expect(peticiones[0]?.cuerpoJson).toBeUndefined();
  });


  it('un fallo que NO es el gate: el hilo se cierra igual y se reintenta al proximo arranque', async () => {
    responder = () => ({ ok: false, status: 500, json: async () => ({}) });
    expect(await completarOnboarding()).toEqual({ ok: false, perfilIncompleto: false });
  });

  it('🔴 el 409 del perfil minimo NO se disfraza de fallo cualquiera, y dice QUE falta', async () => {
    // El defecto que esto cierra: con `catch { return false }` el 409 llegaba como «no se pudo
    // marcar», el hilo se cerraba igual y la persona quedaba contra un gate que no explica nada.
    responder = () => ({
      ok: false,
      status: 409,
      json: async () => ({ detail: { codigo: 'perfil_minimo_incompleto', faltantes: ['que_vende'] } }),
    });
    expect(await completarOnboarding()).toEqual({
      ok: false,
      perfilIncompleto: true,
      faltantes: ['queVende'],
    });
  });

  it('un 409 SIN `faltantes` pide los dos: no saber cual falta no habilita a adivinar uno', async () => {
    responder = () => ({
      ok: false,
      status: 409,
      json: async () => ({ detail: { codigo: 'perfil_minimo_incompleto' } }),
    });
    expect(await completarOnboarding()).toEqual({
      ok: false,
      perfilIncompleto: true,
      faltantes: ['queVende', 'nombreComercial'],
    });
  });

  it('🔴 CONTROL -- un 409 de OTRO codigo no se confunde con el del perfil minimo', async () => {
    // El par del anterior: si ramificara por STATUS y no por CODIGO, este caso devolveria
    // `perfilIncompleto:true` y la pantalla pediria campos que no tienen nada que ver.
    responder = () => ({
      ok: false,
      status: 409,
      json: async () => ({ detail: { codigo: 'presupuesto_ya_facturado' } }),
    });
    expect(await completarOnboarding()).toEqual({ ok: false, perfilIncompleto: false });
  });
});

describe('perfilMinimoCompleto / faltantesDelPerfilMinimo — el predicado único de SM-C3', () => {
  const lleno = { queVende: 'Instalaciones eléctricas', nombreComercial: 'Electricidad Pérez' };

  it('con los dos campos llenos, entra (control positivo)', () => {
    expect(perfilMinimoCompleto(lleno)).toBe(true);
    expect(faltantesDelPerfilMinimo(lleno)).toEqual([]);
  });

  it('🔴 con uno de los dos vacío NO entra, y nombra el que falta', () => {
    expect(perfilMinimoCompleto({ ...lleno, queVende: '' })).toBe(false);
    expect(faltantesDelPerfilMinimo({ ...lleno, queVende: '' })).toEqual(['queVende']);
    expect(perfilMinimoCompleto({ ...lleno, nombreComercial: '' })).toBe(false);
    expect(faltantesDelPerfilMinimo({ ...lleno, nombreComercial: '' })).toEqual(['nombreComercial']);
  });

  it('sólo espacios cuenta como vacío — igual que el `.strip()` del backend', () => {
    // Si los dos lados no coinciden, la app deja pasar algo que el server rechaza con 409 y el
    // usuario ve un error que la pantalla podía evitar.
    expect(perfilMinimoCompleto({ ...lleno, queVende: '   ' })).toBe(false);
    // Tab + newline + espacio construidos SIN escapes: el literal backslash-t, pasando por una
    // capa mas de interpretacion, llega como TAB REAL y parte la cadena (pagado aca mismo).
    expect(perfilMinimoCompleto({ ...lleno, nombreComercial: String.fromCharCode(9, 10, 32) })).toBe(false);
  });

  it('🔴 un perfil ausente NO cuenta como completo: fail-closed, devuelve los dos', () => {
    // El degradado hacia el caso benigno («no pude leerlo, lo dejo pasar») es lo que convierte un
    // gate en decoración.
    expect(perfilMinimoCompleto(null)).toBe(false);
    expect(perfilMinimoCompleto(undefined)).toBe(false);
    expect(faltantesDelPerfilMinimo(null)).toEqual(['queVende', 'nombreComercial']);
  });

  it('`aQuien` NO participa del gate aunque venga lleno: su default lo haría hueco', () => {
    // Documentado en el DoD: el default `"ambos"` hace que «no vacío» siempre pase.
    expect(perfilMinimoCompleto({ ...lleno, queVende: '' })).toBe(false);
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

describe('PEDIDO_DETALLE_POR_COBRAR', () => {
  it('es autocontenido: nombra qué detalle quiere sin depender de lo que mostró el recibo', () => {
    expect(PEDIDO_DETALLE_POR_COBRAR).toMatch(/clientes/);
    expect(PEDIDO_DETALLE_POR_COBRAR).toMatch(/sin cobrar/);
    expect(PEDIDO_DETALLE_POR_COBRAR).not.toMatch(/\$|\d/); // ninguna cifra: no puede quedar viejo
  });
});

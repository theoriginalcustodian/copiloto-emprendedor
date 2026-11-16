/**
 * La prueba de que las respuestas de ejemplo tienen la forma que el backend manda de verdad: se instalan
 * como `HttpPort` falso y se leen con los LECTORES REALES del core. Varios lectores validan «por forma» y
 * degradan a `no_disponible` en silencio si falta un campo; por eso acá se exige `ok` y listas NO vacías,
 * endpoint por endpoint. Una pantalla vacía en modo demo tiene que caer acá antes que en el teléfono.
 *
 * `describe`/`it`/`expect` son globales del runner Jest (no importar nada de `vitest`).
 */
import {
  LEGAL_VERSION,
  apiReal,
  configurarApi,
  estadoAfip,
  leerAgenda,
  leerCalendario,
  leerCapacidades,
  leerEjemploDeTono,
  leerGraficoCategorias,
  leerGraficoEntroVsSalio,
  leerGraficoFacturacion,
  leerGraficoMargenTrabajo,
  leerPerfil,
  leerPerfilNegocio,
  leerPortada,
  leerTablero,
  leerVencimientos,
  listarActividad,
  listarCatalogo,
  listarClientes,
  listarCobros,
  listarComprobantes,
  listarConceptos,
  listarFeedbackPropio,
  listarGastos,
  listarImpagos,
  listarIngresos,
  listarMisTickets,
  listarPresupuestos,
  listarTrabajosImputables,
  obtenerCliente,
  obtenerComprobante,
  obtenerGasto,
  obtenerPresupuesto,
  obtenerResumenContabilidad,
  obtenerResumenGastos,
  obtenerResumenIngresos,
} from '@copiloto/core';
import type { AlmacenTokens, HttpPort, PeticionHttp } from '@copiloto/core';

import { CUIT_DEMO, respuestaDemo } from './respuestasDemo';

/** Lo que cada lector le pidió al puerto: si un path no está cubierto, el test lo nombra. */
let pedidos: string[] = [];

const tokensConSesion: AlmacenTokens = {
  async leerToken() {
    return 'token-demo';
  },
  async guardarToken() {},
  async leerRefresh() {
    return 'refresh-demo';
  },
  async guardarRefresh() {},
  async limpiar() {},
};

/** Puerto falso: 200 con el cuerpo de ejemplo; lo no cubierto es un 404, como una ruta que no existe. */
const httpDemo: HttpPort = {
  async enviar(peticion) {
    pedidos.push(`${peticion.metodo} ${peticion.path}`);
    const cuerpo = respuestaDemo(peticion);
    if (cuerpo === undefined) return { ok: false, status: 404, json: async () => ({ detail: 'no cubierto por el modo demo' }) };
    return { ok: true, status: 200, json: async () => cuerpo };
  },
};

function get(path: string): PeticionHttp {
  return { metodo: 'GET', path, headers: {} };
}

const numero = (v: string | null | undefined): number => Number(v ?? NaN);

/** `YYYY-MM` del mes en curso y del anterior, en hora local (igual que el archivo de datos). */
function periodo(mesesAtras: number): string {
  const h = new Date();
  const d = new Date(h.getFullYear(), h.getMonth() - mesesAtras, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

beforeEach(() => {
  pedidos = [];
  configurarApi({ http: httpDemo, tokens: tokensConSesion });
});

describe('respuestaDemo — qué cubre', () => {
  it('sólo responde GET: una escritura nunca se contesta con un ejemplo', () => {
    expect(respuestaDemo({ metodo: 'POST', path: '/gastos', headers: {}, cuerpoJson: {} })).toBeUndefined();
    expect(respuestaDemo({ metodo: 'DELETE', path: '/gastos/201', headers: {} })).toBeUndefined();
    expect(respuestaDemo({ metodo: 'PATCH', path: '/presupuestos/24', headers: {} })).toBeUndefined();
  });

  it('una ruta que no conoce, o un id que no existe, es `undefined`', () => {
    expect(respuestaDemo(get('/reply?session_id=x&after_id=0'))).toBeUndefined();
    expect(respuestaDemo(get('/clientes/999'))).toBeUndefined();
    expect(respuestaDemo(get('/afip/comprobantes/999'))).toBeUndefined();
    expect(respuestaDemo(get('/afip/comprobantes/999/cobros'))).toBeUndefined();
    expect(respuestaDemo(get('/presupuestos/999'))).toBeUndefined();
    expect(respuestaDemo(get('/gastos/999'))).toBeUndefined();
  });

  it('ningún cuerpo trae un `undefined` suelto: todo sobrevive a un viaje por JSON', () => {
    const paths = [
      '/me', '/catalog', '/mi-dia/tablero', '/mi-dia/calendario', '/mi-dia/calendario?desde=2026-01-01&hasta=2026-01-07',
      '/mi-dia/vencimientos?dias=14', '/inteligencia/portada', '/inteligencia/graficos/facturacion',
      '/inteligencia/graficos/entro-vs-salio', '/inteligencia/graficos/categorias', '/inteligencia/graficos/margen-trabajo',
      '/actividad', '/gastos', '/gastos/resumen', '/gastos/207', '/ingresos', '/ingresos/resumen', '/contabilidad/resumen',
      '/afip/estado', `/afip/perfil?cuit=${CUIT_DEMO}`, `/afip/comprobantes?cuit=${CUIT_DEMO}&limite=50`,
      '/afip/comprobantes/103', '/afip/comprobantes/impagos', '/afip/comprobantes/105/cobros', '/presupuestos',
      '/presupuestos/24', '/clientes', '/clientes/1', '/conceptos', '/perfil-negocio', '/capacidades', '/feedback',
    ];
    for (const path of paths) {
      const cuerpo = respuestaDemo(get(path));
      expect(cuerpo).toBeDefined();
      expect(JSON.parse(JSON.stringify(cuerpo))).toEqual(cuerpo);
    }
  });
});

describe('cuenta y conexiones', () => {
  it('/me: onboarding completo, legal aceptado en la versión vigente, todo conectado', async () => {
    const yo = await apiReal.me();
    expect(yo.onboarding_completado).toBe(true);
    expect(yo.legal_aceptado).toBe(true);
    expect(yo.legal_version_aceptada).toBe(LEGAL_VERSION);
    expect(yo.mp_connected).toBe(true);
    expect(yo.composio_connected).toEqual(expect.arrayContaining(['gmail', 'googlecalendar', 'googledrive']));
    expect(yo.email).toMatch(/ejemplo\.com$/);
  });

  it('/catalog: Mercado Pago y Google, todos conectados y sanos', async () => {
    const res = await listarCatalogo();
    if (res.status !== 'ok') throw new Error('esperaba ok');
    expect(res.servicios.map((s) => s.key)).toEqual(
      expect.arrayContaining(['mercadopago', 'gmail', 'googlecalendar', 'googledrive']),
    );
    for (const s of res.servicios) {
      expect(s.conectado).toBe(true);
      expect(s.estado).toBe('conectado');
      expect(s.nombre).not.toBe('');
      expect(s.capacidades.length).toBeGreaterThan(0);
    }
    expect(res.servicios.find((s) => s.key === 'mercadopago')?.connectPath).toBe('/mp/connect');
  });

  it('/afip/estado y /afip/perfil: ARCA habilitado para emitir, con Drive', async () => {
    const estado = await estadoAfip(CUIT_DEMO);
    if (estado.status !== 'ok') throw new Error('esperaba ok');
    expect(estado.conectado).toBe(true);
    expect(estado.perfilCompleto).toBe(true);
    expect(estado.puedeFacturar).toBe(true);
    expect(estado.driveConectado).toBe(true);
    expect(estado.onboarding?.paso).toBe('habilitado');
    expect(estado.cuit).toBe(CUIT_DEMO);
    expect((await estadoAfip()).status).toBe('ok');

    const perfil = await leerPerfil(CUIT_DEMO);
    if (perfil.status !== 'ok' || perfil.perfil == null) throw new Error('esperaba un perfil');
    expect(perfil.perfil.condicionIva).toBe('monotributo');
    expect(perfil.perfil.cuit).toBe(CUIT_DEMO);
    expect(perfil.perfil.categoriaMonotributo).toBe('D');
    expect(perfil.perfil.guardarEnDrive).toBe(true);
  });

  it('/perfil-negocio, su ejemplo de tono, /conceptos y /capacidades', async () => {
    const perfil = await leerPerfilNegocio();
    if (perfil.status !== 'ok' || perfil.perfil == null) throw new Error('esperaba un perfil');
    expect(perfil.perfil.nombreComercial).toBe('Rivas Electricidad');
    expect(perfil.perfil.queVende.length).toBeGreaterThan(10);

    expect(await leerEjemploDeTono('cercano', 'breve')).toEqual(expect.any(String));
    expect(await leerEjemploDeTono('formal', 'detallado')).toEqual(expect.any(String));

    const conceptos = await listarConceptos();
    if (conceptos.status !== 'ok') throw new Error('esperaba ok');
    expect(conceptos.conceptos.length).toBeGreaterThanOrEqual(6);
    for (const c of conceptos.conceptos) {
      expect(c.nombre).not.toBe('');
      expect(numero(c.precioReferencia)).toBeGreaterThan(0);
    }

    const guia = await leerCapacidades();
    if (guia.status !== 'ok') throw new Error('esperaba ok');
    expect(guia.guia.capacidades.length).toBeGreaterThan(5);
    expect(guia.guia.fechas.entiendo.length).toBeGreaterThan(0);
    expect(guia.guia.fechas.siNoEsta).not.toBeNull();
  });

  it('/feedback y /soporte/tickets: lista vacía legible, no un error', async () => {
    expect(await listarFeedbackPropio()).toEqual([]);
    const tickets = await listarMisTickets();
    expect(tickets.status).toBe('ok');
  });
});

describe('Mi día', () => {
  it('/mi-dia/tablero: tres solapas (5, 2 y 4), con variedad y una tarjeta crítica', async () => {
    const res = await leerTablero();
    if (res.status !== 'ok') throw new Error('esperaba ok');
    expect(res.tablero.solapas.map((s) => s.id)).toEqual(['para_hoy', 'haciendo', 'hecha']);
    const [paraHoy, haciendo, hecha] = res.tablero.solapas;
    expect(paraHoy?.tarjetas).toHaveLength(5);
    expect(haciendo?.tarjetas).toHaveLength(2);
    expect(hecha?.tarjetas).toHaveLength(4);

    const hoy = paraHoy?.tarjetas ?? [];
    expect(hoy.filter((t) => t.criticidad === 'critico')).toHaveLength(1);
    expect(new Set(hoy.map((t) => t.categoria))).toEqual(new Set(['arca', 'cobros', 'presupuestos', 'tuyas']));
    expect(new Set(hoy.map((t) => t.destino?.tipo ?? null))).toEqual(
      new Set(['certificado', 'comprobante', 'presupuesto', null]),
    );
    expect(hoy.filter((t) => t.regla == null)).toHaveLength(1);
    for (const t of hoy) {
      expect(t.verbo).not.toBeNull();
      expect(t.presentacion).not.toBeNull();
    }
    // La de cobros lleva a la factura impaga de la panadería, con chip, prosa, datos y acción.
    const cobro = hoy.find((t) => t.categoria === 'cobros');
    expect(cobro?.cliente).toBe('Panadería La Espiga');
    expect(cobro?.destino).toEqual({ tipo: 'comprobante', id: '103', connectPath: null });
    expect(cobro?.presentacion?.chip?.tono).toBe('pronto');
    expect(cobro?.presentacion?.prosa).not.toBeNull();
    expect(cobro?.presentacion?.kv.length).toBeGreaterThan(0);
    expect(cobro?.presentacion?.accion?.destino?.id).toBe('103');
  });

  it('/mi-dia/calendario: conectado, cuatro eventos de hoy con hora', async () => {
    const res = await leerCalendario();
    if (res.status !== 'ok') throw new Error('esperaba ok');
    expect(res.calendario.conectado).toBe(true);
    expect(res.calendario.eventos).toHaveLength(4);
    const hoy = new Date();
    for (const e of res.calendario.eventos) {
      const inicio = (e.inicioCrudo as { dateTime: string }).dateTime;
      const d = new Date(inicio);
      expect(Number.isNaN(d.getTime())).toBe(false);
      expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([hoy.getFullYear(), hoy.getMonth(), hoy.getDate()]);
    }
  });

  it('/mi-dia/calendario con rango: la agenda agrupada, con los cuatro grupos llenos', async () => {
    const res = await leerAgenda();
    if (res.status !== 'ok') throw new Error('esperaba ok');
    expect(res.agenda.conectado).toBe(true);
    expect(pedidos.at(-1)).toMatch(/^GET \/mi-dia\/calendario\?desde=/);
    expect(res.agenda.grupos.map((g) => g.id)).toEqual(['hoy', 'manana', 'semana', 'sin_hora']);
    for (const g of res.agenda.grupos) expect(g.eventos.length).toBeGreaterThan(0);
    expect(res.agenda.grupos[3]?.eventos[0]?.diaCompleto).toBe(true);
  });

  it('/mi-dia/vencimientos: el certificado de ARCA y los CAE, dentro de la ventana pedida', async () => {
    const res = await leerVencimientos(14);
    if (res.status !== 'ok') throw new Error('esperaba ok');
    expect(res.vencimientos.length).toBeGreaterThanOrEqual(2);
    expect(res.vencimientos.map((v) => v.tipo)).toEqual(expect.arrayContaining(['cae', 'certificado']));
    for (const v of res.vencimientos) {
      expect(v.dias).not.toBeNull();
      expect(v.dias ?? 99).toBeLessThanOrEqual(14);
      expect(v.fecha).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
    const semana = await leerVencimientos();
    if (semana.status !== 'ok') throw new Error('esperaba ok');
    expect(semana.vencimientos.some((v) => v.tipo === 'certificado')).toBe(true);
  });
});

describe('plata: gastos, ingresos, contabilidad', () => {
  it('/gastos, /gastos/{id} y /gastos/resumen', async () => {
    const res = await listarGastos();
    if (res.status !== 'ok') throw new Error('esperaba ok');
    expect(res.gastos).toHaveLength(12);
    expect(res.total).toBe(12);
    expect(new Set(res.gastos.map((g) => g.categoria))).toEqual(
      new Set(['mercaderia', 'transporte', 'herramientas', 'impuestos', 'servicios']),
    );
    expect(new Set(res.gastos.map((g) => g.origen))).toEqual(new Set(['voz', 'manual', 'foto']));
    expect(res.gastos.some((g) => g.imputacion?.presupuestoRef != null)).toBe(true);
    // Más nuevo primero.
    const fechas = res.gastos.map((g) => g.fecha);
    expect([...fechas].sort().reverse()).toEqual(fechas);

    const acotado = await listarGastos({ limit: 5 });
    if (acotado.status !== 'ok') throw new Error('esperaba ok');
    expect(acotado.gastos).toHaveLength(5);

    const uno = await obtenerGasto(207);
    if (uno.status !== 'ok') throw new Error('esperaba ok');
    expect(uno.gasto.proveedor).toBe('Electricidad Oroño');
    expect(uno.gasto.imputacion?.presupuestoRef).toBe(25);
    expect(await obtenerGasto(999)).toEqual({ status: 'no_encontrado' });

    const resumen = await obtenerResumenGastos();
    if (resumen.status !== 'ok') throw new Error('esperaba ok');
    expect(resumen.resumen.periodo).toBe(periodo(0));
    expect(resumen.resumen.porCategoria.length).toBeGreaterThan(0);
    expect(numero(resumen.resumen.mesAnterior)).toBeGreaterThan(0);
    // El total del mes es la suma de los gastos de ESTE mes que muestra el listado.
    const delMes = res.gastos.filter((g) => g.fecha.startsWith(periodo(0)));
    expect(numero(resumen.resumen.total)).toBe(delMes.reduce((a, g) => a + Number(g.monto), 0));

    const pasado = await obtenerResumenGastos(periodo(1));
    if (pasado.status !== 'ok') throw new Error('esperaba ok');
    expect(pasado.resumen.total).toBe(resumen.resumen.mesAnterior);
  });

  it('/ingresos y /ingresos/resumen: los tres orígenes (factura cobrada, Mercado Pago, dictado)', async () => {
    const res = await listarIngresos();
    if (res.status !== 'ok') throw new Error('esperaba ok');
    expect(res.ingresos).toHaveLength(12);
    expect(new Set(res.ingresos.map((i) => i.origen))).toEqual(new Set(['factura', 'mercadopago', 'voz']));
    expect(numero(res.total)).toBe(res.ingresos.reduce((a, i) => a + numero(i.monto), 0));
    for (const i of res.ingresos) {
      expect(i.clienteNombre).not.toBeNull();
      expect(i.concepto).not.toBeNull();
      expect(i.borrable).not.toBeNull();
      if (i.origen === 'factura') expect(i.comprobanteNro).not.toBeNull();
    }
    const acotado = await listarIngresos({ limite: 4 });
    if (acotado.status !== 'ok') throw new Error('esperaba ok');
    expect(acotado.ingresos).toHaveLength(4);

    const resumen = await obtenerResumenIngresos();
    if (resumen.status !== 'ok') throw new Error('esperaba ok');
    const delMes = res.ingresos.filter((i) => (i.fecha ?? '').startsWith(periodo(0)));
    expect(numero(resumen.resumen.total)).toBe(delMes.reduce((a, i) => a + numero(i.monto), 0));
    expect(numero(resumen.resumen.mesAnterior)).toBeGreaterThan(0);
  });

  it('/contabilidad/resumen: caja, categorías, tope del monotributo y clientes', async () => {
    const res = await obtenerResumenContabilidad();
    if (res.status !== 'ok') throw new Error('esperaba ok');
    const r = res.resumen;
    expect(r.periodo).toBe(periodo(0));
    expect(numero(r.caja.entro) - numero(r.caja.salio)).toBe(numero(r.caja.queda));
    expect(r.caja.mesAnterior).not.toBeNull();
    expect(r.gastos.porCategoria.length).toBeGreaterThan(0);
    expect(r.facturado.tope?.semaforo).toBe('verde');
    expect(numero(r.facturado.doceMeses)).toBeGreaterThan(numero(r.facturado.periodo));
    expect(r.clientes.length).toBeGreaterThan(0);
    expect(r.clientes[0]?.clienteRef).toBeGreaterThan(0);

    const pasado = await obtenerResumenContabilidad(periodo(1));
    if (pasado.status !== 'ok') throw new Error('esperaba ok');
    expect(pasado.resumen.caja.entro).toBe(r.caja.mesAnterior?.entro);
  });
});

describe('facturación y cobros', () => {
  it('/afip/comprobantes: ocho facturas C con CAE, cliente y link de Drive', async () => {
    const res = await listarComprobantes(CUIT_DEMO);
    if (res.status !== 'ok') throw new Error('esperaba ok');
    expect(res.comprobantes).toHaveLength(8);
    for (const c of res.comprobantes) {
      expect(c.cae).toMatch(/^\d{14}$/);
      expect(c.tipoCbte).toBe(11);
      expect(c.estado).toBe('emitida');
      expect(c.receptorNombre).not.toBeNull();
      expect(c.fechaEmision).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(c.driveLink).toMatch(/ejemplo\.com/);
      expect(numero(c.total)).toBeGreaterThan(0);
    }
    expect(res.comprobantes.map((c) => c.nro)).toEqual([45, 44, 43, 42, 41, 40, 39, 38]);
  });

  it('/afip/comprobantes/{id}: el detalle es el mismo comprobante del listado', async () => {
    const res = await obtenerComprobante(103);
    if (res.status !== 'ok') throw new Error('esperaba ok');
    expect(res.comprobante.nro).toBe(40);
    expect(res.comprobante.receptorNombre).toBe('Panadería La Espiga');
    expect(res.comprobante.total).toBe('260000.00');
    expect(await obtenerComprobante(999)).toEqual({ status: 'no_encontrado' });
  });

  it('/afip/comprobantes/impagos y /{id}/cobros: unas cobradas, otras no, y los números cierran', async () => {
    const impagos = await listarImpagos();
    if (impagos.status !== 'ok') throw new Error('esperaba ok');
    expect(impagos.comprobantes.map((c) => c.id).sort()).toEqual([103, 105, 108]);
    expect(numero(impagos.totalAdeudado)).toBe(impagos.comprobantes.reduce((a, c) => a + numero(c.saldo), 0));
    expect(impagos.totalAdeudado).toBe('420000.00');
    for (const c of impagos.comprobantes) {
      expect(c.receptorNombre).not.toBeNull();
      expect(c.estadoCobro).not.toBeNull();
      expect(c.dias).not.toBeNull();
    }

    const parcial = await listarCobros(105);
    if (parcial.status !== 'ok') throw new Error('esperaba ok');
    expect(parcial.cobros).toHaveLength(1);
    expect(parcial.comprobante).toEqual({ id: 105, total: '140000.00', cobrado: '70000.00', saldo: '70000.00', estadoCobro: 'parcial' });

    const cobrada = await listarCobros(106);
    if (cobrada.status !== 'ok') throw new Error('esperaba ok');
    expect(cobrada.comprobante?.estadoCobro).toBe('cobrada');
    expect(cobrada.cobros[0]?.monto).toBe('920000.00');

    const impaga = await listarCobros(103);
    if (impaga.status !== 'ok') throw new Error('esperaba ok');
    expect(impaga.cobros).toEqual([]);
    expect(impaga.comprobante?.estadoCobro).toBe('impaga');

    expect(await listarCobros(999)).toEqual({ status: 'no_encontrado' });
  });
});

describe('presupuestos y clientes', () => {
  it('/presupuestos: siete, en todos los estados que el contrato distingue, con link al documento', async () => {
    const res = await listarPresupuestos();
    if (res.status !== 'ok') throw new Error('esperaba ok');
    expect(res.presupuestos).toHaveLength(7);
    expect(res.total).toBe(7);
    expect(new Set(res.presupuestos.map((p) => p.estado))).toEqual(new Set(['pendiente', 'aprobado', 'desestimado']));
    expect(res.presupuestos.some((p) => p.facturado)).toBe(true);
    expect(res.presupuestos.some((p) => p.sinRespuesta === true)).toBe(true);
    for (const p of res.presupuestos) {
      expect(p.docLink).toMatch(/ejemplo\.com/);
      expect(p.receptor.nombre).not.toBe('');
      expect(p.items.length).toBeGreaterThan(0);
      expect(p.cantidadItems).toBe(p.items.length);
      // El total es la suma de los ítems.
      expect(numero(p.total)).toBe(p.items.reduce((a, i) => a + Number(i.cantidad) * Number(i.precioUnitario), 0));
    }
  });

  it('/presupuestos/{id}: el detalle con sus ítems', async () => {
    const res = await obtenerPresupuesto(24);
    if (res.status !== 'ok') throw new Error('esperaba ok');
    expect(res.presupuesto.numero).toBe(17);
    expect(res.presupuesto.receptor.nombre).toBe('Kiosco El Faro');
    expect(res.presupuesto.estado).toBe('pendiente');
    expect(res.presupuesto.total).toBe('480000.00');
    expect(res.presupuesto.items).toHaveLength(3);
    expect(await obtenerPresupuesto(999)).toEqual({ status: 'no_encontrado' });
  });

  it('/clientes: nueve, con búsqueda por texto y los tres casos de facturación', async () => {
    const res = await listarClientes();
    if (res.status !== 'ok') throw new Error('esperaba ok');
    expect(res.clientes).toHaveLength(9);
    expect(res.total).toBe(9);
    expect(res.agregadosEsteMes).toBeGreaterThan(0);
    for (const c of res.clientes) {
      expect(c.nombre).not.toBe('');
      expect(c.montoFacturado).toBeDefined();
      expect(c.facturasAtribuibles).toBeDefined();
    }
    expect(res.clientes.some((c) => c.facturasAtribuibles === false)).toBe(true);
    expect(res.clientes.some((c) => c.facturasAtribuibles === true && c.montoFacturado === '0.00')).toBe(true);

    const busqueda = await listarClientes({ q: 'panaderia' });
    if (busqueda.status !== 'ok') throw new Error('esperaba ok');
    expect(busqueda.clientes.map((c) => c.nombre)).toEqual(['Panadería La Espiga']);
  });

  it('/clientes/{id}: la ficha con su historial de presupuestos y facturas', async () => {
    const res = await obtenerCliente(1);
    if (res.status !== 'ok') throw new Error('esperaba ok');
    expect(res.ficha.cliente.nombre).toBe('Consorcio Pellegrini 1250');
    expect(res.ficha.cliente.montoFacturado).toBe('570000.00');
    expect(res.ficha.presupuestos).toHaveLength(1);
    expect(res.ficha.facturas).toHaveLength(2);
    for (const o of [...res.ficha.presupuestos, ...res.ficha.facturas]) {
      expect(o.detalle).not.toBe('');
      expect(numero(o.total)).toBeGreaterThan(0);
    }
    expect(await obtenerCliente(999)).toEqual({ status: 'no_encontrado' });
  });
});

describe('Inteligencia', () => {
  it('/inteligencia/portada: caja, mes, serie, mejores clientes y por cobrar', async () => {
    const res = await leerPortada();
    if (res.status !== 'ok') throw new Error('esperaba ok');
    const p = res.portada;
    expect(numero(p.caja.saldo)).toBeGreaterThan(0);
    expect(p.caja.fechaCorte).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(p.caja.variacionPct).not.toBeNull();
    expect(p.caja.incompleta).toBe(false);
    for (const v of Object.values(p.mes)) expect(numero(v)).toBeGreaterThan(0);
    expect(numero(p.mes.ingresos) - numero(p.mes.gastos)).toBe(numero(p.mes.rentabilidad));
    expect(p.serieMensual).toHaveLength(6);
    expect(p.serieMensual.at(-1)?.mes).toBe(periodo(0));
    expect(p.mejoresClientes.length).toBeGreaterThanOrEqual(3);
    expect(p.mejoresClientes[0]?.comprobantes).toBeGreaterThan(0);
    expect(numero(p.porCobrar.total)).toBeGreaterThan(numero(p.porCobrar.vencido));
    expect(numero(p.porCobrar.vencido)).toBeGreaterThan(0);
  });

  it('la portada cierra con ingresos, gastos, contabilidad e impagos', async () => {
    const portada = await leerPortada();
    const ingresos = await obtenerResumenIngresos();
    const gastos = await obtenerResumenGastos();
    const conta = await obtenerResumenContabilidad();
    const impagos = await listarImpagos();
    if (
      portada.status !== 'ok' || ingresos.status !== 'ok' || gastos.status !== 'ok' || conta.status !== 'ok' ||
      impagos.status !== 'ok'
    ) {
      throw new Error('esperaba ok en los cinco');
    }
    expect(portada.portada.mes.ingresos).toBe(ingresos.resumen.total);
    expect(portada.portada.mes.gastos).toBe(gastos.resumen.total);
    expect(portada.portada.mes.ingresos).toBe(conta.resumen.caja.entro);
    expect(portada.portada.mes.facturado).toBe(conta.resumen.facturado.periodo);
    expect(portada.portada.porCobrar.total).toBe(impagos.totalAdeudado);
    // Quien debe aparece en los dos lados: el impago más viejo es de un cliente del ranking.
    const deudor = impagos.comprobantes[0]?.receptorNombre;
    expect(deudor).toBe('Panadería La Espiga');
    expect(portada.portada.mejoresClientes.map((c) => c.cliente)).toContain(deudor);
    // La serie de la portada termina en el mismo mes que muestra el resumen.
    const ultimo = portada.portada.serieMensual.at(-1);
    expect(ultimo?.ingresos).toBe(ingresos.resumen.total);
    expect(ultimo?.gastos).toBe(gastos.resumen.total);
  });

  it('gráfico de facturación: serie y detalle del mes', async () => {
    const res = await leerGraficoFacturacion();
    if (res.status !== 'ok' || res.modo !== 'serie') throw new Error('esperaba la serie');
    expect(res.serie).toHaveLength(6);
    for (const punto of res.serie) expect(punto.cantidad).toBeGreaterThan(0);

    const detalle = await leerGraficoFacturacion({ detalle: periodo(0) });
    if (detalle.status !== 'ok' || detalle.modo !== 'detalle') throw new Error('esperaba el detalle');
    expect(detalle.filas.length).toBeGreaterThan(0);
    expect(detalle.filas.length).toBe(res.serie.at(-1)?.cantidad);
    for (const f of detalle.filas) {
      expect(f.numero).toMatch(/^0001-\d{8}$/);
      expect(f.cliente).not.toBe('');
    }
  });

  it('gráfico entró vs salió: serie y los dos detalles', async () => {
    const res = await leerGraficoEntroVsSalio();
    if (res.status !== 'ok' || res.modo !== 'serie') throw new Error('esperaba la serie');
    expect(res.serie).toHaveLength(6);

    const entro = await leerGraficoEntroVsSalio({ detalle: `${periodo(0)}:entro` });
    if (entro.status !== 'ok' || entro.modo !== 'detalle_entro') throw new Error('esperaba detalle_entro');
    expect(entro.filas.length).toBeGreaterThan(0);
    for (const f of entro.filas) expect(f.origen).not.toBeNull();
    expect(entro.filas.reduce((a, f) => a + numero(f.monto), 0)).toBe(numero(res.serie.at(-1)?.entro));

    const salio = await leerGraficoEntroVsSalio({ detalle: `${periodo(0)}:salio` });
    if (salio.status !== 'ok' || salio.modo !== 'detalle_salio') throw new Error('esperaba detalle_salio');
    expect(salio.filas.length).toBeGreaterThan(0);
    expect(salio.filas.reduce((a, f) => a + numero(f.monto), 0)).toBe(numero(res.serie.at(-1)?.salio));

    // El mes pasado también tiene las tres clases de entrada.
    const antes = await leerGraficoEntroVsSalio({ detalle: `${periodo(1)}:entro` });
    if (antes.status !== 'ok' || antes.modo !== 'detalle_entro') throw new Error('esperaba detalle_entro');
    expect(new Set(antes.filas.map((f) => f.origen))).toEqual(new Set(['factura', 'mercadopago', 'dictado']));
  });

  it('gráfico por categoría: torta y detalle', async () => {
    const res = await leerGraficoCategorias();
    if (res.status !== 'ok' || res.modo !== 'serie') throw new Error('esperaba la serie');
    expect(res.periodo).toBe(periodo(0));
    expect(res.serie.length).toBeGreaterThan(0);
    const mayor = res.serie[0];
    if (mayor == null) throw new Error('esperaba una categoría');

    const detalle = await leerGraficoCategorias({ detalle: mayor.categoria });
    if (detalle.status !== 'ok' || detalle.modo !== 'detalle') throw new Error('esperaba el detalle');
    expect(detalle.filas.length).toBeGreaterThan(0);
    expect(detalle.filas.reduce((a, f) => a + numero(f.monto), 0)).toBe(numero(mayor.total));

    const pasado = await leerGraficoCategorias({ mes: periodo(1) });
    if (pasado.status !== 'ok' || pasado.modo !== 'serie') throw new Error('esperaba la serie');
    expect(pasado.serie.length).toBeGreaterThanOrEqual(4);
  });

  it('gráfico de margen por trabajo: con ingreso, sin ingreso y detalle', async () => {
    const res = await leerGraficoMargenTrabajo();
    if (res.status !== 'ok' || res.modo !== 'lista') throw new Error('esperaba la lista');
    expect(res.trabajos.length).toBeGreaterThanOrEqual(3);
    expect(res.sinIngreso.length).toBeGreaterThan(0);
    for (const t of res.trabajos) {
      expect(t.etiqueta).not.toBe('');
      expect(numero(t.cobrado) - numero(t.gastado)).toBe(numero(t.margen));
      expect(t.gastosImputados).toBeGreaterThan(0);
    }
    const primero = res.trabajos[0];
    if (primero == null) throw new Error('esperaba un trabajo');
    const detalle = await leerGraficoMargenTrabajo({ detalle: `${primero.eslabon}:${primero.ref}` });
    if (detalle.status !== 'ok' || detalle.modo !== 'detalle') throw new Error('esperaba el detalle');
    expect(detalle.margen).toBe(primero.margen);

    // El selector de «imputar a un trabajo» junta presupuestos y trabajos: también tiene que llenarse.
    const imputables = await listarTrabajosImputables();
    if (imputables.status !== 'ok') throw new Error('esperaba ok');
    expect(imputables.trabajos.length).toBeGreaterThanOrEqual(7);
    expect(imputables.truncado).toBe(false);
  });
});

describe('actividad', () => {
  it('/actividad: unos quince movimientos mezclados, más nuevo primero', async () => {
    const res = await listarActividad();
    if (res.status !== 'ok') throw new Error('esperaba ok');
    expect(res.items).toHaveLength(15);
    expect(res.cursor).toBeNull();
    expect(new Set(res.items.map((i) => i.tipo)).size).toBeGreaterThanOrEqual(4);
    expect(new Set(res.items.map((i) => i.signo))).toEqual(new Set(['entra', 'sale', 'neutro']));
    for (const i of res.items) {
      expect(i.id).toMatch(/^[a-z]+:\d+$/);
      expect(i.titulo).not.toBe('');
      expect(Number.isNaN(new Date(i.fecha).getTime())).toBe(false);
    }
    const fechas = res.items.map((i) => i.fecha);
    expect([...fechas].sort().reverse()).toEqual(fechas);
    // Son de los últimos días: ninguno de antes del mes pasado.
    expect(fechas.every((f) => f >= `${periodo(1)}-01`)).toBe(true);
  });

  it('con `funcion` filtra por tipo, con `q` por texto, y `limit` recorta', async () => {
    const gastos = await listarActividad({ funcion: 'gastos' });
    if (gastos.status !== 'ok') throw new Error('esperaba ok');
    expect(gastos.items.length).toBeGreaterThan(0);
    expect(gastos.items.every((i) => i.tipo === 'gasto')).toBe(true);

    for (const funcion of ['facturacion', 'ingresos', 'presupuestos']) {
      const res = await listarActividad({ funcion, limit: 50 });
      if (res.status !== 'ok') throw new Error('esperaba ok');
      expect(res.items.length).toBeGreaterThan(0);
    }

    const busqueda = await listarActividad({ q: 'Benítez', limit: 50 });
    if (busqueda.status !== 'ok') throw new Error('esperaba ok');
    expect(busqueda.items.length).toBeGreaterThan(0);
    expect(busqueda.items.every((i) => `${i.titulo} ${i.detalle}`.includes('Benítez'))).toBe(true);

    const sinAcento = await listarActividad({ funcion: 'facturacion', q: 'panaderia' });
    if (sinAcento.status !== 'ok') throw new Error('esperaba ok');
    expect(sinAcento.items.map((i) => i.id)).toEqual(['factura:103']);

    const nada = await listarActividad({ q: 'zzz-no-existe' });
    expect(nada).toEqual({ status: 'ok', items: [], cursor: null });

    const tres = await listarActividad({ limit: 3 });
    if (tres.status !== 'ok') throw new Error('esperaba ok');
    expect(tres.items).toHaveLength(3);
  });
});

describe('ningún lector quedó sin cubrir', () => {
  it('todo lo que pidieron los lectores de este archivo lo contesta el modo demo', async () => {
    await Promise.all([
      apiReal.me(), listarCatalogo(), leerTablero(), leerCalendario(), leerAgenda(), leerVencimientos(), leerPortada(),
      leerGraficoFacturacion(), leerGraficoEntroVsSalio(), leerGraficoCategorias(), leerGraficoMargenTrabajo(),
      listarActividad(), listarGastos(), obtenerResumenGastos(), listarIngresos(), obtenerResumenIngresos(),
      obtenerResumenContabilidad(), estadoAfip(), leerPerfil(CUIT_DEMO), listarComprobantes(CUIT_DEMO), listarImpagos(),
      listarPresupuestos(), listarClientes(), listarConceptos(), leerPerfilNegocio(), leerCapacidades(),
      listarFeedbackPropio(), listarMisTickets(),
    ]);
    const sinCubrir = pedidos.filter((p) => {
      const [metodo = '', path = ''] = p.split(' ');
      return respuestaDemo({ metodo: metodo as PeticionHttp['metodo'], path, headers: {} }) === undefined;
    });
    expect(sinCubrir).toEqual([]);
    expect(pedidos.length).toBeGreaterThanOrEqual(28);
  });
});

describe('las fechas se calculan respecto de hoy', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  // Los días que más rompen: el 1° (no hay «días atrás» dentro del mes), fin de mes, y el cruce de año.
  it.each([
    ['1° de enero', new Date(2027, 0, 1, 9, 0)],
    ['1° de marzo', new Date(2027, 2, 1, 9, 0)],
    ['31 de marzo, de noche', new Date(2027, 2, 31, 23, 30)],
    ['29 de febrero', new Date(2028, 1, 29, 12, 0)],
    ['15 de noviembre', new Date(2026, 10, 15, 12, 0)],
  ])('%s: «este mes» y «mes pasado» siguen teniendo datos y cerrando', async (_nombre, ahora) => {
    jest.useFakeTimers({ now: ahora });

    const portada = await leerPortada();
    const gastos = await obtenerResumenGastos();
    const ingresos = await obtenerResumenIngresos();
    const impagos = await listarImpagos();
    const tablero = await leerTablero();
    const calendario = await leerCalendario();
    const vencimientos = await leerVencimientos();
    const facturacion = await leerGraficoFacturacion({ detalle: periodo(0) });
    const antes = await leerGraficoEntroVsSalio({ detalle: `${periodo(1)}:salio` });
    const actividad = await listarActividad();
    if (
      portada.status !== 'ok' || gastos.status !== 'ok' || ingresos.status !== 'ok' || impagos.status !== 'ok' ||
      tablero.status !== 'ok' || calendario.status !== 'ok' || vencimientos.status !== 'ok' ||
      facturacion.status !== 'ok' || facturacion.modo !== 'detalle' || antes.status !== 'ok' ||
      antes.modo !== 'detalle_salio' || actividad.status !== 'ok'
    ) {
      throw new Error('esperaba ok en todos');
    }

    expect(gastos.resumen.periodo).toBe(periodo(0));
    expect(gastos.resumen.total).toBe('579000.00');
    expect(gastos.resumen.mesAnterior).toBe('527000.00');
    expect(ingresos.resumen.total).toBe('1122000.00');
    expect(ingresos.resumen.mesAnterior).toBe('776000.00');
    expect(portada.portada.mes.rentabilidad).toBe('543000.00');
    expect(portada.portada.mes.facturado).toBe('1215000.00');
    expect(portada.portada.mes.cobrado).toBe('1055000.00');
    expect(portada.portada.porCobrar).toEqual({ total: '420000.00', vencido: '260000.00' });
    expect(portada.portada.serieMensual.map((p) => p.mes)).toEqual([5, 4, 3, 2, 1, 0].map(periodo));
    expect(impagos.totalAdeudado).toBe('420000.00');
    expect(facturacion.filas).toHaveLength(4);
    expect(antes.filas).toHaveLength(6);
    expect(actividad.items).toHaveLength(15);
    expect(calendario.calendario.eventos).toHaveLength(4);
    expect(vencimientos.vencimientos.length).toBeGreaterThanOrEqual(2);
    expect(tablero.tablero.solapas[0]?.tarjetas).toHaveLength(5);
    // La factura impaga vieja siempre tiene al menos tres semanas, y ningún plazo sale negativo.
    expect(impagos.comprobantes.find((c) => c.id === 103)?.dias).toBeGreaterThanOrEqual(18);
    for (const c of impagos.comprobantes) expect(c.dias).toBeGreaterThanOrEqual(0);
    for (const t of tablero.tablero.solapas.flatMap((s) => s.tarjetas)) {
      expect(`${t.texto} ${t.presentacion?.chip?.texto ?? ''}`).not.toMatch(/-\d/);
    }
  });
});

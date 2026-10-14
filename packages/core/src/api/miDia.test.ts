import { beforeEach, describe, expect, it } from 'vitest';

import {
  borrarTarjetaMiDia,
  cambiarEstadoTarjetaMiDia,
  crearTarjetaMiDia,
  horaDeEvento,
  leerCalendario,
  leerTablero,
} from './miDia';
import { configurarApi } from './config';
import type { HttpPort, PeticionHttp, RespuestaHttp } from './http';
import type { AlmacenTokens } from './tokens';

/**
 * `/mi-dia/*` — el detector proactivo, 3 solapas + las 3 mutaciones. Molde del arnés:
 * `conceptos.test.ts`/`presupuestos.test.ts`.
 *
 * **Forma CONFIRMADA por backend** (PR#96, endpoint vivo — verificado 401 sin token). Estos tests
 * fijan la forma real y las reglas que un tablero no puede violar: no confundir «no desplegado» con
 * «tablero vacío», una tarjeta sin `texto` redactado no es una tarjeta, `null` ≠ `0`, `datos` sin
 * forma cerrada no descarta la tarjeta por traer campos que no reconozco.
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

const TARJETA_CRUDA = {
  id: 't1',
  regla: 'trabajo_con_gastos_y_sin_ingreso',
  entidad_tipo: 'trabajo',
  entidad_id: 'trab-1',
  texto: 'Pusiste $42.000 en el trabajo de la panadería y no registraste que te pagaran. ¿Te lo pagaron?',
  estado: 'para_hoy',
  datos: { cliente: 'Panadería del barrio', monto: '42000.00', fecha: '2026-07-20' },
  creada_en: '2026-07-20T09:00:00Z',
  movida_en: null,
};

const TABLERO_VIVO = {
  solapas: [
    { id: 'para_hoy', titulo: 'Para hoy', tarjetas: [TARJETA_CRUDA] },
    { id: 'haciendo', titulo: 'Haciendo', tarjetas: [] },
    { id: 'hecha', titulo: 'Hechas', tarjetas: [] },
  ],
};

beforeEach(() => {
  responder = () => respuesta(200, {});
  const http: HttpPort = { async enviar(p) { return responder(p); } };
  configurarApi({ http, tokens: crearTokensFake() });
});

describe('leerTablero — el camino bueno', () => {
  it('trae las 3 solapas en orden (id "hecha" singular), con sus tarjetas y la plata como string', async () => {
    responder = () => respuesta(200, TABLERO_VIVO);

    const res = await leerTablero();

    expect(res.status).toBe('ok');
    if (res.status !== 'ok') return;
    expect(res.tablero.solapas.map((s) => s.id)).toEqual(['para_hoy', 'haciendo', 'hecha']);
    const t = res.tablero.solapas[0]!.tarjetas[0]!;
    expect(t.id).toBe('t1');
    expect(t.texto).toContain('¿Te lo pagaron?');
    expect(t.regla).toBe('trabajo_con_gastos_y_sin_ingreso');
    expect(t.entidadTipo).toBe('trabajo');
    expect(t.cliente).toBe('Panadería del barrio');
  });

  it('🔴 control de ceguera H12: `datos.monto`/`datos.fecha` existen en el wire y la tarjeta NO los expone', async () => {
    // El wire trae `monto` y `fecha` (TARJETA_CRUDA los lleva en `datos`) y aun así la tarjeta no los tiene:
    // ninguna regla los escribe (H12/DETALLEKV), y si la app vuelve a leerlos las filas «Monto»/«Fecha» quedan
    // escritas e inalcanzables sin dar síntoma. Si alguien los re-agrega a `TarjetaMiDia`, este test cae.
    responder = () => respuesta(200, TABLERO_VIVO);
    const res = await leerTablero();
    if (res.status !== 'ok') throw new Error('esperaba ok');
    const t = res.tablero.solapas[0]!.tarjetas[0]!;
    expect('monto' in t).toBe(false);
    expect('fecha' in t).toBe(false);
  });
});

describe('leerTablero — H5b (`datos.destino`, enum cerrado, aditivo)', () => {
  async function tarjetaConDatos(datos: unknown) {
    const cruda = { ...TARJETA_CRUDA, criticidad: 'critico', verbo: 'Reconectar', datos };
    responder = () => respuesta(200, { solapas: [{ id: 'para_hoy', titulo: 'Para hoy', tarjetas: [cruda] }] });
    const res = await leerTablero();
    if (res.status !== 'ok') throw new Error('esperaba ok');
    return res.tablero.solapas[0]!.tarjetas[0]!;
  }

  it('lee el shape congelado del contrato: tipo, id y connect_path verbatim (MercadoPago ≠ Composio)', async () => {
    const t = await tarjetaConDatos({
      servicio: 'mercadopago',
      destino: { tipo: 'conexion', id: 'mercadopago', connect_path: '/mp/connect' },
    });
    expect(t.destino).toEqual({ tipo: 'conexion', id: 'mercadopago', connectPath: '/mp/connect' });
  });

  it('un servicio Composio conserva su connect_path tal cual, sin reconstruirlo desde la key', async () => {
    const t = await tarjetaConDatos({
      destino: { tipo: 'conexion', id: 'gmail', connect_path: '/composio/connect?service=gmail' },
    });
    expect(t.destino?.connectPath).toBe('/composio/connect?service=gmail');
  });

  it('🔴 un tipo que el contrato no define LLEGA como string (no se descarta): decide quien rutea', async () => {
    const t = await tarjetaConDatos({ destino: { tipo: 'lo-que-sea', id: 'x' } });
    expect(t.destino).toEqual({ tipo: 'lo-que-sea', id: 'x', connectPath: null });
  });

  it('🔴 sin `destino` (backend previo) o con uno malformado → null, nunca inventado', async () => {
    expect((await tarjetaConDatos({ servicio: 'mercadopago' })).destino).toBeNull();
    expect((await tarjetaConDatos({ destino: 'conexion' })).destino).toBeNull();
    expect((await tarjetaConDatos({ destino: { id: 'mercadopago' } })).destino).toBeNull();
    expect((await tarjetaConDatos({ destino: { tipo: '  ' } })).destino).toBeNull();
  });
});

describe('leerTablero — `datos.desde` NO se transporta (KVCAIDASALE: «Se cayó» lo arma el backend)', () => {
  async function tarjetasCon(datos: unknown) {
    const cruda = { ...TARJETA_CRUDA, regla: 'conexion_caida', datos };
    responder = () => respuesta(200, { solapas: [{ id: 'para_hoy', titulo: 'Para hoy', tarjetas: [cruda] }] });
    const res = await leerTablero();
    if (res.status !== 'ok') throw new Error('esperaba ok');
    return res.tablero.solapas[0]!.tarjetas;
  }

  it('🔴 aunque el backend mande `datos.desde`, la tarjeta no lo expone: la app no puede armar «Se cayó»', async () => {
    const tarjetas = await tarjetasCon({
      destino: { tipo: 'conexion', id: 'mercadopago' },
      desde: '2026-10-13T12:12:00+00:00',
    });
    // Control de ceguera: miró UNA tarjeta real, de la regla correcta, y leyó `datos` (su `destino` sí viaja).
    // Sin esto, un recorrido vacío o un `datos` ignorado haría pasar los `not` de abajo solos.
    expect(tarjetas).toHaveLength(1);
    expect(tarjetas[0]!.regla).toBe('conexion_caida');
    expect(tarjetas[0]!.destino).toEqual({ tipo: 'conexion', id: 'mercadopago', connectPath: null });
    expect(tarjetas[0]).not.toHaveProperty('desde');
    expect(JSON.stringify(tarjetas[0])).not.toContain('2026-10-13T12:12');
  });
});

describe('leerTablero — BL-J5 (categoria / criticidad / verbo, aditivos)', () => {
  it('lee los tres campos que manda el backend', async () => {
    const cruda = { ...TARJETA_CRUDA, categoria: 'arca', criticidad: 'critico', verbo: 'Renovarlo' };
    responder = () => respuesta(200, { solapas: [{ id: 'para_hoy', titulo: 'Para hoy', tarjetas: [cruda] }] });

    const res = await leerTablero();

    if (res.status !== 'ok') throw new Error('esperaba ok');
    expect(res.tablero.solapas[0]!.tarjetas[0]).toMatchObject({
      categoria: 'arca', criticidad: 'critico', verbo: 'Renovarlo',
    });
  });

  it('🔴 fixture vieja (sin los campos) sigue parseando: null, nunca inventados', async () => {
    responder = () => respuesta(200, TABLERO_VIVO);

    const res = await leerTablero();

    if (res.status !== 'ok') throw new Error('esperaba ok');
    expect(res.tablero.solapas[0]!.tarjetas[0]).toMatchObject({ categoria: null, criticidad: null, verbo: null });
  });

  it('un valor vacío no se inventa: verbo "" → null', async () => {
    const cruda = { ...TARJETA_CRUDA, verbo: '  ', categoria: '' };
    responder = () => respuesta(200, { solapas: [{ id: 'para_hoy', titulo: 'Para hoy', tarjetas: [cruda] }] });

    const res = await leerTablero();

    if (res.status !== 'ok') throw new Error('esperaba ok');
    expect(res.tablero.solapas[0]!.tarjetas[0]).toMatchObject({ categoria: null, verbo: null });
  });
});

describe('leerTablero — lo que NO inventa', () => {
  it('🔴 un `200` con el HTML del SPA es `no_disponible`, NO un tablero vacío', async () => {
    responder = () => respuesta(200, '<!doctype html><html><body>app</body></html>');
    expect((await leerTablero()).status).toBe('no_disponible');
  });

  it('🔴 CONTROL — un tablero REAL con solapas vacías sí es `ok`', async () => {
    responder = () => respuesta(200, { solapas: [{ id: 'para_hoy', titulo: 'Para hoy', tarjetas: [] }] });
    const res = await leerTablero();
    expect(res.status).toBe('ok');
    if (res.status === 'ok') expect(res.tablero.solapas[0]!.tarjetas).toEqual([]);
  });

  it('🔴 una tarjeta SIN `texto` redactado se descarta — un id sin frase no es una tarjeta', async () => {
    responder = () =>
      respuesta(200, {
        solapas: [
          {
            id: 'para_hoy',
            titulo: 'Para hoy',
            tarjetas: [{ id: 'sin-texto', regla: 'x' }, { id: 'ok', texto: 'con texto' }],
          },
        ],
      });
    const res = await leerTablero();
    if (res.status === 'ok') expect(res.tablero.solapas[0]!.tarjetas.map((t) => t.id)).toEqual(['ok']);
  });

  it('🔴 una tarjeta SIN id se descarta — sin identidad no se puede seguir', async () => {
    responder = () =>
      respuesta(200, {
        solapas: [{ id: 'para_hoy', titulo: 'P', tarjetas: [{ texto: 'sin id' }, { id: 'ok', texto: 'con id' }] }],
      });
    const res = await leerTablero();
    if (res.status === 'ok') expect(res.tablero.solapas[0]!.tarjetas.map((t) => t.id)).toEqual(['ok']);
  });

  it('🔴 una solapa con id fuera del conjunto cerrado se descarta', async () => {
    responder = () =>
      respuesta(200, { solapas: [{ id: 'solapa_inventada', titulo: 'X', tarjetas: [] }, TABLERO_VIVO.solapas[1]] });
    const res = await leerTablero();
    if (res.status === 'ok') expect(res.tablero.solapas.map((s) => s.id)).toEqual(['haciendo']);
  });

  it('🔴 `datos` sin forma conocida no descarta la tarjeta ni inventa un cliente', async () => {
    responder = () =>
      respuesta(200, { solapas: [{ id: 'para_hoy', titulo: 'P', tarjetas: [{ id: 'a', texto: 'm', datos: { otro_campo: 'x' } }] }] });
    const res = await leerTablero();
    if (res.status === 'ok') {
      expect(res.tablero.solapas[0]!.tarjetas[0]!.id).toBe('a');
      expect(res.tablero.solapas[0]!.tarjetas[0]!.cliente).toBeNull();
    }
  });

  it('si la red explota degrada a `no_disponible`', async () => {
    responder = () => { throw new Error('red caída'); };
    expect((await leerTablero()).status).toBe('no_disponible');
  });
});

describe('crearTarjetaMiDia', () => {
  it('manda el texto y devuelve la tarjeta creada', async () => {
    let cuerpo: unknown = null;
    responder = (p) => {
      cuerpo = p.cuerpoJson;
      return respuesta(201, { tarjeta: TARJETA_CRUDA });
    };

    const res = await crearTarjetaMiDia('Llamar a Kiosco por el presupuesto');

    expect(cuerpo).toEqual({ texto: 'Llamar a Kiosco por el presupuesto' });
    expect(res.status).toBe('ok');
    if (res.status === 'ok') expect(res.tarjeta.id).toBe('t1');
  });

  it('endpoint no desplegado degrada a `no_disponible`', async () => {
    responder = () => respuesta(404, { detail: 'not found' });
    expect((await crearTarjetaMiDia('x')).status).toBe('no_disponible');
  });
});

describe('cambiarEstadoTarjetaMiDia', () => {
  it('manda el estado y devuelve la tarjeta actualizada', async () => {
    let cuerpo: unknown = null;
    let ruta = '';
    responder = (p) => {
      cuerpo = p.cuerpoJson;
      ruta = p.path;
      return respuesta(200, { tarjeta: { ...TARJETA_CRUDA, estado: 'hecha' } });
    };

    const res = await cambiarEstadoTarjetaMiDia('t1', 'hecha');

    expect(cuerpo).toEqual({ estado: 'hecha' });
    expect(ruta).toContain('/mi-dia/tarjetas/t1/estado');
    expect(res.status).toBe('ok');
    if (res.status === 'ok') expect(res.tarjeta.estado).toBe('hecha');
  });

  it('🔴 tarjeta inexistente → `no_encontrado`, no una excepción sin manejar', async () => {
    responder = () => respuesta(404, { detail: 'no existe' });
    expect((await cambiarEstadoTarjetaMiDia('fantasma', 'hecha')).status).toBe('no_encontrado');
  });

  it('🔴 estado inválido → el motivo lo explica el backend, no un genérico', async () => {
    responder = () => respuesta(400, { detail: 'ese estado no existe' });
    const res = await cambiarEstadoTarjetaMiDia('t1', 'estado_inventado');
    expect(res).toEqual({ status: 'estado_invalido', motivo: 'ese estado no existe' });
  });
});

describe('borrarTarjetaMiDia', () => {
  it('llama al DELETE', async () => {
    let ruta = '';
    let metodo = '';
    responder = (p) => {
      ruta = p.path;
      metodo = p.metodo;
      return respuesta(200, { ok: true });
    };

    expect((await borrarTarjetaMiDia('t1')).status).toBe('ok');
    expect(metodo).toBe('DELETE');
    expect(ruta).toContain('/mi-dia/tarjetas/t1');
  });

  it('🔴 tarjeta inexistente → `no_encontrado`', async () => {
    responder = () => respuesta(404, { detail: 'no existe' });
    expect((await borrarTarjetaMiDia('fantasma')).status).toBe('no_encontrado');
  });
});

/**
 * `/mi-dia/calendario` (CAL1) — sólo lectura, panel aparte del Kanban. `inicio` viaja crudo
 * (`inicioCrudo`) porque el shape real todavía no está confirmado contra Composio (bloqueado por el
 * OAuth del tenant canónico, ver `mi_dia_web.py`) — estos tests fijan lo que SÍ está confirmado
 * (`conectado`/`id`/`titulo`) y que `horaDeEvento` nunca revienta con formas que no reconoce.
 */
describe('leerCalendario', () => {
  it('`conectado: false` con `eventos: []` es un estado válido, no un error', async () => {
    responder = () => respuesta(200, { conectado: false, eventos: [] });
    const res = await leerCalendario();
    expect(res.status).toBe('ok');
    if (res.status === 'ok') {
      expect(res.calendario.conectado).toBe(false);
      expect(res.calendario.eventos).toEqual([]);
    }
  });

  it('trae id/título de cada evento y transporta `inicio` crudo sin parsearlo', async () => {
    responder = () =>
      respuesta(200, {
        conectado: true,
        eventos: [{ id: 'ev1', titulo: 'Reunión con proveedor', inicio: { dateTime: '2026-08-12T15:00:00-03:00' } }],
      });
    const res = await leerCalendario();
    expect(res.status).toBe('ok');
    if (res.status !== 'ok') return;
    expect(res.calendario.conectado).toBe(true);
    const ev = res.calendario.eventos[0]!;
    expect(ev.id).toBe('ev1');
    expect(ev.titulo).toBe('Reunión con proveedor');
    expect(ev.inicioCrudo).toEqual({ dateTime: '2026-08-12T15:00:00-03:00' });
  });

  it('🔴 un evento sin `titulo` se descarta — mismo criterio que una tarjeta sin `texto`', async () => {
    responder = () =>
      respuesta(200, { conectado: true, eventos: [{ id: 'sin-titulo' }, { id: 'ok', titulo: 'Con título' }] });
    const res = await leerCalendario();
    if (res.status === 'ok') expect(res.calendario.eventos.map((e) => e.id)).toEqual(['ok']);
  });

  it('🔴 un `200` con el HTML del SPA es `no_disponible`, no un calendario vacío', async () => {
    responder = () => respuesta(200, '<!doctype html><html><body>app</body></html>');
    expect((await leerCalendario()).status).toBe('no_disponible');
  });

  it('pega a `/mi-dia/calendario`', async () => {
    let ruta = '';
    responder = (p) => {
      ruta = p.path;
      return respuesta(200, { conectado: false, eventos: [] });
    };
    await leerCalendario();
    expect(ruta).toContain('/mi-dia/calendario');
  });
});

describe('horaDeEvento — sólo muestra lo que reconoce con certeza', () => {
  it('un string ISO se formatea', () => {
    expect(horaDeEvento('2026-08-12T15:00:00-03:00')).not.toBeNull();
  });

  it('`{dateTime}` (evento con hora) se formatea', () => {
    expect(horaDeEvento({ dateTime: '2026-08-12T15:00:00-03:00' })).not.toBeNull();
  });

  it('🔴 `{date}` (evento de día completo) no tiene hora que mostrar — `null`, no medianoche inventada', () => {
    expect(horaDeEvento({ date: '2026-08-12' })).toBeNull();
  });

  it('🔴 una forma que no reconoce no revienta — `null`', () => {
    expect(horaDeEvento({ algo: 'raro' })).toBeNull();
    expect(horaDeEvento(null)).toBeNull();
    expect(horaDeEvento(undefined)).toBeNull();
    expect(horaDeEvento(42)).toBeNull();
  });
});

describe('leerTablero — PROTO4DEPS §C (`presentacion`, fail-soft, aditiva)', () => {
  async function tarjetaCon(extra: Record<string, unknown>) {
    const cruda = { ...TARJETA_CRUDA, ...extra };
    responder = () => respuesta(200, { solapas: [{ id: 'para_hoy', titulo: 'Para hoy', tarjetas: [cruda] }] });
    const res = await leerTablero();
    if (res.status !== 'ok') throw new Error('esperaba ok');
    return res.tablero.solapas[0]!.tarjetas[0]!;
  }

  const PRESENTACION = {
    chip: { texto: '31 días sin respuesta', tono: 'pronto' },
    kv: [
      { k: 'Monto', v: '$84.000' },
      { k: 'Enviado', v: '12/09' },
    ],
    accion: { texto: 'Reclamar el pago', destino: { tipo: 'presupuesto', id: '412' } },
  };

  it('🔴 el caso VACÍO primero — es el de producción hoy: sin `presentacion` → null, la tarjeta se lee como siempre', async () => {
    const t = await tarjetaCon({});
    expect(t.presentacion).toBeNull();
    expect(t.texto).toContain('¿Te lo pagaron?');
  });

  it('lee las tres piezas; `accion.destino` conserva tipo e id para que lo rutee la app', async () => {
    const t = await tarjetaCon({ presentacion: PRESENTACION });
    expect(t.presentacion).toEqual({
      prosa: null,
      chip: { texto: '31 días sin respuesta', tono: 'pronto' },
      kv: [
        { k: 'Monto', v: '$84.000' },
        { k: 'Enviado', v: '12/09' },
      ],
      accion: { texto: 'Reclamar el pago', destino: { tipo: 'presupuesto', id: '412', connectPath: null } },
    });
  });

  it('acepta `presentacion` colgando de `datos` (el contrato no fija el lugar)', async () => {
    const t = await tarjetaCon({ datos: { presentacion: PRESENTACION } });
    expect(t.presentacion?.chip?.texto).toBe('31 días sin respuesta');
  });

  it('un `tono` desconocido NO descarta el chip (sólo la app decide qué hacer con él)', async () => {
    const t = await tarjetaCon({ presentacion: { chip: { texto: 'Nuevo', tono: 'urgentisimo' } } });
    expect(t.presentacion?.chip).toEqual({ texto: 'Nuevo', tono: 'urgentisimo' });
  });

  it('cada pieza es independiente: una `kv` rota no se lleva el chip; una acción sin texto no existe', async () => {
    const t = await tarjetaCon({
      presentacion: { chip: { texto: 'Vence en 3 días', tono: 'critico' }, kv: [{ k: 'Monto' }, 'x', { k: 'Vence', v: '15/10' }], accion: { destino: { tipo: 'conexion', id: 'gmail' } } },
    });
    expect(t.presentacion).toEqual({ prosa: null, chip: { texto: 'Vence en 3 días', tono: 'critico' }, kv: [{ k: 'Vence', v: '15/10' }], accion: null });
  });

  describe('H12 — `prosa` (el importe de la factura vive acá, no en ninguna `kv`)', () => {
    const PROSA = 'Emitida hace 22 días. Son $120.000 que ya facturaste y todavía no entraron.';

    it('🔴 una tarjeta de SÓLO prosa se lee (regla «trabajo»: `kv: []`); con el guard viejo daba null y la prosa no se pintaba nunca', async () => {
      const t = await tarjetaCon({ presentacion: { prosa: PROSA, kv: [] } });
      expect(t.presentacion).toEqual({ prosa: PROSA, chip: null, kv: [], accion: null });
    });

    it('prosa y kv viajan juntas, ya formateadas, sin tocarlas', async () => {
      const t = await tarjetaCon({
        presentacion: { prosa: PROSA, kv: [{ k: 'Factura', v: 'A-0034' }, { k: 'Emitida', v: '22 de septiembre' }] },
      });
      expect(t.presentacion?.prosa).toBe(PROSA);
      expect(t.presentacion?.kv).toEqual([{ k: 'Factura', v: 'A-0034' }, { k: 'Emitida', v: '22 de septiembre' }]);
    });

    it('una `kv` con otra forma ({clave, valor}) se descarta y NO se lleva la prosa: el importe sigue en pantalla', async () => {
      const t = await tarjetaCon({ presentacion: { prosa: PROSA, kv: [{ clave: 'Factura', valor: 'A-0034' }] } });
      expect(t.presentacion).toEqual({ prosa: PROSA, chip: null, kv: [], accion: null });
    });

    it('prosa en blanco no cuenta: sin otra pieza pintable → null', async () => {
      expect((await tarjetaCon({ presentacion: { prosa: '   ', kv: [] } })).presentacion).toBeNull();
    });
  });

  it('basura o vacía → null, nunca un objeto a medias', async () => {
    for (const presentacion of ['x', 42, [], {}, { chip: {}, kv: [], accion: {} }]) {
      expect((await tarjetaCon({ presentacion })).presentacion).toBeNull();
    }
  });
});

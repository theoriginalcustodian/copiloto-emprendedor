import { beforeEach, describe, expect, it } from 'vitest';

import { configurarApi } from './config';
import type { HttpPort, PeticionHttp, RespuestaHttp } from './http';
import type { AlmacenTokens } from './tokens';
import { borrarCobro, listarImpagos, registrarCobro } from './cobros';

/**
 * Los endpoints de cobros **no existían** cuando se escribió esto: la forma la declaró backend en
 * `dato_backend-a-todos_hito3-la-forma-final-de-los-tres-endpoints`. Estos tests fijan **esa** forma,
 * no una medida — y por eso el caso que más importa acá es el de degradación honesta.
 *
 * Molde del arnés: `clientes.test.ts` — `HttpPort` FAKE, sin `fetch` real.
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

describe('registrarCobro', () => {
  it('manda `idem_key` SIEMPRE, y omite lo que no vino', async () => {
    // 🔴 Sin `idem_key`, dos toques del botón dejan DOS cobros — y el backend hace bien en
    // aceptarlos, porque dos cobros parciales del mismo monto son un caso real. El único que puede
    // distinguir "cobré dos veces" de "toqué dos veces" es este lado.
    let cuerpo: unknown = null;
    responder = (p) => {
      cuerpo = p.cuerpoJson;
      return respuesta(201, { cobro: { id: 1, monto: '12500.00' }, comprobante: { id: 9, total: '12500.00', cobrado: '12500.00', saldo: '0.00', estado_cobro: 'cobrada' } });
    };

    await registrarCobro(9, { idemKey: 'uuid-del-gesto' });

    // 🔴 `monto` OMITIDO, no `null`: omitido significa "el saldo pendiente completo", que es el caso
    // del botón «Cobrada» de v1. Mandarlo en `null` sería otra cosa.
    expect(cuerpo).toEqual({ idem_key: 'uuid-del-gesto' });
  });

  it('cuando el monto viene, viaja tal cual — string decimal, sin pasar por Number', async () => {
    let cuerpo: Record<string, unknown> = {};
    responder = (p) => {
      cuerpo = p.cuerpoJson as Record<string, unknown>;
      return respuesta(201, { cobro: { id: 1, monto: '5000.50' }, comprobante: { id: 9 } });
    };

    await registrarCobro(9, { idemKey: 'g1', monto: '5000.50', medio: 'efectivo' });

    expect(cuerpo.monto).toBe('5000.50');
    expect(cuerpo.medio).toBe('efectivo');
  });

  it('🔴 devuelve el comprobante del BACKEND, no un saldo recalculado acá', async () => {
    // El saldo lo deriva el backend (`total − Σ cobros`). Restarlo del lado del cliente daría dos
    // fuentes para el mismo número, y la que se ve en pantalla podría no ser la que decide el estado.
    responder = () => respuesta(200, {
      cobro: { id: 3, monto: '5000.00', medio: 'transferencia', fecha: '2026-07-22', created_at: '2026-07-22T10:00:00Z' },
      comprobante: { id: 9, total: '12500.00', cobrado: '5000.00', saldo: '7500.00', estado_cobro: 'parcial' },
    });

    const res = await registrarCobro(9, { idemKey: 'g1', monto: '5000.00' });

    expect(res.status).toBe('ok');
    if (res.status !== 'ok') throw new Error('esperaba ok');
    expect(res.comprobante).toEqual({
      id: 9, total: '12500.00', cobrado: '5000.00', saldo: '7500.00', estadoCobro: 'parcial',
    });
    expect(res.cobro?.medio).toBe('transferencia');
  });

  it('🔴 un importe AUSENTE queda en `null`, nunca en cero', async () => {
    // "No sé si se cobró" y "no se cobró nada" se ven idénticos en pantalla si el cliente los
    // colapsa acá — y sólo uno de los dos es cierto. Misma familia que `facturas_atribuibles`.
    responder = () => respuesta(200, { cobro: { id: 1, monto: '100.00' }, comprobante: { id: 9, total: '100.00' } });

    const res = await registrarCobro(9, { idemKey: 'g1' });

    if (res.status !== 'ok') throw new Error('esperaba ok');
    expect(res.comprobante).toMatchObject({ cobrado: null, saldo: null, estadoCobro: null });
  });

  it('🔴 un `estado_cobro` desconocido cae en `null`, NO en "impaga"', async () => {
    // Si mañana el backend agrega un cuarto estado, tratarlo como impaga afirmaría que le deben
    // plata a alguien que quizá ya pagó. `null` deja que la UI diga "no sé".
    responder = () => respuesta(200, { cobro: { id: 1, monto: '1' }, comprobante: { id: 9, estado_cobro: 'en_disputa' } });

    const res = await registrarCobro(9, { idemKey: 'g1' });

    if (res.status !== 'ok') throw new Error('esperaba ok');
    expect(res.comprobante?.estadoCobro).toBeNull();
  });

  it('el 400 del backend se devuelve CON su motivo, no con un texto nuestro', async () => {
    // El backend sabe por qué rechazó (monto ≤ 0, o mayor que el saldo). Reescribirlo acá perdería
    // el dato justo cuando hace falta.
    responder = () => respuesta(400, { detail: 'El monto supera el saldo pendiente.' });

    const res = await registrarCobro(9, { idemKey: 'g1', monto: '999999.00' });

    expect(res).toEqual({ status: 'rechazado', motivo: 'El monto supera el saldo pendiente.' });
  });

  it('404 → `no_encontrado` (no existe, o es de otro emprendedor: el backend no los distingue)', async () => {
    responder = () => respuesta(404, { detail: 'not found' });
    expect(await registrarCobro(9, { idemKey: 'g1' })).toEqual({ status: 'no_encontrado' });
  });

  it('🔴 405 → `no_disponible`: el endpoint todavía no está desplegado', async () => {
    // Es el estado REAL al escribir esto. La pantalla tiene que decirlo, no fingir que cobró.
    responder = () => respuesta(405, { detail: 'method not allowed' });
    expect(await registrarCobro(9, { idemKey: 'g1' })).toEqual({ status: 'no_disponible' });
  });

  it('un error que NO sabemos manejar se propaga — no se traga', async () => {
    // El control del propio manejo de errores: si todo cayera en `no_disponible`, un 500 se leería
    // como "función no desplegada" y nadie iría a mirar el servidor.
    responder = () => respuesta(500, { detail: 'boom' });
    await expect(registrarCobro(9, { idemKey: 'g1' })).rejects.toThrow();
  });
});

describe('borrarCobro', () => {
  it('devuelve el comprobante recalculado por el backend', async () => {
    responder = () => respuesta(200, { comprobante: { id: 9, total: '100.00', cobrado: '0.00', saldo: '100.00', estado_cobro: 'impaga' } });

    const res = await borrarCobro(9, 3);

    if (res.status !== 'ok') throw new Error('esperaba ok');
    expect(res.comprobante).toMatchObject({ saldo: '100.00', estadoCobro: 'impaga' });
  });

  it('405 → `no_disponible`', async () => {
    responder = () => respuesta(405, { detail: 'nope' });
    expect(await borrarCobro(9, 3)).toEqual({ status: 'no_disponible' });
  });
});

describe('listarImpagos', () => {
  it('🔴 usa el `total_adeudado` que manda el backend — no lo recalcula sumando', async () => {
    // Sumar del lado del cliente daría un segundo número para la misma pregunta. El día que difieran
    // —un redondeo, una página que no llegó— el emprendedor ve dos verdades y deja de creerle a las dos.
    responder = () => respuesta(200, {
      comprobantes: [
        { id: 1, nro: 18, receptor_nombre: 'Panadería Los Tilos', fecha_emision: '2026-06-01', total: '30000.00', cobrado: '0.00', saldo: '30000.00', estado_cobro: 'impaga', dias: 51 },
        { id: 2, nro: 19, receptor_nombre: 'Ferretería', fecha_emision: '2026-07-01', total: '20000.00', cobrado: '1800.00', saldo: '18200.00', estado_cobro: 'parcial', dias: 21 },
      ],
      total_adeudado: '48200.00',
    });

    const res = await listarImpagos();

    if (res.status !== 'ok') throw new Error('esperaba ok');
    expect(res.totalAdeudado).toBe('48200.00');
    expect(res.comprobantes).toHaveLength(2);
    expect(res.comprobantes[1]).toMatchObject({ receptorNombre: 'Ferretería', saldo: '18200.00', dias: 21 });
  });

  it('🔴 `dias` ausente queda en `null`, no en 0', async () => {
    // Con 0 la fila diría «hace 0 días» sobre una factura de marzo. "Hoy" y "no sé" son distintos.
    responder = () => respuesta(200, { comprobantes: [{ id: 1, total: '100.00' }], total_adeudado: '100.00' });

    const res = await listarImpagos();

    if (res.status !== 'ok') throw new Error('esperaba ok');
    expect(res.comprobantes[0]?.dias).toBeNull();
  });

  it('una fila sin `id` se descarta — no se puede abrir ni cobrar', async () => {
    responder = () => respuesta(200, { comprobantes: [{ nro: 5, total: '10.00' }, { id: 2, total: '20.00' }], total_adeudado: '30.00' });

    const res = await listarImpagos();

    if (res.status !== 'ok') throw new Error('esperaba ok');
    expect(res.comprobantes.map((c) => c.id)).toEqual([2]);
  });

  it('sin deudas responde ok con lista vacía — NO es un error ni un vacío misterioso', async () => {
    responder = () => respuesta(200, { comprobantes: [], total_adeudado: '0.00' });

    const res = await listarImpagos();

    if (res.status !== 'ok') throw new Error('esperaba ok');
    expect(res.comprobantes).toEqual([]);
    expect(res.totalAdeudado).toBe('0.00');
  });

  it('🔴 405 → `no_disponible`, y ESO es distinto de "no te deben nada"', async () => {
    // El control que separa las dos lecturas del mismo vacío: sin esto, un endpoint no desplegado
    // se vería como una pantalla que dice «nadie te debe» — la mentira más cara de esta función.
    responder = () => respuesta(405, { detail: 'nope' });
    expect(await listarImpagos()).toEqual({ status: 'no_disponible' });
  });
});

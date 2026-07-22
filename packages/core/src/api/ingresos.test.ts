import { beforeEach, describe, expect, it } from 'vitest';

import { configurarApi } from './config';
import type { HttpPort, PeticionHttp, RespuestaHttp } from './http';
import { borrarIngreso, completarIngreso, listarIngresos, registrarIngreso } from './ingresos';
import type { AlmacenTokens } from './tokens';

/**
 * `/ingresos` — todo lo que entró. Forma **leída del código del backend** (`cobro_store.py::_fila` y
 * `listar_ingresos`, `afip_web.py:334-403`) el 2026-07-22, no deducida del avance: las dos respuestas
 * NO traen los mismos campos y esa asimetría es justo lo que un cliente descuidado colapsa en un
 * default.
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

describe('listarIngresos', () => {
  it('trae el total que suma el backend, sin recalcularlo', async () => {
    responder = () =>
      respuesta(200, {
        ingresos: [
          { id: 1, monto: '85000.00', medio: 'efectivo', fecha: '2026-07-22', origen: 'manual', borrable: true },
          { id: 2, monto: '10000.00', medio: '', fecha: '2026-07-21', origen: 'factura', comprobante_nro: 901, borrable: false },
        ],
        total: '95000.00',
      });

    const res = await listarIngresos();

    expect(res.status).toBe('ok');
    if (res.status === 'ok') {
      expect(res.total).toBe('95000.00');
      expect(res.ingresos.map((i) => i.origen)).toEqual(['manual', 'factura']);
    }
  });

  it('🔴 el listado NO trae `falta`, y eso queda en null — nunca en []', async () => {
    // `[]` diría "no falta nada", que es una afirmación. El listado sencillamente no lo manda.
    responder = () => respuesta(200, { ingresos: [{ id: 1, monto: '85000', origen: 'manual', borrable: true }], total: '85000' });

    const res = await listarIngresos();

    if (res.status === 'ok') expect(res.ingresos[0].falta).toBeNull();
    else throw new Error('esperaba ok');
  });

  it('🔴 `medio` vacío del wire es null, no una cadena en blanco', async () => {
    // El backend manda `""` para "no lo dijo"; en la UI eso se lee como un renglón vacío, o sea como
    // un bug de pintado en vez de un dato que falta.
    responder = () => respuesta(200, { ingresos: [{ id: 1, monto: '1', medio: '', concepto: '', origen: 'manual' }], total: '1' });

    const res = await listarIngresos();

    if (res.status === 'ok') {
      expect(res.ingresos[0].medio).toBeNull();
      expect(res.ingresos[0].concepto).toBeNull();
    } else throw new Error('esperaba ok');
  });

  it('🔴 un origen desconocido cae en `manual` — el que se muestra con MENOS autoridad', async () => {
    // Al revés le daría a algo tipeado el peso de algo que el sistema vio, que es la mezcla que
    // `origen` existe para impedir.
    responder = () => respuesta(200, { ingresos: [{ id: 1, monto: '1', origen: 'inventado' }], total: '1' });

    const res = await listarIngresos();

    if (res.status === 'ok') expect(res.ingresos[0].origen).toBe('manual');
    else throw new Error('esperaba ok');
  });

  it('🔴 un 200 con el HTML del SPA no es una caja vacía', async () => {
    responder = () => respuesta(200, '<!doctype html>');
    expect((await listarIngresos()).status).toBe('no_disponible');
  });
});

describe('registrarIngreso', () => {
  it('🔴 con SÓLO el monto alcanza — nada más viaja', async () => {
    // Un formulario que exige medio y cliente para anotar que te pagaron es lo que hace que el
    // emprendedor deje de anotar, y la caja vuelve a mentir.
    responder = () => respuesta(201, { ingreso: { id: 9, monto: '85000.00', origen: 'manual', falta: ['cliente', 'medio', 'concepto'] } });

    const res = await registrarIngreso({ monto: '85000' });

    expect(peticiones[0].cuerpoJson).toEqual({ monto: '85000' });
    if (res.status === 'ok') expect(res.ingreso.falta).toEqual(['cliente', 'medio', 'concepto']);
    else throw new Error('esperaba ok');
  });

  it('🔴 el alta NO trae `borrable`, y eso queda en null — no en false', async () => {
    // `false` diría "no se puede borrar", que sobre un dictado es falso. `null` dice "no sé", y la UI
    // no ofrece la acción destructiva hasta releer.
    responder = () => respuesta(201, { ingreso: { id: 9, monto: '85000.00', origen: 'manual', falta: [] } });

    const res = await registrarIngreso({ monto: '85000' });

    if (res.status === 'ok') expect(res.ingreso.borrable).toBeNull();
    else throw new Error('esperaba ok');
  });

  it('🔴 el 409 es una PREGUNTA con su candidato, no un error', async () => {
    responder = () =>
      respuesta(409, {
        detail: {
          mensaje: 'hay un ingreso parecido de estos días — ¿es otro cobro o el mismo?',
          candidato: { id: 4, monto: '85000.00', origen: 'manual', fecha: '2026-07-21' },
          reintentar_con: { confirmar_duplicado: true },
        },
      });

    const res = await registrarIngreso({ monto: '85000' });

    expect(res.status).toBe('posible_duplicado');
    if (res.status === 'posible_duplicado') {
      expect(res.candidato?.id).toBe(4);
      expect(res.mensaje).toContain('parecido');
    }
  });

  it('reintentar con el flag lo guarda igual — avisa, no prohíbe', async () => {
    responder = () => respuesta(201, { ingreso: { id: 10, monto: '85000.00', origen: 'manual', falta: [] } });

    await registrarIngreso({ monto: '85000', confirmarDuplicado: true });

    expect(peticiones[0].cuerpoJson).toEqual({ monto: '85000', confirmar_duplicado: true });
  });

  it('`confirmarDuplicado: false` NO viaja — sería ruido en cada alta', async () => {
    responder = () => respuesta(201, { ingreso: { id: 10, monto: '1', origen: 'manual' } });

    await registrarIngreso({ monto: '1', confirmarDuplicado: false });

    expect(peticiones[0].cuerpoJson).toEqual({ monto: '1' });
  });

  it('el 400 devuelve el motivo del backend, no un genérico', async () => {
    responder = () => respuesta(400, { detail: 'el monto tiene que ser mayor que cero' });

    const res = await registrarIngreso({ monto: '0' });

    expect(res).toEqual({ status: 'rechazado', motivo: 'el monto tiene que ser mayor que cero' });
  });
});

describe('completarIngreso', () => {
  it('usa PATCH sobre el MISMO ingreso y manda sólo lo que vino', async () => {
    // Si contestar el aviso creara otro registro, el aviso duplicaría la caja — el daño que la
    // función viene a evitar.
    responder = () => respuesta(200, { ingreso: { id: 9, monto: '85000.00', origen: 'manual', medio: 'efectivo', falta: ['concepto'] } });

    await completarIngreso(9, { medio: 'efectivo' });

    expect(peticiones[0].metodo).toBe('PATCH');
    expect(peticiones[0].path).toBe('/ingresos/9');
    expect(peticiones[0].cuerpoJson).toEqual({ medio: 'efectivo' });
  });

  it('el 404 es semántico', async () => {
    responder = () => respuesta(404, { detail: 'ingreso no encontrado' });
    expect((await completarIngreso(99, { medio: 'x' })).status).toBe('no_encontrado');
  });
});

describe('borrarIngreso', () => {
  it('llama al DELETE', async () => {
    responder = () => respuesta(200, { borrado: 9 });

    expect(await borrarIngreso(9)).toEqual({ status: 'ok' });
    expect(peticiones[0].metodo).toBe('DELETE');
  });

  it('el 404 cubre «no existe» y «no es borrable» — el backend usa el mismo código', async () => {
    responder = () => respuesta(404, { detail: 'ingreso no encontrado o no es borrable' });
    expect((await borrarIngreso(1)).status).toBe('no_encontrado');
  });
});

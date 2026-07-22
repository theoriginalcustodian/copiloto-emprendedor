import { beforeEach, describe, expect, it } from 'vitest';

import {
  cambiosDeConcepto,
  crearConcepto,
  desactivarConcepto,
  editarConcepto,
  listarConceptos,
  type Concepto,
} from './conceptos';
import { configurarApi } from './config';
import type { HttpPort, PeticionHttp, RespuestaHttp } from './http';
import type { AlmacenTokens } from './tokens';

/**
 * `/conceptos` — el catálogo de lo que el emprendedor vende. Molde del arnés: `cobros.test.ts`.
 *
 * La ruta está **desplegada** (sondeada por HTTP el 2026-07-22: los cuatro verbos dan `401`, contra
 * `405`/`200`-SPA de una ruta inventada), pero la **forma del body** de alta/edición y del `409` no se
 * pudo medir sin sesión. Lo que estos tests fijan es el contrato declarado y, sobre todo, **que el
 * cliente no invente lo que no vino**.
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

describe('listarConceptos', () => {
  it('por defecto NO pide los inactivos — el backend ya los filtra', async () => {
    responder = () =>
      respuesta(200, {
        conceptos: [
          { id: 1, nombre: 'Corte de pelo', precio_referencia: '8000.00', activo: true },
          { id: 2, nombre: 'Color', precio_referencia: '25000.00', activo: false },
        ],
      });

    const res = await listarConceptos();

    expect(peticiones[0].path).not.toContain('incluir_inactivos');
    expect(res.status).toBe('ok');
    if (res.status === 'ok') expect(res.conceptos.map((c) => c.activo)).toEqual([true, false]);
  });

  it('🔴 el ABM tiene que pedir los inactivos EXPLÍCITAMENTE', async () => {
    // Sin esto, un concepto desactivado desaparece de la única pantalla desde la que se lo podría
    // reactivar — y nadie lo nota, porque ver sólo los activos es exactamente lo que se espera.
    responder = () => respuesta(200, { conceptos: [] });

    await listarConceptos({ incluirInactivos: true });

    expect(peticiones[0].path).toContain('incluir_inactivos=true');
  });

  it('🔴 un concepto SIN precio queda en `null`, nunca en "0"', async () => {
    // "No le puse precio" y "vale cero" se ven idénticos en pantalla, y sólo uno de los dos es cierto.
    responder = () => respuesta(200, { conceptos: [{ id: 1, nombre: 'Presupuesto a medida', activo: true }] });

    const res = await listarConceptos();

    if (res.status === 'ok') expect(res.conceptos[0].precioReferencia).toBeNull();
    else throw new Error('esperaba ok');
  });

  it('🔴 la plata NO pasa por Number: el string decimal llega tal cual', async () => {
    responder = () => respuesta(200, { conceptos: [{ id: 1, nombre: 'X', precio_referencia: '8000.10', activo: true }] });

    const res = await listarConceptos();

    if (res.status === 'ok') expect(res.conceptos[0].precioReferencia).toBe('8000.10');
    else throw new Error('esperaba ok');
  });

  it('🔴 un 200 con el HTML del SPA NO es un catálogo vacío — es `no_disponible`', async () => {
    // El control que separa "todavía no hay catálogo" de "el catálogo está vacío". Sin él, un deploy
    // sin el endpoint pinta la pantalla más tranquilizadora posible sobre la ausencia total del dato.
    responder = () => respuesta(200, '<!doctype html><html></html>');

    expect((await listarConceptos()).status).toBe('no_disponible');
  });

  it('el tenant sin conceptos devuelve ok con lista vacía — `[]` no es un error', async () => {
    responder = () => respuesta(200, { conceptos: [] });

    const res = await listarConceptos();

    expect(res.status).toBe('ok');
    if (res.status === 'ok') expect(res.conceptos).toEqual([]);
  });

  it('descarta las filas sin id en vez de pintar un concepto que rompe al tocarlo', async () => {
    responder = () => respuesta(200, { conceptos: [{ nombre: 'Sin id' }, { id: 3, nombre: 'Bien', activo: true }] });

    const res = await listarConceptos();

    if (res.status === 'ok') expect(res.conceptos.map((c) => c.id)).toEqual([3]);
    else throw new Error('esperaba ok');
  });

  it('`activo` ausente cae en true — visible y corregible, no desaparecido en silencio', async () => {
    responder = () => respuesta(200, { conceptos: [{ id: 1, nombre: 'Corte' }] });

    const res = await listarConceptos();

    if (res.status === 'ok') expect(res.conceptos[0].activo).toBe(true);
    else throw new Error('esperaba ok');
  });
});

describe('crearConcepto', () => {
  it('manda sólo lo que vino, con las claves del wire', async () => {
    let cuerpo: unknown = null;
    responder = (p) => {
      cuerpo = p.cuerpoJson;
      return respuesta(201, { id: 7, nombre: 'Corte', precio_referencia: null, activo: true });
    };

    await crearConcepto({ nombre: 'Corte' });

    // `precio_referencia` NO viaja: no ponerle precio y ponerle `null` son dos cosas distintas.
    expect(cuerpo).toEqual({ nombre: 'Corte' });
    expect(peticiones[0].metodo).toBe('POST');
  });

  it('acepta la respuesta PELADA y la ENVUELTA — no está medido cuál manda', async () => {
    responder = () => respuesta(201, { id: 7, nombre: 'Corte', activo: true });
    const pelada = await crearConcepto({ nombre: 'Corte' });
    expect(pelada.status === 'ok' && pelada.concepto.id).toBe(7);

    responder = () => respuesta(201, { concepto: { id: 8, nombre: 'Color', activo: true } });
    const envuelta = await crearConcepto({ nombre: 'Color' });
    expect(envuelta.status === 'ok' && envuelta.concepto.id).toBe(8);
  });

  it('🔴 el 409 devuelve `duplicado` con la ficha del que ya está — no es un error en rojo', async () => {
    responder = () =>
      respuesta(409, { detail: 'ya existe', concepto: { id: 4, nombre: 'Corte', precio_referencia: '8000.00', activo: true } });

    const res = await crearConcepto({ nombre: 'corte' });

    expect(res.status).toBe('duplicado');
    if (res.status === 'duplicado') expect(res.existente?.nombre).toBe('Corte');
  });

  it('el 409 con la ficha bajo `detail` también se lee', async () => {
    responder = () => respuesta(409, { detail: { concepto: { id: 4, nombre: 'Corte', activo: true } } });

    const res = await crearConcepto({ nombre: 'corte' });

    if (res.status === 'duplicado') expect(res.existente?.id).toBe(4);
    else throw new Error('esperaba duplicado');
  });

  it('el 409 sin nada reconocible avisa igual, con `existente` en null', async () => {
    responder = () => respuesta(409, { detail: 'ya existe' });

    const res = await crearConcepto({ nombre: 'corte' });

    expect(res).toEqual({ status: 'duplicado', existente: null });
  });

  it('🔴 el 400 SUBE — el formulario muestra la explicación del backend, no un genérico', async () => {
    // Traducirlo a "no disponible" borraría la causa: el emprendedor vería "probá más tarde" ante un
    // nombre vacío, y probaría más tarde con el mismo nombre vacío.
    responder = () => respuesta(400, { detail: 'el nombre no puede estar vacío' });

    await expect(crearConcepto({ nombre: '' })).rejects.toThrow();
  });
});

describe('editarConcepto', () => {
  it('usa PATCH y manda sólo los campos cambiados', async () => {
    responder = () => respuesta(200, { id: 1, nombre: 'Corte', precio_referencia: '9000.00', activo: true });

    await editarConcepto(1, { precioReferencia: '9000.00' });

    expect(peticiones[0].metodo).toBe('PATCH');
    expect(peticiones[0].cuerpoJson).toEqual({ precio_referencia: '9000.00' });
  });

  it('🔴 `null` (borrar el precio) SÍ viaja; `undefined` (no tocar) no', async () => {
    responder = () => respuesta(200, { id: 1, nombre: 'Corte', activo: true });

    await editarConcepto(1, { precioReferencia: null });

    expect(peticiones[0].cuerpoJson).toEqual({ precio_referencia: null });
  });

  it('reactivar es `activo: true` — no hay endpoint aparte', async () => {
    responder = () => respuesta(200, { id: 1, nombre: 'Corte', activo: true });

    await editarConcepto(1, { activo: true });

    expect(peticiones[0].cuerpoJson).toEqual({ activo: true });
  });

  it('el 404 es semántico: `no_encontrado`, no `no_disponible`', async () => {
    responder = () => respuesta(404, { detail: 'no existe' });

    expect((await editarConcepto(99, { nombre: 'X' })).status).toBe('no_encontrado');
  });
});

describe('desactivarConcepto', () => {
  it('llama al DELETE y devuelve el concepto si vino', async () => {
    responder = () => respuesta(200, { concepto: { id: 1, nombre: 'Corte', activo: false } });

    const res = await desactivarConcepto(1);

    expect(peticiones[0].metodo).toBe('DELETE');
    if (res.status === 'ok') expect(res.concepto?.activo).toBe(false);
    else throw new Error('esperaba ok');
  });

  it('🔴 si el DELETE no devuelve el concepto, `concepto` queda null — no se asume el efecto', async () => {
    // Backend no declaró qué devuelve. Fabricar acá un `{activo:false}` sería pintar un estado que
    // nadie confirmó: la pantalla tiene que recargar la lista.
    responder = () => respuesta(200, {});

    const res = await desactivarConcepto(1);

    expect(res).toEqual({ status: 'ok', concepto: null });
  });
});

describe('cambiosDeConcepto', () => {
  const original: Concepto = { id: 1, nombre: 'Corte', precioReferencia: '8000.00', activo: true };

  it('devuelve {} cuando no cambió nada — guardar sin tocar no debería salir a la red', () => {
    expect(cambiosDeConcepto(original, { nombre: 'Corte', precioReferencia: '8000.00', activo: true })).toEqual({});
  });

  it('sólo devuelve lo que cambió', () => {
    expect(cambiosDeConcepto(original, { nombre: 'Corte', precioReferencia: '9500.00' })).toEqual({
      precioReferencia: '9500.00',
    });
  });

  it('🔴 sacarle el precio (null) es un cambio, no un "no tocar"', () => {
    expect(cambiosDeConcepto(original, { precioReferencia: null })).toEqual({ precioReferencia: null });
  });
});

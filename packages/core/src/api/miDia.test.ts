import { beforeEach, describe, expect, it } from 'vitest';

import { leerTablero } from './miDia';
import { configurarApi } from './config';
import type { HttpPort, PeticionHttp, RespuestaHttp } from './http';
import type { AlmacenTokens } from './tokens';

/**
 * `GET /mi-dia/tablero` — el Kanban del día. Molde del arnés: `conceptos.test.ts`.
 *
 * **[CONNECT] — el endpoint NO está publicado.** Estos tests fijan el contrato §3.2 y las reglas que
 * un tablero no puede violar: no confundir «no desplegado» con «tablero vacío», no pintar un estado
 * desconocido con el color/acción de otro, `null` ≠ `0`.
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

const TABLERO_VIVO = {
  columnas: [
    {
      id: 'presupuesto',
      titulo: 'Presupuestos',
      tarjetas: [{ id: 'p1', titulo: 'Pintura del local', cliente: 'Kiosco', monto: '80000.00', fecha: '2026-07-20', estado: 'borrador' }],
    },
    { id: 'facturado', titulo: 'Facturado', tarjetas: [] },
    { id: 'por_cobrar', titulo: 'Por cobrar', tarjetas: [] },
    { id: 'cobrado', titulo: 'Cobrado', tarjetas: [] },
  ],
};

beforeEach(() => {
  responder = () => respuesta(200, {});
  const http: HttpPort = { async enviar(p) { return responder(p); } };
  configurarApi({ http, tokens: crearTokensFake() });
});

describe('leerTablero — el camino bueno', () => {
  it('trae las columnas en orden, con sus tarjetas y la plata como string', async () => {
    responder = () => respuesta(200, TABLERO_VIVO);

    const res = await leerTablero();

    expect(res.status).toBe('ok');
    if (res.status !== 'ok') return;
    expect(res.tablero.columnas.map((c) => c.id)).toEqual(['presupuesto', 'facturado', 'por_cobrar', 'cobrado']);
    const t = res.tablero.columnas[0].tarjetas[0];
    expect(t.id).toBe('p1');
    expect(t.monto).toBe('80000.00');
    expect(typeof t.monto).toBe('string');
    expect(t.estado).toBe('borrador');
  });
});

describe('leerTablero — lo que NO inventa', () => {
  it('🔴 un `200` con el HTML del SPA es `no_disponible`, NO un tablero vacío', async () => {
    responder = () => respuesta(200, '<!doctype html><html><body>app</body></html>');
    expect((await leerTablero()).status).toBe('no_disponible');
  });

  it('🔴 CONTROL — un tablero REAL con columnas vacías sí es `ok`', async () => {
    responder = () =>
      respuesta(200, { columnas: [{ id: 'presupuesto', titulo: 'Presupuestos', tarjetas: [] }] });
    const res = await leerTablero();
    expect(res.status).toBe('ok');
    if (res.status === 'ok') expect(res.tablero.columnas[0].tarjetas).toEqual([]);
  });

  it('🔴 un estado DESCONOCIDO cae en `desconocido`, no se disfraza del vecino', async () => {
    // Discriminar por ausencia de estructura: un estado nuevo pintado con el color/acción de otro
    // ofrecería la acción equivocada. Mejor una tarjeta muda.
    responder = () =>
      respuesta(200, {
        columnas: [{ id: 'presupuesto', titulo: 'P', tarjetas: [{ id: 'x', titulo: 't', estado: 'un_estado_que_no_existe' }] }],
      });
    const res = await leerTablero();
    if (res.status === 'ok') expect(res.tablero.columnas[0].tarjetas[0].estado).toBe('desconocido');
  });

  it('🔴 una tarjeta SIN id se descarta — sin identidad no se puede mover entre columnas', async () => {
    responder = () =>
      respuesta(200, {
        columnas: [{ id: 'presupuesto', titulo: 'P', tarjetas: [{ titulo: 'sin id' }, { id: 'ok', titulo: 'con id' }] }],
      });
    const res = await leerTablero();
    if (res.status === 'ok') expect(res.tablero.columnas[0].tarjetas.map((t) => t.id)).toEqual(['ok']);
  });

  it('🔴 una columna con id fuera del conjunto cerrado se descarta', async () => {
    responder = () =>
      respuesta(200, { columnas: [{ id: 'columna_inventada', titulo: 'X', tarjetas: [] }, TABLERO_VIVO.columnas[1]] });
    const res = await leerTablero();
    if (res.status === 'ok') expect(res.tablero.columnas.map((c) => c.id)).toEqual(['facturado']);
  });

  it('🔴 monto ausente queda `null`, jamás `0`', async () => {
    responder = () =>
      respuesta(200, { columnas: [{ id: 'presupuesto', titulo: 'P', tarjetas: [{ id: 'a', titulo: 't', estado: 'borrador' }] }] });
    const res = await leerTablero();
    if (res.status === 'ok') expect(res.tablero.columnas[0].tarjetas[0].monto).toBeNull();
  });

  it('si la red explota degrada a `no_disponible`', async () => {
    responder = () => { throw new Error('red caída'); };
    expect((await leerTablero()).status).toBe('no_disponible');
  });
});

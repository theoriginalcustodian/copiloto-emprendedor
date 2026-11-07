import { beforeEach, describe, expect, it } from 'vitest';

import { alGuardarActividad, conSessionIdActividad, fijarSessionIdActividad } from './actividadAlHilo';
import { crearGasto } from './gastos';
import { configurarApi } from './config';
import type { HttpPort, PeticionHttp } from './http';
import type { AlmacenTokens } from './tokens';

const tokens: AlmacenTokens = {
  async leerToken() { return 'tok'; },
  async guardarToken() {},
  async leerRefresh() { return null; },
  async guardarRefresh() {},
  async limpiar() {},
};

let visto: PeticionHttp | null;

beforeEach(() => {
  visto = null;
  fijarSessionIdActividad(null);
  const http: HttpPort = {
    async enviar(p) {
      visto = p;
      return { ok: true, status: 201, json: async () => ({ id: 1, monto: '10.00', fecha: '2026-11-07', origen: 'manual' }) };
    },
  };
  configurarApi({ http, tokens });
});

describe('actividadAlHilo (SM-P19 B, lado app)', () => {
  it('sin hilo activo el body queda IGUAL (no se inventa un session_id)', () => {
    const body = { monto: 5 };
    expect(conSessionIdActividad(body)).toBe(body);
  });

  it('con hilo activo agrega session_id; vacío o null lo apaga', () => {
    fijarSessionIdActividad('s-1');
    expect(conSessionIdActividad({ monto: 5 })).toEqual({ monto: 5, session_id: 's-1' });
    fijarSessionIdActividad('');
    expect(conSessionIdActividad({ monto: 5 })).toEqual({ monto: 5 });
  });

  it('avisa a los oyentes SÓLO con hilo activo; un oyente roto no rompe el guardado; se puede cancelar', () => {
    let n = 0;
    const cancelar = alGuardarActividad(() => { n += 1; });
    const cancelarRoto = alGuardarActividad(() => { throw new Error('boom'); });
    conSessionIdActividad({ a: 1 });
    expect(n).toBe(0);
    fijarSessionIdActividad('s-3');
    expect(conSessionIdActividad({ a: 1 })).toEqual({ a: 1, session_id: 's-3' });
    expect(n).toBe(1);
    cancelar();
    cancelarRoto();
    conSessionIdActividad({ a: 1 });
    expect(n).toBe(1);
  });

  it('el guardado REAL (crearGasto) manda el session_id del hilo y, sin hilo, no lo manda', async () => {
    fijarSessionIdActividad('s-2');
    await crearGasto({ monto: 10, origen: 'manual' } as never);
    expect((visto?.cuerpoJson as Record<string, unknown>)?.session_id).toBe('s-2');
    fijarSessionIdActividad(null);
    await crearGasto({ monto: 10, origen: 'manual' } as never);
    expect(visto?.cuerpoJson as Record<string, unknown>).not.toHaveProperty('session_id');
  });
});

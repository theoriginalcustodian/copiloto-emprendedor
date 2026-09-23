import { beforeEach, describe, expect, it } from 'vitest';

import {
  DIAS_MAX_AGENDA,
  ORDEN_GRUPOS_AGENDA,
  franjaDeEvento,
  leerAgenda,
  rangoAgenda,
} from './agenda';
import { configurarApi } from './config';
import type { HttpPort, PeticionHttp, RespuestaHttp } from './http';
import type { AlmacenTokens } from './tokens';

const respuesta = (status: number, body: unknown): RespuestaHttp => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

const tokens: AlmacenTokens = {
  async leerToken() { return 'tok'; },
  async guardarToken() {},
  async leerRefresh() { return null; },
  async guardarRefresh() {},
  async limpiar() {},
};

let responder: (p: PeticionHttp) => RespuestaHttp;
let visto: PeticionHttp | null;

beforeEach(() => {
  visto = null;
  responder = () => respuesta(200, {});
  const http: HttpPort = { async enviar(p) { visto = p; return responder(p); } };
  configurarApi({ http, tokens });
});

const dias = (d: { desde: string; hasta: string }) =>
  Math.round((Date.parse(d.hasta) - Date.parse(d.desde)) / 86_400_000);

describe('rangoAgenda', () => {
  it('por defecto: hoy → +7, en fecha local', () => {
    expect(rangoAgenda(new Date(2026, 8, 21))).toEqual({ desde: '2026-09-21', hasta: '2026-09-28' });
  });

  it('NUNCA pasa de la ventana del backend, ni pidiéndolo (400 si >14 días)', () => {
    for (const n of [0, 1, 7, 13, 14, 15, 60, 9999, -5, NaN, Infinity]) {
      const r = rangoAgenda(new Date(2026, 8, 21), n);
      expect(dias(r)).toBeLessThanOrEqual(DIAS_MAX_AGENDA);
      expect(dias(r)).toBeGreaterThanOrEqual(0);
    }
  });

  it('cruza el fin de mes/año sin romper', () => {
    expect(rangoAgenda(new Date(2026, 11, 28), 7)).toEqual({ desde: '2026-12-28', hasta: '2027-01-04' });
  });
});

describe('leerAgenda', () => {
  it('pide desde/hasta y devuelve SIEMPRE los 4 grupos en orden', async () => {
    responder = () =>
      respuesta(200, {
        conectado: true,
        eventos: [],
        grupos: [
          { id: 'semana', titulo: 'Esta semana', eventos: [{ id: 'e2', titulo: 'Entrega', inicio: '2026-09-25T10:00:00-03:00', fin: null, dia_completo: false }] },
          { id: 'hoy', titulo: 'Hoy', eventos: [{ id: 'e1', titulo: 'Reunión', inicio: '2026-09-21T10:00:00-03:00', fin: '2026-09-21T11:00:00-03:00', dia_completo: false }] },
        ],
      });
    const res = await leerAgenda({ desde: '2026-09-21', hasta: '2026-09-28' });
    expect(visto?.path).toContain('/mi-dia/calendario?desde=2026-09-21&hasta=2026-09-28');
    if (res.status !== 'ok') throw new Error('esperaba ok');
    expect(res.agenda.grupos.map((g) => g.id)).toEqual([...ORDEN_GRUPOS_AGENDA]);
    expect(res.agenda.grupos[0]!.eventos.map((e) => e.id)).toEqual(['e1']);
    expect(res.agenda.grupos[1]!.eventos).toEqual([]);
    expect(res.agenda.grupos[2]!.eventos.map((e) => e.id)).toEqual(['e2']);
  });

  it('conectado:false → grupos vacíos y conectado false (no es «sin eventos»)', async () => {
    responder = () => respuesta(200, { conectado: false, eventos: [], grupos: [] });
    const res = await leerAgenda();
    if (res.status !== 'ok') throw new Error('esperaba ok');
    expect(res.agenda.conectado).toBe(false);
    expect(res.agenda.grupos.every((g) => g.eventos.length === 0)).toBe(true);
  });

  it('400 / caída → no_disponible, no lanza', async () => {
    responder = () => respuesta(400, { detail: 'ventana máxima 14 días' });
    expect((await leerAgenda()).status).toBe('no_disponible');
  });

  it('descarta eventos sin id o sin título', async () => {
    responder = () =>
      respuesta(200, {
        conectado: true,
        grupos: [{ id: 'hoy', titulo: 'Hoy', eventos: [{ id: '', titulo: 'x' }, { id: 'a', titulo: '  ' }, { id: 'b', titulo: 'ok' }] }],
      });
    const res = await leerAgenda();
    if (res.status !== 'ok') throw new Error('esperaba ok');
    expect(res.agenda.grupos[0]!.eventos.map((e) => e.id)).toEqual(['b']);
  });
});

describe('franjaDeEvento', () => {
  it('día completo → «Todo el día»', () => {
    expect(franjaDeEvento({ inicioCrudo: { date: '2026-09-21' }, finCrudo: null, diaCompleto: true })).toBe('Todo el día');
  });

  it('sin hora reconocible → null (no se inventa)', () => {
    expect(franjaDeEvento({ inicioCrudo: { raro: 1 }, finCrudo: null, diaCompleto: false })).toBeNull();
  });

  it('inicio y fin → «HH:MM – HH:MM»; sólo inicio → «HH:MM»', () => {
    const conFin = franjaDeEvento({ inicioCrudo: '2026-09-21T10:00:00', finCrudo: '2026-09-21T11:30:00', diaCompleto: false });
    expect(conFin).toMatch(/^\d{2}:\d{2}.* – \d{2}:\d{2}/);
    const soloIni = franjaDeEvento({ inicioCrudo: '2026-09-21T10:00:00', finCrudo: null, diaCompleto: false });
    expect(soloIni).toMatch(/^\d{2}:\d{2}/);
    expect(soloIni).not.toContain('–');
  });
});

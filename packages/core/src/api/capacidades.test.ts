import { beforeEach, describe, expect, it } from 'vitest';

import { leerCapacidades } from './capacidades';
import { configurarApi } from './config';
import type { HttpPort, PeticionHttp, RespuestaHttp } from './http';
import type { AlmacenTokens } from './tokens';

/**
 * `/capacidades` — la guía viva. Molde del arnés: `conceptos.test.ts`.
 *
 * **Lo que se fija acá es que el cliente no rellene huecos.** Esta superficie existe porque la guía
 * escrita a mano prometía una tool inexistente; un cliente que "completa" lo que no vino reintroduce
 * el mismo bug una capa más abajo, donde nadie lo mira. Por eso los casos que importan son los de
 * ausencia y los de forma rota — el happy path es el que menos protege.
 *
 * Ruta verificada desplegada por HTTP el 2026-07-22: `GET /capacidades` sin token → `401`; el control
 * negativo (ruta inventada) → `200` con el HTML del SPA. Sin ese control, el `401` no distinguiría
 * *«existe»* de *«cualquier cosa da 401»*.
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

const GUIA_VIVA = {
  capacidades: [
    { tool: 'registrar_gasto', rotulo: 'Gastos', ejemplos: ['pagué 15 mil de mercadería', 'gasté 3.000 en nafta ayer'] },
    { tool: 'registrar_ingreso', rotulo: 'Ingresos', ejemplos: ['me pagaron 85 mil'] },
  ],
  fechas: { entiendo: ['hoy', 'ayer'], si_no_esta: 'Para cualquier otro día, tocá la fecha en la tarjeta.' },
};

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

describe('leerCapacidades — el camino bueno', () => {
  it('trae las capacidades y las fechas, con `si_no_esta` en camelCase', async () => {
    responder = () => respuesta(200, GUIA_VIVA);

    const res = await leerCapacidades();

    expect(peticiones[0].path).toBe('/capacidades');
    expect(res.status).toBe('ok');
    if (res.status !== 'ok') return;
    expect(res.guia.capacidades.map((c) => c.rotulo)).toEqual(['Gastos', 'Ingresos']);
    expect(res.guia.capacidades[0].ejemplos).toHaveLength(2);
    expect(res.guia.fechas.entiendo).toEqual(['hoy', 'ayer']);
    expect(res.guia.fechas.siNoEsta).toContain('tocá la fecha');
  });
});

describe('leerCapacidades — lo que NO inventa', () => {
  it('🔴 un `200` con el HTML del SPA NO es una guía vacía: es `no_disponible`', async () => {
    // Un GET a una ruta no desplegada devuelve 200 con el catch-all del front-door. Sin el guard de
    // forma, esto sería «el copiloto no sabe hacer nada» — la afirmación más tranquilizadora posible,
    // construida sobre la ausencia total del dato.
    responder = () => respuesta(200, '<!doctype html><html><body>app</body></html>');

    const res = await leerCapacidades();

    expect(res.status).toBe('no_disponible');
  });

  it('🔴 CONTROL — una guía REALMENTE vacía sí es `ok`', async () => {
    // El par del anterior. Sin este caso, el guard podría estar rechazando todo y el test de arriba
    // pasaría igual. Y la diferencia importa: `capacidades: []` significa que el backend contestó y
    // hoy no hay tools vivas — la pantalla tiene que poder decir eso, no «no pudimos traer la guía».
    responder = () => respuesta(200, { capacidades: [], fechas: {} });

    const res = await leerCapacidades();

    expect(res.status).toBe('ok');
    if (res.status === 'ok') {
      expect(res.guia.capacidades).toEqual([]);
      expect(res.guia.fechas.siNoEsta).toBeNull();
    }
  });

  it('🔴 una capacidad SIN ejemplos se descarta — un rótulo solo no enseña nada', async () => {
    // Y además se lee como una función rota. Prometer de menos es gratis: si el emprendedor dice algo
    // que anda y no estaba en la lista, gana.
    responder = () =>
      respuesta(200, {
        capacidades: [
          { tool: 'emitir_factura', rotulo: 'Facturar', ejemplos: [] },
          { tool: 'registrar_gasto', rotulo: 'Gastos', ejemplos: ['pagué 15 mil'] },
        ],
        fechas: {},
      });

    const res = await leerCapacidades();

    expect(res.status).toBe('ok');
    if (res.status === 'ok') expect(res.guia.capacidades.map((c) => c.tool)).toEqual(['registrar_gasto']);
  });

  it('descarta ejemplos que no son texto en vez de pintarlos', async () => {
    responder = () =>
      respuesta(200, {
        capacidades: [{ tool: 'x', rotulo: 'X', ejemplos: ['sirve', '', null, 42, '  '] }],
        fechas: {},
      });

    const res = await leerCapacidades();

    if (res.status === 'ok') expect(res.guia.capacidades[0].ejemplos).toEqual(['sirve']);
  });

  it('🔴 `fechas` ausente NO rompe la pantalla — queda vacío, no `undefined`', async () => {
    // La guía de capacidades sigue siendo útil sin la tabla de fechas; tirar todo por eso sería
    // perder lo que sí vino.
    responder = () => respuesta(200, { capacidades: GUIA_VIVA.capacidades });

    const res = await leerCapacidades();

    expect(res.status).toBe('ok');
    if (res.status === 'ok') {
      expect(res.guia.fechas.entiendo).toEqual([]);
      expect(res.guia.fechas.siNoEsta).toBeNull();
    }
  });

  it('si la red explota degrada a `no_disponible`, no propaga', async () => {
    responder = () => {
      throw new Error('red caída');
    };

    const res = await leerCapacidades();

    expect(res.status).toBe('no_disponible');
  });
});

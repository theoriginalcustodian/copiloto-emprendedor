import { beforeEach, describe, expect, it } from 'vitest';

import { configurarApi } from './config';
import type { HttpPort, PeticionHttp, RespuestaHttp } from './http';
import { listarActividad } from './actividad';
import type { AlmacenTokens } from './tokens';

function respuesta(status: number, body: unknown): RespuestaHttp {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

/** El catch-all del SPA: `200` con HTML, y `res.json()` **explota**. */
function respuestaHtmlDelSpa(): RespuestaHttp {
  return {
    ok: true,
    status: 200,
    json: async () => {
      throw new SyntaxError('Unexpected token < in JSON at position 0');
    },
  };
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

/** Forma medida contra el vivo el 2026-07-22 (`avance_backend..._actividad-hito1`). */
function itemCrudo(over: Record<string, unknown> = {}) {
  return {
    id: 'factura:42',
    tipo: 'factura',
    fecha: '2026-07-22T14:30:00Z',
    titulo: 'Factura B 0001-00000042',
    detalle: 'Panadería Los Tilos',
    monto: '136000.00',
    signo: 'entra',
    ...over,
  };
}

describe('actividad.ts', () => {
  let peticiones: PeticionHttp[];
  let responder: (p: PeticionHttp) => RespuestaHttp;

  beforeEach(() => {
    peticiones = [];
    responder = () => respuesta(200, { items: [], cursor: null });
    const http: HttpPort = {
      async enviar(p) {
        peticiones.push(p);
        return responder(p);
      },
    };
    configurarApi({ http, tokens: crearTokensFake() });
  });

  it('normaliza los items y conserva el monto como STRING', async () => {
    responder = () => respuesta(200, { items: [itemCrudo()], cursor: 'c1' });

    const res = await listarActividad();

    expect(res.status).toBe('ok');
    if (res.status !== 'ok') return;
    expect(res.items[0].id).toBe('factura:42');
    expect(res.items[0].monto).toBe('136000.00');
    expect(typeof res.items[0].monto).toBe('string');
    expect(res.items[0].signo).toBe('entra');
    expect(res.cursor).toBe('c1');
  });

  it('sin actividad devuelve [] con cursor null, y NO es un error', async () => {
    await expect(listarActividad()).resolves.toEqual({ status: 'ok', items: [], cursor: null });
  });

  it('🔴 manda el cursor CODIFICADO, no concatenado a mano', async () => {
    // Un cursor lleva `|` y `:`; y uno viejo puede traer `+`, que en una query string significa
    // ESPACIO. `URLSearchParams` codifica los tres (`%7C`, `%3A`, `%2B`) y el token llega intacto.
    // Concatenarlo a mano en la URL es lo que rompe — medido contra el vivo.
    responder = () => respuesta(200, { items: [], cursor: null });

    await listarActividad({ cursor: '2026-07-22T14:30:00Z|factura:42', limit: 20 });

    expect(peticiones[0].path).toBe(
      '/actividad?limit=20&cursor=2026-07-22T14%3A30%3A00Z%7Cfactura%3A42',
    );
  });

  it('no manda cursor cuando es null o vacío', async () => {
    await listarActividad({ cursor: null });
    expect(peticiones[0].path).toBe('/actividad');

    await listarActividad({ cursor: '' });
    expect(peticiones[1].path).toBe('/actividad');
  });

  it('acota por función: manda `funcion` en la query', async () => {
    await listarActividad({ funcion: 'gastos', limit: 20 });
    expect(peticiones[0].path).toBe('/actividad?funcion=gastos&limit=20');
  });

  it('busca por texto: manda `q` en la query', async () => {
    await listarActividad({ funcion: 'gastos', q: 'nafta' });
    expect(peticiones[0].path).toBe('/actividad?funcion=gastos&q=nafta');
  });

  it('sin `funcion` ni `q` la URL queda idéntica a lo ya medido (no rompe el cursor)', async () => {
    // CONTROL: agregar los dos params opcionales no puede haber cambiado la forma vieja de la URL.
    await listarActividad({ limit: 20, cursor: '2026-07-22T14:30:00Z|factura:42' });
    expect(peticiones[0].path).toBe(
      '/actividad?limit=20&cursor=2026-07-22T14%3A30%3A00Z%7Cfactura%3A42',
    );
  });

  it('🔴 un 400 de input (p.ej. `funcion` inválida) se PROPAGA, no se disfraza de no_disponible', async () => {
    // Una vez borrado el stub 501, backend valida el input: `?funcion=invalida` → 400. Mapear ese 400
    // a `no_disponible` escondería un endpoint DESPLEGADO que rechaza el input como si estuviera
    // AUSENTE — el mismo error que la guarda de forma evita del otro lado. Que explote es honesto: es
    // un bug de la llamada, no una función que no existe.
    responder = () => respuesta(400, { detail: 'funcion invalida' });

    await expect(listarActividad({ funcion: 'invalida' })).rejects.toMatchObject({
      status: 400,
    });
  });

  it('un `signo` desconocido cae en `neutro`, que es el que NO pinta color', async () => {
    // Inventar "entra" teñiría de verde algo que quizá salió. No mostrar color es honesto.
    responder = () => respuesta(200, { items: [itemCrudo({ signo: 'reembolso' })], cursor: null });

    const res = await listarActividad();

    expect(res.status).toBe('ok');
    if (res.status !== 'ok') return;
    expect(res.items[0].signo).toBe('neutro');
  });

  it('un `tipo` desconocido NO se descarta — se muestra igual', async () => {
    // El texto ya viene armado del backend, así que un tipo nuevo se ve bien sin que el cliente lo
    // conozca. Filtrarlo acá haría desaparecer operaciones reales al agregar un tipo.
    responder = () => respuesta(200, { items: [itemCrudo({ tipo: 'reintegro' })], cursor: null });

    const res = await listarActividad();

    expect(res.status).toBe('ok');
    if (res.status !== 'ok') return;
    expect(res.items).toHaveLength(1);
    expect(res.items[0].tipo).toBe('reintegro');
  });

  it('un 200 con el HTML del SPA es no_disponible, no una excepción de parseo', async () => {
    // La ruta no desplegada NO da 404: da 200 con el SPA. Y para un endpoint de sólo lectura la
    // sonda por verbo tampoco discrimina (`POST /actividad` y `POST /ruta-inventada` dan 405 los
    // dos, medido). Lo único que distingue es la FORMA.
    responder = () => respuestaHtmlDelSpa();

    await expect(listarActividad()).resolves.toEqual({ status: 'no_disponible' });
  });

  it('un 200 que no trae `items` tampoco se pinta como actividad', async () => {
    responder = () => respuesta(200, { detail: 'otra cosa' });

    await expect(listarActividad()).resolves.toEqual({ status: 'no_disponible' });
  });

  it('501 y 405 son "no disponible"', async () => {
    responder = () => respuesta(501, { detail: 'not implemented' });
    await expect(listarActividad()).resolves.toEqual({ status: 'no_disponible' });

    responder = () => respuesta(405, { detail: 'Method Not Allowed' });
    await expect(listarActividad()).resolves.toEqual({ status: 'no_disponible' });
  });
});

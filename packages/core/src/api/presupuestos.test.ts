import { beforeEach, describe, expect, it } from 'vitest';

import { configurarApi } from './config';
import { ApiError } from './errors';
import type { HttpPort, PeticionHttp, RespuestaHttp } from './http';
import type { AlmacenTokens } from './tokens';
import {
  crearPresupuesto,
  facturarPresupuesto,
  listarPresupuestos,
  obtenerPresupuesto,
} from './presupuestos';

/** Molde: `catalogo.test.ts` — `HttpPort` FAKE, sin `fetch` real. */
function respuesta(status: number, body: unknown): RespuestaHttp {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

/**
 * El catch-all del SPA: `200` con HTML. `res.json()` **explota** — no devuelve un objeto raro.
 * Reproducirlo con un `json()` que rechaza es lo que hace fiel a este fake: si lo simulara
 * devolviendo `{}`, estaría probando una rama que en producción no ocurre.
 */
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

/** El shape del contrato + addendum: `id` ENTERO, `reemplazado_por` presente, 2 decimales siempre. */
function presupuestoCrudo(over: Record<string, unknown> = {}) {
  return {
    id: 12,
    numero: 8,
    fecha: '2026-07-21T22:14:03.120Z',
    concepto: 'Instalación eléctrica',
    receptor: {
      nombre: 'Juan Pérez',
      doc_tipo: 96,
      doc_nro: '20123456',
      condicion_iva: 5,
      domicilio: 'Av. Siempreviva 742',
      contacto: 'juan@mail.com',
    },
    items: [
      { orden: 0, descripcion: 'Mano de obra', cantidad: '1', precio_unitario: '30000.00', codigo: '' },
      { orden: 1, descripcion: 'Materiales', cantidad: '1', precio_unitario: '15000.00', codigo: '' },
    ],
    cantidad_items: 2,
    total: '45000.00',
    moneda: 'ARS',
    doc_link: 'https://docs.google.com/document/d/1HsL/edit',
    doc_id: '1HsL',
    sheet_fila: 'Presupuestos!A7',
    reemplaza_a: 11,
    reemplazado_por: null,
    factura_id: null,
    facturado: false,
    ...over,
  };
}

describe('presupuestos.ts', () => {
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

  describe('listarPresupuestos', () => {
    it('normaliza a camelCase conservando el id ENTERO y los montos como string', async () => {
      responder = () => respuesta(200, { presupuestos: [presupuestoCrudo()] });

      const res = await listarPresupuestos();

      expect(res.status).toBe('ok');
      if (res.status !== 'ok') return;
      const p = res.presupuestos[0];
      expect(p.id).toBe(12);
      expect(typeof p.id).toBe('number');
      // 🔴 El total NO se convierte a número en ningún punto del camino.
      expect(p.total).toBe('45000.00');
      expect(typeof p.total).toBe('string');
      expect(p.reemplazaA).toBe(11);
      expect(p.reemplazadoPor).toBeNull();
      expect(p.receptor.nombre).toBe('Juan Pérez');
      expect(p.docLink).toBe('https://docs.google.com/document/d/1HsL/edit');
    });

    it('no manda parámetros cuando no se piden', async () => {
      responder = () => respuesta(200, { presupuestos: [] });
      await listarPresupuestos();
      expect(peticiones[0].path).toBe('/presupuestos');
    });

    it('pide el historial sólo cuando se piden los reemplazados', async () => {
      responder = () => respuesta(200, { presupuestos: [] });
      await listarPresupuestos({ limit: 20, incluirReemplazados: true });
      expect(peticiones[0].path).toBe('/presupuestos?limit=20&incluir_reemplazados=true');
    });

    it('omite incluir_reemplazados cuando es false — el default del backend es "sólo vigentes"', async () => {
      responder = () => respuesta(200, { presupuestos: [] });
      await listarPresupuestos({ incluirReemplazados: false });
      expect(peticiones[0].path).toBe('/presupuestos');
    });

    it('una lista vacía es ok, NO un error ni un "no disponible"', async () => {
      responder = () => respuesta(200, { presupuestos: [] });
      const res = await listarPresupuestos();
      expect(res.status).toBe('ok');
      if (res.status === 'ok') expect(res.presupuestos).toEqual([]);
    });

    it('en el listado usa cantidad_items y NO el largo de items, que viene vacío a propósito', async () => {
      responder = () =>
        respuesta(200, { presupuestos: [presupuestoCrudo({ items: [], cantidad_items: 3 })] });

      const res = await listarPresupuestos();

      expect(res.status).toBe('ok');
      // Sin esto toda card diría "0 ítems": el listado omite `items` por tamaño de respuesta.
      if (res.status === 'ok') expect(res.presupuestos[0].cantidadItems).toBe(3);
    });

    it('🔴 un 200 con el HTML del SPA es "no desplegado", no una excepción de parseo', async () => {
      // El control que importa: el status dice 200 y todo estaría "bien". La forma dice otra cosa.
      responder = () => respuestaHtmlDelSpa();
      const res = await listarPresupuestos();
      expect(res.status).toBe('no_disponible');
    });

    it('🔴 un 200 con JSON de otra forma (sin la clave del contrato) también es "no desplegado"', async () => {
      responder = () => respuesta(200, { otra_cosa: [] });
      const res = await listarPresupuestos();
      expect(res.status).toBe('no_disponible');
    });

    it('un 405 (catch-all, ruta no desplegada) es "no disponible"', async () => {
      responder = () => respuesta(405, { detail: 'Method Not Allowed' });
      const res = await listarPresupuestos();
      expect(res.status).toBe('no_disponible');
    });

    it('un 500 se propaga — no se disfraza de "todavía no disponible"', async () => {
      responder = () => respuesta(500, { detail: 'boom' });
      await expect(listarPresupuestos()).rejects.toBeInstanceOf(ApiError);
    });
  });

  describe('obtenerPresupuesto', () => {
    it('trae los items en el detalle', async () => {
      responder = () => respuesta(200, { presupuesto: presupuestoCrudo() });

      const res = await obtenerPresupuesto(12);

      expect(res.status).toBe('ok');
      if (res.status !== 'ok') return;
      expect(res.presupuesto.items).toHaveLength(2);
      expect(res.presupuesto.items[0].precioUnitario).toBe('30000.00');
      expect(peticiones[0].path).toBe('/presupuestos/12');
    });

    it('🔴 el 404 es SEMÁNTICO ("no existe para este tenant"), no "no desplegado"', async () => {
      // Distinguirlos importa: decir "todavía no está disponible" sobre un endpoint vivo que
      // contesta bien manda a esperar un despliegue que ya ocurrió.
      responder = () => respuesta(404, { detail: 'presupuesto no encontrado' });
      const res = await obtenerPresupuesto(999999999);
      expect(res.status).toBe('no_encontrado');
    });

    it('un id de otro tenant es indistinguible de uno inexistente — y así debe quedar', async () => {
      responder = () => respuesta(404, { detail: 'presupuesto no encontrado' });
      const res = await obtenerPresupuesto(13);
      expect(res.status).toBe('no_encontrado');
    });
  });

  describe('crearPresupuesto', () => {
    it('serializa a snake_case y NO manda el total — lo calcula el backend', async () => {
      responder = () => respuesta(201, { presupuesto: presupuestoCrudo() });

      await crearPresupuesto({
        concepto: 'Instalación eléctrica',
        receptor: { nombre: 'Juan Pérez', docTipo: 96, docNro: '20123456' },
        items: [{ descripcion: 'Mano de obra', cantidad: '1', precioUnitario: '30000' }],
      });

      const body = peticiones[0].cuerpoJson as Record<string, unknown>;
      expect(body.concepto).toBe('Instalación eléctrica');
      expect(body).not.toHaveProperty('total');
      expect(body.receptor).toEqual({ nombre: 'Juan Pérez', doc_tipo: 96, doc_nro: '20123456' });
      expect(body.items).toEqual([{ descripcion: 'Mano de obra', cantidad: '1', precio_unitario: '30000' }]);
    });

    it('manda reemplaza_a cuando el presupuesto corrige a otro — editar es crear de nuevo', async () => {
      responder = () => respuesta(201, { presupuesto: presupuestoCrudo() });

      await crearPresupuesto({
        concepto: 'Instalación eléctrica (corregido)',
        receptor: { nombre: 'Juan Pérez' },
        items: [{ descripcion: 'Mano de obra', cantidad: '1', precioUnitario: '32000' }],
        reemplazaA: 11,
      });

      expect((peticiones[0].cuerpoJson as Record<string, unknown>).reemplaza_a).toBe(11);
    });

    it('🔴 doc_link null NO es un error: el presupuesto se creó igual, sin Doc', async () => {
      responder = () => respuesta(201, { presupuesto: presupuestoCrudo({ doc_link: null, doc_id: null }) });

      const res = await crearPresupuesto({
        concepto: 'X',
        receptor: { nombre: 'Y' },
        items: [{ descripcion: 'Z', cantidad: '1', precioUnitario: '1' }],
      });

      expect(res.status).toBe('ok');
      if (res.status === 'ok') expect(res.presupuesto.docLink).toBeNull();
    });

    it('un 400 de validación se propaga con su detail', async () => {
      responder = () => respuesta(400, { detail: 'items no puede estar vacío' });
      await expect(
        crearPresupuesto({ concepto: 'X', receptor: { nombre: 'Y' }, items: [] }),
      ).rejects.toMatchObject({ status: 400, detail: 'items no puede estar vacío' });
    });
  });

  describe('facturarPresupuesto', () => {
    it('devuelve el factura_id del BORRADOR — no emite', async () => {
      responder = () => respuesta(200, { factura_id: 'presu-12', borrador_nuevo: true });

      const res = await facturarPresupuesto(12);

      expect(res).toEqual({ status: 'ok', facturaId: 'presu-12', borradorNuevo: true });
      expect(peticiones[0].path).toBe('/presupuestos/12/facturar');
      expect(peticiones[0].metodo).toBe('POST');
    });

    it('🔴 el segundo toque devuelve EL MISMO id con borradorNuevo:false — facturar es idempotente', async () => {
      // Antes de que el backend lo arreglara (2026-07-21), cada toque devolvía un id NUEVO y se
      // podían emitir dos facturas del mismo trabajo. Ahora el id es determinístico.
      responder = () => respuesta(200, { factura_id: 'presu-12', borrador_nuevo: false });

      expect(await facturarPresupuesto(12)).toEqual({
        status: 'ok',
        facturaId: 'presu-12',
        borradorNuevo: false,
      });
    });

    it('🔴 el factura_id NO se valida por su forma — cambió de hex-32 a `presu-{id}` sin avisar antes', async () => {
      // El backend cambió la forma del id el 2026-07-21 al hacerlo determinístico. Cualquier
      // validación de forma acá habría roto en device y no en los tests. Se trata como string opaco.
      responder = () => respuesta(200, { factura_id: 'presu-9999', borrador_nuevo: true });
      const res = await facturarPresupuesto(9999);
      expect(res.status === 'ok' && res.facturaId).toBe('presu-9999');
    });

    it('un deploy sin borrador_nuevo deja null, no inventa "es nuevo"', async () => {
      responder = () => respuesta(200, { factura_id: 'presu-12' });
      expect(await facturarPresupuesto(12)).toEqual({
        status: 'ok',
        facturaId: 'presu-12',
        borradorNuevo: null,
      });
    });

    it('🔴 distingue los dos 409 por la PRESENCIA de factura_id, no por el texto del detail', async () => {
      responder = () =>
        respuesta(409, { detail: 'el presupuesto ya fue facturado', factura_id: 'afip-factura-vieja' });

      const res = await facturarPresupuesto(12);

      expect(res).toEqual({ status: 'ya_facturado', facturaId: 'afip-factura-vieja' });
    });

    it('🔴 el mismo 409 SIN factura_id es "falta el perfil fiscal" — otra pantalla, otra acción', async () => {
      responder = () => respuesta(409, { detail: 'falta el perfil fiscal (CUIT)' });

      const res = await facturarPresupuesto(12);

      expect(res).toEqual({ status: 'falta_perfil_fiscal' });
    });

    it('sigue discriminando aunque el backend reescriba el copy del detail', async () => {
      // El control de que la discriminación es ESTRUCTURAL: mismo texto en los dos 409, y aun así
      // cada uno cae donde corresponde. Con un `detail.includes('facturado')` este test sería rojo.
      responder = () => respuesta(409, { detail: 'conflicto', factura_id: 'afip-factura-x' });
      expect(await facturarPresupuesto(12)).toEqual({ status: 'ya_facturado', facturaId: 'afip-factura-x' });

      responder = () => respuesta(409, { detail: 'conflicto' });
      expect(await facturarPresupuesto(12)).toEqual({ status: 'falta_perfil_fiscal' });
    });

    it('el 404 es el presupuesto que no existe para este tenant', async () => {
      responder = () => respuesta(404, { detail: 'presupuesto no encontrado' });
      expect(await facturarPresupuesto(999)).toEqual({ status: 'no_encontrado' });
    });

    it('un 405 es la ruta no desplegada', async () => {
      responder = () => respuesta(405, { detail: 'Method Not Allowed' });
      expect(await facturarPresupuesto(12)).toEqual({ status: 'no_disponible' });
    });
  });
});

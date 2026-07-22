import { beforeEach, describe, expect, it } from 'vitest';

import { configurarApi } from './config';
import type { HttpPort, PeticionHttp, RespuestaHttp } from './http';
import type { AlmacenTokens } from './tokens';
import {
  cambiosDeCliente,
  crearCliente,
  editarCliente,
  listarClientes,
  obtenerCliente,
} from './clientes';

/** Molde: `gastos.test.ts` — `HttpPort` FAKE, sin `fetch` real. */
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

/** Forma medida contra el vivo el 2026-07-22 (`avance_backend..._clientes-hito1`). */
function clienteCrudo(over: Record<string, unknown> = {}) {
  return {
    id: 12,
    nombre: 'Panadería Los Tilos',
    doc_tipo: 80,
    doc_nro: '30712345678',
    condicion_iva: 1,
    domicilio: null,
    contacto: null,
    notas: null,
    origen: 'derivado',
    creado_en: '2026-07-22T10:00:00+00:00',
    ...over,
  };
}

describe('clientes.ts', () => {
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

  describe('listarClientes', () => {
    it('normaliza a camelCase y lee `creado_en`, no `creado_at`', async () => {
      // El contrato decía `creado_at` y se corrigió antes de que existiera el código. Si el backend
      // volviera a mandar `creado_at`, este campo quedaría vacío SIN error — por eso está aserido.
      responder = () => respuesta(200, { clientes: [clienteCrudo()], total: 1 });

      const res = await listarClientes();

      expect(res.status).toBe('ok');
      if (res.status !== 'ok') return;
      const c = res.clientes[0];
      expect(c.creadoEn).toBe('2026-07-22T10:00:00+00:00');
      expect(c.docTipo).toBe(80);
      expect(c.docNro).toBe('30712345678');
      expect(c.origen).toBe('derivado');
    });

    it('una cartera vacía es `ok` con [], no un error — es el estado del primer día', async () => {
      responder = () => respuesta(200, { clientes: [], total: 0 });

      await expect(listarClientes()).resolves.toEqual({ status: 'ok', clientes: [], total: 0 });
    });

    it('manda `q` sólo si hay búsqueda', async () => {
      responder = () => respuesta(200, { clientes: [], total: 0 });

      await listarClientes({ q: 'panaderia' });
      expect(peticiones[0].path).toBe('/clientes?q=panaderia');

      await listarClientes({ q: '' });
      expect(peticiones[1].path).toBe('/clientes');
    });

    it('un 200 con el HTML del SPA es no_disponible, no una excepción de parseo', async () => {
      responder = () => respuestaHtmlDelSpa();

      await expect(listarClientes()).resolves.toEqual({ status: 'no_disponible' });
    });
  });

  describe('obtenerCliente', () => {
    it('404 es NO ENCONTRADO — semántico — y nunca "no disponible"', async () => {
      responder = () => respuesta(404, { detail: 'cliente no encontrado' });

      await expect(obtenerCliente(999999)).resolves.toEqual({ status: 'no_encontrado' });
    });

    it('las secciones vacías son un DATO, no un error ni un "no disponible"', async () => {
      // Llegan `[]` hasta el hito 3 del backend. Pintarlas como error haría que la ficha parezca
      // rota durante todo el tiempo que dure ese hito.
      responder = () =>
        respuesta(200, { cliente: clienteCrudo(), presupuestos: [], facturas: [] });

      const res = await obtenerCliente(12);

      expect(res.status).toBe('ok');
      if (res.status !== 'ok') return;
      expect(res.ficha.presupuestos).toEqual([]);
      expect(res.ficha.facturas).toEqual([]);
      expect(res.ficha.cliente.nombre).toBe('Panadería Los Tilos');
    });

    it('una operación sin `detalle` cae al concepto o al número, nunca a un renglón en blanco', async () => {
      responder = () =>
        respuesta(200, {
          cliente: clienteCrudo(),
          presupuestos: [{ id: 3, fecha: '2026-07-01', total: '45000.00', concepto: 'Instalación' }],
          facturas: [{ id: 7, fecha: '2026-07-02', total: '45000.00', numero: 14 }],
        });

      const res = await obtenerCliente(12);

      expect(res.status).toBe('ok');
      if (res.status !== 'ok') return;
      expect(res.ficha.presupuestos[0].detalle).toBe('Instalación');
      expect(res.ficha.facturas[0].detalle).toBe('N° 14');
      // Los totales siguen siendo STRING: es plata.
      expect(res.ficha.facturas[0].total).toBe('45000.00');
    });

    it('un 200 sin `cliente` es no_disponible', async () => {
      responder = () => respuesta(200, { detail: 'otra cosa' });

      await expect(obtenerCliente(12)).resolves.toEqual({ status: 'no_disponible' });
    });
  });

  describe('crearCliente — el alta a mano (hito 7)', () => {
    it('manda SÓLO las claves que vinieron: sin CUIT no viaja `doc_nro`', async () => {
      // §6.bis.2: sólo `nombre` es obligatorio. Si el alta mandara `doc_nro: ""` o `null` sin que
      // nadie lo tipeara, estaría afirmando "este cliente no tiene documento" en vez de "no lo sé".
      responder = () => respuesta(201, clienteCrudo({ id: 30, origen: 'manual' }));

      const res = await crearCliente({ nombre: 'Kiosco de la esquina' });

      expect(res.status).toBe('ok');
      expect(peticiones[0]?.path).toBe('/clientes');
      expect(peticiones[0]?.cuerpoJson).toEqual({ nombre: 'Kiosco de la esquina' });
    });

    it('🔴 un 201 devuelve el cliente — se mira la RESPUESTA, no sólo el request', async () => {
      // La lección de `gastos.test.ts`: un test que sólo asierta el body enviado pasa igual aunque el
      // parseo de la respuesta esté roto, y el alta mostraría un cliente en blanco.
      responder = () => respuesta(201, clienteCrudo({ id: 30, nombre: 'Kiosco', origen: 'manual' }));

      const res = await crearCliente({ nombre: 'Kiosco' });

      expect(res.status).toBe('ok');
      if (res.status !== 'ok') return;
      expect(res.cliente.id).toBe(30);
      expect(res.cliente.nombre).toBe('Kiosco');
      expect(res.cliente.origen).toBe('manual');
    });

    it('acepta la respuesta ENVUELTA y la PELADA — la envoltura no está medida', async () => {
      // `[ASSUMED_PENDING_VERIFY]`: `POST /gastos` devuelve pelado y `/presupuestos` envuelve. Apostar
      // a una y errar no da error: daría un cliente con id `NaN`, que se lee como bug del backend.
      responder = () => respuesta(201, { cliente: clienteCrudo({ id: 31 }) });
      const envuelto = await crearCliente({ nombre: 'A' });
      expect(envuelto.status === 'ok' && envuelto.cliente.id).toBe(31);

      responder = () => respuesta(201, clienteCrudo({ id: 32 }));
      const pelado = await crearCliente({ nombre: 'B' });
      expect(pelado.status === 'ok' && pelado.cliente.id).toBe(32);
    });

    it('🔴 el 409 es `duplicado` con el id del dueño — NO una excepción', async () => {
      // §6.bis.3: el documento ya es de otro cliente. Es el resultado útil, no un fallo: la UI dice
      // "ya lo tenés" y ofrece abrirlo. Tratarlo como error rojo empujaría a reintentar el alta.
      responder = () => respuesta(409, { detail: 'documento ya registrado', cliente_id: 7 });

      await expect(crearCliente({ nombre: 'X', docTipo: 80, docNro: '30712345678' })).resolves.toEqual({
        status: 'duplicado',
        duenoId: 7,
      });
    });

    it('el 409 sin una clave reconocible sigue siendo `duplicado`, con `duenoId` null', async () => {
      // La clave del id no está medida. Si ninguna matchea, la UI igual dice "ya lo tenés" pero sin
      // el botón para abrirlo: degradar el atajo es honesto, inventar un id lleva a la ficha ajena.
      responder = () => respuesta(409, { detail: 'ya existe' });

      await expect(crearCliente({ nombre: 'X' })).resolves.toEqual({
        status: 'duplicado',
        duenoId: null,
      });
    });

    it('un 405 es `no_disponible` — el hito 3 todavía no está desplegado', async () => {
      responder = () => respuesta(405, { detail: 'Method Not Allowed' });

      await expect(crearCliente({ nombre: 'X' })).resolves.toEqual({ status: 'no_disponible' });
    });

    it('un 422 SUBE como error — es accionable y el formulario lo muestra', async () => {
      responder = () => respuesta(422, { detail: 'nombre requerido' });

      await expect(crearCliente({})).rejects.toMatchObject({ status: 422 });
    });

    it('el 200 con HTML del SPA no fabrica un cliente vacío', async () => {
      responder = () => respuestaHtmlDelSpa();

      await expect(crearCliente({ nombre: 'X' })).resolves.toEqual({ status: 'no_disponible' });
    });
  });

  describe('editarCliente y `cambiosDeCliente` — la edición parcial', () => {
    it('🔴 cambiar SÓLO el contacto no manda el domicilio', async () => {
      // El DoD del contrato, y el bug más caro de esta pantalla: mandar el objeto entero borra el
      // domicilio que vino de las facturas de AFIP — un dato que el emprendedor nunca tipeó y no
      // sabe que puede perder. Y se ve exactamente igual que un guardado exitoso.
      const original = {
        id: 12,
        nombre: 'Panadería',
        docTipo: 80,
        docNro: '30712345678',
        condicionIva: 1,
        domicilio: 'Av. Mitre 1234',
        contacto: null,
        notas: null,
        origen: 'derivado' as const,
        creadoEn: '2026-07-22T10:00:00+00:00',
      };

      const cambios = cambiosDeCliente(original, {
        nombre: 'Panadería',
        docTipo: 80,
        docNro: '30712345678',
        condicionIva: 1,
        domicilio: 'Av. Mitre 1234',
        contacto: '11-5555-4444',
        notas: null,
      });

      expect(cambios).toEqual({ contacto: '11-5555-4444' });

      responder = () => respuesta(200, clienteCrudo({ contacto: '11-5555-4444' }));
      await editarCliente(12, cambios);

      expect(peticiones[0]?.path).toBe('/clientes/12');
      expect(peticiones[0]?.cuerpoJson).toEqual({ contacto: '11-5555-4444' });
      expect(peticiones[0]?.cuerpoJson).not.toHaveProperty('domicilio');
    });

    it('sin cambios devuelve {} — guardar sin tocar nada no reescribe el cliente', async () => {
      const original = {
        id: 12, nombre: 'Panadería', docTipo: null, docNro: null, condicionIva: null,
        domicilio: null, contacto: null, notas: null,
        origen: 'derivado' as const, creadoEn: '',
      };

      expect(cambiosDeCliente(original, { nombre: 'Panadería', domicilio: null })).toEqual({});
    });

    it('🔴 poner `null` a un campo que tenía valor SÍ es un cambio — borrar es distinto de no tocar', async () => {
      const original = {
        id: 12, nombre: 'Panadería', docTipo: null, docNro: null, condicionIva: null,
        domicilio: 'Av. Mitre 1234', contacto: null, notas: null,
        origen: 'derivado' as const, creadoEn: '',
      };

      expect(cambiosDeCliente(original, { domicilio: null })).toEqual({ domicilio: null });
    });
  });
});

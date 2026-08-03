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
    email: null,
    telefono: null,
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

    it('🔴 el 409 trae la FICHA ENTERA del dueño — no un id — y NO es una excepción', async () => {
      // Forma MEDIDA el 2026-07-22. Yo había supuesto `cliente_id` leyendo el §3.4 ("con su id en el
      // body"): ninguna de mis cuatro claves matcheaba. Y no habría fallado ruidosamente — el aviso
      // salía sin el botón de abrirlo, que se lee como "el backend no manda el id".
      responder = () =>
        respuesta(409, {
          detail: 'ese documento ya es de Ferretería El Tornillo',
          por: 'documento',
          cliente: clienteCrudo({ id: 7, nombre: 'Ferretería El Tornillo' }),
        });

      const res = await crearCliente({ nombre: 'X', docTipo: 80, docNro: '30712345678' });

      expect(res.status).toBe('duplicado');
      if (res.status !== 'duplicado') return;
      expect(res.duplicado.por).toBe('documento');
      // El NOMBRE es lo que hace útil al aviso: con el id pelado haría falta un GET extra sólo para
      // poder escribir "ese documento ya es de X".
      expect(res.duplicado.dueno?.nombre).toBe('Ferretería El Tornillo');
      expect(res.duplicado.dueno?.id).toBe(7);
    });

    it('🔴 `por: "nombre"` se distingue de `por: "documento"` — no estaba en el contrato', async () => {
      // Repetir un nombre normalizado SIN documento también choca (índice parcial por nombre). Decir
      // "ese documento ya es de X" a alguien que no tipeó documento es explicar mal algo que sí pasó.
      responder = () =>
        respuesta(409, { detail: 'ya existe', por: 'nombre', cliente: clienteCrudo({ id: 9 }) });

      const res = await crearCliente({ nombre: 'Panadería Los Tilos' });

      expect(res.status === 'duplicado' && res.duplicado.por).toBe('nombre');
    });

    it('un `por` que el backend agregue mañana cae en `desconocido`, no rompe', async () => {
      responder = () => respuesta(409, { detail: 'x', por: 'algo_nuevo', cliente: clienteCrudo({ id: 9 }) });

      const res = await crearCliente({ nombre: 'X' });

      expect(res.status === 'duplicado' && res.duplicado.por).toBe('desconocido');
    });

    it('un 409 sin nada reconocible sigue siendo `duplicado`, sin dueño', async () => {
      // La UI avisa igual, pero sin el botón para abrirlo: degradar el atajo es honesto, inventar un
      // id lleva a la ficha de otro cliente.
      responder = () => respuesta(409, { detail: 'ya existe' });

      await expect(crearCliente({ nombre: 'X' })).resolves.toEqual({
        status: 'duplicado',
        duplicado: { por: 'desconocido', dueno: null },
      });
    });

    it('🔴 `forzar` sólo viaja cuando es true — no ensucia el body de cada alta', async () => {
      responder = () => respuesta(201, clienteCrudo({ id: 40 }));

      await crearCliente({ nombre: 'Juan Pérez' });
      expect(peticiones[0]?.cuerpoJson).toEqual({ nombre: 'Juan Pérez' });

      await crearCliente({ nombre: 'Juan Pérez' }, { forzar: true });
      expect(peticiones[1]?.cuerpoJson).toEqual({ nombre: 'Juan Pérez', forzar: true });
    });

    it('🔴 `idemKey` viaja como `idem_key` — sólo cuando vino, mismo criterio que `forzar`', async () => {
      responder = () => respuesta(201, clienteCrudo({ id: 41 }));

      await crearCliente({ nombre: 'Juan Pérez' }, { idemKey: 'abc-123' });
      expect(peticiones[0]?.cuerpoJson).toEqual({ nombre: 'Juan Pérez', idem_key: 'abc-123' });

      await crearCliente({ nombre: 'Juan Pérez' });
      expect(peticiones[1]?.cuerpoJson).toEqual({ nombre: 'Juan Pérez' });
    });

    it('`idemKey` y `forzar` conviven — es el mismo gesto de alta confirmado tras el 409', async () => {
      responder = () => respuesta(201, clienteCrudo({ id: 42 }));

      await crearCliente({ nombre: 'Juan Pérez' }, { forzar: true, idemKey: 'abc-123' });
      expect(peticiones[0]?.cuerpoJson).toEqual({ nombre: 'Juan Pérez', forzar: true, idem_key: 'abc-123' });
    });

    it('editando, `forzar` no rompe la parcialidad: sólo el cambio + la confirmación', async () => {
      // Renombrar "Kiosco 2" a "Kiosco" tiene el mismo callejón que el alta, y el backend lo cubrió.
      responder = () => respuesta(200, clienteCrudo({ nombre: 'Kiosco' }));

      await editarCliente(12, { nombre: 'Kiosco' }, { forzar: true });

      expect(peticiones[0]?.cuerpoJson).toEqual({ nombre: 'Kiosco', forzar: true });
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

  describe('email y teléfono — DOS campos (hito 9)', () => {
    it('🔴 llenar SÓLO el mail no manda `telefono` — mandarlo vacío lo BORRA', () => {
      // Es el mismo bug del domicilio, con otra cara: dos claves que se llenan en el mismo formulario
      // y que un `for...in` distraído barre juntas. El teléfono borrado sería el que el backfill sacó
      // de un presupuesto viejo, que nadie tipeó y nadie sabe que puede perder.
      const original = {
        id: 12, nombre: 'Panadería', docTipo: null, docNro: null, condicionIva: null,
        domicilio: null, email: null, telefono: '11-5555-4444', notas: null,
        origen: 'derivado' as const, creadoEn: '',
      };

      expect(cambiosDeCliente(original, { email: 'pan@mail.com', telefono: '11-5555-4444' })).toEqual({
        email: 'pan@mail.com',
      });
    });

    it('lee `email`/`telefono` del backend', async () => {
      responder = () => respuesta(200, {
        clientes: [clienteCrudo({ email: 'pan@mail.com', telefono: '11-5555-4444' })],
        total: 1,
      });

      const res = await listarClientes();

      expect(res.status === 'ok' && res.clientes[0]?.email).toBe('pan@mail.com');
      expect(res.status === 'ok' && res.clientes[0]?.telefono).toBe('11-5555-4444');
    });

    it('un cliente sin mail ni teléfono llega con los dos en `null`, no en `""`', async () => {
      // 🧾 Acá vivían los dos tests del shim del `contacto` viejo, borrado el 2026-07-22 con su
      // condición de pago cumplida (`_COLS` del store ya no lo incluye — leído, no inferido).
      // Queda el caso que sí sobrevive: ausente ≠ vacío. El `""` es un dato afirmado y haría que la
      // ficha pinte un campo en blanco como si el emprendedor lo hubiera borrado.
      responder = () => respuesta(200, {
        clientes: [clienteCrudo({ email: undefined, telefono: undefined })],
        total: 1,
      });

      const res = await listarClientes();

      expect(res.status === 'ok' && res.clientes[0]).toMatchObject({ email: null, telefono: null });
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
        email: null,
    telefono: null,
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
        telefono: '11-5555-4444',
        notas: null,
      });

      expect(cambios).toEqual({ telefono: '11-5555-4444' });

      responder = () => respuesta(200, clienteCrudo({ telefono: '11-5555-4444' }));
      await editarCliente(12, cambios);

      expect(peticiones[0]?.path).toBe('/clientes/12');
      expect(peticiones[0]?.cuerpoJson).toEqual({ telefono: '11-5555-4444' });
      expect(peticiones[0]?.cuerpoJson).not.toHaveProperty('domicilio');
    });

    it('🔴 el 409 también sale EDITANDO — y es el caso que el contrato §3.4 nombra como el real', async () => {
      // "Al editar un cliente sin documento y ponerle uno que ya existe": ése es el caso que la regla
      // describe, y el que yo sólo había probado en el alta. Misma respuesta, mismo camino.
      responder = () =>
        respuesta(409, {
          detail: 'ese documento ya es de Panadería Los Tilos',
          por: 'documento',
          cliente: clienteCrudo({ id: 3, nombre: 'Panadería Los Tilos' }),
        });

      const res = await editarCliente(12, { docTipo: 80, docNro: '30712345678' });

      expect(res.status).toBe('duplicado');
      if (res.status !== 'duplicado') return;
      expect(res.duplicado.dueno?.nombre).toBe('Panadería Los Tilos');
      // Y el request siguió siendo parcial: no arrastró el resto del cliente.
      expect(peticiones[0]?.cuerpoJson).toEqual({ doc_tipo: 80, doc_nro: '30712345678' });
    });

    it('sin cambios devuelve {} — guardar sin tocar nada no reescribe el cliente', async () => {
      const original = {
        id: 12, nombre: 'Panadería', docTipo: null, docNro: null, condicionIva: null,
        domicilio: null, email: null, telefono: null, notas: null,
        origen: 'derivado' as const, creadoEn: '',
      };

      expect(cambiosDeCliente(original, { nombre: 'Panadería', domicilio: null })).toEqual({});
    });

    it('🔴 poner `null` a un campo que tenía valor SÍ es un cambio — borrar es distinto de no tocar', async () => {
      const original = {
        id: 12, nombre: 'Panadería', docTipo: null, docNro: null, condicionIva: null,
        domicilio: 'Av. Mitre 1234', email: null, telefono: null, notas: null,
        origen: 'derivado' as const, creadoEn: '',
      };

      expect(cambiosDeCliente(original, { domicilio: null })).toEqual({ domicilio: null });
    });
  });
});

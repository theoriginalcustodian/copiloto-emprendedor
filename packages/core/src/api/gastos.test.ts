import { beforeEach, describe, expect, it } from 'vitest';

import { configurarApi } from './config';
import { ApiError } from './errors';
import type { HttpPort, PeticionHttp, RespuestaHttp } from './http';
import type { AlmacenTokens } from './tokens';
import {
  CATEGORIAS_GASTO,
  crearGasto,
  destinoDeImputacion,
  rotuloDeImputacion,
  esCategoriaValida,
  imputarGasto,
  listarGastos,
  obtenerGasto,
  obtenerResumenGastos,
} from './gastos';

/** Molde: `presupuestos.test.ts` — `HttpPort` FAKE, sin `fetch` real. */
function respuesta(status: number, body: unknown): RespuestaHttp {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

/**
 * El catch-all del SPA: `200` con HTML. `res.json()` **explota** — no devuelve un objeto raro.
 * Simularlo devolviendo `{}` probaría una rama que en producción no ocurre.
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

/**
 * Forma EXACTA medida contra el vivo (`scratchpad/sonda_gastos.py`, 28/28).
 *
 * 🔴 **`POST /gastos` y `GET /gastos/{id}` devuelven esto PELADO, no `{gasto: …}`** — a diferencia de
 * presupuestos y perfil, que envuelven. Los fixtures de abajo lo usan sin envolver a propósito.
 *
 * Estos tests estuvieron **verdes contra la forma equivocada**: el fixture envolvía porque el código
 * envolvía, y los dos venían de la misma suposición (calcar el cliente de presupuestos). Un test
 * escrito desde la misma creencia que el código no lo verifica — lo confirma. El bug salió en device:
 * la card guardaba el gasto y a la vez decía que la función no estaba disponible.
 */
function gastoCrudo(over: Record<string, unknown> = {}) {
  return {
    id: 2,
    monto: '15000.50',
    monto_sugerido: null,
    fecha: '2026-07-21',
    categoria: 'mercaderia',
    proveedor: 'Distribuidora Sur',
    medio_pago: 'efectivo',
    descripcion: 'quince mil de mercadería en la distribuidora',
    origen: 'voz',
    // ⚠️ Con offset, NO con `Z` — así llega del backend real. El ejemplo del contrato decía `Z`.
    creado_en: '2026-07-22T01:41:08.185511+00:00',
    ...over,
  };
}

describe('gastos.ts', () => {
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

  describe('categorías', () => {
    it('son ocho y cerradas', () => {
      expect(CATEGORIAS_GASTO).toHaveLength(8);
      expect(esCategoriaValida('mercaderia')).toBe(true);
    });

    it('rechaza una categoría inventada — el backend devuelve 400 y acá no se la deja pasar', () => {
      // Si el cliente admitiera valores libres, «mercadería» y «stock» quedarían como rubros
      // distintos y el resumen dejaría de responder «¿en qué se me va la plata?».
      expect(esCategoriaValida('stock')).toBe(false);
      expect(esCategoriaValida('')).toBe(false);
    });
  });

  describe('listarGastos', () => {
    it('normaliza a camelCase con el monto como STRING y el id entero', async () => {
      responder = () => respuesta(200, { gastos: [gastoCrudo()], total: 37 });

      const res = await listarGastos();

      expect(res.status).toBe('ok');
      if (res.status !== 'ok') return;
      const g = res.gastos[0]!;
      expect(g.id).toBe(2);
      // 🔴 El monto NO se convierte a número en ningún punto del camino.
      expect(g.monto).toBe('15000.50');
      expect(typeof g.monto).toBe('string');
      expect(g.medioPago).toBe('efectivo');
      expect(g.origen).toBe('voz');
      expect(g.montoSugerido).toBeNull();
      expect(g.creadoEn).toBe('2026-07-22T01:41:08.185511+00:00');
    });

    it('`total` es el conteo del TENANT, no el largo de la página', async () => {
      // Una página de 1 con 37 gastos en total: confundirlos haría que la pantalla diga "1 gasto"
      // cuando hay 37, y nadie lo notaría porque el número existe y es plausible.
      responder = () => respuesta(200, { gastos: [gastoCrudo()], total: 37 });

      const res = await listarGastos({ limit: 1 });

      expect(res.status).toBe('ok');
      if (res.status !== 'ok') return;
      expect(res.gastos).toHaveLength(1);
      expect(res.total).toBe(37);
      expect(peticiones[0]!.path).toBe('/gastos?limit=1');
    });

    it('un tenant sin gastos devuelve [] y eso NO es un error', async () => {
      responder = () => respuesta(200, { gastos: [], total: 0 });

      const res = await listarGastos();

      expect(res.status).toBe('ok');
      if (res.status !== 'ok') return;
      expect(res.gastos).toEqual([]);
      expect(res.total).toBe(0);
    });

    it('una categoría desconocida del backend cae en "otros" en vez de romper la pantalla', async () => {
      responder = () => respuesta(200, { gastos: [gastoCrudo({ categoria: 'cripto' })], total: 1 });

      const res = await listarGastos();

      expect(res.status).toBe('ok');
      if (res.status !== 'ok') return;
      expect(res.gastos[0]!.categoria).toBe('otros');
    });

    it('un 200 con el HTML del SPA es "no disponible", no una excepción de parseo', async () => {
      // El catch-all `@app.get("/{full_path}")` sirve el SPA sobre cualquier ruta inexistente: el
      // status diría 200 y la pantalla explotaría en `res.json()` en vez de avisar.
      responder = () => respuestaHtmlDelSpa();

      await expect(listarGastos()).resolves.toEqual({ status: 'no_disponible' });
    });

    it('un 405 es "no disponible" (ruta no desplegada)', async () => {
      responder = () => respuesta(405, { detail: 'Method Not Allowed' });

      await expect(listarGastos()).resolves.toEqual({ status: 'no_disponible' });
    });
  });

  describe('obtenerGasto', () => {
    it('404 es NO ENCONTRADO — semántico — y nunca "no disponible"', async () => {
      // Es la distinción que el contrato §7 marca en rojo: en este endpoint el 404 significa "no
      // existe para este tenant" (incluye el id de otro). Tratarlo como "no desplegado" le diría
      // «todavía no está disponible» sobre un endpoint vivo contestando bien.
      responder = () => respuesta(404, { detail: 'no encontrado' });

      await expect(obtenerGasto(999)).resolves.toEqual({ status: 'no_encontrado' });
    });

    it('devuelve el gasto normalizado', async () => {
      responder = () => respuesta(200, gastoCrudo());

      const res = await obtenerGasto(2);

      expect(res.status).toBe('ok');
      if (res.status !== 'ok') return;
      expect(res.gasto.proveedor).toBe('Distribuidora Sur');
    });
  });

  describe('crearGasto', () => {
    it('🔴 un 201 devuelve `ok` CON el gasto — se mira la respuesta, no sólo el request', async () => {
      // Este test no existía, y por eso el bug llegó al teléfono: **todos los demás tests de
      // `crearGasto` assertan sobre `peticiones[0].cuerpoJson`** —lo que se MANDA— o sobre ramas de
      // error. Ninguno miraba qué hace el cliente con una respuesta exitosa.
      //
      // El resultado: `crearGasto` devolvía `no_disponible` sobre un `201` que había guardado bien,
      // la card mostraba "los gastos todavía no están disponibles" y el emprendedor volvía a tocar
      // Guardar — creando un segundo gasto. Verde en 19 tests, roto en device.
      responder = () => respuesta(201, gastoCrudo());

      const res = await crearGasto({ monto: '15000.50', origen: 'manual' });

      expect(res.status).toBe('ok');
      if (res.status !== 'ok') return;
      expect(res.gasto.id).toBe(2);
      expect(res.gasto.monto).toBe('15000.50');
      expect(res.gasto.categoria).toBe('mercaderia');
    });

    it('manda sólo monto y origen cuando no hay más datos — y NO manda `fecha`', async () => {
      // 🔴 Omitir `fecha` es lo que deja que el backend ponga HOY EN ARGENTINA. Mandar `null` o una
      // fecha calculada del lado del cliente reintroduce el bug de zona horaria: a las 21:30 de
      // Argentina, `new Date().toISOString()` ya es mañana, y los días 30/31 caen en el mes
      // siguiente — o sea, en el resumen, que es la recompensa de la función.
      responder = () => respuesta(201, gastoCrudo());

      await crearGasto({ monto: '15000.50', origen: 'manual' });

      expect(peticiones[0]!.cuerpoJson).toEqual({ monto: '15000.50', origen: 'manual' });
      expect(peticiones[0]!.cuerpoJson).not.toHaveProperty('fecha');
    });

    it('traduce a snake_case sólo las claves presentes', async () => {
      responder = () => respuesta(201, gastoCrudo());

      await crearGasto({
        monto: '900.00',
        origen: 'foto',
        categoria: 'transporte',
        medioPago: 'tarjeta',
        montoSugerido: '899.00',
      });

      expect(peticiones[0]!.cuerpoJson).toEqual({
        monto: '900.00',
        origen: 'foto',
        categoria: 'transporte',
        medio_pago: 'tarjeta',
        monto_sugerido: '899.00',
      });
    });

    it('propaga el 400 con su detail, que es mostrable tal cual', async () => {
      // El backend valida a mano justamente para dar `"falta monto"` en vez del array de pydantic.
      responder = () => respuesta(400, { detail: 'falta monto' });

      await expect(crearGasto({ monto: '', origen: 'manual' })).rejects.toBeInstanceOf(ApiError);
    });

    it('405 es "no disponible" y no se confunde con un error de validación', async () => {
      responder = () => respuesta(405, { detail: 'Method Not Allowed' });

      await expect(crearGasto({ monto: '1', origen: 'manual' })).resolves.toEqual({
        status: 'no_disponible',
      });
    });

    it('IDEM-gasto/BL-V33: manda idem_key cuando se la da, y no la manda si no (cliente viejo = comportamiento de antes)', async () => {
      // Molde: presupuestos.test.ts K-01. Mismo mecanismo, mismo backend (PR #666).
      responder = () => respuesta(201, gastoCrudo());

      await crearGasto({ monto: '15000.50', origen: 'manual', idemKey: 'gasto:assistant-123' });
      await crearGasto({ monto: '15000.50', origen: 'manual' });

      expect(peticiones[0]!.cuerpoJson).toHaveProperty('idem_key', 'gasto:assistant-123');
      expect(peticiones[1]!.cuerpoJson).not.toHaveProperty('idem_key');
    });
  });

  describe('obtenerResumenGastos', () => {
    it('normaliza el resumen con los totales como string y el porcentaje como número', async () => {
      responder = () =>
        respuesta(200, {
          periodo: '2026-07',
          total: '340000.00',
          por_categoria: [
            { categoria: 'mercaderia', total: '136000.00', porcentaje: 40 },
            { categoria: 'servicios', total: '68000.00', porcentaje: 20 },
          ],
          mes_anterior: '295000.00',
        });

      const res = await obtenerResumenGastos();

      expect(res.status).toBe('ok');
      if (res.status !== 'ok') return;
      expect(res.resumen.total).toBe('340000.00');
      expect(typeof res.resumen.total).toBe('string');
      expect(res.resumen.porCategoria[0]!.porcentaje).toBe(40);
      expect(res.resumen.mesAnterior).toBe('295000.00');
    });

    it('un mes sin gastos es 200 con total "0.00" — un DATO, no una ausencia', async () => {
      responder = () =>
        respuesta(200, { periodo: '2026-07', total: '0.00', por_categoria: [], mes_anterior: null });

      const res = await obtenerResumenGastos();

      expect(res.status).toBe('ok');
      if (res.status !== 'ok') return;
      expect(res.resumen.total).toBe('0.00');
      expect(res.resumen.porCategoria).toEqual([]);
      expect(res.resumen.mesAnterior).toBeNull();
    });

    it('NO normaliza los porcentajes: los devuelve tal cual aunque no sumen 100', async () => {
      // Tres categorías iguales dan 33.3 tres veces = 99.9. El contrato avisa que no está
      // garantizado que cierren; normalizar acá escondería el hueco y quien dibuje barras creería
      // que puede confiar. La normalización es decisión de quien dibuja, con el dato a la vista.
      responder = () =>
        respuesta(200, {
          periodo: '2026-07',
          total: '300.00',
          por_categoria: [
            { categoria: 'mercaderia', total: '100.00', porcentaje: 33.3 },
            { categoria: 'servicios', total: '100.00', porcentaje: 33.3 },
            { categoria: 'otros', total: '100.00', porcentaje: 33.3 },
          ],
          mes_anterior: null,
        });

      const res = await obtenerResumenGastos();

      expect(res.status).toBe('ok');
      if (res.status !== 'ok') return;
      const suma = res.resumen.porCategoria.reduce((a, c) => a + c.porcentaje, 0);
      expect(suma).toBeCloseTo(99.9, 5);
    });

    it('un 200 que NO trae "periodo" es no_disponible — el caso del 422 int_parsing', async () => {
      // Si `/gastos/resumen` se declarara DESPUÉS de `/gastos/{gasto_id}`, el segmento "resumen"
      // caería en la ruta del id. Validar por forma evita mostrar basura si eso regresa.
      responder = () =>
        respuesta(200, { detail: [{ type: 'int_parsing', loc: ['path', 'gasto_id'] }] });

      await expect(obtenerResumenGastos()).resolves.toEqual({ status: 'no_disponible' });
    });

    it('pasa el período por query cuando se pide uno', async () => {
      responder = () =>
        respuesta(200, { periodo: '2026-06', total: '0.00', por_categoria: [], mes_anterior: null });

      await obtenerResumenGastos('2026-06');

      expect(peticiones[0]!.path).toBe('/gastos/resumen?periodo=2026-06');
    });
  });

  /**
   * La imputación al trabajo — `PUT /gastos/{id}/imputacion` + la clave `imputacion` de los dos GET.
   *
   * 🔴 **Lo que más muerde acá no es el happy-path: es la diferencia entre «sin imputar» y «este
   * backend no lo dijo».** La clave `imputacion` entró al GET el 2026-10-14 (PR #1175); contra un
   * deploy anterior no viene. Si el cliente tradujera «ausente» a «sin imputar», la pantalla
   * afirmaría algo sobre la plata del emprendedor que nadie midió — y lo afirmaría *justo* en el
   * deploy donde no se puede saber.
   */
  describe('imputación del gasto', () => {
    describe('el parser: la ausencia NO es «sin imputar»', () => {
      it('🔴 un gasto sin la clave `imputacion` deja el campo en null -- no en un objeto vacío', async () => {
        responder = () => respuesta(200, gastoCrudo());

        const res = await obtenerGasto(2);

        expect(res.status).toBe('ok');
        if (res.status !== 'ok') return;
        expect(res.gasto.imputacion).toBeNull();
        // Y el destino también: a ninguno CONOCIDO. La pantalla distingue los dos casos por
        // `imputacion !== null`, no por el destino.
        expect(destinoDeImputacion(res.gasto.imputacion)).toBeNull();
      });

      it('🔴 las tres referencias en null SÍ es «sin imputar»: el objeto viene, el destino no', async () => {
        responder = () =>
          respuesta(200, gastoCrudo({
            imputacion: { gasto_id: 2, presupuesto_ref: null, comprobante_ref: null, cobro_ref: null },
          }));

        const res = await obtenerGasto(2);

        expect(res.status).toBe('ok');
        if (res.status !== 'ok') return;
        // El objeto presente es la prueba de que el backend contestó la pregunta.
        expect(res.gasto.imputacion).toEqual({
          gastoId: 2, presupuestoRef: null, comprobanteRef: null, cobroRef: null, etiqueta: null,
        });
        expect(destinoDeImputacion(res.gasto.imputacion)).toBeNull();
      });

      describe('🔴 el rótulo del trabajo imputado viaja con el dato (`etiqueta`), no se re-deriva del id', () => {
        it('GET: la etiqueta del backend llega tal cual (sin espacios de los bordes) y es lo que se pinta', async () => {
          responder = () =>
            respuesta(200, gastoCrudo({
              imputacion: {
                gasto_id: 2, presupuesto_ref: 227, comprobante_ref: null, cobro_ref: null,
                etiqueta: ' asesoría contable · #3 ',
              },
            }));

          const res = await obtenerGasto(2);

          expect(res.status).toBe('ok');
          if (res.status !== 'ok') return;
          // El defecto medido: ref=227 (id de base) y número humano #3. El rótulo es el humano.
          expect(rotuloDeImputacion(res.gasto.imputacion)).toBe('asesoría contable · #3');
        });

        it('PUT: la misma forma en el camino de escritura, para que no diverja del de lectura', async () => {
          responder = () =>
            respuesta(200, {
              imputacion: {
                gasto_id: 2, presupuesto_ref: 227, comprobante_ref: null, cobro_ref: null,
                etiqueta: 'asesoría contable · #3',
              },
            });

          const res = await imputarGasto(2, { eslabon: 'presupuesto', ref: 227 });

          expect(res.status).toBe('ok');
          if (res.status !== 'ok') return;
          expect(rotuloDeImputacion(res.imputacion)).toBe('asesoría contable · #3');
        });

        it('🔴 SIN etiqueta (backend viejo o `null`) NO se inventa un número: queda el nombre del eslabón', () => {
          const base = { gastoId: 2, presupuestoRef: 227, comprobanteRef: null, cobroRef: null };
          for (const etiqueta of [undefined, null]) {
            const rotulo = rotuloDeImputacion({ ...base, etiqueta });
            expect(rotulo).toBe('Presupuesto');
            expect(rotulo).not.toContain('#');
            expect(rotulo).not.toContain('227');
          }
          expect(rotuloDeImputacion({ gastoId: 2, presupuestoRef: null, comprobanteRef: 90, cobroRef: null })).toBe('Factura');
          expect(rotuloDeImputacion({ gastoId: 2, presupuestoRef: null, comprobanteRef: null, cobroRef: 4 })).toBe('Cobro');
        });

        it('una etiqueta ilegible en el wire (vacía, en blanco, número, objeto) se parsea a `null`, no a un rótulo vacío', async () => {
          for (const etiqueta of ['', '   ', 12, {}]) {
            responder = () =>
              respuesta(200, gastoCrudo({
                imputacion: { gasto_id: 2, presupuesto_ref: 227, comprobante_ref: null, cobro_ref: null, etiqueta },
              }));
            const res = await obtenerGasto(2);
            expect(res.status).toBe('ok');
            if (res.status !== 'ok') return;
            expect(res.gasto.imputacion!.etiqueta).toBeNull();
            expect(rotuloDeImputacion(res.gasto.imputacion)).toBe('Presupuesto');
          }
        });

        it('sin trabajo imputado no hay rótulo, aunque venga una etiqueta suelta', () => {
          expect(rotuloDeImputacion(null)).toBeNull();
          expect(
            rotuloDeImputacion({ gastoId: 2, presupuestoRef: null, comprobanteRef: null, cobroRef: null, etiqueta: 'x · #1' }),
          ).toBeNull();
        });
      });

      it('resuelve el destino en cada uno de los tres eslabones', async () => {
        expect(destinoDeImputacion({ gastoId: 1, presupuestoRef: 12, comprobanteRef: null, cobroRef: null }))
          .toEqual({ eslabon: 'presupuesto', ref: 12 });
        expect(destinoDeImputacion({ gastoId: 1, presupuestoRef: null, comprobanteRef: 90, cobroRef: null }))
          .toEqual({ eslabon: 'comprobante', ref: 90 });
        expect(destinoDeImputacion({ gastoId: 1, presupuestoRef: null, comprobanteRef: null, cobroRef: 4 }))
          .toEqual({ eslabon: 'cobro', ref: 4 });
      });

      it('🔴 con DOS referencias no nulas elige una sola, y siempre la misma', async () => {
        // El backend garantiza que a lo sumo una es no nula (`imputar()` escribe las tres columnas en
        // el mismo UPDATE). Si esa garantía se rompiera, un lector ingenuo por pantalla mostraría la
        // primera que mira y cada una elegiría distinta: dos pantallas discrepando sobre el mismo
        // gasto. Acá la precedencia es del eslabón RAÍZ hacia afuera, y es única para todo el repo.
        const imp = { gastoId: 1, presupuestoRef: 12, comprobanteRef: 90, cobroRef: 4 };
        expect(destinoDeImputacion(imp)).toEqual({ eslabon: 'presupuesto', ref: 12 });
      });

      it('una ref no numérica no acredita imputación -- cae a null, no a NaN', async () => {
        responder = () =>
          respuesta(200, gastoCrudo({
            imputacion: { gasto_id: 2, presupuesto_ref: '12', comprobante_ref: null, cobro_ref: null },
          }));

        const res = await obtenerGasto(2);

        expect(res.status).toBe('ok');
        if (res.status !== 'ok') return;
        expect(res.gasto.imputacion!.presupuestoRef).toBeNull();
        expect(destinoDeImputacion(res.gasto.imputacion)).toBeNull();
      });

      it('la imputación también viaja en el LISTADO, no sólo en el detalle', async () => {
        responder = () =>
          respuesta(200, {
            gastos: [gastoCrudo({
              imputacion: { gasto_id: 2, presupuesto_ref: null, comprobante_ref: 90, cobro_ref: null },
            })],
            total: 1,
          });

        const res = await listarGastos();

        expect(res.status).toBe('ok');
        if (res.status !== 'ok') return;
        expect(destinoDeImputacion(res.gastos[0]!.imputacion)).toEqual({ eslabon: 'comprobante', ref: 90 });
      });
    });

    describe('imputarGasto', () => {
      it('manda PUT al endpoint del gasto con eslabón y ref', async () => {
        responder = () =>
          respuesta(200, { imputacion: { gasto_id: 2, presupuesto_ref: 12, comprobante_ref: null, cobro_ref: null } });

        const res = await imputarGasto(2, { eslabon: 'presupuesto', ref: 12 });

        expect(peticiones[0]!.metodo).toBe('PUT');
        expect(peticiones[0]!.path).toBe('/gastos/2/imputacion');
        expect(peticiones[0]!.cuerpoJson).toEqual({ eslabon: 'presupuesto', ref: 12 });
        expect(res.status).toBe('ok');
        if (res.status !== 'ok') return;
        expect(res.imputacion.presupuestoRef).toBe(12);
      });

      it('🔴 desimputar manda `{eslabon: null}` SIN ref -- una ref con eslabón nulo describe un destino que no existe', async () => {
        responder = () =>
          respuesta(200, { imputacion: { gasto_id: 2, presupuesto_ref: null, comprobante_ref: null, cobro_ref: null } });

        const res = await imputarGasto(2, null);

        expect(peticiones[0]!.cuerpoJson).toEqual({ eslabon: null });
        expect(res.status).toBe('ok');
        if (res.status !== 'ok') return;
        expect(destinoDeImputacion(res.imputacion)).toBeNull();
      });

      it('404 es no_encontrado -- y cubre DOS casos que el backend no distingue a propósito', async () => {
        // El gasto ajeno y el trabajo ajeno dan el mismo 404: el backend no confirma recursos de
        // otros tenants. Esta capa no inventa la diferencia.
        responder = () => respuesta(404, { detail: 'ese trabajo no existe' });

        await expect(imputarGasto(2, { eslabon: 'cobro', ref: 999 }))
          .resolves.toEqual({ status: 'no_encontrado' });
      });

      it('🔴 un 200 sin la clave `imputacion` es no_disponible, NO un desimputado exitoso', async () => {
        // El catch-all del SPA y un endpoint que todavía no está devuelven 200 con otra cosa. Leerlo
        // como «quedó sin imputar» mostraría el efecto contrario al que el usuario pidió.
        responder = () => respuesta(200, { ok: true });

        await expect(imputarGasto(2, { eslabon: 'presupuesto', ref: 12 }))
          .resolves.toEqual({ status: 'no_disponible' });
      });

      it('405/501 es no_disponible: el endpoint no está en este deploy', async () => {
        responder = () => respuesta(405, { detail: 'Method Not Allowed' });

        await expect(imputarGasto(2, null)).resolves.toEqual({ status: 'no_disponible' });
      });

      it('un 503 del trabajo_store se propaga como ApiError -- no se traga como «sin imputar»', async () => {
        responder = () => respuesta(503, { detail: 'la imputación no está disponible' });

        await expect(imputarGasto(2, { eslabon: 'presupuesto', ref: 12 })).rejects.toThrow(ApiError);
      });
    });
  });
});

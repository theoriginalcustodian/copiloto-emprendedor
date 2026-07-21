import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  anularComprobante,
  cancelarFactura,
  conectarArca,
  confirmarConTokenFresco,
  confirmarFactura,
  cambiarAmbiente,
  crearFactura,
  ErrorValidacionFiscal,
  esperarEcoDelSignal,
  esperarEstadoEstable,
  estadoAfip,
  estadoAnulacion,
  estadoFactura,
  guardarAjustesAfip,
  guardarPerfil,
  leerPerfil,
  listarComprobantes,
  SinCertificadoError,
} from './afip';
import { configurarApi } from './config';
import { ApiError } from './errors';
import type { HttpPort, PeticionHttp, RespuestaHttp } from './http';
import type { AlmacenTokens } from './tokens';

/**
 * Molde: `actividad.test.ts`/`clientes.test.ts` — `HttpPort` FAKE, sin `fetch` real (el paquete
 * compila sin `lib.dom`). `secuencia(...)` cubre los tests que necesitan respuestas DISTINTAS en
 * llamadas sucesivas al mismo path (`esperarEstadoEstable`, `confirmarConTokenFresco`).
 */

function respuesta(status: number, body: unknown): RespuestaHttp {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

function secuencia(...respuestas: RespuestaHttp[]): () => RespuestaHttp {
  let i = 0;
  return () => respuestas[Math.min(i++, respuestas.length - 1)]!;
}

function crearTokensFake(token: string | null = 'tok-123'): AlmacenTokens {
  return {
    async leerToken() {
      return token;
    },
    async guardarToken() {},
    async leerRefresh() {
      return null;
    },
    async guardarRefresh() {},
    async limpiar() {},
  };
}

/** Estado crudo mínimo válido de `GET /afip/facturas/{id}` — los tests pisan sólo lo que les importa. */
function estadoFacturaCruda(overrides: Record<string, unknown> = {}) {
  return {
    estado: 'borrador',
    faltantes: [],
    items: [],
    total: '0.00',
    token_confirmacion: null,
    resultado: null,
    pdf: null,
    motivo: null,
    terminado: false,
    ...overrides,
  };
}

describe('afip.ts', () => {
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

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('leerPerfil — GET /afip/perfil', () => {
    it('normaliza el shape crudo a camelCase', async () => {
      responder = () =>
        respuesta(200, {
          perfil: {
            cuit: '20111222339',
            razon_social: 'Ana Pérez',
            domicilio_comercial: 'Calle Falsa 123',
            condicion_iva: 'monotributo',
            ingresos_brutos: 'CM',
            inicio_actividades: '2020-01-01',
            punto_venta: 1,
          },
        });

      const result = await leerPerfil('20111222339');

      expect(result).toEqual({
        status: 'ok',
        perfil: {
          cuit: '20111222339',
          razonSocial: 'Ana Pérez',
          domicilioComercial: 'Calle Falsa 123',
          condicionIva: 'monotributo',
          ingresosBrutos: 'CM',
          inicioActividades: '2020-01-01',
          puntoVenta: 1,
          // Sin la clave en la respuesta el ajuste queda APAGADO: subir los datos fiscales de
          // alguien a una cuenta de Drive no puede pasar por un default.
          guardarEnDrive: false,
        },
      });
    });

    it('trae guardar_en_drive cuando el backend lo manda', async () => {
      responder = () =>
        respuesta(200, {
          perfil: {
            cuit: '20111222339', razon_social: 'Ana Pérez', domicilio_comercial: 'Calle Falsa 123',
            condicion_iva: 'monotributo', ingresos_brutos: 'CM', inicio_actividades: '2020-01-01',
            punto_venta: 1, guardar_en_drive: true,
          },
        });

      const result = await leerPerfil('20111222339');

      expect(result.status === 'ok' && result.perfil?.guardarEnDrive).toBe(true);
    });

    it('perfil: null (200 real, no error) -> status ok con perfil null', async () => {
      responder = () => respuesta(200, { perfil: null });

      const result = await leerPerfil('20111222339');

      expect(result).toEqual({ status: 'ok', perfil: null });
    });

    it('404 (app de AFIP sin montar) -> no_disponible', async () => {
      responder = () => respuesta(404, { detail: 'not found' });

      expect(await leerPerfil('20111222339')).toEqual({ status: 'no_disponible' });
    });

    it('501 -> no_disponible, mismo criterio que 404', async () => {
      responder = () => respuesta(501, { detail: 'not implemented' });

      expect(await leerPerfil('20111222339')).toEqual({ status: 'no_disponible' });
    });

    it('otro status (403) SÍ se relanza', async () => {
      responder = () => respuesta(403, { detail: 'forbidden' });

      const err = (await leerPerfil('x').catch((e: unknown) => e)) as ApiError;
      expect(err).toBeInstanceOf(ApiError);
      expect(err.status).toBe(403);
    });
  });

  describe('guardarPerfil — POST /afip/perfil', () => {
    it('200 -> {status: ok, ok: true}', async () => {
      responder = () => respuesta(200, { ok: true });

      const result = await guardarPerfil({
        cuit: '20111222339',
        razonSocial: 'Ana Pérez',
        domicilioComercial: 'Calle Falsa 123',
        condicionIva: 'monotributo',
        ingresosBrutos: 'CM',
        inicioActividades: '2020-01-01',
        puntoVenta: 1,
      });

      expect(result).toEqual({ status: 'ok', ok: true });
      expect(peticiones[0]).toMatchObject({ metodo: 'POST', path: '/afip/perfil' });
      const cuerpo = peticiones[0]!.cuerpoJson as Record<string, unknown>;
      expect(cuerpo).toEqual({
        cuit: '20111222339',
        razon_social: 'Ana Pérez',
        domicilio_comercial: 'Calle Falsa 123',
        condicion_iva: 'monotributo',
        ingresos_brutos: 'CM',
        inicio_actividades: '2020-01-01',
        punto_venta: 1,
      });
    });

    it('422 con detail ARRAY (validar_perfil) -> ErrorValidacionFiscal con Faltante[]', async () => {
      responder = () =>
        respuesta(422, {
          detail: [
            { codigo: 'cuit_invalido', campo: 'cuit', mensaje: 'El CUIT no es válido.' },
            { codigo: 'razon_social_vacio', campo: 'razon_social', mensaje: 'Falta completar razón social.' },
          ],
        });

      const err = (await guardarPerfil({
        cuit: 'x',
        razonSocial: '',
        domicilioComercial: '',
        condicionIva: 'monotributo',
        ingresosBrutos: '',
        inicioActividades: '2020-01-01',
        puntoVenta: 1,
      }).catch((e: unknown) => e)) as ErrorValidacionFiscal;

      expect(err).toBeInstanceOf(ErrorValidacionFiscal);
      expect(err.status).toBe(422);
      expect(err.faltantes).toEqual([
        { codigo: 'cuit_invalido', campo: 'cuit', mensaje: 'El CUIT no es válido.' },
        { codigo: 'razon_social_vacio', campo: 'razon_social', mensaje: 'Falta completar razón social.' },
      ]);
    });

    it('422 con detail STRING ("condicion_iva inválida: X") -> ErrorValidacionFiscal con un Faltante de campo vacío', async () => {
      responder = () => respuesta(422, { detail: 'condicion_iva inválida: marciano' });

      const err = (await guardarPerfil({
        cuit: '20111222339',
        razonSocial: 'Ana',
        domicilioComercial: 'x',
        // @ts-expect-error -- valor deliberadamente inválido para forzar el 422 string del backend.
        condicionIva: 'marciano',
        ingresosBrutos: 'CM',
        inicioActividades: '2020-01-01',
        puntoVenta: 1,
      }).catch((e: unknown) => e)) as ErrorValidacionFiscal;

      expect(err).toBeInstanceOf(ErrorValidacionFiscal);
      expect(err.faltantes).toEqual([{ codigo: '', campo: '', mensaje: 'condicion_iva inválida: marciano' }]);
    });

    it('404/501 -> no_disponible, no lanza', async () => {
      responder = () => respuesta(404, { detail: 'not found' });
      expect(await guardarPerfil({
        cuit: '1', razonSocial: '', domicilioComercial: '', condicionIva: 'monotributo',
        ingresosBrutos: '', inicioActividades: '2020-01-01', puntoVenta: 1,
      })).toEqual({ status: 'no_disponible' });
    });
  });

  describe('conectarArca — POST /afip/conectar', () => {
    it('200 -> {status: ok, ok, workflowId, mensaje} SIN la clave fiscal en el resultado', async () => {
      responder = () =>
        respuesta(200, {
          ok: true,
          workflow_id: 'afip-onboarding-c1-20111222339',
          mensaje: 'Estamos vinculando tu cuenta con ARCA.',
        });

      const result = await conectarArca({
        cuit: '20111222339',
        usuario: '20111222339',
        claveFiscal: 'secreto-super-sensible',
      });

      expect(result).toEqual({
        status: 'ok',
        ok: true,
        workflowId: 'afip-onboarding-c1-20111222339',
        mensaje: 'Estamos vinculando tu cuenta con ARCA.',
      });
      // La clave NO puede aparecer en ningún valor del objeto devuelto.
      expect(JSON.stringify(result)).not.toContain('secreto-super-sensible');

      // La request SÍ la manda (es el único lugar donde debe viajar).
      const cuerpo = peticiones[0]!.cuerpoJson as Record<string, unknown>;
      expect(cuerpo.clave_fiscal).toBe('secreto-super-sensible');
    });

    it('manda ambiente sólo si el caller lo manda (el backend hoy lo ignora, ver docstring del tipo)', async () => {
      responder = () => respuesta(200, { ok: true, workflow_id: 'wf1', mensaje: 'ok' });

      await conectarArca({ cuit: '1', usuario: '1', claveFiscal: 'x' });
      expect('ambiente' in (peticiones[0]!.cuerpoJson as Record<string, unknown>)).toBe(false);

      peticiones.length = 0;
      await conectarArca({ cuit: '1', usuario: '1', claveFiscal: 'x', ambiente: 'homologacion' });
      expect((peticiones[0]!.cuerpoJson as Record<string, unknown>).ambiente).toBe('homologacion');
    });

    it('422 "CUIT inválido" (string) -> ErrorValidacionFiscal con un Faltante de campo vacío', async () => {
      responder = () => respuesta(422, { detail: 'CUIT inválido' });

      const err = (await conectarArca({ cuit: 'x', usuario: 'x', claveFiscal: 'x' }).catch(
        (e: unknown) => e,
      )) as ErrorValidacionFiscal;

      expect(err).toBeInstanceOf(ErrorValidacionFiscal);
      expect(err.faltantes).toEqual([{ codigo: '', campo: '', mensaje: 'CUIT inválido' }]);
    });

    it('404/501 -> no_disponible', async () => {
      responder = () => respuesta(501, { detail: 'not implemented' });
      expect(await conectarArca({ cuit: '1', usuario: '1', claveFiscal: 'x' })).toEqual({ status: 'no_disponible' });
    });
  });

  describe('estadoAfip — GET /afip/estado', () => {
    it('normaliza conectado/perfil/onboarding a camelCase', async () => {
      responder = () =>
        respuesta(200, {
          conectado: true,
          ws_autorizados: ['wsfe'],
          perfil_completo: true,
          puede_facturar: true,
          onboarding: { paso: 'habilitado', motivo: null, ws_autorizados: ['wsfe'], terminado: true, ok: true },
        });

      const result = await estadoAfip('20111222339');

      expect(result).toEqual({
        status: 'ok',
        conectado: true,
        wsAutorizados: ['wsfe'],
        perfilCompleto: true,
        puedeFacturar: true,
        onboarding: { paso: 'habilitado', motivo: null, wsAutorizados: ['wsfe'], terminado: true, ok: true },
      });
    });

    it('onboarding: null pasa tal cual', async () => {
      responder = () =>
        respuesta(200, {
          conectado: false, ws_autorizados: [], perfil_completo: false, puede_facturar: false, onboarding: null,
        });

      const result = await estadoAfip('1');
      expect(result).toMatchObject({ status: 'ok', onboarding: null });
    });

    it('404 -> no_disponible', async () => {
      responder = () => respuesta(404, { detail: 'not found' });
      expect(await estadoAfip('1')).toEqual({ status: 'no_disponible' });
    });

    /**
     * 🔴 **La regresión que este test impide, encontrada al construir la pantalla de Ajustes.**
     *
     * `estadoAfip` armaba un objeto literal con 5 claves fijas, así que `cuit`, `ambiente` y
     * `ambientes_vinculados` —los tres que el backend está por sumar (pedidos §2 y §3)— se
     * DESCARTABAN en silencio. El daño no se ve el día que se escribe: se ve el día que el backend
     * los sube, la pantalla de Ajustes sigue en modo degradado, y el síntoma ("el selector de
     * ambiente no anda") no apunta a este archivo por ningún lado.
     *
     * Es la clase de defecto que un test de "normaliza a camelCase" nunca caza: pasa verde porque lo
     * que afirma —que las 5 claves conocidas se traducen— sigue siendo cierto.
     */
    it('propaga cuit/ambiente/ambientes_vinculados cuando el backend los manda', async () => {
      responder = () =>
        respuesta(200, {
          cuit: '20111222339',
          ambiente: 'dev',
          ambientes_vinculados: ['dev', 'prod'],
          conectado: true,
          ws_autorizados: ['wsfe'],
          perfil_completo: true,
          puede_facturar: true,
          onboarding: null,
        });

      const result = await estadoAfip();

      expect(result).toMatchObject({
        status: 'ok',
        cuit: '20111222339',
        ambiente: 'dev',
        ambientesVinculados: ['dev', 'prod'],
      });
    });

    /**
     * El caso de HOY: el backend todavía no manda esos tres campos. Tienen que quedar `undefined`,
     * NO con un default inventado — `undefined` significa "no sé" y la pantalla está obligada a
     * decirlo. Un default `'dev'` acá haría que la UI afirme un ambiente que nadie verificó, que es
     * exactamente el error caro de este flujo (emitir en producción creyendo que se está probando).
     */
    it('sin esos campos quedan undefined, sin inventar un default', async () => {
      responder = () =>
        respuesta(200, {
          conectado: false, ws_autorizados: [], perfil_completo: false, puede_facturar: false, onboarding: null,
        });

      const result = await estadoAfip('1');

      expect(result).toMatchObject({ status: 'ok' });
      const ok = result as Extract<typeof result, { status: 'ok' }>;
      expect(ok.ambiente).toBeUndefined();
      expect(ok.ambientesVinculados).toBeUndefined();
      expect(ok.cuit).toBeUndefined();
    });

    /**
     * 🔴 **`drive_conectado` tiene TRES valores y el `null` no es `false`.**
     *
     * `true` = vinculado y ACTIVE · `false` = sin conexión **o EXPIRED** · `null` = el backend no
     * pudo averiguarlo (Composio no respondió). Colapsar `null` a `false` le diría *"conectá tu
     * Drive"* a alguien que lo tiene conectado hace meses, cada vez que se cae un servicio ajeno —
     * la misma forma del bug del alta fallida, un rastro pisando el hecho.
     *
     * El test recorre los tres en la MISMA tabla a propósito: un booleano que devuelve siempre lo
     * mismo pasa cualquier prueba de humo, y sólo un caso que los distinga puede fallar si el
     * mapeo colapsa dos de ellos.
     */
    it.each([
      ['true', true, true],
      ['false (incluye EXPIRED)', false, false],
      ['null (no se pudo averiguar)', null, null],
      ['ausente (backend viejo)', undefined, undefined],
    ])('drive_conectado %s se propaga sin colapsarse', async (_caso, crudo, esperado) => {
      responder = () =>
        respuesta(200, {
          conectado: true, ws_autorizados: ['wsfe'], perfil_completo: true, puede_facturar: true,
          onboarding: null, drive_conectado: crudo,
        });

      const result = await estadoAfip('1');

      const ok = result as Extract<typeof result, { status: 'ok' }>;
      expect(ok.driveConectado).toBe(esperado);
    });
  });

  describe('crearFactura — POST /afip/facturas', () => {
    it('200 -> {status: ok, ok: true, facturaId}', async () => {
      responder = () => respuesta(200, { ok: true, factura_id: 'f-1' });
      expect(await crearFactura('1')).toEqual({ status: 'ok', ok: true, facturaId: 'f-1' });
    });

    it('503 ("facturación no disponible") -> no_disponible', async () => {
      responder = () => respuesta(503, { detail: 'facturación no disponible' });
      expect(await crearFactura('1')).toEqual({ status: 'no_disponible' });
    });

    it('404 -> no_disponible también', async () => {
      responder = () => respuesta(404, { detail: 'not found' });
      expect(await crearFactura('1')).toEqual({ status: 'no_disponible' });
    });
  });

  describe('estadoFactura — GET /afip/facturas/{id} (id dinámico: NO usa no_disponible)', () => {
    it('normaliza items/resultado/pdf a camelCase', async () => {
      responder = () =>
        respuesta(
          200,
          estadoFacturaCruda({
            estado: 'entregada',
            items: [{ descripcion: 'Consultoría', cantidad: '2', precio_unitario: '100.00', subtotal: '200.00' }],
            total: '200.00',
            resultado: { ok: true, duplicado: false, cae: '75304012345678', cae_vto: '2026-08-01', nro: 5, tipo_cbte: 11, punto_venta: 1 },
            pdf: { url: 'https://x/1.pdf', nombre: '1.pdf', expira_at: '2026-07-22T00:00:00Z' },
            terminado: true,
          }),
        );

      const result = await estadoFactura('f-1');

      expect(result).toEqual({
        estado: 'entregada',
        faltantes: [],
        items: [{ descripcion: 'Consultoría', cantidad: '2', precioUnitario: '100.00', subtotal: '200.00' }],
        total: '200.00',
        tokenConfirmacion: null,
        resultado: { ok: true, duplicado: false, cae: '75304012345678', caeVto: '2026-08-01', nro: 5, tipoCbte: 11, puntoVenta: 1 },
        pdf: { url: 'https://x/1.pdf', nombre: '1.pdf', expiraAt: '2026-07-22T00:00:00Z' },
        drive: null,
        motivo: null,
        motivoCodigo: null,
        terminado: true,
      });
    });

    it('normaliza el archivado en Drive, guardado y fallado', async () => {
      responder = () =>
        respuesta(200, estadoFacturaCruda({
          estado: 'entregada', terminado: true,
          drive: { guardado: true, file_id: '1tnAN', link: 'https://drive/uc?id=1tnAN', compartido: true },
        }));

      const ok = await estadoFactura('f-1');
      expect(ok.drive).toEqual({
        guardado: true, fileId: '1tnAN', link: 'https://drive/uc?id=1tnAN', compartido: true, motivo: null,
      });

      // El caso que importa para el copy: el ajuste estaba PRENDIDO y el archivado falló igual.
      // `guardado: false` es el hecho — de acá cuelga el aviso de las 24 h, no del ajuste.
      responder = () =>
        respuesta(200, estadoFacturaCruda({
          estado: 'entregada', terminado: true,
          drive: { guardado: false, motivo: 'error_drive: ConnectionRequired' },
        }));

      const fallo = await estadoFactura('f-1');
      expect(fallo.drive).toEqual({
        guardado: false, fileId: null, link: null, compartido: false, motivo: 'error_drive: ConnectionRequired',
      });
    });

    it('resultado sin cae_vto (rama "adoptado de AFIP") -> caeVto: null, no explota', async () => {
      responder = () =>
        respuesta(
          200,
          estadoFacturaCruda({
            resultado: { ok: true, duplicado: true, cae: 'x', nro: 1, tipo_cbte: 11, punto_venta: 1 },
          }),
        );

      const result = await estadoFactura('f-1');
      expect(result.resultado?.caeVto).toBeNull();
    });

    it('404 ("factura no encontrada", id dinámico) -> ApiError, NO no_disponible', async () => {
      responder = () => respuesta(404, { detail: 'factura no encontrada' });

      const err = (await estadoFactura('ajena').catch((e: unknown) => e)) as ApiError;
      expect(err).toBeInstanceOf(ApiError);
      expect(err.status).toBe(404);
    });
  });

  describe('confirmarFactura / cancelarFactura — signals', () => {
    it('confirmarFactura manda el token en el body', async () => {
      responder = () => respuesta(200, { ok: true });
      await confirmarFactura('f-1', 'tok-abc');
      expect(peticiones[0]).toMatchObject({ metodo: 'POST', path: '/afip/facturas/f-1/confirmar' });
      expect(peticiones[0]!.cuerpoJson).toEqual({ token: 'tok-abc' });
    });

    it('cancelarFactura no manda body', async () => {
      responder = () => respuesta(200, { ok: true });
      await cancelarFactura('f-1');
      expect(peticiones[0]).toMatchObject({ metodo: 'POST', path: '/afip/facturas/f-1/cancelar' });
    });
  });

  describe('listarComprobantes — GET /afip/comprobantes', () => {
    it('normaliza cada fila a camelCase', async () => {
      responder = () =>
        respuesta(200, {
          comprobantes: [
            {
              cuit: '1', tipo_cbte: 11, punto_venta: 1, nro: 5, cae: 'x', cae_vto: '2026-08-01',
              fecha_emision: '2026-07-21', total: '200.00', estado: 'emitida', pdf_url: 'https://x', cbte_asoc_nro: null,
            },
          ],
        });

      const result = await listarComprobantes('1');

      expect(result).toEqual({
        status: 'ok',
        comprobantes: [
          {
            cuit: '1', tipoCbte: 11, puntoVenta: 1, nro: 5, cae: 'x', caeVto: '2026-08-01',
            fechaEmision: '2026-07-21', total: '200.00', estado: 'emitida', pdfUrl: 'https://x', cbteAsocNro: null,
            driveFileId: null, driveLink: null, receptorNombre: null, docTipo: null, docNro: null,
          },
        ],
      });
    });

    // 🔴 Regresión del bug que este módulo ya tuvo una vez: `estadoAfip` armaba un objeto literal y
    // DESCARTABA `ambiente`/`ambientes_vinculados`, así que la pantalla habría quedado degradada
    // para siempre incluso con el backend ya arreglado. Un campo que el normalizador se olvida no
    // da error en ningún lado — sólo desaparece.
    it('no descarta los campos de Drive ni los del receptor', async () => {
      responder = () =>
        respuesta(200, {
          comprobantes: [
            {
              cuit: '1', tipo_cbte: 11, punto_venta: 1, nro: 15, cae: 'x', cae_vto: '2026-08-01',
              fecha_emision: '2026-07-21', total: '200.00', estado: 'emitida', pdf_url: 'https://x',
              cbte_asoc_nro: null,
              drive_file_id: '1tnAN', drive_link: 'https://drive/uc?id=1tnAN&export=download',
              receptor_nombre: 'Juan Pérez SRL', doc_tipo: 80, doc_nro: '20111111112',
            },
          ],
        });

      const result = await listarComprobantes('1');
      const fila = result.status === 'ok' ? result.comprobantes[0]! : null;

      expect(fila).toMatchObject({
        driveFileId: '1tnAN',
        driveLink: 'https://drive/uc?id=1tnAN&export=download',
        receptorNombre: 'Juan Pérez SRL',
        docTipo: 80,
        docNro: '20111111112',
      });
    });

    it('manda cuit/limite como querystring, default limite=50', async () => {
      responder = () => respuesta(200, { comprobantes: [] });
      await listarComprobantes('20111222339');
      expect(peticiones[0]!.path).toBe('/afip/comprobantes?cuit=20111222339&limite=50');
    });

    it('404 -> no_disponible', async () => {
      responder = () => respuesta(404, { detail: 'not found' });
      expect(await listarComprobantes('1')).toEqual({ status: 'no_disponible' });
    });
  });

  describe('anularComprobante / estadoAnulacion', () => {
    it('anularComprobante 200 -> {status: ok, ok: true, anulacionId}', async () => {
      responder = () => respuesta(200, { ok: true, anulacion_id: 'a-1' });
      const result = await anularComprobante({ cuit: '1', tipoCbte: 11, puntoVenta: 1, nro: 5 });
      expect(result).toEqual({ status: 'ok', ok: true, anulacionId: 'a-1' });
      expect(peticiones[0]!.cuerpoJson).toEqual({ cuit: '1', tipo_cbte: 11, punto_venta: 1, nro: 5 });
    });

    it('anularComprobante 503 ("anulación no disponible") -> no_disponible', async () => {
      responder = () => respuesta(503, { detail: 'anulación no disponible' });
      expect(await anularComprobante({ cuit: '1', tipoCbte: 11, puntoVenta: 1, nro: 5 })).toEqual({ status: 'no_disponible' });
    });

    it('estadoAnulacion normaliza original + resultado', async () => {
      responder = () =>
        respuesta(200, {
          paso: 'anulada',
          original: {
            cuit: '1', tipo_cbte: 11, punto_venta: 1, nro: 5, cae: 'x', cae_vto: '2026-08-01',
            fecha_emision: '2026-07-21', total: '200.00', estado: 'anulada', pdf_url: null, cbte_asoc_nro: 6,
          },
          errores: [],
          resultado: { ok: true, duplicado: false, cae: 'y', cae_vto: '2026-08-01', nro: 6, tipo_cbte: 13, punto_venta: 1 },
          motivo: null,
          terminado: true,
        });

      const result = await estadoAnulacion('a-1');

      expect(result.paso).toBe('anulada');
      expect(result.original?.cbteAsocNro).toBe(6);
      expect(result.resultado).toEqual({ ok: true, duplicado: false, cae: 'y', caeVto: '2026-08-01', nro: 6, tipoCbte: 13, puntoVenta: 1 });
    });

    it('estadoAnulacion 404 ("anulación no encontrada", id dinámico) -> ApiError', async () => {
      responder = () => respuesta(404, { detail: 'anulación no encontrada' });
      const err = (await estadoAnulacion('ajena').catch((e: unknown) => e)) as ApiError;
      expect(err).toBeInstanceOf(ApiError);
      expect(err.status).toBe(404);
    });
  });

  describe('esperarEstadoEstable', () => {
    it('converge cuando perfil_ausente desaparece en el 2º intento', async () => {
      vi.useFakeTimers();
      responder = secuencia(
        respuesta(200, estadoFacturaCruda({ faltantes: [{ codigo: 'perfil_ausente', campo: 'perfil', mensaje: 'x' }] })),
        respuesta(200, estadoFacturaCruda({ estado: 'borrador' })),
      );

      const promesa = esperarEstadoEstable('f-1');
      await vi.advanceTimersByTimeAsync(50);
      const resultado = await promesa;

      expect(resultado.convergio).toBe(true);
      expect(resultado.estado.faltantes).toEqual([]);
      // 1 fetch inicial + 1 refetch tras el backoff de 50ms.
      expect(peticiones).toHaveLength(2);
    });

    it('CORTA con convergio:false si perfil_ausente nunca desaparece (topeMs bajo para no tardar de verdad)', async () => {
      vi.useFakeTimers();
      responder = () =>
        respuesta(200, estadoFacturaCruda({ faltantes: [{ codigo: 'perfil_ausente', campo: 'perfil', mensaje: 'x' }] }));

      const promesa = esperarEstadoEstable('f-1', { topeMs: 300 });
      await vi.advanceTimersByTimeAsync(1000);
      const resultado = await promesa;

      expect(resultado.convergio).toBe(false);
      expect(resultado.estado.faltantes[0]?.codigo).toBe('perfil_ausente');
    });
  });

  /**
   * 🔴 El bug que motivó esto, cazado en device el 2026-07-21: los `POST` de la factura mandan un
   * SIGNAL a Temporal y devuelven 200 al instante. Leer el estado justo después es una carrera; al
   * perderla, la pantalla se queda mostrando el paso anterior sobre un backend que ya avanzó. Sin
   * error visible, y **intermitente** — cuando el signal se procesa rápido, parece funcionar.
   */
  describe('esperarEcoDelSignal', () => {
    it('repolea hasta que el estado cambia, no se queda con la primera lectura', async () => {
      vi.useFakeTimers();
      const previo = await (async () => {
        responder = () => respuesta(200, estadoFacturaCruda({ estado: 'borrador' }));
        return estadoFactura('f-1');
      })();
      peticiones.length = 0;

      // El backend todavía no procesó el signal en la 1ª lectura; en la 2ª sí.
      responder = secuencia(
        respuesta(200, estadoFacturaCruda({ estado: 'borrador' })),
        respuesta(200, estadoFacturaCruda({ estado: 'datos_venta_ok' })),
      );

      const promesa = esperarEcoDelSignal('f-1', previo);
      await vi.advanceTimersByTimeAsync(50);
      const resultado = await promesa;

      expect(resultado.cambio).toBe(true);
      expect(resultado.estado.estado).toBe('datos_venta_ok');
      expect(peticiones).toHaveLength(2);
    });

    it('detecta un cambio que NO mueve el estado (segundo ítem: items_ok -> items_ok)', async () => {
      vi.useFakeTimers();
      responder = () =>
        respuesta(200, estadoFacturaCruda({
          estado: 'items_ok',
          items: [{ descripcion: 'a', cantidad: '1', precio_unitario: '10.00', subtotal: '10.00' }],
          total: '10.00',
        }));
      const previo = await estadoFactura('f-1');
      peticiones.length = 0;

      responder = () =>
        respuesta(200, estadoFacturaCruda({
          estado: 'items_ok',
          items: [
            { descripcion: 'a', cantidad: '1', precio_unitario: '10.00', subtotal: '10.00' },
            { descripcion: 'b', cantidad: '1', precio_unitario: '5.00', subtotal: '5.00' },
          ],
          total: '15.00',
        }));

      const resultado = await esperarEcoDelSignal('f-1', previo);

      // Mismo `estado`, pero la lista cambió: mirar sólo `estado` habría esperado el tope entero.
      expect(resultado.cambio).toBe(true);
      expect(peticiones).toHaveLength(1);
    });

    it('CORTA honesto con cambio:false si nada cambia — un signal puede no cambiar nada', async () => {
      vi.useFakeTimers();
      responder = () => respuesta(200, estadoFacturaCruda({ estado: 'borrador' }));
      const previo = await estadoFactura('f-1');

      const promesa = esperarEcoDelSignal('f-1', previo, { topeMs: 300 });
      await vi.advanceTimersByTimeAsync(1000);
      const resultado = await promesa;

      expect(resultado.cambio).toBe(false);
      expect(resultado.estado.estado).toBe('borrador');
    });

    it('sin estado previo la primera lectura ES el resultado, sin esperar', async () => {
      responder = () => respuesta(200, estadoFacturaCruda({ estado: 'borrador' }));

      const resultado = await esperarEcoDelSignal('f-1', null);

      expect(resultado.cambio).toBe(true);
      expect(peticiones).toHaveLength(1);
    });
  });

  describe('confirmarConTokenFresco', () => {
    it('emite OK cuando el estado avanza más allá de esperando_confirmacion', async () => {
      responder = secuencia(
        respuesta(200, estadoFacturaCruda({ estado: 'esperando_confirmacion', token_confirmacion: 'tok-fresco' })),
        respuesta(200, { ok: true }),
        respuesta(200, estadoFacturaCruda({ estado: 'emitiendo', token_confirmacion: null })),
      );

      const result = await confirmarConTokenFresco('f-1');

      expect(result.emitida).toBe(true);
      expect(result.estado?.estado).toBe('emitiendo');
      // GET estado -> POST confirmar (con el token FRESCO) -> GET estado.
      expect(peticiones).toHaveLength(3);
      expect(peticiones[1]!.cuerpoJson).toEqual({ token: 'tok-fresco' });
    });

    it('detecta el no-op (sigue esperando_confirmacion) y devuelve el motivo, sin declarar éxito', async () => {
      responder = secuencia(
        respuesta(200, estadoFacturaCruda({ estado: 'esperando_confirmacion', token_confirmacion: 'tok-viejo' })),
        respuesta(200, { ok: true }),
        respuesta(
          200,
          estadoFacturaCruda({
            estado: 'esperando_confirmacion',
            token_confirmacion: 'tok-nuevo',
            motivo: 'la confirmación no corresponde a los datos actuales; revisá el resumen',
          }),
        ),
      );

      const result = await confirmarConTokenFresco('f-1');

      expect(result.emitida).toBe(false);
      expect(result.motivo).toBe('la confirmación no corresponde a los datos actuales; revisá el resumen');
    });

    it('token_confirmacion null -> NO llama al backend (ni confirmar ni un 2º estado)', async () => {
      responder = () => respuesta(200, estadoFacturaCruda({ estado: 'borrador', token_confirmacion: null }));

      const result = await confirmarConTokenFresco('f-1');

      // `result.estado` es el shape YA NORMALIZADO (camelCase) que devuelve `estadoFactura`, no el
      // crudo que manda el fake `HttpPort` — por eso no se compara contra `estadoFacturaCruda(...)`.
      expect(result).toEqual({
        emitida: false,
        motivo: 'la factura no está lista para emitir',
        estado: {
          estado: 'borrador',
          faltantes: [],
          items: [],
          total: '0.00',
          tokenConfirmacion: null,
          resultado: null,
          pdf: null,
          drive: null,
          motivo: null,
          motivoCodigo: null,
          terminado: false,
        },
      });
      expect(peticiones).toHaveLength(1); // sólo el estadoFactura() inicial, nada más.
    });
  });

  describe('guardarAjustesAfip — POST /afip/ajustes', () => {
    it('200 -> ok con el valor que confirmó el backend, no el que mandó la UI', async () => {
      responder = () => respuesta(200, { ok: true, guardar_en_drive: true });

      const result = await guardarAjustesAfip('20111222339', true);

      expect(result).toEqual({ ok: true, guardarEnDrive: true });
      expect(peticiones[0]!.cuerpoJson).toEqual({ cuit: '20111222339', guardar_en_drive: true });
    });

    /**
     * 🔴 El 409 vuelve como VALOR. Es "ese CUIT no tiene perfil fiscal", no una falla: un `UPDATE`
     * sobre cero filas "funciona" en SQL, así que sin este camino el toggle quedaría prendido en
     * pantalla y la base sin nada guardado — el usuario creería tener sus facturas archivándose.
     */
    it('409 -> sinPerfil como valor, sin lanzar', async () => {
      responder = () =>
        respuesta(409, { detail: 'todavía no cargaste tus datos fiscales para ese CUIT' });

      const result = await guardarAjustesAfip('20111222339', true);

      expect(result).toEqual({
        ok: false,
        sinPerfil: true,
        mensaje: 'todavía no cargaste tus datos fiscales para ese CUIT',
      });
    });

    it('un error que NO es 409 sigue subiendo', async () => {
      responder = () => respuesta(500, { detail: 'boom' });
      await expect(guardarAjustesAfip('1', true)).rejects.toBeInstanceOf(ApiError);
    });
  });
  /**
   * Contrato desplegado por backend el 2026-07-21, a pedido de esta capa. Los tres casos de abajo son
   * los que cambian el COMPORTAMIENTO de la UI, no sólo su tipado.
   */
  describe('contrato nuevo — 409 sin certificado, cambio de ambiente y motivo_codigo', () => {
    it('crearFactura sin certificado lanza SinCertificadoError, no un ApiError genérico', async () => {
      responder = () =>
        respuesta(409, { detail: 'Todavía no vinculaste tu cuenta de ARCA.' });

      await expect(crearFactura('20111222339')).rejects.toBeInstanceOf(SinCertificadoError);
    });

    /**
     * 🔴 El 409 NO puede colapsar a `no_disponible`. Son estados opuestos: `no_disponible` significa
     * "el backend no tiene esta capacidad" (la app muestra "todavía no está disponible"), y el 409
     * significa "vos no configuraste tu cuenta" (la app tiene que ofrecer el camino a Ajustes).
     * Mezclarlos dejaría al usuario esperando algo que sólo él puede destrabar.
     */
    it('el 409 NO se confunde con no_disponible', async () => {
      responder = () => respuesta(409, { detail: 'x' });
      const err = await crearFactura('1').catch((e) => e);
      expect(err).toBeInstanceOf(SinCertificadoError);
      expect(err).not.toEqual({ status: 'no_disponible' });
    });

    it('cambiarAmbiente OK devuelve {ok:true}', async () => {
      responder = () => respuesta(200, { ok: true });
      expect(await cambiarAmbiente('20111222339', 'prod')).toEqual({ ok: true });
    });

    /**
     * El 409 `ambiente_no_vinculado` NO es una falla que mostrar como error: es el caso donde la UI
     * ofrece el alta para ESE ambiente. Por eso vuelve como valor y no como excepción — una excepción
     * empujaría al caller a un `catch` genérico y de ahí a un cartel rojo, que es justo lo contrario
     * de lo que el usuario necesita ver.
     */
    it('cambiarAmbiente a uno no vinculado vuelve como VALOR, no como excepción', async () => {
      responder = () =>
        respuesta(409, { detail: 'Todavía no vinculaste producción.' });

      const r = await cambiarAmbiente('20111222339', 'prod');

      expect(r).toEqual({
        ok: false,
        ambienteNoVinculado: 'prod',
        mensaje: 'Todavía no vinculaste producción.',
      });
    });

    it('motivo_codigo se propaga como motivoCodigo (es el que se usa para ramificar)', async () => {
      responder = () =>
        respuesta(200, {
          estado: 'emitida',
          faltantes: [],
          items: [],
          total: '1000.00',
          token_confirmacion: null,
          resultado: null,
          pdf: null,
          motivo: 'tu factura se emitió (CAE 123); el PDF no está disponible en este momento',
          motivo_codigo: 'emitida_sin_pdf',
          terminado: false,
        });

      const r = await estadoFactura('f-1');

      expect(r.motivoCodigo).toBe('emitida_sin_pdf');
      expect(r.motivo).toContain('CAE 123');
    });
  });
});

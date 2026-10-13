import { describe, expect, it } from 'vitest';

import { etiquetaCondicionIva, leerFacturaPropuesta } from './facturaPropuesta';

/**
 * La card TAL COMO LA EMITE el backend (`tool_catalog.py`): `tipo_comprobante` y `condicion_iva` son el
 * `.name` del enum (`FACTURA_C`, `CONSUMIDOR_FINAL`), no la letra ni un código. La fixture anterior usaba
 * `'C'` y `'CF'` — formas que el backend no manda — y por eso la card real mostraba «Factura FACTURA_C».
 */
function cardReal(over: Record<string, unknown> = {}) {
  return {
    kind: 'factura_propuesta',
    data: {
      factura_id: 'presu-12',
      faltantes: [],
      items: [{ descripcion: 'Service de aire', cantidad: 1, precio_unitario: 50000 }],
      cliente: {
        razon_social: 'Juan Pérez',
        cuit: '20304050607',
        condicion_iva: 'CONSUMIDOR_FINAL',
        del_registro: false,
      },
      total: 50000,
      tipo_comprobante: 'FACTURA_C',
      ...over,
    },
  };
}

describe('leerFacturaPropuesta', () => {
  it('traduce la forma real del wire', () => {
    const p = leerFacturaPropuesta(cardReal());

    expect(p).toEqual({
      facturaId: 'presu-12',
      faltantes: [],
      items: [{ descripcion: 'Service de aire', cantidad: '1', precioUnitario: '50000' }],
      cliente: {
        razonSocial: 'Juan Pérez',
        cuit: '20304050607',
        condicionIva: 'CONSUMIDOR_FINAL',
        delRegistro: false,
      },
      total: '50000',
      tipoComprobante: 'C',
    });
  });

  describe('`cliente.del_registro` (D7) — antes se descartaba', () => {
    const delRegistro = {
      razon_social: 'Panadería La Esquina',
      cuit: '30712345678',
      condicion_iva: 'RESPONSABLE_INSCRIPTO',
      del_registro: true,
    };

    it('🔴 un cliente que salió del registro llega marcado, con SU condición de IVA', () => {
      const p = leerFacturaPropuesta(cardReal({ cliente: delRegistro, tipo_comprobante: 'FACTURA_A' }));

      expect(p?.cliente).toEqual({
        razonSocial: 'Panadería La Esquina',
        cuit: '30712345678',
        condicionIva: 'RESPONSABLE_INSCRIPTO',
        delRegistro: true,
      });
      expect(p?.tipoComprobante).toBe('A');
    });

    it('control negativo: `del_registro: false` (lo dictó la persona) NO se marca', () => {
      const p = leerFacturaPropuesta(cardReal({ cliente: { ...delRegistro, del_registro: false } }));

      expect(p?.cliente?.delRegistro).toBe(false);
    });

    it('estricto: un `del_registro` que no es `true` booleano no marca (un "false" string, un 1)', () => {
      for (const raro of ['false', 'true', 1, null, undefined]) {
        const p = leerFacturaPropuesta(cardReal({ cliente: { ...delRegistro, del_registro: raro } }));
        expect(p?.cliente?.delRegistro).toBe(false);
      }
    });

    it('un backend anterior que no manda el campo degrada a no-marcado, sin romper', () => {
      const { del_registro: _omitido, ...sinCampo } = delRegistro;
      void _omitido;
      expect(leerFacturaPropuesta(cardReal({ cliente: sinCampo }))?.cliente?.delRegistro).toBe(false);
    });
  });

  describe('`tipo_comprobante` — la LETRA', () => {
    it.each([
      ['FACTURA_A', 'A'],
      ['FACTURA_B', 'B'],
      ['FACTURA_C', 'C'],
      ['C', 'C'],
    ])('%s → %s', (wire, letra) => {
      expect(leerFacturaPropuesta(cardReal({ tipo_comprobante: wire }))?.tipoComprobante).toBe(letra);
    });

    it('un valor que no es una factura A/B/C no se pinta crudo: null', () => {
      for (const raro of ['NOTA_CREDITO_A', 'FACTURA_X', 'factura c', '', null]) {
        expect(leerFacturaPropuesta(cardReal({ tipo_comprobante: raro }))?.tipoComprobante).toBeNull();
      }
    });
  });

  describe('etiquetaCondicionIva', () => {
    it('traduce el `.name` del enum del backend', () => {
      expect(etiquetaCondicionIva('RESPONSABLE_INSCRIPTO')).toBe('Responsable Inscripto');
      expect(etiquetaCondicionIva('MONOTRIBUTO')).toBe('Monotributo');
      expect(etiquetaCondicionIva('CONSUMIDOR_FINAL')).toBe('Consumidor Final');
    });

    it('un nombre desconocido o ausente es null — nunca el identificador crudo', () => {
      expect(etiquetaCondicionIva('ALGO_NUEVO')).toBeNull();
      expect(etiquetaCondicionIva(null)).toBeNull();
    });
  });

  it('ignora cualquier card que no sea `factura_propuesta`', () => {
    expect(leerFacturaPropuesta({ kind: 'gasto_propuesto', data: { factura_id: 'presu-12' } })).toBeNull();
    expect(leerFacturaPropuesta(undefined)).toBeNull();
  });

  it('sin `factura_id` no hay sobre qué actuar — null, no un objeto a medias', () => {
    expect(leerFacturaPropuesta(cardReal({ factura_id: null }))).toBeNull();
  });

  it('`data` ausente o rota no crashea — null', () => {
    expect(leerFacturaPropuesta({ kind: 'factura_propuesta', data: null })).toBeNull();
    expect(leerFacturaPropuesta({ kind: 'factura_propuesta', data: 'texto suelto' })).toBeNull();
    expect(leerFacturaPropuesta({ kind: 'factura_propuesta' })).toBeNull();
  });

  it('`faltantes`/`items`/`cliente` ausentes degradan a vacío/null, no rompen', () => {
    const p = leerFacturaPropuesta(
      cardReal({ faltantes: undefined, items: undefined, cliente: undefined }),
    );

    expect(p).toEqual(
      expect.objectContaining({ faltantes: [], items: [], cliente: null }),
    );
  });

  it('un `faltantes` no vacío viaja tal cual — es lo que decide Emitir vs Completar a mano', () => {
    const p = leerFacturaPropuesta(cardReal({ faltantes: ['cliente', 'datos_venta'] }));

    expect(p?.faltantes).toEqual(['cliente', 'datos_venta']);
  });

  it('un ítem sin `descripcion` se descarta, no se pinta una fila muda', () => {
    const p = leerFacturaPropuesta(
      cardReal({ items: [{ cantidad: 1, precio_unitario: 100 }, { descripcion: 'Válido', cantidad: 2, precio_unitario: 200 }] }),
    );

    expect(p?.items).toEqual([{ descripcion: 'Válido', cantidad: '2', precioUnitario: '200' }]);
  });

  it('🔴 `cantidad`/`precio_unitario`/`total` son `number` en el wire — se convierten con String(), nunca se opera', () => {
    const p = leerFacturaPropuesta(cardReal({ total: 123.5, items: [{ descripcion: 'X', cantidad: 2.5, precio_unitario: 10.25 }] }));

    expect(p?.total).toBe('123.5');
    expect(p?.items[0]).toEqual({ descripcion: 'X', cantidad: '2.5', precioUnitario: '10.25' });
  });
});

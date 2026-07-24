import { describe, expect, it } from 'vitest';

import { leerFacturaPropuesta } from './facturaPropuesta';

/** La card TAL COMO LA DESCRIBE el contrato §2.1 — `data` confirmada. */
function cardReal(over: Record<string, unknown> = {}) {
  return {
    kind: 'factura_propuesta',
    data: {
      factura_id: 'presu-12',
      faltantes: [],
      items: [{ descripcion: 'Service de aire', cantidad: 1, precio_unitario: 50000 }],
      cliente: { razon_social: 'Juan Pérez', cuit: '20304050607', condicion_iva: 'CF' },
      total: 50000,
      tipo_comprobante: 'C',
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
      cliente: { razonSocial: 'Juan Pérez', cuit: '20304050607', condicionIva: 'CF' },
      total: '50000',
      tipoComprobante: 'C',
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

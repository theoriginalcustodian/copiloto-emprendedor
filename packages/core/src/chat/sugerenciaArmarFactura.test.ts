import { describe, expect, it } from 'vitest';
import { avisoArmarFactura, leerSugerenciaArmarFactura } from './sugerenciaArmarFactura';

describe('leerSugerenciaArmarFactura', () => {
  it('lee la card completa', () => {
    expect(
      leerSugerenciaArmarFactura({ kind: 'sugerencia_armar_factura', presupuesto_id: 7, texto: '¿Te armo la factura?' }),
    ).toEqual({ presupuestoId: 7, texto: '¿Te armo la factura?' });
  });

  it('sin texto usa el default', () => {
    expect(leerSugerenciaArmarFactura({ kind: 'sugerencia_armar_factura', presupuesto_id: 7 })?.texto).toBe(
      '¿Te armo la factura?',
    );
  });

  it('control negativo: kind desconocido / otra card / null no pintan', () => {
    expect(leerSugerenciaArmarFactura({ kind: 'algo_nuevo', presupuesto_id: 7 })).toBeNull();
    expect(leerSugerenciaArmarFactura({ kind: 'requiere_conexion', presupuesto_id: 7 })).toBeNull();
    expect(leerSugerenciaArmarFactura(null)).toBeNull();
    expect(leerSugerenciaArmarFactura(undefined)).toBeNull();
  });

  it('presupuesto_id inválido (string, 0, decimal, ausente) no pinta', () => {
    for (const id of ['7', 0, -1, 1.5, undefined]) {
      expect(leerSugerenciaArmarFactura({ kind: 'sugerencia_armar_factura', presupuesto_id: id } as never)).toBeNull();
    }
  });
});

describe('avisoArmarFactura', () => {
  it('ok no dice nada (se navega); el resto dice qué pasó', () => {
    expect(avisoArmarFactura({ status: 'ok', facturaId: 'f1', borradorNuevo: true })).toBeNull();
    expect(avisoArmarFactura({ status: 'ya_facturado', facturaId: 'f1' })).toMatch(/ya está facturado/);
    expect(avisoArmarFactura({ status: 'falta_perfil_fiscal' })).toMatch(/datos fiscales/);
    expect(avisoArmarFactura({ status: 'estado_incompatible', estado: 'desestimado', motivo: 'Está desestimado.' })).toBe(
      'Está desestimado.',
    );
    expect(avisoArmarFactura({ status: 'no_disponible' })).toMatch(/No pudimos/);
  });
});

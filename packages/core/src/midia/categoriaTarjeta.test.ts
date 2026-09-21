import { describe, expect, it } from 'vitest';

import type { TarjetaMiDia } from '../api';

import { categoriaDe, filtrarPorCategoria } from './categoriaTarjeta';

function tarjeta(over: Partial<TarjetaMiDia> = {}): TarjetaMiDia {
  return {
    id: 't1',
    texto: 'Algo pasó en tu negocio.',
    regla: null,
    entidadTipo: null,
    entidadId: null,
    estado: 'para_hoy',
    cliente: null,
    monto: null,
    fecha: null,
    ...over,
  };
}

describe('categoriaDe — el mapeo provisorio que espera B-3', () => {
  it('sin regla es una tarjeta del emprendedor: «Tuyas»', () => {
    // El único caso que no adivina nada: la ausencia de regla ES «esto no lo detecté yo».
    expect(categoriaDe(tarjeta({ regla: null }))).toBe('tuyas');
  });

  it.each(['cae_por_vencer', 'certificado_afip_por_vencer'])('la regla %s es de ARCA', (regla) => {
    expect(categoriaDe(tarjeta({ regla, entidadTipo: 'comprobante' }))).toBe('arca');
  });

  it('una factura impaga es un cobro, aunque comparta `entidadTipo` con las de ARCA', () => {
    // `comprobante` no alcanza para decidir: tres reglas distintas lo usan. Es justamente por qué
    // esta derivación pertenece al backend.
    expect(categoriaDe(tarjeta({ regla: 'facturas_impagas_viejas', entidadTipo: 'comprobante' }))).toBe('cobros');
  });

  it('un presupuesto enfriándose es de Presupuestos', () => {
    expect(categoriaDe(tarjeta({ regla: 'presupuestos_enfriandose', entidadTipo: 'presupuesto' }))).toBe(
      'presupuestos',
    );
  });

  it('🔴 lo que no entra en ningún chip devuelve `null` — no se le inventa uno', () => {
    // Márgenes y gastos no tienen chip en el prototipo. Inventarles uno sería agregar una pantalla
    // que el diseño no pidió; lo que corresponde es que se vean en «Todo».
    expect(categoriaDe(tarjeta({ regla: 'trabajo_con_margen_negativo', entidadTipo: 'trabajo' }))).toBeNull();
    expect(categoriaDe(tarjeta({ regla: 'gasto_del_mes_alto', entidadTipo: 'mes' }))).toBeNull();
  });
});

describe('filtrarPorCategoria', () => {
  const lista = [
    tarjeta({ id: 'a', regla: 'facturas_impagas_viejas', entidadTipo: 'comprobante' }),
    tarjeta({ id: 'b', regla: 'cae_por_vencer', entidadTipo: 'comprobante' }),
    tarjeta({ id: 'c', regla: null }),
    tarjeta({ id: 'd', regla: 'trabajo_con_margen_negativo', entidadTipo: 'trabajo' }),
  ];

  it('🔴 «Todo» no filtra: muestra TODAS, incluidas las que no tienen chip propio', () => {
    // Es la garantía de que ninguna tarjeta queda inalcanzable por no encajar en el mapeo.
    expect(filtrarPorCategoria(lista, 'todo').map((t) => t.id)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('cada chip deja sólo lo suyo', () => {
    expect(filtrarPorCategoria(lista, 'cobros').map((t) => t.id)).toEqual(['a']);
    expect(filtrarPorCategoria(lista, 'arca').map((t) => t.id)).toEqual(['b']);
    expect(filtrarPorCategoria(lista, 'tuyas').map((t) => t.id)).toEqual(['c']);
    expect(filtrarPorCategoria(lista, 'presupuestos')).toEqual([]);
  });
});

import { describe, expect, it } from 'vitest';

import type { TableroMiDia, TarjetaMiDia } from '../api';
import { filtrarPorCategoria, hayCategorias, tarjetasCriticas } from './filtroTablero';

function t(id: string, over: Partial<TarjetaMiDia> = {}): TarjetaMiDia {
  return {
    id, texto: `t${id}`, regla: null, entidadTipo: null, entidadId: null, estado: 'para_hoy',
    cliente: null, monto: null, fecha: null, categoria: null, criticidad: null, verbo: null, ...over,
  };
}
const tablero = (para: TarjetaMiDia[], hechas: TarjetaMiDia[] = []): TableroMiDia => ({
  solapas: [
    { id: 'para_hoy', titulo: 'Para hoy', tarjetas: para },
    { id: 'haciendo', titulo: 'Haciendo', tarjetas: [] },
    { id: 'hecha', titulo: 'Hechas', tarjetas: hechas },
  ],
});

describe('filtroTablero (BL-J5)', () => {
  const tarjetas = [t('1', { categoria: 'arca' }), t('2', { categoria: 'cobros' }), t('3', { categoria: null })];

  it('filtra por `t.categoria`; «todo» no filtra; categoria null sólo aparece en «todo»', () => {
    expect(filtrarPorCategoria(tarjetas, 'todo')).toHaveLength(3);
    expect(filtrarPorCategoria(tarjetas, 'arca').map((x) => x.id)).toEqual(['1']);
    expect(filtrarPorCategoria(tarjetas, 'tuyas')).toHaveLength(0);
    for (const c of ['cobros', 'arca', 'presupuestos', 'tuyas'] as const) {
      expect(filtrarPorCategoria(tarjetas, c).some((x) => x.id === '3')).toBe(false);
    }
  });

  it('hayCategorias: false con backend previo (ninguna trae categoria), true si alguna', () => {
    expect(hayCategorias(null)).toBe(false);
    expect(hayCategorias(tablero([t('1'), t('2')]))).toBe(false);
    expect(hayCategorias(tablero([t('1'), t('2', { categoria: 'tuyas' })]))).toBe(true);
  });

  it('tarjetasCriticas: sin crítica → []; con crítica abierta → esa; una ya hecha no alerta', () => {
    expect(tarjetasCriticas(null)).toEqual([]);
    expect(tarjetasCriticas(tablero([t('1', { criticidad: 'pronto' })]))).toEqual([]);
    const c = t('2', { criticidad: 'critico', verbo: 'Renovarlo' });
    expect(tarjetasCriticas(tablero([t('1'), c]))).toEqual([c]);
    expect(tarjetasCriticas(tablero([], [t('3', { criticidad: 'critico' })]))).toEqual([]);
  });
});

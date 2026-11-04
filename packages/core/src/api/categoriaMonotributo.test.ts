import { describe, expect, it } from 'vitest';

import { CATEGORIAS_MONOTRIBUTO, leerCategoriaMonotributo } from './afip';

describe('categoría de monotributo (SM-N35)', () => {
  it('las categorías son A…K, once', () => {
    expect(CATEGORIAS_MONOTRIBUTO).toHaveLength(11);
    expect(CATEGORIAS_MONOTRIBUTO[0]).toBe('A');
    expect(CATEGORIAS_MONOTRIBUTO[10]).toBe('K');
  });

  it('sólo A…K es válida; todo lo demás es «sin categoría» (null), nunca se inventa una', () => {
    expect(leerCategoriaMonotributo('A')).toBe('A');
    expect(leerCategoriaMonotributo('K')).toBe('K');
    for (const malo of ['', 'a', 'L', 'AA', null, undefined, 3, {}]) expect(leerCategoriaMonotributo(malo)).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';

import { leerPreferenciaTema, PREFERENCIA_DEFAULT, resolverPiel } from './preferenciaTema';

describe('preferenciaTema (BL-X4)', () => {
  it('sistema sigue al esquema del sistema; las explícitas lo ignoran', () => {
    expect(resolverPiel('sistema', true)).toBe('oscuro');
    expect(resolverPiel('sistema', false)).toBe('claro');
    expect(resolverPiel('claro', true)).toBe('claro');
    expect(resolverPiel('oscuro', false)).toBe('oscuro');
  });

  it('lee lo persistido; nocturno (retirada) migra a oscuro; lo desconocido cae al default', () => {
    expect(leerPreferenciaTema('sistema')).toBe('sistema');
    expect(leerPreferenciaTema('oscuro')).toBe('oscuro');
    expect(leerPreferenciaTema('nocturno')).toBe('oscuro');
    expect(leerPreferenciaTema('no-existe')).toBe(PREFERENCIA_DEFAULT);
    expect(leerPreferenciaTema(null)).toBe(PREFERENCIA_DEFAULT);
  });
});

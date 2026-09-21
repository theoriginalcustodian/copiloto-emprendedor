import { describe, expect, it } from 'vitest';

import { TEMAS_AYUDA } from './temasAyuda';

describe('TEMAS_AYUDA (BL-W9)', () => {
  it('son los 5 temas, cada uno con una pregunta en forma de pregunta', () => {
    expect(TEMAS_AYUDA).toHaveLength(5);
    for (const t of TEMAS_AYUDA) {
      expect(t.titulo).not.toBe('');
      expect(t.pregunta).toMatch(/^¿.+\?$/);
    }
  });
});

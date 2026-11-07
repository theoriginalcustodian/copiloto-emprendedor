import { describe, expect, it } from 'vitest';

import { segmentarNegrita } from './negrita';

describe('segmentarNegrita', () => {
  it('parte el texto en tramos y marca los de **negrita**', () => {
    expect(segmentarNegrita('Anoté **$1.234** en Otros')).toEqual([
      { texto: 'Anoté ', negrita: false },
      { texto: '$1.234', negrita: true },
      { texto: ' en Otros', negrita: false },
    ]);
  });

  it('varias negritas y negrita al borde', () => {
    expect(segmentarNegrita('**Hola** y **chau**')).toEqual([
      { texto: 'Hola', negrita: true },
      { texto: ' y ', negrita: false },
      { texto: 'chau', negrita: true },
    ]);
  });

  it('sin marcas devuelve un único tramo, vacío incluido', () => {
    expect(segmentarNegrita('texto plano')).toEqual([{ texto: 'texto plano', negrita: false }]);
    expect(segmentarNegrita('')).toEqual([{ texto: '', negrita: false }]);
  });

  it('un ** sin cerrar o vacío queda LITERAL (no se adivina)', () => {
    expect(segmentarNegrita('esto **no cierra')).toEqual([{ texto: 'esto **no cierra', negrita: false }]);
    expect(segmentarNegrita('a **** b')).toEqual([{ texto: 'a **** b', negrita: false }]);
  });

  it('no cruza saltos de línea', () => {
    expect(segmentarNegrita('**a\nb**')).toEqual([{ texto: '**a\nb**', negrita: false }]);
  });
});

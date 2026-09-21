import { describe, expect, it } from 'vitest';

import { TEXTO_CREDENCIALES_INCORRECTAS, TEXTO_PIE_INGRESAR, TEXTOS_REVEAL } from './textosEntrada';

describe('textosEntrada', () => {
  it('los textos son los del prototipo (fuente única web + mobile)', () => {
    expect(TEXTO_CREDENCIALES_INCORRECTAS).toBe('Ese mail y esa contraseña no coinciden. Probá de nuevo.');
    expect(TEXTO_PIE_INGRESAR).toBe('Tus datos quedan guardados: al volver a entrar está todo como lo dejaste.');
  });

  it('el reveal «volver» sólo cambia las dos puertas del de primera vez', () => {
    expect(TEXTOS_REVEAL.volver).toEqual({ primario: 'Entrar', secundario: 'Entrar con otra cuenta' });
    expect(TEXTOS_REVEAL.primeraVez.primario).not.toBe(TEXTOS_REVEAL.volver.primario);
  });
});

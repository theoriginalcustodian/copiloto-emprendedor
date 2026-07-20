import { describe, expect, it } from 'vitest';

import { nivelDeMuestras } from './nivel';

describe('nivelDeMuestras — la onda muestra lo que el micrófono capta, no una animación', () => {
  it('el silencio da 0 -- si el micrófono no capta nada, la onda no puede fingir que sí', () => {
    expect(nivelDeMuestras(new Float32Array(1024))).toBe(0);
  });

  it('un bloque vacío da 0, NO NaN', () => {
    // Un NaN que llegue a un estilo de React Native rompe el render entero. Y un bloque vacío no es un
    // error: es silencio.
    expect(nivelDeMuestras(new Float32Array(0))).toBe(0);
    expect(Number.isNaN(nivelDeMuestras([]))).toBe(false);
  });

  it('más energía = más nivel, de forma monótona', () => {
    const bajo = nivelDeMuestras(new Float32Array(512).fill(0.02));
    const medio = nivelDeMuestras(new Float32Array(512).fill(0.1));
    const alto = nivelDeMuestras(new Float32Array(512).fill(0.3));

    expect(bajo).toBeLessThan(medio);
    expect(medio).toBeLessThan(alto);
  });

  it('nunca pasa de 1 -- una voz muy fuerte llena la barra, no la desborda', () => {
    // Una altura > 1 haría que la barra se salga de su contenedor.
    expect(nivelDeMuestras(new Float32Array(256).fill(1))).toBe(1);
    expect(nivelDeMuestras(new Float32Array(256).fill(-1))).toBe(1);
  });

  /**
   * 🔴 La razón de usar RMS y no el pico. Un chasquido, un golpe en el escritorio o un clic del mouse
   * son UNA muestra al máximo en un bloque de miles: con detección por pico, la barra saltaría al tope
   * con el ambiente en silencio, y el usuario creería que está grabando una conversación.
   */
  it('un pico aislado NO dispara la barra: se mide la energía del bloque, no su máximo', () => {
    const casiSilencio = new Float32Array(4096);
    casiSilencio[0] = 1; // un solo chasquido al máximo, todo lo demás en silencio

    const nivel = nivelDeMuestras(casiSilencio);

    expect(nivel).toBeGreaterThan(0); // algo capta -- no lo ignora
    expect(nivel).toBeLessThan(0.2); // pero no finge que hay alguien hablando
  });

  it('una señal negativa cuenta igual que su positiva -- lo que importa es la energía, no el signo', () => {
    const positiva = nivelDeMuestras(new Float32Array(256).fill(0.1));
    const negativa = nivelDeMuestras(new Float32Array(256).fill(-0.1));

    expect(negativa).toBeCloseTo(positiva, 10);
  });
});

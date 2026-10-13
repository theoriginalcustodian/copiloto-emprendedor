import { bordeElipticoPath, gradienteCss } from './formasPath';

describe('bordeElipticoPath — border-radius elíptico del prototipo (index.html:1203-1204)', () => {
  it('un radio uniforme del 34% arranca en x=.34 y vuelve ahí con una arco por esquina', () => {
    const d = bordeElipticoPath([0.34, 0.34, 0.34, 0.34], [0.34, 0.34, 0.34, 0.34]);
    expect(d.startsWith('M 0.3400 0 ')).toBe(true);
    expect(d.endsWith('0.3400 0 Z')).toBe(true);
    expect(d.match(/ A /g)).toHaveLength(4);
  });

  it('`super` (58% 42% 47% 53% / 47% 55% 45% 53%): cada esquina usa SU radio horizontal y vertical', () => {
    const d = bordeElipticoPath([0.58, 0.42, 0.47, 0.53], [0.47, 0.55, 0.45, 0.53]);
    // arriba-der: rx .42 / ry .55 → termina en (1, .55)
    expect(d).toContain('A 0.4200 0.5500 0 0 1 1 0.5500');
    // abajo-der: rx .47 / ry .45 → termina en (.53, 1)
    expect(d).toContain('A 0.4700 0.4500 0 0 1 0.5300 1');
    // abajo-izq: rx .53 / ry .53 → termina en (0, .47)
    expect(d).toContain('A 0.5300 0.5300 0 0 1 0 0.4700');
    // arriba-izq: rx .58 / ry .47 → vuelve al punto de partida (.58, 0)
    expect(d.endsWith('A 0.5800 0.4700 0 0 1 0.5800 0 Z')).toBe(true);
  });

  it('el egg y el super NO son la misma forma (control: la asimetría llega al path)', () => {
    const egg = bordeElipticoPath([0.46, 0.54, 0.52, 0.48], [0.53, 0.46, 0.54, 0.47]);
    const sup = bordeElipticoPath([0.58, 0.42, 0.47, 0.53], [0.47, 0.55, 0.45, 0.53]);
    expect(egg).not.toBe(sup);
  });
});

describe('gradienteCss — linear-gradient(<ángulo>) sobre una caja cuadrada', () => {
  it('180° va de arriba a abajo por el centro', () => {
    const g = gradienteCss(180);
    expect(g.x1).toBeCloseTo(0.5);
    expect(g.x2).toBeCloseTo(0.5);
    expect(g.y1).toBeCloseTo(0);
    expect(g.y2).toBeCloseTo(1);
  });

  it('90° va de izquierda a derecha', () => {
    const g = gradienteCss(90);
    expect(g.x1).toBeCloseTo(0);
    expect(g.x2).toBeCloseTo(1);
    expect(g.y1).toBeCloseTo(0.5);
    expect(g.y2).toBeCloseTo(0.5);
  });

  it('160° (squircle): baja y se inclina a la derecha, con extremos fuera de la caja', () => {
    const g = gradienteCss(160);
    expect(g.x2).toBeGreaterThan(g.x1);
    expect(g.y2).toBeGreaterThan(g.y1);
    expect(g.y1).toBeLessThan(0);
    expect(g.y2).toBeGreaterThan(1);
    // Simétrico respecto del centro.
    expect((g.x1 + g.x2) / 2).toBeCloseTo(0.5);
    expect((g.y1 + g.y2) / 2).toBeCloseTo(0.5);
  });
});

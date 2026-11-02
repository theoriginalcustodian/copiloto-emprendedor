/**
 * SM-I3 — los botones del chat. El criterio es el del sistema (`odobi-ui/CLAUDE.md`): un glifo pide 3:1
 * contra su fondo (WCAG 1.4.11). Se mide también el deshabilitado: WCAG lo exime, pero un botón que no se ve
 * no dice que está apagado, parece que no está. El glifo blanco sobre crema daba 1,07:1.
 */
import { SKINS, type NombreSkin } from '../../theme/tokens';
import { tonoBotonEntrada, tonoBotonFoto } from './tonoBotonEntrada';

type Rgba = [number, number, number, number];

function aRgba(color: string): Rgba {
  const m = color.match(/rgba?\(([^)]+)\)/);
  if (m != null) {
    const [r, g, b, a] = m[1].split(',').map((v) => Number(v.trim()));
    return [r, g, b, a ?? 1];
  }
  const h = color.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), 1];
}

function sobre(color: string, base: Rgba): Rgba {
  const [r, g, b, a] = aRgba(color);
  return [r * a + base[0] * (1 - a), g * a + base[1] * (1 - a), b * a + base[2] * (1 - a), 1];
}

function luminancia([r, g, b]: Rgba): number {
  const canal = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
}

function contrasteSobreFondo(piel: NombreSkin, tono: { fondo: string; glifo: string }): number {
  const lienzo = aRgba(SKINS[piel].color.fondo);
  const fondo = sobre(tono.fondo, lienzo);
  const a = luminancia(sobre(tono.glifo, fondo));
  const b = luminancia(fondo);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

describe.each<NombreSkin>(['claro', 'oscuro'])('los botones del chat en %s', (piel) => {
  const tema = SKINS[piel];

  it.each([
    ['enviar y mic en reposo', tonoBotonEntrada(tema, true)],
    ['enviar y mic deshabilitados', tonoBotonEntrada(tema, false)],
    ['foto en reposo', tonoBotonFoto(tema, true)],
    ['foto deshabilitada', tonoBotonFoto(tema, false)],
  ])('%s se leen (≥ 3:1)', (_nombre, tono) => {
    expect(contrasteSobreFondo(piel, tono)).toBeGreaterThanOrEqual(3);
  });

  it('el deshabilitado se distingue del activo', () => {
    const activo = tonoBotonEntrada(tema, true);
    const apagado = tonoBotonEntrada(tema, false);
    expect(apagado.fondo).not.toBe(activo.fondo);
    expect(apagado.glifo).not.toBe(activo.glifo);
    expect(tonoBotonFoto(tema, false).glifo).not.toBe(tonoBotonFoto(tema, true).glifo);
  });
});

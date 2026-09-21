import { describe, expect, it } from 'vitest';

// eslint-disable-next-line import/no-unresolved -- `?raw` es una convención de Vite (ver themesContrast.test.ts)
import fontsCss from './fonts.css?raw';
// eslint-disable-next-line import/no-unresolved -- idem
import fontsWebCss from './fonts-web.css?raw';
// eslint-disable-next-line import/no-unresolved -- idem
import script from '../../../../deploy/copiloto/fetch-fonts.sh?raw';

/**
 * BL-X6 — ningún `@font-face` puede apuntar a un archivo que nadie produce.
 *
 * Los .woff2 no están en el árbol: los genera `deploy/copiloto/fetch-fonts.sh` en el build. Un `src`
 * cuyo nombre el script no produce era el bug (Neue Einstellung: el .otf ya no existe y el script
 * fallaba). El test resuelve CADA `src` y exige que el script lo nombre; y que las familias retiradas
 * (licencia impaga / sin token) no vuelvan por ningún CSS de la app.
 */
const CSS = [fontsCss, fontsWebCss];

const srcsDe = (css: string): string[] =>
  [...css.matchAll(/@font-face\s*\{[^}]*?url\(['"]?\.\/fonts\/([^'")]+)['"]?\)/g)].map((m) => m[1]);

describe('BL-X6 · fuentes', () => {
  const declarados = CSS.flatMap(srcsDe);

  it('la app declara sus caras (Plus Jakarta Sans + Inter)', () => {
    expect(declarados.sort()).toEqual([
      'Inter-Medium.woff2',
      'Inter-Regular.woff2',
      'Inter-Semibold.woff2',
      'PlusJakartaSans-Bold.woff2',
    ]);
  });

  it.each(declarados)('el src %s lo produce fetch-fonts.sh', (archivo) => {
    expect(script).toContain(archivo);
  });

  it('ninguna familia retirada vuelve a los CSS ni al script', () => {
    for (const texto of [...CSS, script]) {
      expect(texto).not.toMatch(/font-family:\s*['"](NeueEinstellung|Clash Display|General Sans)/);
      expect(texto).not.toMatch(/\.otf['"\s]/);
    }
  });

  it('los tokens nombran Plus Jakarta Sans (display) e Inter (cuerpo)', () => {
    const css = fontsCss;
    expect(css).toMatch(/--font-display:\s*'Plus Jakarta Sans'/);
    expect(css).toMatch(/--font-body:\s*'Inter'/);
  });
});

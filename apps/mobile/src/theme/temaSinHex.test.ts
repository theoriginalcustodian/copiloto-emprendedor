import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// Jest (jest-expo) — `describe`/`it`/`expect` son globales, no se importan de `vitest`.

/**
 * Los colores salen SIEMPRE de los tokens. Un `#00C896` suelto en un componente rompe los 5 skins
 * en silencio: se ve bien en el tema por defecto y mal en los otros cuatro. Este test lo impide.
 *
 * Archivos autorizados a tener hex (los ÚNICOS): `tokens.ts` (colores de los 5 temas),
 * `glass/iconPalette.ts` (las 8 paletas de los iconos glass) y `glass/ondaPalette.ts` (el degradé de
 * la onda de audio). Los dos últimos comparten el MISMO criterio, y es lo que los separa de un color
 * hardcodeado: son colores **INTRÍNSECOS del diseño**, no del tema — un icono de "carpeta" es
 * magenta→naranja en los 5 skins, y la galería de ondas declara explícitamente *«cada onda trae su
 * propia paleta fija — sin skins»*. Los tres son SÓLO-DATOS-DE-COLOR, sin lógica; quien los consume
 * (`GlassIcon.tsx`, `icons.ts`, `Onda.tsx`) queda cero-hex.
 *
 * 🔴 Esta lista se extiende con argumento, nunca para destrabar un archivo. El criterio de admisión
 * es doble y hay que cumplir los dos: (a) el color es del DISEÑO del elemento y no puede cambiar con
 * el skin, y (b) el archivo es datos puros. Un componente con lógica NO entra acá: mueve sus colores
 * a un archivo de datos.
 */
const ARCHIVOS_DE_COLOR = [
  join('theme', 'tokens.ts'),
  join('theme', 'glass', 'iconPalette.ts'),
  join('theme', 'glass', 'ondaPalette.ts'),
];
/**
 * `.test.ts` / `.test.tsx` (runner nativo) y `.test.web.ts` (runner web, proyecto Jest "web") son las
 * DOS convenciones de test del repo. Reconocer sólo la primera hacía que un test web contara como
 * código fuente de producción -- y su docstring, como si fuera un componente.
 */
const ES_TEST = /\.test\.(web\.)?tsx?$/;

function archivosFuente(dir: string, acc: string[] = []): string[] {
  for (const entrada of readdirSync(dir)) {
    const p = join(dir, entrada);
    if (statSync(p).isDirectory()) archivosFuente(p, acc);
    else if (/\.tsx?$/.test(p) && !ES_TEST.test(p)) acc.push(p);
  }
  return acc;
}

/**
 * Un color hardcodeado en React Native es SIEMPRE un literal de string completo (`backgroundColor:
 * '#00C896'`) -- no existe otra forma de escribirlo que el runtime acepte. Atar el patrón a eso es lo
 * que separa un color de un `#` cualquiera seguido de dígitos hexadecimales.
 *
 * 🔴 El regex anterior (`/#[0-9a-fA-F]{3,8}\b/`, sin exigir las comillas) daba FALSO POSITIVO con un
 * número de issue citado en un comentario (`jsdom/jsdom` seguido de almohadilla y 722; también con un
 * issue de 4 dígitos). Un guard que grita en falso se aprende a ignorar, y ese es el modo en que un
 * guard muere: no lo borra nadie, simplemente deja de creerse. La alternativa que se descartó
 * -- "citen los issues sin almohadilla" -- es un workaround que cada autor futuro tiene que recordar,
 * y por lo tanto no es una solución.
 */
const COLOR_HEX_LITERAL = /(['"`])#[0-9a-fA-F]{3,8}\1/;

describe('cero-hex fuera de los tokens', () => {
  it('ningún componente tiene un color hardcodeado', () => {
    // 🟡 MEDIUM-1: escanear SÓLO `src/` deja afuera las pantallas de ruta de Expo Router en
    // `apps/mobile/app/` (`login.tsx` -- la primera pantalla que ve un emprendedor -- y
    // `(tabs)/_layout.tsx`, que pinta los colores de la barra de tabs, entre otras). El guard
    // tiene que cubrir las DOS raíces de código de la app, no sólo `src/`.
    const raizApp = join(__dirname, '..', '..');
    const raices = [join(raizApp, 'src'), join(raizApp, 'app')];
    const culpables = raices
      .flatMap((raiz) => archivosFuente(raiz))
      .filter((p) => !ARCHIVOS_DE_COLOR.some((permitido) => p.endsWith(permitido)))
      .filter((p) => COLOR_HEX_LITERAL.test(readFileSync(p, 'utf8')));

    expect(culpables).toEqual([]);
  });

  /**
   * Control: sin esto, el test de arriba pasaría igual si `COLOR_HEX_LITERAL` estuviera roto y no
   * matcheara NADA -- una lista vacía de culpables es exactamente lo que devuelve un guard muerto.
   */
  it('el patrón sigue cazando un color de verdad, y ya no confunde un número de issue con uno', () => {
    expect(COLOR_HEX_LITERAL.test("backgroundColor: '#00C896',")).toBe(true);
    expect(COLOR_HEX_LITERAL.test('color: "#fff"')).toBe(true);
    expect(COLOR_HEX_LITERAL.test('borde: `#1a1a1a`')).toBe(true);
    expect(COLOR_HEX_LITERAL.test('// ver el issue jsdom/jsdom#722 para el detalle')).toBe(false);
    expect(COLOR_HEX_LITERAL.test('// software-mansion/react-native-audio-api#1133')).toBe(false);
  });
});

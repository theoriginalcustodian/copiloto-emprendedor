import { describe, expect, it } from 'vitest';

// eslint-disable-next-line import/no-unresolved -- `?raw` es una convención de Vite (import de
// texto crudo), no un módulo real; no hay @types/node en el proyecto así que evitamos fs/path
// (mismo patrón que los tests `*NoHexLiterals.test.ts` del repo).
import themesCss from './themes.css?raw';

/**
 * Gate WCAG AA de contraste (>= 4.5:1) para los tokens de texto de los 4 temas — bloquea para
 * siempre la regresión medida en vivo el 2026-07-04 (daylight `--mono/--label/--concept/--chip-fg`
 * y refined `--mono/--label` por debajo de AA).
 *
 * Superficie de referencia por token: la mayoría de los tokens de texto (`--text`, `--heading`,
 * `--mono`, `--label`, `--concept`, `--status-fg`) se pintan directamente sobre `--bg` (no tienen
 * un contenedor propio — confirmado por grep en `primitives.css`/`*.css`), así que se miden
 * contra `--bg`. Pero `--chip-fg`, `--user-fg` y `--bubble-fg` SÍ tienen su propio token de fondo
 * (`--chip-bg`, `--user-bg`, `--bubble-bg` — ver `primitives.css` líneas 130-208, `chat.css`) y
 * casi nunca son iguales a `--bg` (son gradientes/acentos con tinte propio, a propósito, para
 * distinguirse de la página). Medirlos contra `--bg` es un falso positivo/negativo real, no solo
 * un tecnicismo: se verificó en vivo que `daylight --user-fg` (#fff) da 1.23:1 contra `--bg`
 * (falla) pero 5.22:1 contra su `--user-bg` real (pasa) — y a la inversa, `daylight --chip-fg` da
 * 4.1:1 contra `--bg` (aprueba el piso ingenuo) pero solo 3.78:1 contra su `--chip-bg` real
 * (sigue fallando ahí). Por eso este test resuelve la superficie REAL de cada token antes de
 * medir, en vez de asumir `--bg` para todos.
 *
 * Resolución de superficie (`resolveSurface`): si el fondo es hex sólido se usa tal cual; si es
 * `transparent`/`none` se usa `--bg` (deja ver la página); si es gradiente/`rgba(...)` se extraen
 * los stops de color, cada uno se alpha-compone sobre `--bg`, y se promedian en espacio sRGB —
 * una aproximación razonable para un gate (no fotométricamente exacta en degradés de ángulo, pero
 * exacta para sólidos/transparent/rgba plano, que son los casos reales de este archivo).
 *
 * Fórmula WCAG 2.x: luminancia relativa con linealización sRGB, contraste = (L1+0.05)/(L2+0.05)
 * con L1 el más claro.
 */

const SOLID_HEX_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const COLOR_STOP_RE = /(#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\))/g;
const RGBA_FN_RE = /rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)/;

const TEXT_TOKENS = [
  '--text',
  '--heading',
  '--mono',
  '--label',
  '--concept',
  '--status-fg',
  '--chip-fg',
  '--user-fg',
  '--bubble-fg',
  // Sumados por CONS8 (2026-08-07): los usa la consola de operador y NINGUNO estaba cubierto.
  // Al agregarlos, `--danger-fg` del tema claro apareció en 4.00:1 contra `--card-bg` — por debajo
  // de AA, en el texto que el DoD de CONS7a exige que el operador pueda leer. Se corrigió el token
  // (`#c7455a` → `#b03549`, mismo tono H=350.3 y misma saturación, sólo menos luminosidad).
  // El fix tocó DOS definiciones, no una: `:root` y `:root[data-theme='claro']` tenían el mismo
  // valor, y arreglar sólo la segunda dejaba el default —lo que se ve antes de elegir tema— bajo AA
  // sin dar síntoma (`memoria/un-token-con-dos-definiciones-y-la-equivocada-no-da-sintoma`).
  '--danger-fg',
  '--input-fg',
] as const;

/** Token de fondo dedicado de cada fg (confirmado por grep de uso real en los componentes). */
const OWN_BG_TOKEN: Partial<Record<(typeof TEXT_TOKENS)[number], string>> = {
  '--chip-fg': '--chip-bg',
  '--user-fg': '--user-bg',
  '--bubble-fg': '--bubble-bg',
  // Un campo de formulario tiene su propio fondo, siempre. Medir `--input-fg` contra `--bg` daría
  // un número que ningún píxel de la pantalla tiene.
  '--input-fg': '--input-bg',
  // `--danger-fg` NO tiene fondo propio: se pinta sobre lo que haya debajo, y aparece tanto suelto
  // como dentro de una card. Queda con el default (`--bg`), pero eso NO es "la superficie más
  // exigente": cuál de las dos exige más depende del tema, porque `--card-bg` es más claro que
  // `--bg` en los tres y el texto es oscuro en claro y claro en oscuro/nocturno. Medido:
  //     claro     bg 4.90  ·  card 5.14   → el fondo exige más
  //     oscuro    bg 8.23  ·  card 7.79   → la card exige más
  //     nocturno  bg 9.20  ·  card 8.75   → la card exige más
  // Con el valor corregido las seis combinaciones pasan AA, así que medir contra `--bg` alcanza
  // acá. Si alguna vez el margen se achica, este comentario dice dónde mirar: la card, no el fondo.
};

type Rgb = { r: number; g: number; b: number };

function hexToRgb(hex: string): Rgb {
  let h = hex.replace('#', '');
  if (h.length === 3) {
    h = h
      .split('')
      .map((c) => c + c)
      .join('');
  }
  const num = parseInt(h, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

function rgbToHex({ r, g, b }: Rgb): string {
  return (
    '#' +
    [r, g, b]
      .map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0'))
      .join('')
  );
}

function channelLuminance(c: number): number {
  const cs = c / 255;
  return cs <= 0.03928 ? cs / 12.92 : Math.pow((cs + 0.055) / 1.055, 2.4);
}

function relativeLuminance({ r, g, b }: Rgb): number {
  return 0.2126 * channelLuminance(r) + 0.7152 * channelLuminance(g) + 0.0722 * channelLuminance(b);
}

/** Ratio de contraste WCAG entre dos colores hex (orden no importa). */
function contrastRatio(hexA: string, hexB: string): number {
  const lA = relativeLuminance(hexToRgb(hexA));
  const lB = relativeLuminance(hexToRgb(hexB));
  const lighter = Math.max(lA, lB);
  const darker = Math.min(lA, lB);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Parsea un stop de color (`#hex` u `rgba(...)`) a `{ rgb, alpha }`; null si no reconocido. */
function parseColorStop(token: string): { rgb: Rgb; alpha: number } | null {
  const t = token.trim();
  if (SOLID_HEX_RE.test(t)) return { rgb: hexToRgb(t), alpha: 1 };
  const m = t.match(RGBA_FN_RE);
  if (m) {
    return {
      rgb: { r: Number(m[1]), g: Number(m[2]), b: Number(m[3]) },
      alpha: m[4] !== undefined ? Number(m[4]) : 1,
    };
  }
  return null;
}

/** Alpha-composita `rgb` (con `alpha`) sobre `bg` (Porter-Duff "over", en espacio sRGB 0-255). */
function compositeOver(rgb: Rgb, alpha: number, bg: Rgb): Rgb {
  return {
    r: rgb.r * alpha + bg.r * (1 - alpha),
    g: rgb.g * alpha + bg.g * (1 - alpha),
    b: rgb.b * alpha + bg.b * (1 - alpha),
  };
}

/**
 * Resuelve la superficie de color efectiva de un valor de fondo CSS (hex sólido / transparent /
 * gradiente / rgba) sobre la página `pageBgHex`. Ver doc del archivo para la justificación.
 */
function resolveSurface(bgValue: string | undefined, pageBgHex: string): string {
  if (bgValue === undefined) return pageBgHex;
  const v = bgValue.trim();
  if (v === 'transparent' || v === 'none') return pageBgHex;
  if (SOLID_HEX_RE.test(v)) return v;

  const pageBgRgb = hexToRgb(pageBgHex);
  const stops = v.match(COLOR_STOP_RE) ?? [];
  const composited: Rgb[] = [];
  for (const stop of stops) {
    const parsed = parseColorStop(stop);
    if (parsed) composited.push(compositeOver(parsed.rgb, parsed.alpha, pageBgRgb));
  }
  if (composited.length === 0) return pageBgHex;

  const avg = composited.reduce(
    (acc, c) => ({
      r: acc.r + c.r / composited.length,
      g: acc.g + c.g / composited.length,
      b: acc.b + c.b / composited.length,
    }),
    { r: 0, g: 0, b: 0 },
  );
  return rgbToHex(avg);
}

/** Extrae `--token: valor;` de un bloque CSS (contenido entre `{` y `}`, ya recortado). */
function parseDeclarations(blockBody: string): Record<string, string> {
  const decls: Record<string, string> = {};
  const re = /(--[a-z0-9-]+)\s*:\s*([^;]+);/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(blockBody))) {
    decls[m[1]] = m[2].trim();
  }
  return decls;
}

/** Extrae el cuerpo `{ ... }` de un selector exacto (sin llaves anidadas en este archivo). */
function extractBlock(css: string, selectorRe: RegExp): string {
  const match = css.match(selectorRe);
  if (!match) {
    throw new Error(`No se encontró el bloque para ${selectorRe} en themes.css`);
  }
  return match[1];
}

// Las 3 pieles ODOBI + el fallback `:root` sin `data-theme` (documentado como default `claro`
// antes de que ThemeProvider monte — ver comentario en themes.css). Se valida también por
// separado para que un drift entre el fallback y el tema `claro` real no pase inadvertido.
const THEME_BLOCKS: Record<string, RegExp> = {
  'root-default (fallback claro)': /:root\s*\{([^}]*)\}/,
  claro: /:root\[data-theme=['"]claro['"]\]\s*\{([^}]*)\}/,
  oscuro: /:root\[data-theme=['"]oscuro['"]\]\s*\{([^}]*)\}/,
  nocturno: /:root\[data-theme=['"]nocturno['"]\]\s*\{([^}]*)\}/,
};

describe('temas — contraste WCAG AA (>=4.5:1) de tokens de texto sobre su superficie real', () => {
  for (const [themeName, selectorRe] of Object.entries(THEME_BLOCKS)) {
    const blockBody = extractBlock(themesCss, selectorRe);
    const vars = parseDeclarations(blockBody);
    const pageBg = vars['--bg'];

    it(`${themeName}: --bg es un hex sólido (precondición del gate)`, () => {
      expect(pageBg, `--bg del tema ${themeName} no es hex sólido: ${pageBg}`).toMatch(SOLID_HEX_RE);
    });

    for (const token of TEXT_TOKENS) {
      const value = vars[token];
      const ownBgToken = OWN_BG_TOKEN[token];
      const surfaceLabel = ownBgToken ?? '--bg';

      it(`${themeName}: ${token} sobre ${surfaceLabel} >= 4.5:1 (o se saltea si no es hex sólido)`, () => {
        if (value === undefined || !SOLID_HEX_RE.test(value)) {
          // El propio token de texto no es hex sólido (gradiente/rgba) — no aplica el gate.
          return;
        }
        const surface = ownBgToken ? resolveSurface(vars[ownBgToken], pageBg) : pageBg;
        const ratio = contrastRatio(value, surface);
        expect(
          ratio,
          `${themeName} ${token}=${value} sobre ${surfaceLabel}(≈${surface}) → contraste ${ratio.toFixed(2)}:1 (< 4.5 AA)`,
        ).toBeGreaterThanOrEqual(4.5);
      });
    }
  }
});

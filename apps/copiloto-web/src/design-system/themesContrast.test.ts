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
  // Sumados por FE1 (contrato Tarea 2, 2026-09-07): rebrand de acento a #DE7250/#B04A2E. Ambos
  // pasan a ser theme-dependent (antes un solo valor invariante en las 3 pieles) — el gate
  // confirma que las 3 pieles + el fallback `:root` quedan sobre AA con el par nuevo, no sólo la
  // piel que se miró a ojo. Los dos limpian 4.5:1 con margen (≥4.59 en las 6 combinaciones), así
  // que entran al gate estricto sin excepción — a diferencia de `--core` (ver nota más abajo).
  '--avatar-fg',
  '--amount-sign',
  // Sumados por FE1 (Tarea 3, "bloque" de cifra, 2026-09-07). Decisión de planificación resuelta
  // el mismo día: el rol es "máximo contraste contra el lienzo", no "negro" — la polaridad se
  // invierte en oscuro/nocturno (bloque CREMA con texto oscuro, no al revés). Las 4 combinaciones
  // (3 pieles + root-default) tienen valor de diseño real (hex sólido), así que las 4 entran al
  // gate estricto sin excepción.
  '--bloque-cifra-fg',
  '--bloque-cifra-fg-secondary',
  // Sumados por FE2 (contrato "shell/auth", 2026-09-07): `--btn-fg`/`--send-fg` (`#FBF3E2`, texto
  // sobre el fill del composer) usan `--btn-bg`/`--send-bg` como fondo — que el rebrand de acento
  // cambió a `#B04A2E` sólido (antes degradé del acento viejo) sin que ninguna de las dos puntas
  // del par quedara en este gate. Es la misma clase de hueco que backend encontró hoy en mobile
  // (`--accent`/`ACCENT_ON`): un color perfectamente tokenizado puede volverse ilegible sin que
  // ningún test lo note, porque nada mide el par real. Medido antes de agregarlo, no asumido:
  // `#FBF3E2` sobre `#B04A2E` da 4,92:1 en las 4 combinaciones (invariante entre pieles, coincide
  // con el comentario de `themes.css` junto a `--btn-bg`) — pasa hoy, y de acá en más una
  // regresión la caza este gate en vez de quedar invisible.
  '--btn-fg',
  '--send-fg',
  // Sumados por FE2 (contrato "tokens semánticos", 2026-09-08): estos 4 quedaron fuera de
  // TEXT_TOKENS porque la lista era manual — nadie los agregó cuando se crearon, y el gate pasó
  // callado. Se detectó al invertir el gate a auto-derivado desde `themes.css` (ver
  // `findUnmappedFgTokens` más abajo): son `--*-fg` declarados que la lista manual no cubría.
  // Medidos con el mismo arnés WCAG antes de agregarlos (no asumidos): `--amount-fg`/`--name-fg`
  // (11.5-15.9:1 contra `--bg`) y `--cancel-fg` (4.7-5.7:1) pasan AA holgado en las 4 combinaciones.
  // `--badge-fg` daba 1.98-2.06:1 en claro (bajo incluso el piso no-textual 3:1) — corregido acá
  // (ver comentario junto a su valor en `themes.css`, mismo H/S, sólo menos L).
  // `--danger-btn-fg` y `--ok-fg` (4.00:1 y 3.77-3.95:1 en claro/root-default) NO se agregan acá:
  // son deuda real, pero corregirlos es una decisión de diseño (qué tono, no sólo "más oscuro") que
  // este contrato no autoriza — quedan en `EXEMPT_FG_TOKENS` con motivo y las cifras, escaladas a
  // planificación en vez de asumidas o escondidas.
  '--amount-fg',
  '--name-fg',
  '--cancel-fg',
  '--badge-fg',
] as const;

/**
 * `--core` (acento como trazo de ícono / texto chico) queda A PROPÓSITO fuera de `TEXT_TOKENS`: no
 * es un token de texto puro, es dual — la mayoría de sus consumidores son gráficos decorativos
 * (trazo SVG 1.7px, outline, tinte `color-mix`, umbral WCAG 1.4.11 no-texto ≥3:1). Consumidores de
 * TEXTO real medidos (`.midia-screen__calendario-hora`, 13px/600, y 5 más en `ajustes.css` —
 * `.como-hablarle-bloque__rotulo`, `.catalogo-seccion__fila-alternar`,
 * `.afip-setup-cuit-fijo__cambiar`, `.afip-setup-ambiente-chip__estado/__accion`, hallazgo de FE2
 * 2026-09-07 con arnés real, dos de ellos sobre `color-mix` y no `--bg` plano): los 6 dan
 * EXACTAMENTE el mismo número (el tinte no mueve la aguja) — 4.38:1 en `claro`, 5.63:1 `oscuro`,
 * 6.30:1 `nocturno`. `claro` queda por debajo del 4.5:1 estricto de este gate, deuda heredada y
 * documentada en `themes.css` (cabecera del archivo): el valor viejo daba 4.04:1, así que no es una
 * regresión, y no hay un tercer valor de acento disponible sin violar "nunca 3 terracotas convivas"
 * (`Prototipo frontend/odobi-ui/audit/ANALISIS-PROTOTIPO-DAVID.md` §4.1). Meterlo en este gate
 * rompería CI por un token que en la mayoría de sus usos no es texto — se documenta la exclusión en
 * vez de forzarlo.
 */

/** Token de fondo dedicado de cada fg (confirmado por grep de uso real en los componentes). */
const OWN_BG_TOKEN: Partial<Record<(typeof TEXT_TOKENS)[number], string>> = {
  '--chip-fg': '--chip-bg',
  '--user-fg': '--user-bg',
  '--bubble-fg': '--bubble-bg',
  // Un campo de formulario tiene su propio fondo, siempre. Medir `--input-fg` contra `--bg` daría
  // un número que ningún píxel de la pantalla tiene.
  '--input-fg': '--input-bg',
  // `--avatar-fg` (texto/ícono 24px/600 dentro del círculo de avatar) y `--amount-sign` (texto
  // 20px/400 en `hitl-card`, `Surface variant="card"` -> `--card-bg`) tienen fondo propio, igual
  // que `--input-fg` arriba — medirlos contra `--bg` sería el mismo falso positivo/negativo que
  // ya documentó este archivo para `--chip-fg`/`--user-fg`.
  '--avatar-fg': '--avatar-bg',
  '--amount-sign': '--card-bg',
  '--bloque-cifra-fg': '--bloque-cifra-bg',
  '--bloque-cifra-fg-secondary': '--bloque-cifra-bg',
  // `--btn-fg`/`--send-fg` son el texto/ícono del composer, siempre sobre el fill sólido de
  // `--btn-bg`/`--send-bg` (nunca sobre `--bg` — mismo motivo que `--input-fg` arriba).
  '--btn-fg': '--btn-bg',
  '--send-fg': '--send-bg',
  // `--danger-fg` NO tiene fondo propio: se pinta sobre lo que haya debajo, y aparece tanto suelto
  // como dentro de una card. Queda con el default (`--bg`), pero eso NO es "la superficie más
  // exigente": cuál de las dos exige más depende del tema, porque `--card-bg` es más claro que
  // `--bg` en los tres y el texto es oscuro en claro y claro en oscuro/nocturno. Medido:
  //     claro     bg 4.90  ·  card 5.14   → el fondo exige más
  //     oscuro    bg 8.23  ·  card 7.79   → la card exige más
  //     nocturno  bg 9.20  ·  card 8.75   → la card exige más
  // Con el valor corregido las seis combinaciones pasan AA, así que medir contra `--bg` alcanza
  // acá. Si alguna vez el margen se achica, este comentario dice dónde mirar: la card, no el fondo.
  // `--amount-fg`/`--name-fg` no tienen fondo propio (se pintan directo en `chat.css`, sin
  // contenedor dedicado) — quedan con el default `--bg`, igual que `--danger-fg`.
  // `--cancel-fg`: su fondo real (`--cancel-bg`) es `transparent` — `resolveSurface` lo resuelve a
  // `--bg` de todos modos, pero se mapea explícito para que quede documentado cuál es la superficie
  // real, no un default asumido.
  '--cancel-fg': '--cancel-bg',
  // `--badge-fg` SÍ tiene fondo propio (`--badge-bg`, rgba con tinte) — `resolveSurface` lo
  // alpha-composita sobre `--bg` antes de medir (mismo mecanismo ya usado para `--chip-bg` etc.).
  '--badge-fg': '--badge-bg',
};

/**
 * Todo custom property `--*-fg` declarado en `:root` que NO esté en `TEXT_TOKENS` y tampoco en
 * `EXEMPT_FG_TOKENS` (con motivo escrito) es un hueco: un token nuevo que nadie sumó al gate.
 * Antes (lista manual) ese hueco pasaba callado — así fue como `--badge-fg` y otros 5 quedaron sin
 * cubrir hasta que alguien los buscó a mano. Pedido de planificación (2026-09-08): invertir la
 * relación, que el CI rompa por default y el que agrega un token nuevo tenga que declarar
 * explícitamente por qué queda afuera, no que el gate calle por omisión.
 */
const EXEMPT_FG_TOKENS: Record<string, string> = {
  // Dual-role (icono/trazo decorativo, no texto puro) — ver comentario extenso arriba de
  // `OWN_BG_TOKEN`. Documentado con deuda conocida en claro (4.38:1), no una regresión nueva.
  '--core': 'dual-role decorativo/texto — ver comentario junto a OWN_BG_TOKEN; no termina en -fg así que ni siquiera aplica el auto-derive, queda listado acá por completitud.',
  // Deuda real medida por FE2 (2026-09-08), NO corregida: `--danger-btn-fg`=#F5EBD5 sobre su
  // `--danger-btn-bg` real (#c7455a) da 4.00:1 en claro/root-default (8.36:1 en oscuro/nocturno,
  // sin problema ahí). Pasa el piso 3:1 no-textual pero no el 4.5:1 AA de texto. Corregirlo cambia
  // un tono, no sólo su luminosidad recuperando contraste (a diferencia de `--badge-fg`, que sí se
  // corrigió en este mismo cambio) — el contrato de tokens semánticos no autoriza esa decisión de
  // diseño. Escalado a planificación con esta cifra vía buzón el 2026-09-08; sale de acá el día que
  // se resuelva (con el fix, no con más exención).
  '--danger-btn-fg': 'AA-debt claro/root-default 4.00:1 (piso 3:1 OK) — escalado a planificación 2026-09-08, requiere decisión de diseño, no lo corrige este contrato.',
  // Deuda real medida por FE2 (2026-09-08), NO corregida: `--ok-fg`=#3C8069 da 3.77:1 contra `--bg`
  // / 3.95:1 contra `--card-bg` en claro/root-default (10.3-12.2:1 en oscuro/nocturno). Se usa en
  // texto real de 13px (`ingresos`, `chat`), así que el piso 3:1 no alcanza — es AA-debt genuino,
  // no un caso límite ignorable. Mismo motivo que `--danger-btn-fg`: la corrección es una decisión
  // de color, no una recuperación mecánica de contraste. Escalado a planificación 2026-09-08.
  '--ok-fg': 'AA-debt claro/root-default 3.77-3.95:1 (piso 3:1 OK, usado en texto real 13px) — escalado a planificación 2026-09-08, requiere decisión de diseño, no lo corrige este contrato.',
};

/** Todo custom property `--algo-fg` declarado en un bloque de vars ya parseado. */
function fgTokensIn(vars: Record<string, string>): string[] {
  return Object.keys(vars).filter((k) => k.endsWith('-fg'));
}

/** Tokens `-fg` declarados que no están cubiertos por el gate ni exentos con motivo. */
function findUnmappedFgTokens(
  vars: Record<string, string>,
  known: readonly string[],
  exempt: Record<string, string>,
): string[] {
  return fgTokensIn(vars).filter((t) => !known.includes(t) && !(t in exempt));
}

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

    it(`${themeName}: todo token --*-fg declarado está en TEXT_TOKENS o EXEMPT_FG_TOKENS`, () => {
      const unmapped = findUnmappedFgTokens(vars, TEXT_TOKENS, EXEMPT_FG_TOKENS);
      expect(
        unmapped,
        `${themeName}: ${unmapped.join(', ')} se declaran en themes.css pero no están en TEXT_TOKENS ` +
          `ni en EXEMPT_FG_TOKENS — sumalos a uno de los dos (con motivo si van exentos).`,
      ).toEqual([]);
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

/**
 * Gate "bloque-vs-lienzo" (DoD de la decisión de planificación sobre el "bloque" de cifra,
 * 2026-09-07): el test de arriba mide TEXTO sobre su fondo propio, pero no mide si el fondo del
 * bloque en sí (`--bloque-cifra-bg`) se distingue del canvas de la página (`--bg`) — que es
 * exactamente el problema real que se escaló (`#1A1512` de claro da 14,59:1 contra su canvas pero
 * ~1:1 en oscuro/nocturno, invisible). Umbral 3:1 (WCAG 1.4.11, contraste no-textual de un
 * componente gráfico) — el piso de "se distingue de lo que tiene alrededor", no el 4.5:1 de texto.
 * Los valores reales (14,59 / 16,12 / 18,04:1) están muy por encima; el gate existe para cazar una
 * regresión que los baje, no para certificar el número exacto de hoy.
 */
describe('temas — el "bloque" de cifra se distingue del lienzo (>=3:1, WCAG 1.4.11)', () => {
  for (const [themeName, selectorRe] of Object.entries(THEME_BLOCKS)) {
    const blockBody = extractBlock(themesCss, selectorRe);
    const vars = parseDeclarations(blockBody);
    const pageBg = vars['--bg'];
    const bloqueBg = vars['--bloque-cifra-bg'];

    it(`${themeName}: --bloque-cifra-bg sobre --bg >= 3:1`, () => {
      expect(bloqueBg, `--bloque-cifra-bg del tema ${themeName} no es hex sólido: ${bloqueBg}`).toMatch(
        SOLID_HEX_RE,
      );
      const ratio = contrastRatio(bloqueBg, pageBg);
      expect(
        ratio,
        `${themeName}: bloque ${bloqueBg} sobre canvas ${pageBg} → ${ratio.toFixed(2)}:1 (< 3:1, se funde con el lienzo)`,
      ).toBeGreaterThanOrEqual(3);
    });
  }
});

/**
 * Control negativo del gate "invertido" de arriba (`findUnmappedFgTokens`): demuestra que la
 * detección efectivamente rompe cuando aparece un token `-fg` nuevo sin mapear, en vez de asumirlo
 * por la ausencia de fallas en el gate real de `themes.css` (que podría estar verde porque el
 * detector es un no-op). Datos sintéticos, no toca el CSS real.
 */
describe('control negativo — findUnmappedFgTokens realmente detecta un token nuevo sin mapear', () => {
  it('un --*-fg fuera de TEXT_TOKENS y EXEMPT_FG_TOKENS aparece como no mapeado', () => {
    const vars = { '--text': '#000000', '--rogue-fg': '#ff00ff' };
    const unmapped = findUnmappedFgTokens(vars, TEXT_TOKENS, EXEMPT_FG_TOKENS);
    expect(unmapped).toEqual(['--rogue-fg']);
  });

  it('un --*-fg exento con motivo escrito no aparece como no mapeado', () => {
    const vars = { '--text': '#000000', '--legacy-fg': '#ff00ff' };
    const exempt = { '--legacy-fg': 'motivo de prueba' };
    const unmapped = findUnmappedFgTokens(vars, TEXT_TOKENS, exempt);
    expect(unmapped).toEqual([]);
  });

  it('los tokens declarados en TEXT_TOKENS no aparecen como no mapeados', () => {
    const vars = Object.fromEntries(TEXT_TOKENS.filter((t) => t.endsWith('-fg')).map((t) => [t, '#000000']));
    const unmapped = findUnmappedFgTokens(vars, TEXT_TOKENS, EXEMPT_FG_TOKENS);
    expect(unmapped).toEqual([]);
  });
});

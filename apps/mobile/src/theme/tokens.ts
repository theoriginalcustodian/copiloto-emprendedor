/**
 * Los tokens del tema. **La única fuente de color de la app.** Ver el test `temaSinHex`.
 *
 * Los 5 temas (`cian` default, `violeta`, `ambar`, `medicalWhite`, `black`) son el rediseño Z-Depth de
 * DocuMed (panel de vidrio deslizable, ver `docs/Implementacion_Desarrollo/
 * 2026-07-18_PLAN_rediseno-ui-panel-glass.md`), heredado 1:1 vía el port — mapeo directo de las
 * variables `--dm-*` del diseño. En DocuMed reemplazaron una paleta anterior (`documed|aurora|daylight|
 * refined|ai`, ya descartada allá); el copiloto no tuvo esa paleta previa, nace directo con estos 5.
 *
 * Cada tema define una paleta CRUDA (`PALETAS`, abajo) con los valores tal cual del diseño — 4 son
 * oscuros y comparten una base de vidrio (`BASE_OSCURO`: `s1/s2/bd/hi/pill/chip`), `medicalWhite` y
 * `black` la overridean porque su vidrio es distinto (claro y monocromo respectivamente).
 * `construirTokens` deriva de ahí las DOS superficies que consume el resto de la app:
 *
 * - `color.*` — el shape YA existente (no cambia para no romper los ~20 componentes que lo consumen
 *   por `useTema()`). Derivación, misma técnica que la versión anterior de este archivo:
 *   - `fondo` ← `fondoBase` (directo) · `texto` ← `tx` (directo) · `textoTenue` ← `dim` (directo)
 *   - `acento` ← `accent` (directo) · `acentoTexto` ← `on` (directo)
 *   - `superficie`/`superficieAlta` ← elevation-overlay de Material: blend de `fondoBase` hacia `tx`
 *     al 6% / 12% (`mezclarHex`). No hay superficie plana en un diseño de vidrio; esto usa los DOS
 *     colores que el tema ya eligió, no un tercero inventado.
 *   - `borde` ← el `bd` (rgba del vidrio) aplanado (alpha-composite) sobre `fondoBase` a un sólido —
 *     `Tokens.color` no tiene canal alpha.
 *   - `peligro`/`exito` — semánticos comunes a los 4 temas oscuros (heredados del skin `cian`);
 *     `medicalWhite` usa el par legible-sobre-claro (mismo criterio: es el único tema claro).
 * - `glass` — NUEVO sub-objeto para el vidrio del rediseño: mapeo 1:1 de `--dm-*`
 *   (`tint, tint2, bd, hi, s1, s2, chip, pill, glow, accent2, on, blur, esLight`).
 */
/** Una zona de luz radial del fondo (mapeo de un `radial-gradient` de `--dm-phonebg` del diseño).
 *  `cx/cy` = centro y `rx/ry` = radios, TODO en fracción 0-1 del rectángulo de pantalla (equivale a
 *  `objectBoundingBox` en SVG). `color` es el rgba del centro; se desvanece a transparente en `~0.6`
 *  del radio, dándole al vidrio zonas iluminadas que refractar. Solo `tokens.ts` define los rgba. */
export interface LuzFondo {
  color: string;
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

export interface Tokens {
  color: {
    fondo: string;
    superficie: string;
    superficieAlta: string;
    texto: string;
    textoTenue: string;
    acento: string;
    acentoTexto: string;
    borde: string;
    peligro: string;
    /** Fondo/borde de la acción destructiva (píldora Descartar del HUD). */
    peligroFondo: string;
    peligroBorde: string;
    exito: string;
    /**
     * Paleta CATEGÓRICA — identidad, no magnitud. Hoy la usa el gráfico 3 de Inteligencia de Negocio
     * ("en qué se me va", torta por categoría de gasto): 8 colores, uno por cada `CATEGORIAS_GASTO`
     * (`packages/core/src/api/gastos.ts`), en ESE orden — el color sigue a la categoría, nunca a su
     * posición en la torta (regla dura de `dataviz`: "color follows the entity, never its rank").
     *
     * Validada con `scripts/validate_palette.js` del skill `dataviz` contra `#050e18` (fondo `cian`,
     * representa los 4 skins oscuros) y `#eef3fa` (fondo `medicalWhite`). Resultado, documentado en vez
     * de silenciado: separación CVD (protan/deutan/tritan) en PASS para los 28 pares; el piso de visión
     * normal da 13.4 en el peor par (`impuestos`↔`transporte`) contra el mínimo recomendado de 15 — 8
     * hues verdaderamente distinguibles en sRGB es un límite físico del gamut, no una paleta a medio
     * hacer. El contrato de IN exige "período y fuente siempre visibles" + toda barra/porción con
     * detalle-al-tacto, así que la etiqueta de texto (encoding secundario) ya cubre ese par — la regla
     * del skill lo permite explícitamente bajo esa condición.
     *
     * Compartida por los 5 skins (no deriva del acento): la identidad de una categoría de gasto no
     * tiene que cambiar si el operador cambia de tema.
     */
    categorico: readonly string[];
  };
  glass: {
    tint: string;
    tint2: string;
    bd: string;
    hi: string;
    s1: string;
    s2: string;
    chip: string;
    pill: string;
    glow: string;
    accent2: string;
    on: string;
    /** Gradiente de la burbuja del USUARIO (`--dm-ub1`/`--dm-ub2`). Translúcido a propósito: la
     *  burbuja es vidrio sobre el vidrio de la conversación — el fondo se ve a través. */
    ub1: string;
    ub2: string;
    blur: number;
    esLight: boolean;
    /** Zonas de luz del fondo (mapeo de `--dm-phonebg`): 1-2 glows radiales sobre `color.fondo`. */
    fondoLuz: LuzFondo[];
    /** Color de la sombra proyectada de las cards (relieve/profundidad). Lleva alpha (Android API 28+
     *  la respeta) — por eso vive en `glass`, no en `color`. Blanco clínico usa un azul-gris (como el
     *  template); los oscuros, negro. */
    sombra: string;
  };
  espacio: { xs: number; sm: number; md: number; lg: number; xl: number };
  radio: { sm: number; md: number; lg: number; completo: number };
  tipo: { chico: number; base: number; grande: number; titulo: number };
  /** Familias tipográficas del diseño (iguales en los 5 temas). Los valores son las CLAVES que
   * `useFonts` registra en `app/_layout.tsx` (`@expo-google-fonts/*`), usables directo como
   * `fontFamily`. `ui*` = Space Grotesk (UI general); `mono*` = JetBrains Mono (labels/meta/timestamps
   * en mayúsculas). Ver `docs/Implementacion_Desarrollo/2026-07-18_PLAN...` Tarea 2.2. */
  fuente: {
    ui: string;
    uiMedium: string;
    uiSemibold: string;
    uiBold: string;
    mono: string;
    monoMedium: string;
  };
}

export type NombreSkin = 'cian' | 'violeta' | 'ambar' | 'medicalWhite' | 'black';

const espacio = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };
const radio = { sm: 6, md: 12, lg: 20, completo: 999 };
const tipo = { chico: 13, base: 15, grande: 18, titulo: 24 };
/** Claves de `@expo-google-fonts/*` (ver `useFonts` en `app/_layout.tsx`). Compartidas por los 5 temas. */
const fuente = {
  ui: 'SpaceGrotesk_400Regular',
  uiMedium: 'SpaceGrotesk_500Medium',
  uiSemibold: 'SpaceGrotesk_600SemiBold',
  uiBold: 'SpaceGrotesk_700Bold',
  mono: 'JetBrainsMono_400Regular',
  monoMedium: 'JetBrainsMono_500Medium',
};

// ---------------------------------------------------------------------------------------------
// Aritmética de color (sólo vive acá — `tokens.ts` es el único archivo autorizado a tener hex/rgba,
// ver `temaSinHex.test.ts`). Nada de esto es specific-al-tema: son las DOS técnicas de derivación
// documentadas arriba, aplicadas igual a los 5 temas.
// ---------------------------------------------------------------------------------------------

function componenteHex(n: number): string {
  const h = Math.round(n).toString(16);
  return h.length === 1 ? `0${h}` : h;
}

function hexARgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function rgbAHex(r: number, g: number, b: number): string {
  return `#${componenteHex(r)}${componenteHex(g)}${componenteHex(b)}`;
}

/** Elevation-overlay de Material: `hexBase` blendeado hacia `hexMezcla` en proporción `alpha`. */
function mezclarHex(hexBase: string, hexMezcla: string, alpha: number): string {
  const [br, bg, bb] = hexARgb(hexBase);
  const [mr, mg, mb] = hexARgb(hexMezcla);
  return rgbAHex(br * (1 - alpha) + mr * alpha, bg * (1 - alpha) + mg * alpha, bb * (1 - alpha) + mb * alpha);
}

/** Alpha-composite de un `rgba(r,g,b,a)' sobre un fondo sólido `hexFondo` → hex sólido. */
function aplanarRgbaSobre(rgba: string, hexFondo: string): string {
  const m = rgba.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*\)/);
  if (!m) throw new Error(`aplanarRgbaSobre: formato rgba inesperado "${rgba}"`);
  const [, rs, gs, bs, as] = m;
  const r = Number(rs);
  const g = Number(gs);
  const b = Number(bs);
  const a = Number(as);
  const [fr, fg, fb] = hexARgb(hexFondo);
  return rgbAHex(r * a + fr * (1 - a), g * a + fg * (1 - a), b * a + fb * (1 - a));
}

interface VidrioCrudo {
  s1: string;
  s2: string;
  bd: string;
  hi: string;
  pill: string;
  chip: string;
}

/** Base de vidrio compartida por los 4 temas oscuros (`cian`/`violeta`/`ambar`/`black` la heredan;
 * `medicalWhite` y `black` la overridean con la suya propia). */
const BASE_OSCURO: VidrioCrudo = {
  s1: 'rgba(255,255,255,.14)',
  s2: 'rgba(255,255,255,.04)',
  bd: 'rgba(255,255,255,.16)',
  hi: 'rgba(255,255,255,.55)',
  pill: 'rgba(255,255,255,.5)',
  chip: 'rgba(255,255,255,.1)',
};

interface PaletaCruda extends Partial<VidrioCrudo> {
  accent: string;
  accent2: string;
  on: string;
  glow: string;
  /** Gradiente de la burbuja del usuario (`--dm-ub1`/`--dm-ub2` del template). */
  ub1: string;
  ub2: string;
  tx: string;
  dim: string;
  tint: string;
  tint2: string;
  fondoBase: string;
  /**
   * **Knob de luminosidad del skin — el ÚNICO número a tocar para aclarar u oscurecer un tema.**
   *
   * Cuánto del acento propio del skin se mezcla dentro de `fondoBase`: `0` = el fondo crudo del
   * template · `1` = el acento puro (inusable). El resultado alimenta `color.fondo`, y con él las
   * superficies y el borde — así una sola perilla mueve el tema entero y no quedan tres o cuatro
   * hex desincronizados.
   *
   * **Por qué se mezcla hacia el ACENTO y no hacia el blanco.** Mezclar hacia `tx` (casi blanco)
   * sube el brillo pero lava el color: los tres skins oscuros convergerían al mismo gris. El
   * template ya resuelve esto — su `--dm-phonebg` es un radial del acento sobre la base, o sea el
   * skin se ilumina *con su propia luz*. Mezclar hacia el acento es esa misma idea aplicada al
   * fondo plano, así que subir la luminosidad **satura la identidad del skin** en vez de borrarla.
   *
   * **Por qué acá y no bajando el wash del vidrio.** La palanca intuitiva sería bajar
   * `opacidadFondo` en `CristalVidrio` (el vidrio taparía menos), pero ese wash es justo lo que
   * impide que el escritorio se lea nítido a través del vidrio Y de las burbujas translúcidas
   * (cazado en device). Bajarlo devuelve ese bug. El fondo es la palanca que no rompe nada.
   *
   * **Escalón sugerido: 0.03.** Un paso se nota sin desarmar el skin; dos ya es un cambio de humor.
   * `medicalWhite` y `black` van en `0` a propósito — uno ya es claro y el otro es negro por diseño
   * (subirle luz lo convertiría en el skin cian). Calibración pendiente del operador (2026-07-18).
   */
  luminosidad: number;
  blur: number;
  esLight: boolean;
  peligro: string;
  exito: string;
  /** Fondo y borde de la píldora destructiva (Descartar). Ver `SEMANTICOS_OSCURO`. */
  peligroFondo: string;
  peligroBorde: string;
  /** Glows del fondo (mapeo directo de `--dm-phonebg` del skin en el template). */
  fondoLuz: LuzFondo[];
  /** Color (con alpha) de la sombra de las cards. */
  sombra: string;
}

/**
 * Semánticos comunes a los 4 temas oscuros — heredados del skin `cian` de DocuMed (ver docstring del
 * módulo).
 *
 * 🔴 `peligroFondo`/`peligroBorde` existen para la píldora **Descartar** del HUD. El template los
 * trae HARDCODEADOS (`rgba(255,90,90,.14)` / `rgba(255,120,120,.45)` / `#ffb3b3`): copiarlos tal cual
 * habría hecho fallar `temaSinHex.test.ts` y, peor, habría pintado el mismo rojo en los 5 skins —
 * incluido `medicalWhite`, donde un rojo pensado para fondo oscuro se lee lavado. Se derivan del
 * `peligro` de cada tema, con alfa, para que el aviso sea legible en todos.
 */
const SEMANTICOS_OSCURO = {
  peligro: '#ff8fa0',
  exito: '#34e5a0',
  peligroFondo: 'rgba(255,90,90,.14)',
  peligroBorde: 'rgba(255,120,120,.45)',
};
/** Semánticos legibles sobre claro — para `medicalWhite`, el único tema claro de los 5. */
const SEMANTICOS_CLARO = {
  peligro: '#c7455a',
  exito: '#2e9e68',
  // Sobre fondo claro el mismo alfa quedaría invisible: se sube el borde y se tiñe con el rojo oscuro.
  peligroFondo: 'rgba(199,69,90,.10)',
  peligroBorde: 'rgba(199,69,90,.45)',
};

/**
 * Paleta categórica — ver el docstring de `Tokens.color.categorico`. Un solo set para los 5 skins
 * (validado contra el fondo más oscuro y el más claro de la familia).
 *
 * Orden = `CATEGORIAS_GASTO`: mercaderia, servicios, alquiler, sueldos, impuestos, transporte,
 * herramientas, otros.
 */
const CATEGORICO: readonly string[] = [
  '#8c398b', // mercaderia
  '#eb5484', // servicios
  '#aa3900', // alquiler
  '#929d00', // sueldos
  '#00915d', // impuestos
  '#00a7b8', // transporte
  '#1f57c5', // herramientas
  '#876bed', // otros
];

const PALETAS: Record<NombreSkin, PaletaCruda> = {
  cian: {
    accent: '#4dd9ff', accent2: '#d6f6ff', on: '#04141c', glow: 'rgba(77,217,255,.6)',
    ub1: 'rgba(77,217,255,.3)', ub2: 'rgba(40,120,170,.16)',
    tx: '#ecfaff', dim: '#9fc9dd', tint: 'rgba(77,217,255,.16)', tint2: 'rgba(20,80,120,.12)',
    fondoBase: '#050e18', luminosidad: 0.06, blur: 16, esLight: false, ...SEMANTICOS_OSCURO,
    fondoLuz: [
      { color: 'rgba(77,217,255,.24)', cx: 0.5, cy: 0, rx: 0.8, ry: 0.55 },
      { color: 'rgba(40,140,200,.16)', cx: 0.5, cy: 1, rx: 0.75, ry: 0.6 },
    ],
    sombra: 'rgba(0,0,0,.5)',
  },
  violeta: {
    accent: '#b98bff', accent2: '#e9d8ff', on: '#2a0a44', glow: 'rgba(185,139,255,.6)',
    ub1: 'rgba(185,139,255,.32)', ub2: 'rgba(150,90,200,.18)',
    tx: '#f4ecff', dim: '#c1a9e4', tint: 'rgba(150,110,220,.18)', tint2: 'rgba(60,30,110,.12)',
    fondoBase: '#0e0722', luminosidad: 0.06, blur: 16, esLight: false, ...SEMANTICOS_OSCURO,
    fondoLuz: [
      { color: 'rgba(185,139,255,.28)', cx: 0.5, cy: 0, rx: 0.8, ry: 0.55 },
      { color: 'rgba(255,110,190,.16)', cx: 0.5, cy: 1, rx: 0.75, ry: 0.6 },
    ],
    sombra: 'rgba(0,0,0,.5)',
  },
  ambar: {
    accent: '#ffae3d', accent2: '#ffe0af', on: '#241503', glow: 'rgba(255,174,61,.5)',
    ub1: 'rgba(255,174,61,.3)', ub2: 'rgba(180,110,30,.16)',
    tx: '#fff4e4', dim: '#cbb08f', tint: 'rgba(255,174,61,.15)', tint2: 'rgba(120,70,20,.14)',
    fondoBase: '#0f0b06', luminosidad: 0.06, blur: 16, esLight: false, ...SEMANTICOS_OSCURO,
    fondoLuz: [
      { color: 'rgba(255,174,61,.2)', cx: 0.5, cy: 1, rx: 0.65, ry: 0.48 },
      { color: 'rgba(255,174,61,.14)', cx: 0.5, cy: 0, rx: 0.8, ry: 0.55 },
    ],
    sombra: 'rgba(0,0,0,.5)',
  },
  medicalWhite: {
    accent: '#1f6feb', accent2: '#cfe0ff', on: '#ffffff', glow: 'rgba(31,111,235,.32)',
    // El template overridea la burbuja de usuario del blanco a blanco puro → azul muy claro (no el
    // celeste translúcido de los oscuros): es una card OPACA y levantada sobre el vidrio claro.
    ub1: '#ffffff', ub2: '#eef4fc',
    tx: '#132a47', dim: '#5f7692', tint: 'rgba(255,255,255,.16)', tint2: 'rgba(228,238,250,.08)',
    // `luminosidad: 0` — ya es el skin claro; mezclarle su acento (azul) lo teñiría, que es
    // exactamente lo que el operador sacó al pedir "blanco clínico" (2026-07-18).
    fondoBase: '#eef3fa', luminosidad: 0, blur: 16, esLight: true, ...SEMANTICOS_CLARO,
    s1: 'rgba(255,255,255,.92)', s2: 'rgba(255,255,255,.58)', bd: 'rgba(31,70,130,.14)',
    hi: 'rgba(255,255,255,.95)', pill: 'rgba(60,90,140,.34)', chip: 'rgba(30,70,130,.06)',
    // Blanco CLÍNICO: sin glow de fondo (el operador quitó el foco celeste/azul, 2026-07-18). La
    // profundidad la dan las sombras de las cards, no el fondo.
    fondoLuz: [],
    sombra: 'rgba(31,70,130,.5)',
  },
  black: {
    accent: '#5cc8ff', accent2: '#d6f2ff', on: '#031018', glow: 'rgba(92,200,255,.5)',
    ub1: 'rgba(92,200,255,.26)', ub2: 'rgba(50,120,180,.14)',
    tx: '#eef4f8', dim: '#8298a8', tint: 'rgba(255,255,255,.06)', tint2: 'rgba(255,255,255,.02)',
    // `luminosidad: 0` — el negro es negro por diseño. Subirle luz lo acerca al cian y deja de
    // haber dos skins distintos.
    fondoBase: '#050608', luminosidad: 0, blur: 16, esLight: false, ...SEMANTICOS_OSCURO,
    s1: 'rgba(255,255,255,.08)', s2: 'rgba(255,255,255,.02)', bd: 'rgba(255,255,255,.1)',
    hi: 'rgba(255,255,255,.4)', pill: 'rgba(255,255,255,.4)', chip: 'rgba(255,255,255,.07)',
    fondoLuz: [{ color: 'rgba(92,200,255,.12)', cx: 0.5, cy: 0, rx: 0.8, ry: 0.5 }],
    sombra: 'rgba(0,0,0,.6)',
  },
};

function construirTokens(p: PaletaCruda): Tokens {
  const s1 = p.s1 ?? BASE_OSCURO.s1;
  const s2 = p.s2 ?? BASE_OSCURO.s2;
  const bd = p.bd ?? BASE_OSCURO.bd;
  const hi = p.hi ?? BASE_OSCURO.hi;
  const pill = p.pill ?? BASE_OSCURO.pill;
  const chip = p.chip ?? BASE_OSCURO.chip;

  // El knob de luminosidad (ver `PaletaCruda.luminosidad`). Se resuelve UNA vez acá y de él salen
  // las superficies y el borde: si el fondo se aclarara solo, las superficies derivadas del crudo
  // quedarían más oscuras que su propio fondo y las cards se verían hundidas en vez de levantadas.
  const fondo = p.luminosidad > 0 ? mezclarHex(p.fondoBase, p.accent, p.luminosidad) : p.fondoBase;

  return {
    color: {
      fondo,
      superficie: mezclarHex(fondo, p.tx, 0.06),
      superficieAlta: mezclarHex(fondo, p.tx, 0.12),
      texto: p.tx,
      textoTenue: p.dim,
      acento: p.accent,
      acentoTexto: p.on,
      borde: aplanarRgbaSobre(bd, fondo),
      peligro: p.peligro,
      peligroFondo: p.peligroFondo,
      peligroBorde: p.peligroBorde,
      exito: p.exito,
      categorico: CATEGORICO,
    },
    glass: {
      tint: p.tint, tint2: p.tint2, bd, hi, s1, s2, chip, pill,
      glow: p.glow, accent2: p.accent2, on: p.on, blur: p.blur, esLight: p.esLight,
      fondoLuz: p.fondoLuz, sombra: p.sombra, ub1: p.ub1, ub2: p.ub2,
    },
    espacio, radio, tipo, fuente,
  };
}

export const SKINS: Record<NombreSkin, Tokens> = Object.fromEntries(
  (Object.keys(PALETAS) as NombreSkin[]).map((nombre) => [nombre, construirTokens(PALETAS[nombre])]),
) as Record<NombreSkin, Tokens>;

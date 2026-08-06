/**
 * Los tokens del tema. **La única fuente de color de la app.** Ver el test `temaSinHex`.
 *
 * Rebrand ODOBI (2026-08-05, `docs/copiloto-emprendedor/2026-08-05-DoD-sprint-odobi.md`): reemplaza
 * los 5 skins heredados del rediseño Z-Depth de DocuMed (`cian`/`violeta`/`ambar`/`medicalWhite`/
 * `black`) por 3 pieles con un solo acento terracota — `claro` (default) · `oscuro` · `nocturno`.
 * Decisión cerrada del sprint (§1.2/§1.3 del DoD): "sin glass, color pleno + relieve" — las
 * superficies YA NO son vidrio translúcido, son color plano aplanado (§2.3). El shape `Tokens.glass`
 * (heredado del rediseño anterior) se conserva porque `CristalVidrio.tsx` sigue consumiéndolo este
 * hito (hito 1 es "sólo colores" — retirar el componente de vidrio es trabajo de un hito posterior);
 * sus campos se rellenan con valores inertes/neutros (blur 0, sin glows) en vez de inventar un
 * sistema de vidrio nuevo para un diseño que ya no lo usa.
 *
 * Cada tema define una paleta CRUDA (`PALETAS`, abajo). `oscuro` y `nocturno` comparten la base de
 * vidrio oscura (`BASE_OSCURO`); `claro` trae la suya (vidrio claro, mismo criterio que la extinta
 * `medicalWhite`). `construirTokens` deriva de ahí las DOS superficies que consume el resto de la app:
 *
 * - `color.*` — el shape YA existente (no cambia para no romper los ~20 componentes que lo consumen
 *   por `useTema()`). Derivación, misma técnica que la versión anterior de este archivo:
 *   - `fondo` ← `fondoBase` (directo) · `texto` ← `tx` (directo) · `textoTenue` ← `dim` (directo)
 *   - `acento` ← `accent` (directo) · `acentoTexto` ← `on` (directo)
 *   - `superficie`/`superficieAlta` ← **`p.superficie`/`p.superficieAlta` si el tema los declara
 *     (ODOBI); si no, cae al elevation-overlay de Material** (blend de `fondoBase` hacia `tx` al
 *     6%/12%, `mezclarHex` — el comportamiento heredado de los 5 skins de vidrio que este rebrand
 *     reemplaza). El override existe porque el blend-hacia-`tx` sólo puede OSCURECER: en un tema
 *     oscuro blendear hacia un `tx` claro aclara la superficie (por eso servía ahí), pero en un tema
 *     CLARO blendear hacia un `tx` oscuro la oscurece — la dirección opuesta a la superficie
 *     aplanada §2.3 del DoD, que es más CLARA que el fondo. Matemáticamente no hay `fondoBase` válido
 *     (0-255) que reproduzca `#F5EBD5` vía ese blend — se probó por despeje, el canal R exige
 *     `fondoBase.r > 255`. `claro`/`oscuro`/`nocturno` declaran el valor exacto de §2.3 y saltean el
 *     blend; ningún skin sigue dependiendo del blend viejo (los 5 anteriores se borraron con este
 *     mismo cambio), así que no hay comportamiento previo que romper.
 *   - `peligro`/`exito` — semánticos reusados sin cambio de `SEMANTICOS_CLARO`/`SEMANTICOS_OSCURO`
 *     (no están en el DoD de ODOBI; no hay WCAG gate en mobile que los ejercite, así que reusar el
 *     par ya validado es preferible a inventar uno nuevo). `nocturno` reusa el par de `oscuro`.
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

export type NombreSkin = 'claro' | 'oscuro' | 'nocturno';

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
   * Override explícito de `color.superficie`/`color.superficieAlta` — salta el blend-hacia-`tx` de
   * `construirTokens` (ver docstring del módulo). ODOBI los declara siempre (§2.3 del DoD); queda
   * opcional para no forzar un valor a un tema hipotético futuro que sí quiera el blend automático.
   */
  superficie?: string;
  superficieAlta?: string;
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
/** Semánticos legibles sobre fondo claro — para `claro`, la única piel clara de ODOBI. Sin `exito`:
 * `claro` lo pisa siempre con el valor propio del DoD (§2.1, `#3C8069`) — no tiene sentido declarar
 * un valor que ningún caller termina usando. */
const SEMANTICOS_CLARO = {
  peligro: '#c7455a',
  // Sobre fondo claro el mismo alfa quedaría invisible: se sube el borde y se tiñe con el rojo oscuro.
  peligroFondo: 'rgba(199,69,90,.10)',
  peligroBorde: 'rgba(199,69,90,.45)',
};

/**
 * Paleta categórica — ver el docstring de `Tokens.color.categorico`. Un solo set para las 3 pieles
 * (validado contra el fondo más oscuro y el más claro de la familia; no deriva del acento, así que
 * el rebrand ODOBI no la toca).
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

// El acento (`#C2452E`→`#7E2417`) es el MISMO en las 3 pieles (§2.1/§2.2 del DoD: "el acento no
// cambia entre claro y oscuro" — y nocturno deriva de oscuro). `accent2` (tinte pálido, sin
// declaración propia en el DoD) sale de mezclar el acento hacia blanco al 78%, misma técnica que
// ya usaba cada skin viejo para su propio `accent2` — no es un color nuevo, es una dilución del
// que ya está declarado.
const ACCENT = '#C2452E';
const ACCENT2 = '#F2D6D1';
const ACCENT_ON = '#FBF3E2'; // texto sobre acento, §2.1
const ACCENT_GLOW = 'rgba(194,69,46,.55)';
// Burbuja del usuario = "acento (superficie)" del DoD, sólida (no rgba) — mismo criterio que la
// extinta `medicalWhite` (card opaca), y es literalmente lo que el DoD asigna a "burbuja del
// usuario" en la fila de acento.
const UB1 = '#C2452E';
const UB2 = '#7E2417';
// Wash de vidrio del acento — mismo patrón que cada skin viejo (`tint`/`tint2` = el propio acento
// a alfa baja), usando los DOS stops YA declarados del gradiente de acento como base del rgba.
const TINT = 'rgba(194,69,46,.16)';
const TINT2 = 'rgba(126,36,23,.10)';

const PALETAS: Record<NombreSkin, PaletaCruda> = {
  claro: {
    accent: ACCENT, accent2: ACCENT2, on: ACCENT_ON, glow: ACCENT_GLOW,
    ub1: UB1, ub2: UB2,
    tx: '#2E2A20',
    // Texto secundario del DoD es `rgba(46,42,32,.55)` — aplanado sobre el fondo da 3.23:1, bajo el
    // piso WCAG AA (4.5:1). Mismo alfa que `dim` necesita para textoTenue, así que se sube a `.69`
    // (mínimo matemático .673 + margen), mismo rgb/hue que el DoD — no es un color nuevo, es el
    // mismo texto un poco más oscuro para que siga siendo legible. Verificado con
    // `scripts/../odobi_tokens2.py` (no a ojo): 4.72:1.
    dim: '#6A6457',
    tint: TINT, tint2: TINT2,
    // `superficie`/`superficieAlta` explícitos (ver docstring del módulo) — §2.3 del DoD: superficie
    // aplanada `#F5EBD5`, campo aplanado `#FAF7EC` (reusado como "superficie alta": el shape no tiene
    // un tercer nivel de elevación declarado por el DoD, y campo es la superficie más elevada que sí
    // lo está).
    superficie: '#F5EBD5', superficieAlta: '#FAF7EC',
    fondoBase: '#EFE6D2', luminosidad: 0, blur: 0, esLight: true,
    // Éxito tiene valor propio en el DoD (§2.1); peligro no está en el DoD de ODOBI — se reusa el
    // par ya validado de `SEMANTICOS_CLARO` (no hay WCAG gate en mobile que lo ejercite, así que
    // reusar es preferible a inventar uno nuevo).
    ...SEMANTICOS_CLARO, exito: '#3C8069',
    // Vidrio claro — mismo criterio que la extinta `medicalWhite` (blancos para s1/s2/hi), pero
    // `bd` usa el valor EXACTO del DoD ("Borde de superficie") y `pill`/`chip` se retiñen del azul
    // de `medicalWhite` al neutro cálido de `tx` (misma técnica, mismo alfa, nuevo hue).
    s1: 'rgba(255,255,255,.92)', s2: 'rgba(255,255,255,.58)', bd: 'rgba(255,252,244,.7)',
    hi: 'rgba(255,255,255,.95)', pill: 'rgba(46,42,32,.34)', chip: 'rgba(46,42,32,.06)',
    fondoLuz: [],
    // Sombra cálida validada por el spike del hito 0 (nivel 1 · reposo, §2.4 del DoD).
    sombra: 'rgba(110,75,44,.3)',
  },
  oscuro: {
    accent: ACCENT, accent2: ACCENT2, on: ACCENT_ON, glow: ACCENT_GLOW,
    ub1: UB1, ub2: UB2,
    tx: '#F1E4CC',
    // Texto secundario declarado (`rgba(241,228,204,.55)`) ya pasa AA (5.07:1) — sin ajustar.
    dim: '#928777',
    tint: TINT, tint2: TINT2,
    superficie: '#251B11', superficieAlta: '#1B120B', // §2.3: superficie / campo aplanados
    fondoBase: '#1E1610', luminosidad: 0, blur: 0, esLight: false,
    // Ni éxito ni peligro tienen valor propio en el DoD para oscuro — se reusa el par de
    // `SEMANTICOS_OSCURO` (ya validado, ≥8:1 contra este fondo — más margen del que exige AA).
    ...SEMANTICOS_OSCURO,
    bd: 'rgba(241,228,204,.14)', // §2.2, exacto
    s1: BASE_OSCURO.s1, s2: BASE_OSCURO.s2, hi: BASE_OSCURO.hi,
    pill: BASE_OSCURO.pill, chip: BASE_OSCURO.chip,
    fondoLuz: [],
    sombra: 'rgba(0,0,0,.6)', // §2.4, nivel 1 oscuro
  },
  nocturno: {
    // Deriva de oscuro (§2.8): acento y texto principal idénticos, sin valor propio en el DoD.
    accent: ACCENT, accent2: ACCENT2, on: ACCENT_ON, glow: ACCENT_GLOW,
    ub1: UB1, ub2: UB2,
    tx: '#F1E4CC',
    dim: '#928777', // reuso del secundario ya ajustado de oscuro — con el fondo más oscuro de
    // nocturno da AÚN más contraste (5.66:1), sigue AA sin re-ajustar.
    tint: TINT, tint2: TINT2,
    superficie: '#141009', superficieAlta: '#140E08', // §2.8 superficie; campo = rgba(20,13,8,.5)
    // sobre la superficie nocturna (misma técnica §2.3, base = superficie del propio skin).
    fondoBase: '#0C0805', luminosidad: 0, blur: 0, esLight: false,
    ...SEMANTICOS_OSCURO, // reuso de oscuro, ver nota arriba
    bd: 'rgba(241,228,204,.10)', // §2.8, exacto
    s1: BASE_OSCURO.s1, s2: BASE_OSCURO.s2,
    // `hi` (luz interna superior) reducida — §2.8 es explícito: "relieve nivel 1-2 con
    // rgba(0,0,0,.75), SIN luz interna cálida". El resto del vidrio (s1/s2/pill/chip) no tiene esa
    // instrucción explícita, así que se deja igual a `oscuro`.
    hi: 'rgba(255,255,255,.15)',
    pill: BASE_OSCURO.pill, chip: BASE_OSCURO.chip,
    fondoLuz: [],
    sombra: 'rgba(0,0,0,.75)', // §2.8, exacto
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
      superficie: p.superficie ?? mezclarHex(fondo, p.tx, 0.06),
      superficieAlta: p.superficieAlta ?? mezclarHex(fondo, p.tx, 0.12),
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

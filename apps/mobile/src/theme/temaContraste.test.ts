import { SKINS, type NombreSkin, type Tokens } from './tokens';

/**
 * Gate de contraste WCAG 2.1 para los tokens de texto de las 3 pieles.
 *
 * 🔴 **Por qué existe: una regresión real que NADA cazó (2026-09-07).** El rebrand Odobi movió el
 * acento y yo validé `acentoTinta` contra `acentoTexto` y contra blanco —los casos "texto SOBRE el
 * acento"— pero NO contra el fondo de cada piel, que es el caso "el acento COMO texto" y son 33 de
 * sus 36 usos. Resultado: mejoré claro (4.04→4.38) y **empeoré oscuro (3.55→3.28) y nocturno
 * (3.98→3.67)** sin que un solo test se pusiera rojo. `temaSinHex.test.ts` no podía verlo: prueba
 * que no haya hex sueltos, no que los colores contrasten. Web ya tenía su red
 * (`themesContrast.test.ts`); mobile no. Esto la empareja.
 *
 * **El criterio que importa, calcado de web: se mide contra la superficie REAL, no contra `fondo`
 * para todos.** Un token que se pinta sobre la burbuja del usuario medido contra el lienzo da un
 * número que no existe en pantalla — falso positivo o falso negativo según el caso, no un
 * tecnicismo. Cada par de abajo declara su superficie explícitamente.
 *
 * **Los umbrales son BASELINE, no aspiración.** Varios pares están hoy por debajo de AA (4.5) y eso
 * es deuda conocida y documentada, igual que en web. El test NO exige arreglarla: exige **no
 * empeorarla**. Bajar un número rompe el build; subirlo obliga a subir el piso acá, que es
 * exactamente el trinquete que se quiere.
 */

// ── WCAG 2.1: luminancia relativa con linealización sRGB ────────────────────────────────────────
function aRgb(hex: string): [number, number, number] {
  const s = hex.replace('#', '');
  const full = s.length === 3 ? s.split('').map((c) => c + c).join('') : s;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as [number, number, number];
}

function luminancia(hex: string): number {
  const lineal = (c: number) => {
    const x = c / 255;
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  };
  const [r, g, b] = aRgb(hex);
  return 0.2126 * lineal(r) + 0.7152 * lineal(g) + 0.0722 * lineal(b);
}

export function contraste(a: string, b: string): number {
  const [l1, l2] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

/**
 * Cada par declara CONTRA QUÉ se mide, porque el token de texto y su superficie casi nunca son
 * `texto` sobre `fondo`. `min` es el baseline medido hoy (redondeado hacia abajo a 2 decimales):
 * es un piso anti-regresión, no un objetivo.
 */
interface Par {
  nombre: string;
  tinta: (t: Tokens) => string;
  superficie: (t: Tokens) => string;
  min: Record<NombreSkin, number>;
}

const PARES: Par[] = [
  {
    nombre: 'texto principal sobre el lienzo',
    tinta: (t) => t.color.texto,
    superficie: (t) => t.color.fondo,
    min: { claro: 10, oscuro: 10, nocturno: 10 },
  },
  {
    // 🔴 EL PAR DE LA REGRESIÓN, ya corregido. `acentoTinta` es el acento usado COMO texto (33 usos)
    // y **invierte por piel**: #B04A2E en claro, #DE7250 en oscuro/nocturno.
    //
    // Los pisos SUBIERON con el fix (eran 4.3/3.2/3.6, el baseline de cuando el token era un valor
    // único). Ese es el trinquete: la mejora queda protegida y volver al valor fijo rompe el build —
    // con #B04A2E en las tres, oscuro cae a 3.28 y nocturno a 3.67, por debajo de estos pisos.
    // **Ese es el control negativo que pidió el DoD**, y está verificado corriéndolo, no razonándolo.
    nombre: 'acentoTinta como texto sobre el lienzo',
    tinta: (t) => t.color.acentoTinta,
    superficie: (t) => t.color.fondo,
    min: { claro: 4.3, oscuro: 5.6, nocturno: 6.29 },
  },
  {
    // Texto SOBRE una superficie de acento (botón con label, gate de confirmación, swipe de Mi Día).
    //
    // 🔴 Se mide contra `acentoSuperficie`, NO contra `acentoTinta`, y la distinción la descubrió
    // este mismo test: al hacer que `acentoTinta` invirtiera por piel, este caso se puso ROJO en
    // oscuro y nocturno (3.17 contra un piso de 5.4), porque esos tres botones usaban `acentoTinta`
    // como fondo. La inversión mejora la tinta sobre el lienzo y arruina la superficie bajo el
    // texto: son roles opuestos que compartían token. Por eso existe `acentoSuperficie`.
    nombre: 'acentoTexto sobre la superficie de acento',
    tinta: (t) => t.color.acentoTexto,
    superficie: (t) => t.color.acentoSuperficie,
    min: { claro: 5.4, oscuro: 5.4, nocturno: 5.4 },
  },
  {
    // La burbuja del usuario lleva el texto del mensaje: se mide contra su stop MÁS CLARO, que es
    // el peor caso del gradiente. Medir contra `ub2` daría un número cómodo que no protege nada.
    nombre: 'acentoTexto sobre la burbuja del usuario (peor stop)',
    tinta: (t) => t.color.acentoTexto,
    superficie: (t) => t.glass.ub1,
    min: { claro: 5.4, oscuro: 5.4, nocturno: 5.4 },
  },
  // 🔴 Los 2 casos de abajo existen por el hallazgo de 2026-09-08
  // (`hallazgo_backend-a-planificacion_censo-acentoTexto-2-consumidores-sin-cubrir.md`): los pares
  // de ARRIBA verifican lo que los TOKENS declaran (`acentoTexto` vs `acentoSuperficie`), pero
  // `BotonVoz.tsx` y `Marca.tsx` (`tono='acento'`, el default) no usan `acentoSuperficie` — pintan
  // el isotipo con `acentoTexto` directo sobre `t.color.acento` puro. Ese par nunca tuvo test propio
  // y por eso el gate seguía verde con dos componentes de altísima exposición sin cobertura real.
  // Ratio computado (no estimado, `node` con la misma fórmula de este archivo): 3.1681:1 — piso
  // redondeado hacia abajo a 2 decimales, mismo criterio que el resto del archivo. `accent` y
  // `acentoTexto` son el MISMO valor en las 3 pieles (`tokens.ts:359`, `:393`), así que el piso es
  // idéntico en las tres.
  {
    nombre: 'acentoTexto sobre accent puro (isotipo de BotonVoz, offset final del gradiente)',
    tinta: (t) => t.color.acentoTexto,
    superficie: (t) => t.color.acento,
    min: { claro: 3.16, oscuro: 3.16, nocturno: 3.16 },
  },
  {
    nombre: "acentoTexto sobre accent puro (isotipo de Marca, tono='acento')",
    tinta: (t) => t.color.acentoTexto,
    superficie: (t) => t.color.acento,
    min: { claro: 3.16, oscuro: 3.16, nocturno: 3.16 },
  },
];

describe('contraste WCAG de las 3 pieles', () => {
  const pieles = Object.keys(SKINS) as NombreSkin[];

  it('las 3 pieles existen — control del instrumento', () => {
    // Sin esto, un `SKINS` vacío haría que TODOS los casos de abajo pasen por no ejecutarse nunca.
    expect(pieles.sort()).toEqual(['claro', 'nocturno', 'oscuro']);
  });

  for (const par of PARES) {
    for (const piel of pieles) {
      it(`${piel}: ${par.nombre} >= ${par.min[piel]}:1`, () => {
        const t = SKINS[piel];
        const ratio = contraste(par.tinta(t), par.superficie(t));
        expect(ratio).toBeGreaterThanOrEqual(par.min[piel]);
      });
    }
  }

  it('la fórmula discrimina — control positivo y negativo', () => {
    // Sin esto, un `contraste()` que devolviera siempre 21 dejaría pasar todo lo de arriba.
    expect(contraste('#000000', '#FFFFFF')).toBeCloseTo(21, 1);
    expect(contraste('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 1);
  });
});

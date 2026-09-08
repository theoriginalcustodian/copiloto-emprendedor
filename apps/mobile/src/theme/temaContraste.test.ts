import * as fs from 'fs';
import * as path from 'path';
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
 * Cada entrada declara CONTRA QUÉ se mide, porque el token de texto y su superficie casi nunca son
 * `texto` sobre `fondo`. `min` es el baseline medido hoy (redondeado hacia abajo a 2 decimales):
 * es un piso anti-regresión, no un objetivo.
 */
interface Par {
  nombre: string;
  tinta: (t: Tokens) => string;
  superficie: (t: Tokens) => string;
  min: Record<NombreSkin, number>;
}

/** Compone un stop `rgba(...)` del vidrio sobre un fondo sólido → hex plano, misma técnica que
 *  `aplanarRgbaSobre` de `tokens.ts` (no se importa: ese helper es privado del módulo de color). */
function aplanar(rgba: string, hexFondo: string): string {
  const m = rgba.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*\)/);
  if (!m) throw new Error(`aplanar: formato rgba inesperado "${rgba}"`);
  const [, rs, gs, bs, as] = m;
  const [r, g, b, a] = [rs, gs, bs, as].map(Number);
  const [fr, fg, fb] = aRgb(hexFondo);
  const c = (fg2: number, bg2: number) => Math.round(fg2 * a + bg2 * (1 - a));
  const hex2 = (n: number) => { const h = n.toString(16); return h.length === 1 ? `0${h}` : h; };
  return `#${hex2(c(r, fr))}${hex2(c(g, fg))}${hex2(c(b, fb))}`;
}

/**
 * **Mapa declarativo token→superficie(s) real(es)**, calcado del patrón de web
 * (`themesContrast.test.ts`: `TEXT_TOKENS` + `OWN_BG_TOKEN`). La diferencia con web —por eso no es
 * un `Record<token, unaSuperficie>` 1:1— es que acá un mismo rol de foreground SÍ se reutiliza sobre
 * superficies distintas (`acentoTexto` tiene 3; `texto`/`textoTenue`/`peligro` tienen 2-4 cada uno):
 * en mobile los estilos son objetos JS reusados entre componentes estructuralmente distintos, no
 * clases CSS con un solo selector. Por eso el mapa es `Record<rol, Par[]>` — una entrada por
 * superficie real, no por token.
 *
 * **Censo que generó esto (2026-09-08, sub-agente headless, 66 archivos leídos completos, grep
 * `tema\.color\.(texto|textoTenue|acentoTinta|peligro|exito)\b` en `src/`)**: contra el supuesto de
 * que estos 5 roles "siempre pintan sobre `fondo`" (falso para 4 de los 5 — sólo `acentoTinta` casi
 * no tiene excepciones). Evidencia completa archivada en
 * `coordinacion/cerrado/2026-09-08/2026-09-08_dato_backend-a-planificacion_censo-superficies-reales-5-roles.md`.
 * `acentoTexto` NO se reaudita acá — ya tiene sus 3 pares (hallazgo previo, PR #501).
 *
 * Superficies que el censo encontró y que **NO** están abajo como pares nuevos, a propósito:
 * - `fondo` con alpha explícito (`+'F2'`, `FichaCliente.tsx`/`DetalleGasto.tsx`) — mismo token que
 *   `fondo`, casi opaco (95%): no es una superficie distinta, es el mismo par ya cubierto.
 * - `borde` en `EnvolturaCampo.tsx:46` para `peligro` — es `borderColor`, no `color` de texto: fuera
 *   de alcance de este gate (que mide texto/ícono, no bordes).
 * - `HudGrabacion.tsx` — deuda conocida y DIFERIDA por el operador (`tokens.ts:398-400`), fuera de
 *   alcance de este contrato explícitamente.
 * - `PantallaTicket.tsx` (burbuja de soporte) usa geometría de color ad-hoc del componente, no un
 *   token de `Tokens.color` reusable — mismo motivo que `HudGrabacion`: no hay token que referenciar
 *   sin reinventar el cálculo local. Documentado, no cubierto — deuda conocida, no silenciada.
 * - `Composer.tsx:138/141` pinta `peligro` sobre `glass.s1→s2`, pero es un punto de estado de 1-2px,
 *   no texto legible: fuera del criterio WCAG que este gate mide.
 */
const SUPERFICIES: Record<string, Par[]> = {
  texto: [
    {
      nombre: 'texto principal sobre el lienzo',
      tinta: (t) => t.color.texto,
      superficie: (t) => t.color.fondo,
      min: { claro: 10, oscuro: 10, nocturno: 10 },
    },
    {
      // Campos de formulario (`EnvolturaCampo.tsx:50`): `CampoSelect`, `CampoTexto`, `CampoFecha`,
      // overlays/paneles modales (`DetallePresupuesto`), paneles de confirmación
      // (`SeccionMisComprobantes`, `PantallaApps`, `PantallaCuenta`). Decenas de sitios, 1 superficie.
      nombre: 'texto sobre superficieAlta (campos, paneles, overlays)',
      tinta: (t) => t.color.texto,
      superficie: (t) => t.color.superficieAlta,
      min: { claro: 13.33, oscuro: 14.68, nocturno: 15.24 },
    },
    {
      nombre: 'texto sobre superficie (campo de login, PantallaLogin.tsx:87/89)',
      tinta: (t) => t.color.texto,
      superficie: (t) => t.color.superficie,
      min: { claro: 12.07, oscuro: 13.43, nocturno: 15.08 },
    },
    {
      // Composer.tsx:185 — input del chat, vidrio `glass.s1→s2`. Se mide contra `s2` (el stop más
      // transparente, peor caso) compuesto sobre `fondo` — mismo criterio que `ub1` para acentoTexto:
      // medir contra el stop cómodo escondería el peor caso real.
      nombre: 'texto sobre glass.s2 del composer (peor stop, compuesto sobre fondo)',
      tinta: (t) => t.color.texto,
      superficie: (t) => aplanar(t.glass.s2, t.color.fondo),
      min: { claro: 13.12, oscuro: 12.88, nocturno: 14.81 },
    },
  ],
  textoTenue: [
    {
      nombre: 'textoTenue sobre el lienzo',
      tinta: (t) => t.color.textoTenue,
      superficie: (t) => t.color.fondo,
      min: { claro: 4.7, oscuro: 5, nocturno: 5.6 },
    },
    {
      // Placeholder de `CampoTexto`/`CampoSelect`/`CampoFecha`, ícono del ojo de `CampoSecreto`,
      // paneles modales (`DetallePresupuesto`, 10 usos).
      nombre: 'textoTenue sobre superficieAlta (placeholders, paneles)',
      tinta: (t) => t.color.textoTenue,
      superficie: (t) => t.color.superficieAlta,
      min: { claro: 5.47, oscuro: 5.23, nocturno: 5.43 },
    },
    {
      // Composer.tsx:187 — placeholder del input, mismo vidrio que `texto` arriba, peor stop.
      nombre: 'textoTenue sobre glass.s2 del composer (peor stop)',
      tinta: (t) => t.color.textoTenue,
      superficie: (t) => aplanar(t.glass.s2, t.color.fondo),
      min: { claro: 5.39, oscuro: 4.59, nocturno: 5.28 },
    },
  ],
  acentoTinta: [
    {
      // 🔴 EL PAR DE LA REGRESIÓN original (2026-09-07), ya corregido. `acentoTinta` es el acento
      // usado COMO texto (33 usos) y **invierte por piel**: #B04A2E en claro, #DE7250 en
      // oscuro/nocturno. Los pisos SUBIERON con el fix (eran 4.3/3.2/3.6) — volver al valor fijo
      // rompe el build (con #B04A2E fijo, oscuro cae a 3.28 y nocturno a 3.67). Control negativo
      // verificado corriéndolo, no razonándolo.
      nombre: 'acentoTinta como texto sobre el lienzo',
      tinta: (t) => t.color.acentoTinta,
      superficie: (t) => t.color.fondo,
      min: { claro: 4.3, oscuro: 5.6, nocturno: 6.29 },
    },
    {
      // Único caso encontrado por el censo donde `acentoTinta` NO pinta sobre `fondo`:
      // `DetallePresupuesto.tsx:319`, `DetalleComprobante.tsx:170` (sobre un scrim).
      nombre: 'acentoTinta sobre superficieAlta',
      tinta: (t) => t.color.acentoTinta,
      superficie: (t) => t.color.superficieAlta,
      min: { claro: 5.06, oscuro: 5.82, nocturno: 6.04 },
    },
  ],
  peligro: [
    {
      nombre: 'peligro sobre el lienzo',
      tinta: (t) => t.color.peligro,
      superficie: (t) => t.color.fondo,
      min: { claro: 3.82, oscuro: 8.22, nocturno: 9.2 },
    },
    {
      // DetallePresupuesto.tsx (4 usos).
      nombre: 'peligro sobre superficieAlta',
      tinta: (t) => t.color.peligro,
      superficie: (t) => t.color.superficieAlta,
      // 🔴 Deuda conocida en `claro` (4.42 < 4.5 AA), igual que otros pares de este archivo — el
      // piso protege contra EMPEORAR, no exige arreglar hoy.
      min: { claro: 4.42, oscuro: 8.51, nocturno: 8.83 },
    },
    {
      // Píldora Descartar del HUD (`FilaBotones.tsx:52`, bg `:100`) y `PasoResumen.tsx:110`
      // (condicional, sólo `ambiente==='prod'`) — `peligroFondo` es un token propio (no genérico),
      // ya diseñado para llevar `peligro` encima (ver docstring de `Tokens.color.peligroFondo`).
      nombre: 'peligro sobre peligroFondo (compuesto sobre fondo)',
      tinta: (t) => t.color.peligro,
      superficie: (t) => aplanar(t.color.peligroFondo, t.color.fondo),
      min: { claro: 3.38, oscuro: 6.79, nocturno: 7.95 },
    },
  ],
  exito: [
    {
      nombre: 'exito sobre el lienzo',
      tinta: (t) => t.color.exito,
      superficie: (t) => t.color.fondo,
      min: { claro: 3.77, oscuro: 10.92, nocturno: 12.21 },
    },
    {
      // DetallePresupuesto.tsx:404, SeccionMisComprobantes.tsx:324 (condicional junto con `peligro`).
      nombre: 'exito sobre superficieAlta',
      tinta: (t) => t.color.exito,
      superficie: (t) => t.color.superficieAlta,
      min: { claro: 4.36, oscuro: 11.3, nocturno: 11.73 },
    },
  ],
  acentoTexto: [
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
    // el isotipo con `acentoTexto` directo sobre `t.color.acento` puro. Ratio computado (no
    // estimado, `node` con la misma fórmula de este archivo): 3.1681:1. `accent` y `acentoTexto`
    // son el MISMO valor en las 3 pieles (`tokens.ts:359`, `:393`), así que el piso es idéntico.
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
  ],
};

const PARES: Par[] = Object.values(SUPERFICIES).flat();

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

describe('auditoría del mapa SUPERFICIES contra el código real', () => {
  // 🔴 Lo que pidió el contrato de 2026-09-08 ("auditá el mapa contra el código: si un token está en
  // el mapa pero ya nadie lo pinta, eso vale más que el ratio") ejecutado, no sólo comentado: un rol
  // que deje de aparecer en `src/` deja el par correspondiente HUÉRFANO — esto lo caza en cada corrida
  // de CI, no depende de que alguien relea el comentario. La mitad "consumidor sin mapear" NO es
  // automatizable sin parsear JSX (false positives de `tema.color.<rol>` usado como borde/fondo, no
  // como color de texto) — esa mitad la cubrió el censo manual, archivado en
  // `coordinacion/cerrado/2026-09-08/2026-09-08_dato_backend-a-planificacion_censo-superficies-reales-5-roles.md`.
  const SRC = path.join(__dirname, '..');

  function archivosFuente(dir: string): string[] {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) return archivosFuente(p);
      return /\.tsx?$/.test(e.name) ? [p] : [];
    });
  }

  const TODO_EL_SRC = archivosFuente(SRC)
    .filter((p) => !p.endsWith('.test.ts') && !p.endsWith('.test.tsx'))
    .map((p) => fs.readFileSync(p, 'utf8'))
    .join('\n');

  for (const rol of Object.keys(SUPERFICIES)) {
    it(`el rol "${rol}" del mapa sigue pintándose en algún componente real`, () => {
      const usado = new RegExp(`(tema|theme|t)\\.color\\.${rol}\\b`).test(TODO_EL_SRC);
      expect(usado).toBe(true);
    });
  }
});

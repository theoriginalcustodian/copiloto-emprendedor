import { describe, expect, it } from 'vitest';

// eslint-disable-next-line import/no-unresolved -- `?raw` es una convención de Vite.
import themesCss from './themes.css?raw';

/**
 * BL-Q4 — contraste de los pares PINTADOS, no sólo los declarados.
 *
 * `themesContrast.test.ts` mide cada token `--*-fg` contra el fondo que el TEST declara para él. Eso
 * verifica el par declarado; no dice qué par pinta cada regla real (memoria
 * `el-gate-verifica-el-par-declarado-no-el-par-pintado`). Acá se recorre TODO el CSS de `src/`: por
 * cada regla que fija `color: var(--X)`, se toma el fondo de la MISMA regla (`background`/
 * `background-color`: `var(--Y)` u hex) y, si no hay, se mide contra las dos superficies sobre las
 * que el texto sin fondo propio se pinta (`--bg` y `--card-bg`). Cada par se computa en las pieles
 * vigentes (fallback `:root`, `claro`, `oscuro`).
 *
 * Limitación declarada: sólo ve el fondo puesto en la misma regla; un texto que hereda un fondo de un
 * ancestro se mide contra `--bg`/`--card-bg` (las dos superficies de página). No sustituye la
 * captura en device; cierra el hueco de "el gate no miraba el par que se pinta".
 */

const CSS_FILES = import.meta.glob('../**/*.css', { query: '?raw', import: 'default', eager: true }) as Record<
  string,
  string
>;

const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

type Rgb = { r: number; g: number; b: number };

function hexToRgb(hex: string): Rgb {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
function lum({ r, g, b }: Rgb): number {
  const c = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * c(r) + 0.7152 * c(g) + 0.0722 * c(b);
}
function ratio(a: string, b: string): number {
  const la = lum(hexToRgb(a));
  const lb = lum(hexToRgb(b));
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

function declaraciones(body: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /(--[a-z0-9-]+)\s*:\s*([^;]+);/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) out[m[1]] = m[2].trim();
  return out;
}

const THEMES: Record<string, RegExp> = {
  'root-default': /:root\s*\{([^}]*)\}/,
  claro: /:root\[data-theme=['"]claro['"]\],\s*\[data-muestra=['"]claro['"]\]\s*\{([^}]*)\}/,
  oscuro: /:root\[data-theme=['"]oscuro['"]\],\s*\[data-muestra=['"]oscuro['"]\]\s*\{([^}]*)\}/,
};
const VARS: Record<string, Record<string, string>> = Object.fromEntries(
  Object.entries(THEMES).map(([n, re]) => {
    const m = themesCss.match(re);
    if (!m) throw new Error(`Bloque de tema no encontrado: ${n}`);
    return [n, declaraciones(m[1])];
  }),
);

/** Resuelve `var(--x)` (con alias en cadena) u hex a un hex sólido; null si no es resoluble (gradiente, rgba…). */
function resolver(valor: string | undefined, vars: Record<string, string>, prof = 0): string | null {
  if (!valor || prof > 5) return null;
  const v = valor.trim();
  if (HEX.test(v)) return v;
  const m = v.match(/^var\(\s*(--[a-z0-9-]+)\s*(?:,\s*([^)]+))?\)$/i);
  if (!m) return null;
  return resolver(vars[m[1]], vars, prof + 1) ?? (m[2] ? resolver(m[2], vars, prof + 1) : null);
}

interface Par {
  archivo: string;
  selector: string;
  fg: string; // valor CSS crudo
  bg: string | null; // valor CSS crudo o null (sin fondo propio)
}

function pares(): Par[] {
  const out: Par[] = [];
  for (const [archivo, css] of Object.entries(CSS_FILES)) {
    if (archivo.endsWith('themes.css')) continue;
    const limpio = css.replace(/\/\*[\s\S]*?\*\//g, '');
    const re = /([^{}]+)\{([^{}]*)\}/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(limpio))) {
      const selector = m[1].trim().replace(/\s+/g, ' ');
      const cuerpo = m[2];
      const fg = cuerpo.match(/(?:^|[;\s])color\s*:\s*([^;]+);?/i)?.[1]?.trim();
      if (!fg || !/^var\(|^#/.test(fg)) continue;
      const bg = cuerpo.match(/(?:^|[;\s])background(?:-color)?\s*:\s*([^;]+);?/i)?.[1]?.trim() ?? null;
      out.push({ archivo: archivo.replace('../', ''), selector, fg, bg });
    }
  }
  return out;
}

/**
 * Deuda ya conocida y escalada (no se esconde: cada clave tiene motivo, y sale de acá con el fix).
 * Clave: `<token fg>` — se exime el token en cualquier par. Vacío = ningún par pintado bajo AA.
 */
const DEUDA_CONOCIDA: Record<string, string> = {
  '--core':
    'dual-role acento (trazo/texto): 4,38:1 en claro, decisión de diseño DEC-11/DA-4 — ver themesContrast.test.ts',
  '--danger-btn-fg': 'AA-debt claro 4,00:1 escalada a planificación 2026-09-08 (themesContrast.test.ts)',
  '--ok-fg': 'AA-debt claro 3,77-3,95:1 escalada a planificación 2026-09-08 (themesContrast.test.ts)',
};

/**
 * Superficie de un fg que NO fija su fondo en la misma regla (el fondo lo pone el contenedor). Por
 * convención `--X-fg` (o `--X-fg-secondary`) se pinta sobre `--X-bg`; los que no la siguen se
 * declaran acá. Sin fondo propio resoluble → se mide contra las dos superficies de página.
 */
const SUPERFICIE_EXPLICITA: Record<string, string> = { '--amount-sign': '--card-bg' };

function fondoHeredado(fgToken: string | null, vars: Record<string, string>): string | null {
  if (!fgToken) return null;
  const explicito = SUPERFICIE_EXPLICITA[fgToken];
  if (explicito) return resolver(`var(${explicito})`, vars);
  const base = fgToken.replace(/-fg(-secondary)?$/, '');
  return base !== fgToken ? resolver(`var(${base}-bg)`, vars) : null;
}

function tokenDe(valor: string): string | null {
  return valor.match(/^var\(\s*(--[a-z0-9-]+)/i)?.[1] ?? null;
}

/**
 * BL-Q4, hallazgo de auditoría A2 — `pares()` de arriba sólo barre `.css`; un `style={{color:…}}`
 * inline en un `.tsx` quedaba afuera del gate. Reusa el mismo `Par`/`resolver`/`ratio` de arriba,
 * mismo criterio (fondo de la MISMA declaración, si no hay se mide contra las 2 superficies de
 * página) — la única diferencia es CÓMO se extrae el par (brace-matching sobre `style={{…}}` en vez
 * de un selector CSS).
 *
 * Censo de `color:` fuera de `.css` (grep, 2026-09-21): 5 archivos. 4 caen acá (`App.tsx`, `Kit.tsx`,
 * `Marca.tsx`, `serviceIcons.tsx` — todos `style={{color:…}}` real). El 5º, `GraficosInteligencia.tsx`
 * (4 asignaciones), es `color` de un objeto `series` que `GraficoBarras.tsx:80` consume como
 * `backgroundColor` del RELLENO de la barra/punto de leyenda — nunca como `color` de texto; no hay
 * `style={{` ahí y el barrido de abajo correctamente no lo toca. Documentado, no ignorado (contrato
 * A2: "sumarlos al barrido o probar que no son texto sobre superficie").
 */
const TSX_FILES = import.meta.glob('../**/*.tsx', { query: '?raw', import: 'default', eager: true }) as Record<
  string,
  string
>;

function paresInline(): Par[] {
  const out: Par[] = [];
  for (const [archivo, src] of Object.entries(TSX_FILES)) {
    if (/\.test\.tsx$/.test(archivo)) continue;
    let i = 0;
    while ((i = src.indexOf('style={{', i)) !== -1) {
      const inicio = i + 'style={'.length; // apunta a la '{' interna del objeto
      let profundidad = 0;
      let fin = -1;
      for (let j = inicio; j < src.length; j++) {
        if (src[j] === '{') profundidad++;
        else if (src[j] === '}') {
          profundidad--;
          if (profundidad === 0) {
            fin = j;
            break;
          }
        }
      }
      if (fin === -1) break; // objeto sin cerrar (no debería pasar en TS válido) — no cuelga el barrido
      const cuerpo = src.slice(inicio, fin + 1);
      i = fin + 1;
      const fg = cuerpo.match(/(?:^|[,{\s])color\s*:\s*['"]([^'"]+)['"]/)?.[1];
      if (!fg || !/^var\(|^#/.test(fg)) continue;
      const bg = cuerpo.match(/(?:^|[,{\s])background(?:Color)?\s*:\s*['"]([^'"]+)['"]/)?.[1] ?? null;
      out.push({ archivo: archivo.replace('../', ''), selector: 'style={{…}} inline', fg, bg });
    }
  }
  return out;
}

describe('BL-Q4 — pares color/fondo PINTADOS en las pieles vigentes (>=4.5:1)', () => {
  const todos = pares();
  const inline = paresInline();

  it('control positivo: el barrido encuentra pares (no es un no-op)', () => {
    expect(todos.length).toBeGreaterThan(20);
    expect(todos.some((p) => p.bg !== null)).toBe(true);
  });

  it('control positivo (inline): el barrido de `style={{…}}` en .tsx encuentra pares', () => {
    expect(inline.length).toBeGreaterThan(0);
    expect(inline.some((p) => p.archivo.endsWith('Marca.tsx'))).toBe(true);
  });

  for (const [tema, vars] of Object.entries(VARS)) {
    it(`${tema}: ningún par pintado queda bajo AA sin deuda declarada`, () => {
      const fallas: string[] = [];
      let medidos = 0;
      for (const p of [...todos, ...inline]) {
        const tk = tokenDe(p.fg);
        if (tk && tk in DEUDA_CONOCIDA) continue;
        const fg = resolver(p.fg, vars);
        if (!fg) continue;
        const propio = p.bg ? resolver(p.bg, vars) : fondoHeredado(tk, vars);
        const superficies = p.bg || propio
          ? [propio]
          : [resolver('var(--bg)', vars), resolver('var(--card-bg)', vars)];
        for (const s of superficies) {
          if (!s) continue; // fondo gradiente/rgba: no computable acá (ver `themesContrast.test.ts`)
          medidos++;
          const r = ratio(fg, s);
          if (r < 4.5) fallas.push(`${p.archivo} «${p.selector}» ${p.fg}=${fg} sobre ${p.bg ?? 'página'}=${s} → ${r.toFixed(2)}:1`);
        }
      }
      expect(medidos).toBeGreaterThan(20);
      expect(fallas, `\n${fallas.join('\n')}\n`).toEqual([]);
    });
  }
});

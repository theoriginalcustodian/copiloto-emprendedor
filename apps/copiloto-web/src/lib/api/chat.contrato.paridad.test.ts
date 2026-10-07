import { describe, expect, it } from 'vitest';
// `?raw` (sufijo de Vite, texto crudo en build-time) en vez de `node:fs`/`node:url`: no hay
// `@types/node` en este proyecto -- mismo patrón que `chatNoHexLiterals.test.ts`. Cruza el root
// del proyecto sin problema (verificado).
import pySource from '../../../../../apps/copiloto/chat_contrato.py?raw';
import { CLAVES_DECLARADAS } from './chat.contrato';

/**
 * MECLAVESRESTO (FE2, mitad de `POST /chat`): el set TS y el set Python tienen que ser el mismo.
 * Ancla contra `ChatResponse` de ESTE árbol (`apps/copiloto-web/src/lib/api/types.ts`), el que corre
 * el PWA en vivo -- no la copia de `packages/core`, que consume mobile. Mismo patrón que
 * `me.contrato.paridad.test.ts` / `auth.contrato.paridad.test.ts` (MECLAVESCORE / MECLAVESRESTO).
 */

// `core.autocrlf=true` en Windows deja el .py con CRLF: sin normalizar, los `replace` de los
// controles buscan `\n`, no mutan nada, y el control pasa en vacío. Por eso se normaliza al leer.
function leerPython(): string {
  return (pySource as string).replace(/\r\n/g, '\n');
}

function clavesPython(fuente: string): string[] {
  const bloque = /CLAVES_CHAT\s*=\s*frozenset\(\{([\s\S]*?)\}\)/.exec(fuente);
  if (!bloque) {
    throw new Error('no encontré `CLAVES_CHAT = frozenset({...})` en apps/copiloto/chat_contrato.py');
  }
  return [...(bloque[1] ?? '').matchAll(/"([a-z_]+)"/g)].map((m) => m[1] ?? '');
}

function divergencias(ts: readonly string[], py: readonly string[]) {
  const enTs = new Set(ts);
  const enPy = new Set(py);
  return {
    soloTs: ts.filter((k) => !enPy.has(k)),
    soloPy: py.filter((k) => !enTs.has(k)),
  };
}

function mensajeDivergencia(d: ReturnType<typeof divergencias>): string {
  return [
    ...d.soloTs.map((k) => `"${k}" está en CLAVES_DECLARADAS (chat.contrato.ts) y NO en CLAVES_CHAT (chat_contrato.py)`),
    ...d.soloPy.map((k) => `"${k}" está en CLAVES_CHAT (chat_contrato.py) y NO en CLAVES_DECLARADAS (chat.contrato.ts)`),
  ].join('\n');
}

const TS = Object.keys(CLAVES_DECLARADAS);
const PY_REAL = clavesPython(leerPython());

describe('paridad POST /chat: CLAVES_DECLARADAS (TS) ↔ CLAVES_CHAT (Python)', () => {
  it('ambos lados declaran el mismo set de claves', () => {
    expect(PY_REAL.length, 'el parser no encontró claves en chat_contrato.py').toBeGreaterThan(0);
    const d = divergencias(TS, PY_REAL);
    expect([...d.soloTs, ...d.soloPy], mensajeDivergencia(d)).toEqual([]);
  });

  it('control: una clave de mentira en el lado TS se detecta y se nombra', () => {
    const d = divergencias([...TS, 'clave_de_mentira_ts'], PY_REAL);
    expect(d.soloTs).toEqual(['clave_de_mentira_ts']);
    expect(mensajeDivergencia(d)).toContain('"clave_de_mentira_ts" está en CLAVES_DECLARADAS');
  });

  it('control: una clave de mentira en el lado Python se detecta y se nombra', () => {
    const original = leerPython();
    const fuenteMentira = original.replace('"wf_id",', '"wf_id",\n    "clave_de_mentira_py",');
    expect(fuenteMentira, 'el mutante no cambió la fuente: el control no mira').not.toBe(original);
    const d = divergencias(TS, clavesPython(fuenteMentira));
    expect(d.soloPy).toEqual(['clave_de_mentira_py']);
    expect(mensajeDivergencia(d)).toContain('"clave_de_mentira_py" está en CLAVES_CHAT');
  });

  it('control: una clave quitada del lado Python se detecta (falta en Python)', () => {
    const original = leerPython();
    const fuenteSinUna = original.replace('    "accepted",\n', '');
    expect(fuenteSinUna, 'el mutante no quitó la clave: el control no mira').not.toBe(original);
    const d = divergencias(TS, clavesPython(fuenteSinUna));
    expect(d.soloTs).toEqual(['accepted']);
  });
});

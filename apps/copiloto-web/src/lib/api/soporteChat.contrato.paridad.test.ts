import { describe, expect, it } from 'vitest';
// `?raw` (sufijo de Vite, texto crudo en build-time) en vez de `node:fs`: no hay `@types/node` en este
// proyecto -- mismo patrón que `chat.contrato.paridad.test.ts`.
import pySource from '../../../../../apps/copiloto/chat_contrato.py?raw';
import { CLAVES_DECLARADAS } from './soporteChat.contrato';

/**
 * CONTRATO4: el set TS de POST /soporte/chat y `CLAVES_SOPORTE_CHAT` (Python) tienen que ser el mismo.
 * La paridad compara dos DECLARACIONES; que el set sea el `return` REAL del handler lo mide
 * `apps/copiloto/tests/test_chat_familia_contrato_return_real.py` (en CI, no sólo en el smoke).
 *
 * `chat_contrato.py` declara VARIOS sets: todo se acota al bloque `CLAVES_SOPORTE_CHAT = frozenset({...})`, para
 * que ni el parser ni los mutantes de los controles toquen el set de otro endpoint.
 */

const RE_BLOQUE = /CLAVES_SOPORTE_CHAT\s*=\s*frozenset\(\{([\s\S]*?)\}\)/;

// `core.autocrlf=true` en Windows deja el .py con CRLF: sin normalizar, los `replace` de los
// controles buscan `\n`, no mutan nada, y el control pasa en vacío. Por eso se normaliza al leer.
function leerPython(): string {
  return (pySource as string).replace(/\r\n/g, '\n');
}

function interiorDelBloque(fuente: string): string {
  const bloque = RE_BLOQUE.exec(fuente);
  if (!bloque) {
    throw new Error('no encontré `CLAVES_SOPORTE_CHAT = frozenset({...})` en apps/copiloto/chat_contrato.py');
  }
  return bloque[1] ?? '';
}

function clavesPython(fuente: string): string[] {
  return [...interiorDelBloque(fuente).matchAll(/"([a-z_]+)"/g)].map((m) => m[1] ?? '');
}

/** Aplica `mutar` SÓLO al interior del bloque de este set; el resto del archivo queda intacto. */
function mutarBloque(fuente: string, mutar: (interior: string) => string): string {
  return fuente.replace(RE_BLOQUE, (todo, interior: string) => todo.replace(interior, mutar(interior)));
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
    ...d.soloTs.map((k) => `"${k}" está en CLAVES_DECLARADAS (soporteChat.contrato.ts) y NO en CLAVES_SOPORTE_CHAT (chat_contrato.py)`),
    ...d.soloPy.map((k) => `"${k}" está en CLAVES_SOPORTE_CHAT (chat_contrato.py) y NO en CLAVES_DECLARADAS (soporteChat.contrato.ts)`),
  ].join('\n');
}

const TS = Object.keys(CLAVES_DECLARADAS);
const PY_REAL = clavesPython(leerPython());

describe('paridad POST /soporte/chat: CLAVES_DECLARADAS (TS) <-> CLAVES_SOPORTE_CHAT (Python)', () => {
  it('ambos lados declaran el mismo set de claves', () => {
    expect(PY_REAL.length, 'el parser no encontró claves en CLAVES_SOPORTE_CHAT').toBeGreaterThan(0);
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
    const fuenteMentira = mutarBloque(original, (i) => i.replace('"wf_id",', '"wf_id",\n    "clave_de_mentira_py",'));
    expect(fuenteMentira, 'el mutante no cambió la fuente: el control no mira').not.toBe(original);
    const d = divergencias(TS, clavesPython(fuenteMentira));
    expect(d.soloPy).toEqual(['clave_de_mentira_py']);
    expect(mensajeDivergencia(d)).toContain('"clave_de_mentira_py" está en CLAVES_SOPORTE_CHAT');
  });

  it('control: una clave quitada del lado Python se detecta (falta en Python)', () => {
    const original = leerPython();
    const fuenteSinUna = mutarBloque(original, (i) => i.replace('    "accepted",\n', ''));
    expect(fuenteSinUna, 'el mutante no quitó la clave: el control no mira').not.toBe(original);
    const d = divergencias(TS, clavesPython(fuenteSinUna));
    expect(d.soloTs).toEqual(['accepted']);
  });

  it('control: mutar el bloque de ESTE set no altera el de otro endpoint', () => {
    const original = leerPython();
    const mutada = mutarBloque(original, () => '\n');
    const otro = /CLAVES_CHAT\s*=\s*frozenset\(\{([\s\S]*?)\}\)/;
    expect(otro.exec(mutada)?.[1]).toBe(otro.exec(original)?.[1]);
  });
});

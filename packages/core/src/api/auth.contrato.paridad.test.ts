import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CLAVES_DECLARADAS } from './auth.contrato';

/**
 * MECLAVESRESTO (FE2, mitad de /auth/login): el set TS y el set Python tienen que ser el mismo. Sin
 * este test son dos listas sin prueba de que coinciden. El lado Python se lee como TEXTO (no se
 * importa): no hace falta bundler ni resolveJsonModule. Mismo patrón que `me.contrato.paridad.test.ts`
 * (MECLAVESCORE). Los controles positivos ejercitan la comparación con una clave de mentira en cada
 * lado: si no salen rojos, el test no mira.
 */

const RUTA_PY = fileURLToPath(new URL('../../../../apps/copiloto/auth_login_contrato.py', import.meta.url));

// `core.autocrlf=true` en Windows deja el .py con CRLF: sin normalizar, los `replace` de los controles
// buscan `\n`, no mutan nada, y el control pasa en vacío. Por eso se normaliza al leer, siempre.
function leerPython(): string {
  return readFileSync(RUTA_PY, 'utf8').replace(/\r\n/g, '\n');
}

function clavesPython(fuente: string): string[] {
  const bloque = /CLAVES_LOGIN\s*=\s*frozenset\(\{([\s\S]*?)\}\)/.exec(fuente);
  if (!bloque) {
    throw new Error('no encontré `CLAVES_LOGIN = frozenset({...})` en apps/copiloto/auth_login_contrato.py');
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
    ...d.soloTs.map((k) => `"${k}" está en CLAVES_DECLARADAS (auth.contrato.ts) y NO en CLAVES_LOGIN (auth_login_contrato.py)`),
    ...d.soloPy.map((k) => `"${k}" está en CLAVES_LOGIN (auth_login_contrato.py) y NO en CLAVES_DECLARADAS (auth.contrato.ts)`),
  ].join('\n');
}

const TS = Object.keys(CLAVES_DECLARADAS);
const PY_REAL = clavesPython(leerPython());

describe('paridad POST /auth/login: CLAVES_DECLARADAS (TS) ↔ CLAVES_LOGIN (Python)', () => {
  it('ambos lados declaran el mismo set de claves', () => {
    expect(PY_REAL.length, 'el parser no encontró claves en auth_login_contrato.py').toBeGreaterThan(0);
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
    const fuenteMentira = original.replace('"access_token",', '"access_token",\n    "clave_de_mentira_py",');
    // Un control que no muta la fuente no prueba nada: que falle aquí, no que pase en silencio.
    expect(fuenteMentira, 'el mutante no cambió la fuente: el control no mira').not.toBe(original);
    const d = divergencias(TS, clavesPython(fuenteMentira));
    expect(d.soloPy).toEqual(['clave_de_mentira_py']);
    expect(mensajeDivergencia(d)).toContain('"clave_de_mentira_py" está en CLAVES_LOGIN');
  });

  it('control: una clave quitada del lado Python se detecta (falta en Python)', () => {
    const original = leerPython();
    const fuenteSinUna = original.replace('    "refresh_token",\n', '');
    expect(fuenteSinUna, 'el mutante no quitó la clave: el control no mira').not.toBe(original);
    const d = divergencias(TS, clavesPython(fuenteSinUna));
    expect(d.soloTs).toEqual(['refresh_token']);
  });
});

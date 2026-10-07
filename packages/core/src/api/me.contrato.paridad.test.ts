import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CLAVES_DECLARADAS } from './me.contrato';

/**
 * MECLAVESCORE (FE2): el set TS de `/me` y el set Python tienen que ser el mismo. Sin este test son dos
 * listas sin prueba de que coinciden. El lado Python se lee como TEXTO (no se importa): no hace falta
 * bundler ni resolveJsonModule. Los controles positivos ejercitan la comparación con una clave de mentira
 * en cada lado: si no salen rojos, el test no mira.
 */

const RUTA_PY = fileURLToPath(new URL('../../../../apps/copiloto/me_contrato.py', import.meta.url));

function clavesPython(fuente: string): string[] {
  const bloque = /CLAVES_ME\s*=\s*frozenset\(\{([\s\S]*?)\}\)/.exec(fuente);
  if (!bloque) throw new Error('no encontré `CLAVES_ME = frozenset({...})` en apps/copiloto/me_contrato.py');
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
    ...d.soloTs.map((k) => `"${k}" está en CLAVES_DECLARADAS (me.contrato.ts) y NO en CLAVES_ME (me_contrato.py)`),
    ...d.soloPy.map((k) => `"${k}" está en CLAVES_ME (me_contrato.py) y NO en CLAVES_DECLARADAS (me.contrato.ts)`),
  ].join('\n');
}

const TS = Object.keys(CLAVES_DECLARADAS);
const PY_REAL = clavesPython(readFileSync(RUTA_PY, 'utf8'));

describe('paridad GET /me: CLAVES_DECLARADAS (TS) ↔ CLAVES_ME (Python)', () => {
  it('ambos lados declaran el mismo set de claves', () => {
    expect(PY_REAL.length, 'el parser no encontró claves en me_contrato.py').toBeGreaterThan(0);
    const d = divergencias(TS, PY_REAL);
    expect([...d.soloTs, ...d.soloPy], mensajeDivergencia(d)).toEqual([]);
  });

  it('control: una clave de mentira en el lado TS se detecta y se nombra', () => {
    const d = divergencias([...TS, 'clave_de_mentira_ts'], PY_REAL);
    expect(d.soloTs).toEqual(['clave_de_mentira_ts']);
    expect(mensajeDivergencia(d)).toContain('"clave_de_mentira_ts" está en CLAVES_DECLARADAS');
  });

  it('control: una clave de mentira en el lado Python se detecta y se nombra', () => {
    const fuenteMentira = readFileSync(RUTA_PY, 'utf8').replace(
      '"cliente_id",',
      '"cliente_id",\n    "clave_de_mentira_py",',
    );
    const d = divergencias(TS, clavesPython(fuenteMentira));
    expect(d.soloPy).toEqual(['clave_de_mentira_py']);
    expect(mensajeDivergencia(d)).toContain('"clave_de_mentira_py" está en CLAVES_ME');
  });

  it('control: una clave quitada del lado Python se detecta (falta en Python)', () => {
    const fuenteSinUna = readFileSync(RUTA_PY, 'utf8').replace('    "legal_version_aceptada",\n', '');
    const d = divergencias(TS, clavesPython(fuenteSinUna));
    expect(d.soloTs).toEqual(['legal_version_aceptada']);
  });
});

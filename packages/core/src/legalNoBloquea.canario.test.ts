import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * SM-C4 — CANARIO INVERTIDO de «la aceptación legal INFORMA, no BLOQUEA» (lado frontend).
 *
 * Regla vigente (decisión del operador 2026-10-13, `LEGALNOOPERA`): una cuenta con
 * `legal_aceptado = false` opera igual. Las dos plataformas **informan** la versión aceptada
 * (`descripcionLegal`, 4 estados) y nada más. La versión anterior del DoD pedía «cuenta sin
 * aceptación es rechazada al operar»: está RETIRADA, y este test es lo que impide que reaparezca
 * por la puerta de atrás.
 *
 * Qué NO hace: no exige una UI ni un rechazo que no existen (nacería rojo y se volvería escudo de
 * los rojos propios — mismo patrón que `test_hitl_card_editable_canario.py`, #1146). Mira la LECTURA:
 * hoy el único código de producción que *lee* los campos de aceptación es `descripcionLegal`, y éste
 * se pone rojo el día que alguien los lea en otro lado (donde podría colgar un guard).
 *
 * Qué cuenta como «leer» un campo de aceptación en un archivo de producción de las tres bases
 * (`packages/core`, `apps/mobile`, `apps/copiloto-web`):
 *   · declarar/emitir el campo (`legal_aceptado: …` en un tipo, un contrato, un mock) → DATO, permitido;
 *   · un comentario → permitido;
 *   · cualquier otra mención (`me.legal_aceptado`, `if (…)`, `?.`, desestructurar) → LECTURA: sólo
 *     `packages/core/src/legal.ts` puede, y ahí dentro no puede lanzar ni redirigir;
 *   · `descripcionLegal(...)` sólo como texto de un nodo (`{descripcionLegal(me)}`): nunca en un
 *     `if`, un `disabled=`, un `&&`.
 *
 * ⚠️ Limitaciones declaradas: es estático. Un guard armado con el campo renombrado o leído por clave
 * dinámica (`me[k]`) no lo caza; lo que caza es el camino natural (el campo con su nombre del wire).
 * El lado backend (ningún handler rechaza por la aceptación) es `test_legal_no_bloquea_canario.py`.
 *
 * Control positivo (por qué este test no es ciego): `auditar` corre sobre fuentes mutadas en memoria
 * —un consumidor nuevo, un `if` en un archivo permitido, un `descripcionLegal` en un `disabled`— y
 * TIENE que acusar cada una; y el recorrido real exige haber mirado > 0 archivos y > 0 campos.
 */

const RAIZ_REPO = fileURLToPath(new URL('../../..', import.meta.url));
const RAICES = ['packages/core/src', 'apps/mobile/src', 'apps/mobile/app', 'apps/copiloto-web/src'];

/** El único archivo donde leer los campos es legal (`descripcionLegal` decide TEXTO, no acceso). */
const UNICO_LECTOR = 'packages/core/src/legal.ts';

const CAMPO = /\b(legal_aceptado|legal_version_aceptada|legalAceptado|legalVersionAceptada)\b/;
/** Declaración/valor de propiedad: `legal_aceptado: …`, `legal_aceptado?: …`, `'legal_aceptado',`. */
const LINEA_DE_DATO = /^\s*(?:\w+\s*,\s*)*['"]?(legal_aceptado|legal_version_aceptada)['"]?\??\s*[:,]/;
const NUNCA_EN_EL_LECTOR = /\b(throw|disabled|navigate|redirect|reject|Alert\.alert)\b/;
const USO_DE_DESCRIPCION = /\bdescripcionLegal\b/;
const USO_COMO_TEXTO = /\{\s*descripcionLegal\(/;
const DEFINICION_O_IMPORT = /\bexport\s+function\s+descripcionLegal\b|\bimport\b[^;]*\bdescripcionLegal\b|\bexport\b[^;]*\bdescripcionLegal\b/;

export interface Fuente {
  ruta: string; // relativa a la raíz del repo, con `/`
  texto: string;
}

const QUE_HACER =
  'La aceptación legal INFORMA, no bloquea (decisión 2026-10-13, LEGALNOOPERA). Si lo que agregás es ' +
  'una vista que muestra la versión aceptada, usá `descripcionLegal(me)` de core como texto. Si es un ' +
  'guard (rechazar, deshabilitar, ocultar una acción por `legal_aceptado=false`), ese camino está ' +
  'RETIRADO: es una decisión del operador, no se relaja este test a mano ni con --no-verify.';

// Saca los comentarios conservando los saltos de línea (los números de línea del reporte no se
// corren). Cubre los bloques en varias líneas —incluido el comentario de JSX, cuya prosa no empieza
// con asterisco— y el de línea precedido de espacio, para no confundir una URL con un comentario.
function sinComentarios(texto: string): string {
  const sinBloques = texto.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  return sinBloques.replace(/(^|\s)\/\/.*$/gm, '$1');
}

/** Devuelve las violaciones; vacío = nadie lee la aceptación para decidir acceso. */
export function auditar(fuentes: Fuente[]): { violaciones: string[]; campos: number } {
  const violaciones: string[] = [];
  let campos = 0;
  for (const { ruta, texto } of fuentes) {
    const lineas = sinComentarios(texto).split(/\r?\n/);
    lineas.forEach((linea, i) => {
      const donde = `${ruta}:${i + 1}`;
      if (CAMPO.test(linea)) {
        campos += 1;
        const esDato = LINEA_DE_DATO.test(linea) || /\blegal_aceptado\??:\s*\w+,\s*legal_version_aceptada/.test(linea);
        if (!esDato) {
          if (ruta !== UNICO_LECTOR) {
            violaciones.push(`${donde} LEE un campo de aceptación fuera de core/legal.ts: ${linea.trim()}`);
          } else if (NUNCA_EN_EL_LECTOR.test(linea)) {
            violaciones.push(`${donde} el lector de la aceptación lanza/redirige/deshabilita: ${linea.trim()}`);
          }
        }
      }
      if (USO_DE_DESCRIPCION.test(linea) && !DEFINICION_O_IMPORT.test(linea)) {
        if (!USO_COMO_TEXTO.test(linea) || /\b(if|disabled|&&|\|\|)\b|\?\s/.test(linea)) {
          violaciones.push(`${donde} \`descripcionLegal\` usada para decidir, no como texto: ${linea.trim()}`);
        }
      }
    });
  }
  return { violaciones, campos };
}

function esProduccion(ruta: string): boolean {
  if (!/\.(ts|tsx)$/.test(ruta)) return false;
  if (/\.(test|spec)\.(ts|tsx)$/.test(ruta)) return false;
  return !/(^|\/)(node_modules|__fixtures__|__mocks__)\//.test(ruta);
}

function recorrer(dir: string, acc: string[] = []): string[] {
  for (const nombre of readdirSync(dir)) {
    if (nombre === 'node_modules') continue;
    const abs = join(dir, nombre);
    if (statSync(abs).isDirectory()) recorrer(abs, acc);
    else acc.push(abs);
  }
  return acc;
}

function fuentesReales(): Fuente[] {
  const out: Fuente[] = [];
  for (const raiz of RAICES) {
    const abs = join(RAIZ_REPO, raiz);
    let archivos: string[] = [];
    try {
      archivos = recorrer(abs);
    } catch {
      continue; // `apps/mobile/app` puede no existir en todos los árboles
    }
    for (const a of archivos) {
      const ruta = relative(RAIZ_REPO, a).split(sep).join('/');
      if (esProduccion(ruta)) out.push({ ruta, texto: readFileSync(a, 'utf8') });
    }
  }
  return out;
}

describe('SM-C4 · la aceptación legal informa, no bloquea (canario invertido, frontend)', () => {
  it('ningún código de producción lee la aceptación para decidir acceso', () => {
    const fuentes = fuentesReales();
    expect(fuentes.length, 'el recorrido miró 0 archivos: pasa siempre y no prueba nada').toBeGreaterThan(50);
    const { violaciones, campos } = auditar(fuentes);
    expect(campos, 'no encontró ni un campo de aceptación: el canario está ciego').toBeGreaterThan(0);
    expect(violaciones, `${QUE_HACER}\n${violaciones.join('\n')}`).toEqual([]);
  });

  it('el lector permitido existe y es el que informa (denominador del canario)', () => {
    const legal = fuentesReales().find((f) => f.ruta === UNICO_LECTOR);
    expect(legal, `${UNICO_LECTOR} no existe: el canario perdió su único lector permitido`).toBeDefined();
    expect(legal!.texto).toMatch(/export function descripcionLegal\(/);
  });

  describe('CONTROL POSITIVO — el mismo verificador TIENE que acusar cada guard', () => {
    const limpio: Fuente = { ruta: 'apps/mobile/src/x/PantallaX.tsx', texto: 'const a = 1;\n' };

    it('un consumidor nuevo que lee el campo para decidir', () => {
      const { violaciones } = auditar([
        limpio,
        { ruta: 'apps/mobile/src/shell/Guard.tsx', texto: 'if (!me.legal_aceptado) return null;\n' },
      ]);
      expect(violaciones).toHaveLength(1);
      expect(violaciones[0]).toContain('Guard.tsx:1');
    });

    it('un guard por la versión (la otra mitad del par)', () => {
      const { violaciones } = auditar([
        { ruta: 'apps/copiloto-web/src/modules/chat/Composer.tsx', texto: 'const bloqueado = me?.legal_version_aceptada === null;\n' },
      ]);
      expect(violaciones).toHaveLength(1);
    });

    it('descripcionLegal usada para decidir, no como texto', () => {
      const { violaciones } = auditar([
        { ruta: 'apps/mobile/src/x/Boton.tsx', texto: '<Pressable disabled={descripcionLegal(me).startsWith("Todavía")} />\n' },
      ]);
      expect(violaciones).toHaveLength(1);
    });

    it('el lector permitido que empieza a lanzar', () => {
      const { violaciones } = auditar([
        { ruta: UNICO_LECTOR, texto: 'if (!me.legal_aceptado) throw new Error("legal");\n' },
      ]);
      expect(violaciones).toHaveLength(1);
    });

    it('la prosa de un comentario (de bloque o de JSX) que nombra el campo NO acusa', () => {
      const { violaciones } = auditar([
        {
          ruta: 'apps/mobile/src/modules/ajustes/PantallaCuenta.tsx',
          texto: '{/* La lógica es descripcionLegal de core.\n   Si me.legal_aceptado es false, se informa. */}\n// if (!me.legal_aceptado) return;\n',
        },
      ]);
      expect(violaciones).toEqual([]);
    });

    it('los usos legítimos NO acusan (el verificador no es un falso rojo)', () => {
      const { violaciones, campos } = auditar([
        { ruta: 'packages/core/src/api/types.ts', texto: '  legal_aceptado: boolean;\n  legal_version_aceptada: string | null;\n' },
        { ruta: 'packages/core/src/api/me.contrato.ts', texto: "  legal_aceptado: true,\n  legal_version_aceptada: null,\n" },
        { ruta: 'apps/copiloto-web/src/lib/api/mock.ts', texto: '      legal_aceptado: true, legal_version_aceptada: LEGAL_VERSION,\n' },
        { ruta: 'apps/mobile/src/modules/ajustes/PantallaCuenta.tsx', texto: "import { descripcionLegal } from '@copiloto/core';\n<Text>{descripcionLegal(me)}</Text>\n" },
        { ruta: UNICO_LECTOR, texto: 'if (me.legal_aceptado) return `Aceptaste (${me.legal_version_aceptada}).`;\n' },
      ]);
      expect(campos).toBeGreaterThan(0);
      expect(violaciones).toEqual([]);
    });
  });
});

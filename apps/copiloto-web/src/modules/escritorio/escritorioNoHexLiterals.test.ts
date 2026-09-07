import { describe, expect, it } from 'vitest';

/* eslint-disable import/no-unresolved -- `?raw` es una convención de Vite (import de texto
   crudo), no un módulo real (mismo patrón que modules/account/accountNoHexLiterals.test.ts). */
import escritorioCss from './escritorio.css?raw';
import escritorioScreenSource from './EscritorioScreen.tsx?raw';

/**
 * Gate "cero color literal" (Global Constraint del plan: "Ningún componente usa color literal —
 * todo token"), acotado al módulo Escritorio. Mismo criterio que
 * `modules/account/accountNoHexLiterals.test.ts`.
 *
 * Diferencia con el patrón original: acá los comentarios se descartan antes de buscar. Una
 * referencia a un PR (`#372`, `#295`) matchea `#[0-9a-fA-F]{3,8}` porque los dígitos son hex
 * válidos, y este módulo tiene esas referencias en sus docstrings. Los 7 archivos gateados
 * antes que este no las tenían, así que el falso positivo nunca había disparado — el gate viejo
 * no es más estricto, sólo tuvo suerte con su muestra.
 */
const HEX_COLOR_RE = /#[0-9a-fA-F]{3,8}\b/g;

/** Descarta comentarios de bloque y de línea; `//` precedido de `:` (URLs) no cuenta. */
const sinComentarios = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(?<!:)\/\/.*$/gm, '');

const SOURCES: Record<string, string> = {
  'escritorio.css': escritorioCss,
  'EscritorioScreen.tsx': escritorioScreenSource,
};

describe('módulo escritorio — cero color literal (hex)', () => {
  it.each(Object.entries(SOURCES))('%s no tiene hex literales de color', (_name, source) => {
    const matches = sinComentarios(source).match(HEX_COLOR_RE) ?? [];
    expect(matches, `hex literales encontrados: ${matches.join(', ')}`).toHaveLength(0);
  });
});

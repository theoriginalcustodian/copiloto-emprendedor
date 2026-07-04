import { describe, expect, it } from 'vitest';

// eslint-disable-next-line import/no-unresolved -- `?raw` es una convención de Vite (import de
// texto crudo), no un módulo real (mismo patrón que modules/connections/connectionsNoHexLiterals.test.ts).
import appsCss from './apps.css?raw';
import appsScreenSource from './AppsScreen.tsx?raw';
import modeButtonSource from './ModeButton.tsx?raw';

/**
 * Gate "cero color literal" (Global Constraint del plan: "Ningún componente usa color literal —
 * todo token"), acotado a mi ownership del módulo Apps. `shell/shellNoHexLiterals.test.ts` (fuera
 * de mi ownership) ya escanea `AppsScreen.tsx` también — este test cubre el resto del módulo
 * (`ModeButton.tsx`, `apps.css`) que ese gate no toca, mismo criterio que
 * `modules/connections/connectionsNoHexLiterals.test.ts`.
 */
const HEX_COLOR_RE = /#[0-9a-fA-F]{3,8}\b/g;

const SOURCES: Record<string, string> = {
  'AppsScreen.tsx': appsScreenSource,
  'ModeButton.tsx': modeButtonSource,
  'apps.css': appsCss,
};

describe('módulo apps — cero color literal (hex)', () => {
  it.each(Object.entries(SOURCES))('%s no tiene hex literales de color', (_name, source) => {
    const matches = source.match(HEX_COLOR_RE) ?? [];
    expect(matches, `hex literales encontrados: ${matches.join(', ')}`).toHaveLength(0);
  });
});

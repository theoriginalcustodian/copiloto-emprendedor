import { describe, expect, it } from 'vitest';

// eslint-disable-next-line import/no-unresolved -- `?raw` es una convención de Vite (import de
// texto crudo), no un módulo real (mismo patrón que modules/connections/connectionsNoHexLiterals.test.ts).
import accountCss from './account.css?raw';
import accountScreenSource from './AccountScreen.tsx?raw';

/**
 * Gate "cero color literal" (Global Constraint del plan: "Ningún componente usa color literal —
 * todo token"), acotado a mi ownership de este Task (módulo Cuenta). Mismo criterio que
 * `modules/connections/connectionsNoHexLiterals.test.ts` / `modules/chat/chatNoHexLiterals.test.ts`.
 */
const HEX_COLOR_RE = /#[0-9a-fA-F]{3,8}\b/g;

const SOURCES: Record<string, string> = {
  'AccountScreen.tsx': accountScreenSource,
  'account.css': accountCss,
};

describe('módulo account — cero color literal (hex)', () => {
  it.each(Object.entries(SOURCES))('%s no tiene hex literales de color', (_name, source) => {
    const matches = source.match(HEX_COLOR_RE) ?? [];
    expect(matches, `hex literales encontrados: ${matches.join(', ')}`).toHaveLength(0);
  });
});

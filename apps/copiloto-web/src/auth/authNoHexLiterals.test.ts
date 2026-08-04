import { describe, expect, it } from 'vitest';

// eslint-disable-next-line import/no-unresolved -- `?raw` es una convención de Vite (import de
// texto crudo), no un módulo real (mismo patrón que modules/connections/connectionsNoHexLiterals.test.ts).
import loginCss from './login.css?raw';
import legalScreenSource from './LegalScreen.tsx?raw';
import loginScreenSource from './LoginScreen.tsx?raw';
import signupScreenSource from './SignupScreen.tsx?raw';

/**
 * Gate "cero color literal" (Global Constraint del plan: "Ningún componente usa color literal —
 * todo token"), acotado a mi ownership de este Task (LoginScreen, Task 22 + SignupScreen/
 * LegalScreen, BETA-4b/2.a). Mismo criterio que `modules/account/accountNoHexLiterals.test.ts` /
 * `shell/shellNoHexLiterals.test.ts`.
 */
const HEX_COLOR_RE = /#[0-9a-fA-F]{3,8}\b/g;

const SOURCES: Record<string, string> = {
  'LoginScreen.tsx': loginScreenSource,
  'SignupScreen.tsx': signupScreenSource,
  'LegalScreen.tsx': legalScreenSource,
  'login.css': loginCss,
};

describe('LoginScreen — cero color literal (hex)', () => {
  it.each(Object.entries(SOURCES))('%s no tiene hex literales de color', (_name, source) => {
    const matches = source.match(HEX_COLOR_RE) ?? [];
    expect(matches, `hex literales encontrados: ${matches.join(', ')}`).toHaveLength(0);
  });
});

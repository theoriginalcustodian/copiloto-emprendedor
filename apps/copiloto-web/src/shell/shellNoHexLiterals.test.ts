import { describe, expect, it } from 'vitest';

// eslint-disable-next-line import/no-unresolved -- `?raw` es una convención de Vite (import de
// texto crudo), no un módulo real (mismo patrón que modules/chat/chatNoHexLiterals.test.ts).
import appShellSource from './AppShell.tsx?raw';
import shellCss from './shell.css?raw';
import tabBarSource from './TabBar.tsx?raw';
import accountScreenSource from '../modules/account/AccountScreen.tsx?raw';
import appsScreenSource from '../modules/apps/AppsScreen.tsx?raw';
import connectionsScreenSource from '../modules/connections/ConnectionsScreen.tsx?raw';

/**
 * Gate "cero color literal" (Global Constraint del plan: "Ningún componente usa color literal —
 * todo token"), acotado a mi ownership de este Task (shell/** + los 3 placeholders de módulo).
 * Mismo criterio que `modules/chat/chatNoHexLiterals.test.ts`.
 */
const HEX_COLOR_RE = /#[0-9a-fA-F]{3,8}\b/g;

const SOURCES: Record<string, string> = {
  'AppShell.tsx': appShellSource,
  'TabBar.tsx': tabBarSource,
  'shell.css': shellCss,
  'modules/apps/AppsScreen.tsx': appsScreenSource,
  'modules/connections/ConnectionsScreen.tsx': connectionsScreenSource,
  'modules/account/AccountScreen.tsx': accountScreenSource,
};

describe('shell + placeholders de módulo — cero color literal (hex)', () => {
  it.each(Object.entries(SOURCES))('%s no tiene hex literales de color', (_name, source) => {
    const matches = source.match(HEX_COLOR_RE) ?? [];
    expect(matches, `hex literales encontrados: ${matches.join(', ')}`).toHaveLength(0);
  });
});

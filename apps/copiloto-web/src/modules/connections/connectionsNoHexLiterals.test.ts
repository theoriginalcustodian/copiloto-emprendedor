import { describe, expect, it } from 'vitest';

// eslint-disable-next-line import/no-unresolved -- `?raw` es una convención de Vite (import de
// texto crudo), no un módulo real (mismo patrón que modules/chat/chatNoHexLiterals.test.ts).
import connectionsCss from './connections.css?raw';
import connectionsScreenSource from './ConnectionsScreen.tsx?raw';
import serviceCardSource from './ServiceCard.tsx?raw';
import useConnectionsSource from './useConnections.ts?raw';

/**
 * Gate "cero color literal" (Global Constraint del plan: "Ningún componente usa color literal —
 * todo token"), acotado a mi ownership de este Task (módulo Conexiones). Mismo criterio que
 * `modules/chat/chatNoHexLiterals.test.ts`. `shell/shellNoHexLiterals.test.ts` (fuera de mi
 * ownership) ya escanea `ConnectionsScreen.tsx` también — este test cubre el resto del módulo
 * (`ServiceCard.tsx`, `useConnections.ts`, `connections.css`) que ese gate no toca.
 */
const HEX_COLOR_RE = /#[0-9a-fA-F]{3,8}\b/g;

const SOURCES: Record<string, string> = {
  'ConnectionsScreen.tsx': connectionsScreenSource,
  'ServiceCard.tsx': serviceCardSource,
  'useConnections.ts': useConnectionsSource,
  'connections.css': connectionsCss,
};

describe('módulo connections — cero color literal (hex)', () => {
  it.each(Object.entries(SOURCES))('%s no tiene hex literales de color', (_name, source) => {
    const matches = source.match(HEX_COLOR_RE) ?? [];
    expect(matches, `hex literales encontrados: ${matches.join(', ')}`).toHaveLength(0);
  });
});

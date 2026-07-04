import { describe, expect, it } from 'vitest';

// eslint-disable-next-line import/no-unresolved -- `?raw` es una convención de Vite (import de
// texto crudo), no un módulo real; no hay @types/node en el proyecto así que evitamos fs/path.
import bubbleSource from './Bubble.tsx?raw';
import chatCss from './chat.css?raw';
import chatHeaderSource from './ChatHeader.tsx?raw';
import chatScreenSource from './ChatScreen.tsx?raw';
import composerSource from './Composer.tsx?raw';
import disambiguationChipsSource from './DisambiguationChips.tsx?raw';
import hitlCardSource from './HitlCard.tsx?raw';
import hitlMappingSource from './hitlMapping.ts?raw';
import messageListSource from './MessageList.tsx?raw';
import micButtonSource from './MicButton.tsx?raw';
import recordingOverlaySource from './RecordingOverlay.tsx?raw';

/**
 * Gate "cero color literal" (Global Constraint del plan: "Ningún componente usa color literal —
 * todo token"). Escanea el código fuente del módulo Chat (mi ownership) buscando literales hex
 * (`#rgb`/`#rrggbb`/`#rrggbbaa`) — deben ser 0. Usa imports `?raw` de Vite en vez de `node:fs`
 * porque el proyecto no tiene `@types/node` instalado (agregarlo es una decisión de tooling fuera
 * de mi ownership — ver report).
 *
 * Excepciones documentadas en chat.css (`--brand-instagram`, keyword `white`) usan `var(--token)`
 * o keywords CSS, nunca hex, así que no rompen este gate.
 */
const HEX_COLOR_RE = /#[0-9a-fA-F]{3,8}\b/g;

const SOURCES: Record<string, string> = {
  'Bubble.tsx': bubbleSource,
  'ChatHeader.tsx': chatHeaderSource,
  'ChatScreen.tsx': chatScreenSource,
  'Composer.tsx': composerSource,
  'DisambiguationChips.tsx': disambiguationChipsSource,
  'HitlCard.tsx': hitlCardSource,
  'hitlMapping.ts': hitlMappingSource,
  'MessageList.tsx': messageListSource,
  'MicButton.tsx': micButtonSource,
  'RecordingOverlay.tsx': recordingOverlaySource,
  'chat.css': chatCss,
};

describe('módulo chat — cero color literal (hex)', () => {
  it.each(Object.entries(SOURCES))('%s no tiene hex literales de color', (_name, source) => {
    const matches = source.match(HEX_COLOR_RE) ?? [];
    expect(matches, `hex literales encontrados: ${matches.join(', ')}`).toHaveLength(0);
  });
});

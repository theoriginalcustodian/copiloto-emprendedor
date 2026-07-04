import { describe, expect, it } from 'vitest';

// eslint-disable-next-line import/no-unresolved -- `?raw` es una convención de Vite (import de
// texto crudo), mismo patrón que `shellNoHexLiterals.test.ts`.
import desktopShellSource from './DesktopShell.tsx?raw';
import desktopCss from './desktop.css?raw';
import railSource from './Rail.tsx?raw';
import responsiveShellSource from './ResponsiveShell.tsx?raw';
import useBreakpointSource from './useBreakpoint.ts?raw';
import fontsWebCss from '../design-system/fonts-web.css?raw';

/**
 * Gate "cero color literal" (mismo criterio que `shellNoHexLiterals.test.ts`), acotado al
 * ownership de este task (shell de escritorio + `fonts-web.css`). Los colores de preview de skin
 * (`--skin-preview-*`) y el fondo de ítem activo (`--nav-active`) viven como TOKENS en
 * `themes.css` (excluido de este gate, igual que el resto de sus `--brand-*` — es la fuente de
 * los tokens, no un consumidor) — acá solo se consumen vía `var(--...)`.
 */
const HEX_COLOR_RE = /#[0-9a-fA-F]{3,8}\b/g;

const SOURCES: Record<string, string> = {
  'DesktopShell.tsx': desktopShellSource,
  'Rail.tsx': railSource,
  'ResponsiveShell.tsx': responsiveShellSource,
  'useBreakpoint.ts': useBreakpointSource,
  'desktop.css': desktopCss,
  '../design-system/fonts-web.css': fontsWebCss,
};

describe('shell de escritorio + fonts-web — cero color literal (hex)', () => {
  it.each(Object.entries(SOURCES))('%s no tiene hex literales de color', (_name, source) => {
    const matches = source.match(HEX_COLOR_RE) ?? [];
    expect(matches, `hex literales encontrados: ${matches.join(', ')}`).toHaveLength(0);
  });
});

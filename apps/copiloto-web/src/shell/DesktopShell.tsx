import { useState } from 'react';

import { ChatScreen } from '../modules/chat';
import { AppsScreen } from '../modules/apps';
import { ConnectionsScreen } from '../modules/connections';
import { AccountScreen } from '../modules/account';
import { Rail } from './Rail';
import { type TabKey } from './TabBar';
import './desktop.css';

const DEFAULT_TAB: TabKey = 'chat';

/**
 * Shell de escritorio (DESIGN-SYSTEM-EXTRACT-WEB.md §3/§4): Rail lateral + columna de contenido a
 * pantalla completa. Mismo criterio de navegación que `AppShell.tsx` (mobile) — estado local
 * (`useState<TabKey>`), NO react-router, mismas 4 pantallas de módulo montadas TAL CUAL (cero
 * lógica nueva de escritorio; este componente es una capa de presentación).
 *
 * `data-shell="desktop"` en la raíz es el ÚNICO acoplamiento con la tipografía web
 * (`fonts-web.css` lo lee para resolver `--font-display`/`--font-body` a Space Grotesk/Manrope) —
 * el resto del design-system (temas, escala, `--font-mono`) es 100% compartido con mobile.
 */
export function DesktopShell() {
  const [activeTab, setActiveTab] = useState<TabKey>(DEFAULT_TAB);

  return (
    <div className="desktop-shell" data-shell="desktop" data-testid="desktop-shell">
      <Rail active={activeTab} onChange={setActiveTab} />
      <main className="desktop-shell__content" data-testid="desktop-shell-content">
        {activeTab === 'chat' && <ChatScreen />}
        {activeTab === 'apps' && (
          <AppsScreen onGoToConnections={() => setActiveTab('connections')} />
        )}
        {activeTab === 'connections' && <ConnectionsScreen />}
        {activeTab === 'account' && <AccountScreen />}
      </main>
    </div>
  );
}

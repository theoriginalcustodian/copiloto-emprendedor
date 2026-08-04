import { useCallback, useState } from 'react';

import { ChatScreen } from '../modules/chat';
import { AppsScreen } from '../modules/apps';
import { ConnectionsScreen } from '../modules/connections';
import { GastosScreen } from '../modules/gastos';
import { ClientesScreen } from '../modules/clientes';
import { AccountScreen } from '../modules/account';
import { AppsModal } from './AppsModal';
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
 *
 * "Apps" (gap estructural #1 del audit desktop) NO es una pantalla de tab: el diseño
 * (`Copiloto Web.dc.html:363-402`) la presenta como un MODAL centrado, overlay sobre lo que sea que
 * esté activo detrás (`AppsModal`, hermano de `<main>`, no un reemplazo de su contenido). Por eso
 * `activeTab` nunca vale `'apps'` — el ítem "Apps" del Rail abre `appsModalOpen` en vez de navegar,
 * y `chat`/`connections`/`account` siguen montados debajo sin interrupción.
 */
export interface DesktopShellProps {
  /** BETA-4b: mismo criterio que `AppShell.initialTab` — ver su docstring. */
  initialTab?: TabKey;
}

export function DesktopShell({ initialTab }: DesktopShellProps = {}) {
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab ?? DEFAULT_TAB);
  const [appsModalOpen, setAppsModalOpen] = useState(false);
  // `AppsModal` queda SIEMPRE montado (necesario para animar el cierre) — sin este gate,
  // `AppsScreen` (y su `useConnections()`/fetch a `/catalog`) montaría en cada carga del shell
  // aunque el usuario nunca abra "Apps". Se vuelve `true` en la primera apertura y no resetea.
  const [appsEverOpened, setAppsEverOpened] = useState(false);

  const handleTabChange = useCallback((key: TabKey) => {
    if (key === 'apps') {
      setAppsModalOpen(true);
      setAppsEverOpened(true);
      return;
    }
    setActiveTab(key);
  }, []);

  const closeAppsModal = useCallback(() => setAppsModalOpen(false), []);

  const goToConnectionsFromApps = useCallback(() => {
    setAppsModalOpen(false);
    setActiveTab('connections');
  }, []);

  return (
    <div className="desktop-shell" data-shell="desktop" data-testid="desktop-shell">
      <Rail active={activeTab} onChange={handleTabChange} />
      <main className="desktop-shell__content" data-testid="desktop-shell-content">
        {activeTab === 'chat' && <ChatScreen variant="desktop" />}
        {activeTab === 'connections' && <ConnectionsScreen />}
        {activeTab === 'gastos' && <GastosScreen />}
        {activeTab === 'clientes' && <ClientesScreen />}
        {activeTab === 'account' && <AccountScreen />}
      </main>
      <AppsModal open={appsModalOpen} onClose={closeAppsModal}>
        {appsEverOpened && <AppsScreen onGoToConnections={goToConnectionsFromApps} />}
      </AppsModal>
    </div>
  );
}

import { useState } from 'react';

import { ChatScreen } from '../modules/chat';
import { AppsScreen } from '../modules/apps';
import { ConnectionsScreen } from '../modules/connections';
import { AccountScreen } from '../modules/account';
import { TabBar, type TabKey } from './TabBar';
import './shell.css';

const DEFAULT_TAB: TabKey = 'chat';

/**
 * Shell mobile (Task 9, EXTRACT §2.3/§4): contenedor de navegación con tab-bar flotante que
 * envuelve las 4 pantallas de módulo. Navega por ESTADO LOCAL (`useState`), NO react-router: los
 * tabs no tienen URL propia y el callback OAuth (Conexiones, Task 20) vuelve a la raíz de la app,
 * no a una ruta de tab — agregar react-router acá sería complejidad sin necesidad real todavía.
 *
 * Monta la pantalla del tab activo dentro de `.app-shell__content` + la `TabBar` fija debajo (ver
 * shell.css para por qué "debajo en el flujo" y no "overlay" como el mock). `ChatScreen` ya
 * resuelve su propio `onLogout` internamente vía `useSession()` (ver ChatScreen.tsx) — no hace
 * falta pasarle nada acá; cuando Cuenta (Task 21) tenga su propio "Cerrar sesión", ese botón se
 * retira de `ChatHeader` (nota ya dejada en ChatHeader.tsx, no se toca en este task).
 */
export function AppShell() {
  const [activeTab, setActiveTab] = useState<TabKey>(DEFAULT_TAB);

  return (
    <div className="app-frame app-shell" data-testid="app-shell">
      <div className="app-shell__content" data-testid="app-shell-content">
        {activeTab === 'chat' && <ChatScreen />}
        {activeTab === 'apps' && <AppsScreen />}
        {activeTab === 'connections' && <ConnectionsScreen />}
        {activeTab === 'account' && <AccountScreen />}
      </div>
      <TabBar active={activeTab} onChange={setActiveTab} />
    </div>
  );
}

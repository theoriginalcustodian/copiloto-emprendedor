import { useCallback, useState } from 'react';

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
 *
 * `AppsScreen` (Feature addendum 2026-07-03, "modos por app") no conoce el estado de tabs — su
 * botón "+" solo pide `onGoToConnections`, que acá es simplemente cambiar `activeTab` (mismo
 * mecanismo de navegación por estado local que el resto del shell, cero acoplamiento nuevo).
 *
 * Nota de scope (deuda visible, no bloqueante): el mock (EXTRACT §2.3) describe un badge-dot en el
 * ícono del tab "Apps" cuando hay un modo activo (`hasActiveMode`). Queda deliberadamente FUERA de
 * este pase — requeriría tocar `TabBar.tsx` (fuera de mi ownership en esta feature) para exponer
 * un dato por tab; el spec de esta feature lo marca explícitamente como "(opcional)". Candidato:
 * sumar un prop `badge?: boolean` por `TabDefinition` en `TabBar.tsx` cuando se retome.
 */
export function AppShell() {
  const [activeTab, setActiveTab] = useState<TabKey>(DEFAULT_TAB);
  // Hide-on-scroll (EXTRACT §2.3): solo el Chat lo dispara; cambiar de tab siempre re-muestra la barra.
  const [tabHidden, setTabHidden] = useState(false);

  const changeTab = useCallback((key: TabKey) => {
    setTabHidden(false);
    setActiveTab(key);
  }, []);

  const shellClasses = ['app-frame', 'app-shell', tabHidden ? 'app-shell--tab-hidden' : '']
    .filter(Boolean)
    .join(' ');

  return (
    <div className={shellClasses} data-testid="app-shell">
      <div className="app-shell__content" data-testid="app-shell-content">
        {activeTab === 'chat' && <ChatScreen onHideChange={setTabHidden} />}
        {activeTab === 'apps' && <AppsScreen onGoToConnections={() => changeTab('connections')} />}
        {activeTab === 'connections' && <ConnectionsScreen />}
        {activeTab === 'account' && <AccountScreen />}
      </div>
      <TabBar active={activeTab} onChange={changeTab} hidden={tabHidden} />
    </div>
  );
}

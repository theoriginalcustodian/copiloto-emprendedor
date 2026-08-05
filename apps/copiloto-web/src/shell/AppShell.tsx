import { useCallback, useState } from 'react';

import { BottomSheet } from '../design-system';
import { ChatScreen } from '../modules/chat';
import { AppsScreen } from '../modules/apps';
import { ConnectionsScreen } from '../modules/connections';
import { GastosScreen } from '../modules/gastos';
import { ClientesScreen } from '../modules/clientes';
import { ContabilidadScreen } from '../modules/contabilidad';
import { IngresosScreen } from '../modules/ingresos';
import { AccountScreen } from '../modules/account';
import { TabBar, type TabKey } from './TabBar';
import { useBackGuard } from './useBackGuard';
import { useChromeAutoHide } from './useChromeAutoHide';
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
 * "Apps" (gap estructural #1/#17 del audit mobile, `Copiloto App.dc.html:218-270`) NO es una
 * pantalla de tab: es un BOTTOM-SHEET que se desliza sobre lo que sea que esté activo detrás (por
 * default, Chat). `activeTab` nunca vale `'apps'` — tocar el tab abre `appsSheetOpen` en vez de
 * navegar, así que Chat/Conexiones/Cuenta siguen montados debajo sin interrumpirse. Cierra por
 * click en el scrim, tecla Escape, o arrastrando el handle (`BottomSheet`, sin botón X — el mock
 * mobile no lo tiene, a diferencia del modal de escritorio).
 *
 * `AppsScreen` no conoce el estado de tabs — su botón "+" solo pide `onGoToConnections`, que acá
 * cierra el sheet y cambia `activeTab` (mismo mecanismo de navegación por estado local que el
 * resto del shell, cero acoplamiento nuevo).
 */
export interface AppShellProps {
  /** BETA-4b: aterrizar en un tab distinto de Chat la PRIMERA vez (ej. 'connections' recién
   * firmado) — ver `App.tsx`/`ResponsiveShell.tsx`. Sólo afecta el mount inicial. */
  initialTab?: TabKey;
}

export function AppShell({ initialTab }: AppShellProps = {}) {
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab ?? DEFAULT_TAB);
  // Show/hide del chrome (tab-bar + composer al borde): lo disparan el hide-on-scroll del chat (dedo
  // apoyado) y el tap en el área de chat (toggle). SIN auto-ocultado por inactividad — escondía la
  // barra sola y forzaba un doble-tap para abrir Apps (ver useChromeAutoHide). `hidden` baja a la
  // TabBar (translateY) y al content (padding-bottom -> 0, ver shell.css). Cambiar de tab la re-muestra.
  const { hidden: tabHidden, setHidden: setTabHidden, toggle: toggleChrome } = useChromeAutoHide();
  const [appsSheetOpen, setAppsSheetOpen] = useState(false);
  // `BottomSheet` queda SIEMPRE montado (necesario para animar el cierre, ver su docstring) — sin
  // este gate, `AppsScreen` (y su `useConnections()`/fetch a `/catalog`) montaría en cada carga del
  // shell aunque el usuario nunca abra "Apps". Se vuelve `true` en la primera apertura y no
  // resetea, así el cierre sigue animando con el contenido ya cargado.
  const [appsEverOpened, setAppsEverOpened] = useState(false);

  const changeTab = useCallback((key: TabKey) => {
    if (key === 'apps') {
      setAppsSheetOpen(true);
      setAppsEverOpened(true);
      return;
    }
    setTabHidden(false);
    setActiveTab(key);
  }, [setTabHidden]);

  const closeAppsSheet = useCallback(() => setAppsSheetOpen(false), []);

  const goToConnectionsFromApps = useCallback(() => {
    setAppsSheetOpen(false);
    setTabHidden(false);
    setActiveTab('connections');
  }, [setTabHidden]);

  // Botón "atrás" del navegador/OS (2026-07-04): pelar los overlays abiertos (sheet primero, luego
  // un tab != Chat) antes de dejar salir de la app. `backDepth` = cuántas capas hay abiertas.
  const handleBack = useCallback(() => {
    if (appsSheetOpen) {
      setAppsSheetOpen(false);
      return;
    }
    if (activeTab !== DEFAULT_TAB) {
      setActiveTab(DEFAULT_TAB);
    }
  }, [appsSheetOpen, activeTab]);
  const backDepth = (appsSheetOpen ? 1 : 0) + (activeTab !== DEFAULT_TAB ? 1 : 0);
  useBackGuard(backDepth, handleBack);

  // El auto-hide del chrome (barra + composer al borde) es SÓLO del Chat: en Conexiones/Cuenta no hay
  // área de chat para togglear, así que ocultar la barra ahí dejaría al usuario trabado sin forma de
  // traerla de vuelta (pedido del operador 2026-07-04). Fuera del Chat la barra queda SIEMPRE visible.
  const chromeHidden = activeTab === 'chat' && tabHidden;
  const shellClasses = ['app-frame', 'app-shell', chromeHidden ? 'app-shell--tab-hidden' : '']
    .filter(Boolean)
    .join(' ');

  return (
    <div className={shellClasses} data-testid="app-shell">
      <div className="app-shell__content" data-testid="app-shell-content">
        {activeTab === 'chat' && (
          <ChatScreen onHideChange={setTabHidden} onSurfaceTap={toggleChrome} />
        )}
        {activeTab === 'connections' && <ConnectionsScreen />}
        {activeTab === 'gastos' && <GastosScreen />}
        {activeTab === 'clientes' && <ClientesScreen />}
        {activeTab === 'contabilidad' && <ContabilidadScreen />}
        {activeTab === 'ingresos' && <IngresosScreen />}
        {activeTab === 'account' && <AccountScreen />}
      </div>
      <TabBar active={activeTab} onChange={changeTab} hidden={chromeHidden} />
      <BottomSheet open={appsSheetOpen} onClose={closeAppsSheet} ariaLabel="Tus apps">
        {appsEverOpened && <AppsScreen onGoToConnections={goToConnectionsFromApps} />}
      </BottomSheet>
    </div>
  );
}

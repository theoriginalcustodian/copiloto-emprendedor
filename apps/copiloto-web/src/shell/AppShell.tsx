import { useCallback, useState } from 'react';

import { useSession } from '../auth/useSession';
import { BottomSheet, Toast } from '../design-system';
import { AdminScreen } from '../modules/admin';
import { ChatScreen } from '../modules/chat';
import { AppsScreen } from '../modules/apps';
import { ConnectionsScreen } from '../modules/connections';
import { GastosScreen } from '../modules/gastos';
import { ClientesScreen } from '../modules/clientes';
import { ContabilidadScreen } from '../modules/contabilidad';
import { IngresosScreen } from '../modules/ingresos';
import { ActividadScreen } from '../modules/actividad';
import { PresupuestosScreen } from '../modules/presupuestos';
import { InteligenciaScreen } from '../modules/inteligencia';
import { MidiaScreen } from '../modules/midia';
import { EscritorioScreen } from '../modules/escritorio';
import { RecientesScreen } from '../modules/recientes';
import { AjustesScreen } from '../modules/ajustes';
import { PantallaFacturacion } from '../modules/facturacion';
import type { FuncionSoporte } from '../lib/api';
import { AccountScreen } from '../modules/account';
import { MiTicketScreen, SoporteScreen } from '../modules/soporte';
import { FUNCION_A_TAB } from './funcionTabMap';
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
  // Ver el mismo comentario en `DesktopShell.tsx`: la condición se deriva UNA vez y alimenta la
  // entrada de la barra y el montaje de la pantalla, que tienen que coincidir.
  const { me } = useSession();
  const esAdmin = me?.es_admin === true;
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
  // Funciones sin tab propio en la web (ninguna hoy con los 9 tiles de Escritorio wireados, ver
  // `funcionTabMap.ts` — se conserva por si un futuro tile llega sin tab todavía).
  const [avisoPendiente, setAvisoPendiente] = useState<string | null>(null);
  const avisarNoDisponible = useCallback(() => {
    setAvisoPendiente('Esta función todavía no está disponible en la web — probala desde la app por ahora.');
  }, []);
  // "Facturar" desde un presupuesto crea el borrador ANTES de navegar (mismo mecanismo que
  // mobile) -- PantallaFacturacion lo adopta vía `facturaIdInicial` en vez de crear uno nuevo.
  const [facturaIdDesdePresupuesto, setFacturaIdDesdePresupuesto] = useState<string | undefined>(
    undefined,
  );
  // SOP5 — cuál de las DOS conversaciones de soporte está activa. `TabKey` sigue siendo un solo
  // valor ('soporte'); esto es estado adicional que el shell recuerda, no un TabKey nuevo (evita
  // ensanchar el union y todo lo que lo consume exhaustivamente, ver `navIcons.tsx`).
  const [funcionSoporte, setFuncionSoporte] = useState<FuncionSoporte>('soporte_tecnico');
  // S6-11 — el ticket abierto desde una fila de Actividad. Mismo criterio que `funcionSoporte`:
  // estado adicional, NO un `TabKey` nuevo (no es un destino de la barra, sólo se llega tocando
  // una fila). `!= null` reemplaza el contenido del tab activo, como un drill-down de pantalla
  // completa; `onVolver` lo cierra y vuelve a mostrar lo que el tab activo tenía.
  const [ticketIdAbierto, setTicketIdAbierto] = useState<number | null>(null);
  // D14 — id del cliente a abrir en el tab Clientes, disparado desde una fila de Actividad/
  // Escritorio o el botón "Ver cliente" de `TarjetaClientePropuesto` (ya_existe). Mismo criterio
  // que `ticketIdAbierto`: estado del shell, se limpia en cada `changeTab` para que volver al tab
  // por la barra (no por `abrirCliente`) no reabra la última ficha.
  const [clienteIdAbierto, setClienteIdAbierto] = useState<number | null>(null);

  // `key === 'apps'` (2026-08-06): sin caller real desde la depuración de la barra -- `apps`
  // salió de `TABS` y ningún otro lugar del shell navega a esta key (a diferencia de
  // `connections`/`account`/`recientes`, que `AjustesScreen`/`EscritorioScreen` siguen pidiendo).
  // Se deja la rama viva a propósito: `AppsScreen`/`BottomSheet` tienen otros usos fuera de este
  // shell (Composer, AccountScreen) y retirar el sheet entero es una decisión más grande que
  // "depurar la barra" -- fuera de este contrato.
  const changeTab = useCallback((key: TabKey) => {
    if (key === 'apps') {
      setAppsSheetOpen(true);
      setAppsEverOpened(true);
      return;
    }
    setTabHidden(false);
    // S6-11: cambiar de tab con un ticket abierto tiene que CERRARLO — si no, `ticketIdAbierto`
    // sigue ganándole al `activeTab` nuevo y el usuario ve el mismo ticket detrás de la barra.
    setTicketIdAbierto(null);
    // D14: mismo criterio para la ficha por id — un cambio de tab genérico (barra, Escritorio,
    // Ajustes) no debe dejar `clienteIdAbierto` viejo esperando para la próxima vez que se entre a
    // Clientes. `abrirCliente` lo re-setea DESPUÉS de llamar a este `changeTab`.
    setClienteIdAbierto(null);
    setActiveTab(key);
  }, [setTabHidden]);

  // D14 — variante de `changeTab('clientes')` que además abre la ficha de `id`. `changeTab` limpia
  // `clienteIdAbierto` como parte de su cuerpo; el `setClienteIdAbierto(id)` de acá corre DESPUÉS
  // en el mismo batch, así que gana.
  const abrirCliente = useCallback((id: number) => {
    changeTab('clientes');
    setClienteIdAbierto(id);
  }, [changeTab]);

  const abrirSoporte = useCallback(
    (funcion: FuncionSoporte) => {
      setFuncionSoporte(funcion);
      changeTab('soporte');
    },
    [changeTab],
  );

  const closeAppsSheet = useCallback(() => setAppsSheetOpen(false), []);

  const goToConnectionsFromApps = useCallback(() => {
    setAppsSheetOpen(false);
    setTabHidden(false);
    setActiveTab('connections');
  }, [setTabHidden]);

  // Botón "atrás" del navegador/OS (2026-07-04): pelar los overlays abiertos (sheet primero, luego
  // el ticket de S6-11, luego un tab != Chat) antes de dejar salir de la app. `backDepth` = cuántas
  // capas hay abiertas.
  const handleBack = useCallback(() => {
    if (appsSheetOpen) {
      setAppsSheetOpen(false);
      return;
    }
    if (ticketIdAbierto != null) {
      setTicketIdAbierto(null);
      return;
    }
    if (activeTab !== DEFAULT_TAB) {
      setActiveTab(DEFAULT_TAB);
    }
  }, [appsSheetOpen, ticketIdAbierto, activeTab]);
  const backDepth =
    (appsSheetOpen ? 1 : 0) + (ticketIdAbierto != null ? 1 : 0) + (activeTab !== DEFAULT_TAB ? 1 : 0);
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
        {/* S6-11: el ticket abierto reemplaza el contenido del tab activo, drill-down de pantalla
            completa — mismo criterio que `PantallaGastosRoute` en mobile, sin ruta propia porque acá
            no hay router. `onVolver` restaura lo que el tab activo ya tenía montado. */}
        {ticketIdAbierto != null ? (
          <MiTicketScreen ticketId={ticketIdAbierto} onVolver={() => setTicketIdAbierto(null)} />
        ) : (
          <>
            {activeTab === 'chat' && (
              <ChatScreen
                onHideChange={setTabHidden}
                onSurfaceTap={toggleChrome}
                onAbrirCliente={abrirCliente}
              />
            )}
            {activeTab === 'connections' && <ConnectionsScreen />}
            {activeTab === 'gastos' && <GastosScreen />}
            {activeTab === 'clientes' && <ClientesScreen clienteIdInicial={clienteIdAbierto ?? undefined} />}
            {activeTab === 'contabilidad' && <ContabilidadScreen />}
            {activeTab === 'ingresos' && <IngresosScreen />}
            {activeTab === 'actividad' && (
              <ActividadScreen
                onAbrirGasto={() => changeTab('gastos')}
                onAbrirCliente={abrirCliente}
                onAbrirTicket={setTicketIdAbierto}
              />
            )}
            {activeTab === 'presupuestos' && (
              <PresupuestosScreen
                onFacturar={(facturaId) => {
                  setFacturaIdDesdePresupuesto(facturaId);
                  changeTab('facturacion');
                }}
              />
            )}
            {activeTab === 'inteligencia' && <InteligenciaScreen />}
            {activeTab === 'midia' && <MidiaScreen />}
            {activeTab === 'escritorio' && (
              <EscritorioScreen
                onFuncion={(key) => {
                  const tab = FUNCION_A_TAB[key];
                  if (tab == null) {
                    avisarNoDisponible();
                    return;
                  }
                  changeTab(tab);
                }}
                onAbrirGasto={() => changeTab('gastos')}
                onAbrirCliente={abrirCliente}
                onVerRecientes={() => changeTab('recientes')}
              />
            )}
            {activeTab === 'recientes' && <RecientesScreen />}
            {activeTab === 'ajustes' && <AjustesScreen onNavegarTab={changeTab} />}
            {activeTab === 'facturacion' && (
              <PantallaFacturacion
                facturaIdInicial={facturaIdDesdePresupuesto}
                onConfigurar={() => changeTab('ajustes')}
              />
            )}
            {/* Ver el mismo comentario en `DesktopShell.tsx`: el `&& esAdmin` cubre el caso en que
                `activeTab` quedó en 'admin' y el claim ya no está. */}
            {activeTab === 'admin' && esAdmin && <AdminScreen />}
            {activeTab === 'account' && (
              <AccountScreen onNavegarTab={(_tab, funcion) => abrirSoporte(funcion)} />
            )}
            {activeTab === 'soporte' && <SoporteScreen funcion={funcionSoporte} />}
          </>
        )}
      </div>
      <TabBar active={activeTab} onChange={changeTab} hidden={chromeHidden} esAdmin={esAdmin} />
      <BottomSheet open={appsSheetOpen} onClose={closeAppsSheet} ariaLabel="Tus apps">
        {appsEverOpened && <AppsScreen onGoToConnections={goToConnectionsFromApps} />}
      </BottomSheet>
      {avisoPendiente != null && (
        <Toast message={avisoPendiente} onDismiss={() => setAvisoPendiente(null)} />
      )}
    </div>
  );
}

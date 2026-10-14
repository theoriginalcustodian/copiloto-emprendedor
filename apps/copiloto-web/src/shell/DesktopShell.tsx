import { useCallback, useState } from 'react';

import { useSession } from '../auth/useSession';
import { Toast } from '../design-system';
import { AdminScreen } from '../modules/admin';
import { ChatScreen } from '../modules/chat';
import { ConnectionsScreen } from '../modules/connections';
import { GastosScreen } from '../modules/gastos';
import { ClientesScreen } from '../modules/clientes';
import { IngresosScreen } from '../modules/ingresos';
import { ActividadScreen } from '../modules/actividad';
import { PresupuestosScreen } from '../modules/presupuestos';
import { InteligenciaScreen } from '../modules/inteligencia';
import { MidiaScreen } from '../modules/midia';
import { EscritorioScreen } from '../modules/escritorio';
import { RecientesScreen } from '../modules/recientes';
import { AjustesScreen, PantallaComoUsarLaApp } from '../modules/ajustes';
import { PantallaFacturacion } from '../modules/facturacion';
import type { FuncionSoporte } from '../lib/api';
import { AccountScreen } from '../modules/account';
import { MiTicketScreen, SoporteScreen } from '../modules/soporte';
import { FUNCION_A_TAB } from './funcionTabMap';
import { Rail } from './Rail';
import { type TabKey } from './TabBar';
import { usePreviewActividad } from './usePreviewActividad';
import './desktop.css';

// BL-X1: la app abre en Mi día (la portada), no en el chat — igual que mobile.
const DEFAULT_TAB: TabKey = 'midia';

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
 * La pantalla «Tus apps» (modal) y sus modos se RETIRARON (SM-D3, issue 1019): ver `AppShell.tsx`.
 */
export interface DesktopShellProps {
  /** BETA-4b: mismo criterio que `AppShell.initialTab` — ver su docstring. */
  initialTab?: TabKey;
}

export function DesktopShell({ initialTab }: DesktopShellProps = {}) {
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab ?? DEFAULT_TAB);
  // La condición de la Consola se deriva UNA vez acá y alimenta las dos cosas que tienen que
  // coincidir: la entrada en el Rail y el montaje de la pantalla. `=== true` y no un truthy: si el
  // backend dejara de mandar el campo, `undefined` cae en `false` (fail-closed) en vez de propagar
  // un `undefined` que cualquier `&&` de abajo leería como "no", pero un `!` leería como "sí".
  const { me } = useSession();
  const esAdmin = me?.es_admin === true;
  // Ver docstring equivalente en AppShell.tsx.
  const [avisoPendiente, setAvisoPendiente] = useState<string | null>(null);
  const avisarNoDisponible = useCallback(() => {
    setAvisoPendiente('Esta función todavía no está disponible en la web — probala desde la app por ahora.');
  }, []);
  const [facturaIdDesdePresupuesto, setFacturaIdDesdePresupuesto] = useState<string | undefined>(
    undefined,
  );
  // Ver el mismo comentario en `AppShell.tsx`: estado adicional, no un `TabKey` nuevo.
  const [funcionSoporte, setFuncionSoporte] = useState<FuncionSoporte>('soporte_tecnico');
  // S6-11 — ver el mismo comentario en `AppShell.tsx`.
  const [ticketIdAbierto, setTicketIdAbierto] = useState<number | null>(null);
  // D14 — ver el mismo comentario en `AppShell.tsx`.
  const [clienteIdAbierto, setClienteIdAbierto] = useState<number | null>(null);
  // ACTID — ver el mismo comentario en `AppShell.tsx`.
  const [gastoIdAbierto, setGastoIdAbierto] = useState<number | null>(null);

  // ESCRACT — el preview de "Actividad reciente" del Escritorio. Ver `usePreviewActividad.ts`.
  const { actividad: actividadPreview, cargandoActividad } = usePreviewActividad(
    activeTab === 'escritorio',
  );

  const handleTabChange = useCallback((key: TabKey) => {
    // Ver el mismo comentario en `AppShell.tsx`: cambiar de tab con un ticket abierto lo cierra.
    setTicketIdAbierto(null);
    // D14 — ver el mismo comentario en `AppShell.tsx`.
    setClienteIdAbierto(null);
    // ACTID — ver el mismo comentario en `AppShell.tsx`.
    setGastoIdAbierto(null);
    setActiveTab(key);
  }, []);

  // D14 — ver el mismo comentario en `AppShell.tsx`. Acá no pasa por `handleTabChange` (mismo
  // criterio que `onAbrirGasto` de esta pantalla, más abajo: navegación directa vía `setActiveTab`).
  const abrirCliente = useCallback((id: number) => {
    setActiveTab('clientes');
    setClienteIdAbierto(id);
  }, []);

  // ACTID — variante de `setActiveTab('gastos')` que además abre el detalle de `id`. Mismo
  // criterio que `abrirCliente`: navegación directa, no pasa por `handleTabChange`.
  const abrirGasto = useCallback((id: number) => {
    setActiveTab('gastos');
    setGastoIdAbierto(id);
  }, []);

  // D12 — ver el mismo comentario en `AppShell.tsx`: mismo handoff que "Facturar" desde un
  // presupuesto, ahora también disparado por "Completar a mano" del chat.
  const irAFacturar = useCallback((facturaId: string) => {
    setFacturaIdDesdePresupuesto(facturaId);
    setActiveTab('facturacion');
  }, []);

  const abrirSoporte = useCallback((funcion: FuncionSoporte) => {
    setFuncionSoporte(funcion);
    setActiveTab('soporte');
  }, []);

  return (
    <div className="desktop-shell" data-shell="desktop" data-testid="desktop-shell">
      <Rail active={activeTab} onChange={handleTabChange} esAdmin={esAdmin} />
      <main className="desktop-shell__content" data-testid="desktop-shell-content">
        {/* Ver el mismo comentario en `AppShell.tsx`: S6-11 reemplaza el contenido del tab activo. */}
        {ticketIdAbierto != null ? (
          <MiTicketScreen ticketId={ticketIdAbierto} onVolver={() => setTicketIdAbierto(null)} />
        ) : (
          <>
            {activeTab === 'chat' && (
              <ChatScreen variant="desktop" onAbrirCliente={abrirCliente} onFacturar={irAFacturar} />
            )}
            {activeTab === 'connections' && <ConnectionsScreen />}
            {activeTab === 'gastos' && <GastosScreen gastoIdInicial={gastoIdAbierto ?? undefined} />}
            {activeTab === 'clientes' && <ClientesScreen clienteIdInicial={clienteIdAbierto ?? undefined} />}
            {activeTab === 'ingresos' && <IngresosScreen />}
            {activeTab === 'actividad' && (
              <ActividadScreen
                onAbrirGasto={abrirGasto}
                onAbrirCliente={abrirCliente}
                onAbrirTicket={setTicketIdAbierto}
              />
            )}
            {activeTab === 'presupuestos' && <PresupuestosScreen onFacturar={irAFacturar} />}
            {activeTab === 'inteligencia' && <InteligenciaScreen onAbrirChat={() => setActiveTab('chat')} />}
            {activeTab === 'midia' && <MidiaScreen onAbrirChat={() => setActiveTab('chat')} />}
            {activeTab === 'escritorio' && (
              <EscritorioScreen
                onFuncion={(key) => {
                  const tab = FUNCION_A_TAB[key];
                  if (tab == null) {
                    avisarNoDisponible();
                    return;
                  }
                  setActiveTab(tab);
                }}
                actividad={actividadPreview}
                cargandoActividad={cargandoActividad}
                onAbrirGasto={abrirGasto}
                onAbrirCliente={abrirCliente}
                onVerRecientes={() => setActiveTab('recientes')}
              />
            )}
            {activeTab === 'recientes' && <RecientesScreen />}
            {activeTab === 'ajustes' && <AjustesScreen onNavegarTab={setActiveTab} onAbrirSoporte={() => abrirSoporte('soporte_tecnico')} />}
            {activeTab === 'facturacion' && (
              <PantallaFacturacion
                facturaIdInicial={facturaIdDesdePresupuesto}
                onConfigurar={() => setActiveTab('ajustes')}
              />
            )}
            {/* El `&& esAdmin` no es redundante con esconder el tab: si el claim se pierde (logout y
                login como otro, refresh del token) `activeTab` puede seguir valiendo 'admin' de antes.
                Sin este gate la pantalla quedaría montada pidiendo `/admin/*` y mostrando 403s. */}
            {activeTab === 'admin' && esAdmin && <AdminScreen />}
            {activeTab === 'account' && (
              <AccountScreen onNavegarTab={(_tab, funcion) => abrirSoporte(funcion)} />
            )}
            {activeTab === 'soporte' &&
              (funcionSoporte === 'como_uso_la_app' ? (
                // BL-W9: «Cómo uso la app» no es un chat de ayuda propio — cada tema abre el chat principal.
                <PantallaComoUsarLaApp onAbrirChat={() => setActiveTab('chat')} />
              ) : (
                <SoporteScreen funcion={funcionSoporte} />
              ))}
          </>
        )}
      </main>
      {avisoPendiente != null && (
        <Toast message={avisoPendiente} onDismiss={() => setAvisoPendiente(null)} />
      )}
    </div>
  );
}

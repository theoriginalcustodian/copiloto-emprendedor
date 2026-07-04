import { useMemo } from 'react';

import { Button, Skeleton } from '../../design-system';
import type { CatalogService } from '../../lib/api';
import { useConnections } from '../connections/useConnections';
import { useMode } from '../../shell/modeStore';
import { ModeButton } from './ModeButton';
import './apps.css';

export interface AppsScreenProps {
  /**
   * El botón "+" navega a Conexiones. `AppsScreen` no conoce react-router ni el estado de tabs del
   * shell (mismo criterio que `ChatHeader.onLogout`, ver ChatScreen.tsx) — `AppShell` decide el
   * cambio de tab y pasa el callback.
   */
  onGoToConnections?: () => void;
}

/**
 * `category` -> ícono de dominio (spec §4/§8). Data-driven por CATEGORÍA (campo ya existente en
 * `CatalogService`, no por servicio puntual) — degrada con gracia a `DEFAULT_ICON` para categorías
 * nuevas sin tocar este archivo, mismo criterio que `categoryLabel` en ConnectionsScreen.tsx.
 */
const CATEGORY_ICON: Record<string, string> = {
  pagos: '💰',
  comunicacion: '📧',
  agenda: '📅',
  archivos: '📁',
  clientes: '👥',
  publicacion: '📷',
};
/** Mismo glyph que el tab "Apps" (shell/TabBar.tsx) — fallback genérico, no un ícono de marca. */
const DEFAULT_ICON = '▦';

function iconFor(service: CatalogService): string {
  return CATEGORY_ICON[service.category] ?? DEFAULT_ICON;
}

const SKELETON_COUNT = 3;

/**
 * Pantalla Apps (Feature addendum 2026-07-03, reemplaza el placeholder de Task 9/17) — la
 * superficie de "modos por app": barra data-driven de servicios CONECTADOS (`useConnections`, ya
 * construido por Conexiones/Task 20 — reusado, no duplicado) donde cada botón activa `mode`
 * (estado GLOBAL vía `useMode()`, compartido con `Composer`). FOCO BLANDO (spec §1): acá solo se
 * setea estado local — nunca se bloquea ni se valida nada contra el backend.
 */
export function AppsScreen({ onGoToConnections }: AppsScreenProps) {
  const { status, services, refresh } = useConnections();
  const { mode, setMode, clearMode } = useMode();

  const connected = useMemo(() => services.filter((service) => service.connected), [services]);

  function handleToggle(service: CatalogService) {
    // Tocar el modo YA activo vuelve a modo general (spec §3.3); tocar otro lo reemplaza (§3.2).
    if (mode?.key === service.key) {
      clearMode();
    } else {
      setMode({ key: service.key, label: service.work_label, category: service.category });
    }
  }

  return (
    <div className="apps-screen" data-testid="apps-screen">
      <header className="apps-screen__header">
        <h1 className="apps-screen__title">Apps</h1>
        <p className="apps-screen__subtitle">Elegí un modo para enfocar al copiloto</p>
      </header>

      {status === 'loading' && (
        <div className="apps-screen__loading" data-testid="apps-loading">
          {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
            <Skeleton key={i} width={92} height={44} radius={12} />
          ))}
        </div>
      )}

      {status === 'error' && (
        <div className="apps-screen__error" data-testid="apps-error">
          <p>No pudimos cargar tus apps.</p>
          <Button variant="cancel" onClick={() => void refresh()}>
            Reintentar
          </Button>
        </div>
      )}

      {status === 'ready' && (
        <div className="apps-screen__bar" data-testid="mode-bar">
          {connected.map((service) => (
            <ModeButton
              key={service.key}
              icon={iconFor(service)}
              label={service.work_label}
              active={mode?.key === service.key}
              onToggle={() => handleToggle(service)}
              testId={`mode-button-${service.key}`}
            />
          ))}

          <Button
            variant="ghost"
            className="apps-screen__add"
            onClick={onGoToConnections}
            data-testid="apps-add-button"
          >
            {connected.length === 0 ? '+ Conectá una app para empezar' : '+ Conectar más'}
          </Button>
        </div>
      )}
    </div>
  );
}

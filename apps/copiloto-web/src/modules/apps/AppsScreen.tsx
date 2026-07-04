import { useMemo } from 'react';

import { Button, Skeleton } from '../../design-system';
import type { CatalogService } from '../../lib/api';
import { useConnections } from '../connections/useConnections';
import { useMode } from '../../shell/modeStore';
import { ModeButton } from './ModeButton';
import './apps.css';

export interface AppsScreenProps {
  /**
   * El botón "Conectar más" navega a Conexiones. `AppsScreen` no conoce react-router ni el estado
   * de tabs del shell (mismo criterio que `ChatHeader.onLogout`, ver ChatScreen.tsx) — `AppShell`
   * decide el cambio de tab y pasa el callback.
   */
  onGoToConnections?: () => void;
}

const SKELETON_COUNT = 3;

/** Ícono X de la píldora "Salir del modo" (diseño línea 229, verbatim). */
function ExitIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

/** Ícono "+" de la fila dashed "Conectar más" (diseño línea 263, verbatim). */
function PlusIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/** Chevron final de la fila "Conectar más" (diseño línea 265, verbatim). */
function ChevronIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M9 6l6 6-6 6" stroke="var(--label)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Pantalla Apps (Feature addendum 2026-07-03, reemplaza el placeholder de Task 9/17; contenido
 * portado 1:1 del bloque "apps sheet" de `Copiloto App.dc.html` líneas 218-268) — la superficie
 * de "modos por app": listado data-driven de servicios CONECTADOS (`useConnections`, ya
 * construido por Conexiones/Task 20 — reusado, no duplicado) donde cada fila activa `mode`
 * (estado GLOBAL vía `useMode()`, compartido con `Composer`). FOCO BLANDO (spec §1): acá solo se
 * setea estado local — nunca se bloquea ni se valida nada contra el backend.
 *
 * Se mantiene como PANTALLA (screen) dentro de `.app-shell__content`, no como bottom-sheet: el
 * diseño la exporta como sheet modal, pero convertir la navegación a sheet es una decisión de
 * arquitectura del shell (fuera de este ownership) — acá solo se mejora la fidelidad del
 * CONTENIDO de lo que ya existe como pantalla.
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
        <h1 className="apps-screen__title">Tus apps</h1>
        <p className="apps-screen__subtitle">Elegí un modo para enfocar al copiloto</p>
      </header>

      {status === 'loading' && (
        <div className="apps-screen__loading" data-testid="apps-loading">
          {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
            <Skeleton key={i} height={66} radius={16} />
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
        <div className="apps-screen__list" data-testid="mode-bar">
          {mode && (
            <button
              type="button"
              className="apps-screen__exit"
              onClick={clearMode}
              data-testid="apps-exit-mode"
            >
              <ExitIcon />
              Salir del modo
            </button>
          )}

          {connected.map((service) => (
            <ModeButton
              key={service.key}
              service={service}
              active={mode?.key === service.key}
              onToggle={() => handleToggle(service)}
              testId={`mode-button-${service.key}`}
            />
          ))}

          {connected.length > 0 && <div className="apps-screen__divider" aria-hidden="true" />}

          <button
            type="button"
            className="apps-screen__connect-more"
            onClick={onGoToConnections}
            data-testid="apps-add-button"
          >
            <span className="apps-screen__connect-more-icon" aria-hidden="true">
              <PlusIcon />
            </span>
            <span className="apps-screen__connect-more-body">
              <span className="apps-screen__connect-more-title">Conectar más</span>
              <span className="apps-screen__connect-more-subtitle">
                {connected.length === 0 ? 'Conectá una app para empezar' : 'Sumá otra app a tu copiloto'}
              </span>
            </span>
            <ChevronIcon />
          </button>
        </div>
      )}
    </div>
  );
}

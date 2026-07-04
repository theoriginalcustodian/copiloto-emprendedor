import { useState } from 'react';

import { useSession } from '../auth/useSession';
import { useTheme, type Theme } from '../design-system/ThemeProvider';
import { useMode } from './modeStore';
import { NAV_ICONS } from './navIcons';
import { TABS, type TabKey } from './TabBar';
import './desktop.css';

export interface RailProps {
  active: TabKey;
  onChange: (key: TabKey) => void;
}

/** Título accesible de cada swatch (EXTRACT §2.4) — mismo criterio que `THEME_LABELS` de
 * `modules/account/AccountScreen.tsx`, duplicado deliberadamente acá: no está exportado desde ahí
 * (es un detalle interno del componente) y el rail es una superficie de UI separada. */
const THEME_SWATCH_TITLE: Record<Theme, string> = {
  aurora: 'Aurora Glass',
  daylight: 'Soft Daylight',
  refined: 'Refined Dark',
  ai: 'Tema AI',
};

/** Mismo helper que `accountLabel`/`initial` de AccountScreen.tsx (no exportados de ahí) — el
 * bloque de usuario del rail necesita el mismo fallback ("Tu cuenta" / iniciales) sin backend de
 * nombre/email todavía (`/me` solo trae `cliente_id`, ver AccountScreen.tsx). */
function accountLabel(clienteId: string | undefined): string {
  if (!clienteId) return 'Tu cuenta';
  return `Cuenta #${clienteId.trim().slice(0, 8)}`;
}

function initial(clienteId: string | undefined): string {
  return (clienteId?.trim()?.[0] ?? '?').toUpperCase();
}

/**
 * Rail lateral de escritorio (DESIGN-SYSTEM-EXTRACT-WEB.md §3.1/§5.1) — nuevo, sin equivalente
 * mobile. Auto-hide 72px↔244px por hover: spacer fijo (reserva el ancho colapsado en el flujo
 * flex) + `<nav>` `position:absolute` superpuesto que crece encima (ver desktop.css para el
 * layout completo, calcado del markup real del mock).
 *
 * `railOpen` es estado de React, no `:hover` CSS puro: el EXTRACT documenta timing DISTINTO entre
 * apertura (fade retardado .08s, ver `.rail--open .rail__label` en desktop.css) y cierre (fade
 * inmediato) del contenido de texto — un simple `:hover` no separa esos dos casos limpiamente.
 *
 * Data-driven del MISMO registro `TABS` que `TabBar.tsx` (mobile) — sumar/quitar un tab es editar
 * un solo array, ambos shells lo reflejan sin tocar este componente.
 */
export function Rail({ active, onChange }: RailProps) {
  const [railOpen, setRailOpen] = useState(false);
  const { theme, setTheme, themes } = useTheme();
  const { me } = useSession();
  const { mode } = useMode();

  return (
    <>
      {/* Zona 1 (EXTRACT §3.1): spacer fijo que reserva el ancho colapsado en el flujo flex —
          el `<nav>` real va superpuesto encima vía position:absolute (zona 2). */}
      <div className="rail-spacer" aria-hidden="true" />
      <nav
        className={['rail', railOpen ? 'rail--open' : ''].filter(Boolean).join(' ')}
        data-testid="rail"
        aria-label="Navegación principal"
        onPointerEnter={() => setRailOpen(true)}
        onPointerLeave={() => setRailOpen(false)}
      >
        <div className="rail__items">
          {TABS.map((tab) => {
            const isActive = tab.key === active;
            // Badge-dot en "Apps" cuando hay un modo activo — mismo dato (`useMode()`) que ya lee
            // `Composer`/`AppsScreen`; el mobile `TabBar.tsx` lo dejó deliberadamente fuera de su
            // pase (ver docstring ahí), pero acá es un componente NUEVO sin ese deuda previa.
            const showModeBadge = tab.key === 'apps' && mode !== null;
            return (
              <button
                key={tab.key}
                type="button"
                className={['rail__item', isActive ? 'rail__item--active' : '']
                  .filter(Boolean)
                  .join(' ')}
                aria-current={isActive ? 'page' : undefined}
                onClick={() => onChange(tab.key)}
              >
                <span className="rail__icon-wrap" aria-hidden="true">
                  <span className="rail__icon">{NAV_ICONS[tab.key]()}</span>
                  {showModeBadge && <span className="rail__dot" data-testid="rail-mode-dot" />}
                </span>
                <span className="rail__label">{tab.label}</span>
                {showModeBadge && (
                  <span className="rail__mode-badge" data-testid="rail-mode-badge">
                    {mode?.label}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Selector de skin (EXTRACT §2.4) — real UI de producto dentro del rail, no chrome de
            documentación: los 4 temas son elegibles en vivo acá, mismo `ThemeProvider`/`localStorage`
            compartido con `AccountScreen` (Cuenta sigue teniendo su propio selector, mobile). */}
        <div className="rail__skin">
          <span className="rail__skin-label">Skin</span>
          <div className="rail__skin-swatches" role="group" aria-label="Selector de tema">
            {themes.map((t) => (
              <button
                key={t}
                type="button"
                className={[
                  'rail__swatch',
                  `rail__swatch--${t}`,
                  t === theme ? 'rail__swatch--active' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                title={THEME_SWATCH_TITLE[t]}
                aria-pressed={t === theme}
                data-testid={`rail-swatch-${t}`}
                onClick={() => setTheme(t)}
              />
            ))}
          </div>
        </div>

        <div className="rail__user" data-testid="rail-user">
          <span className="rail__avatar" aria-hidden="true">
            {initial(me?.cliente_id)}
          </span>
          <div className="rail__user-text">
            <span className="rail__user-name">{accountLabel(me?.cliente_id)}</span>
          </div>
        </div>
      </nav>
    </>
  );
}

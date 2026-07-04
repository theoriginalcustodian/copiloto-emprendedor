import { useMode } from './modeStore';
import { NAV_ICONS } from './navIcons';
import './shell.css';

export type TabKey = 'chat' | 'apps' | 'connections' | 'account';

export interface TabDefinition {
  key: TabKey;
  label: string;
}

/**
 * Registro declarativo de tabs (EXTRACT §2.3/§4: Chat · Apps · Conexiones · Cuenta). Sumar o
 * quitar un tab es editar este array — TabBar y AppShell son data-driven de acá, cero refactor.
 * El ícono sale de `NAV_ICONS[key]` (SVG verbatim del diseño), no de un glyph emoji.
 */
export const TABS: readonly TabDefinition[] = [
  { key: 'chat', label: 'Chat' },
  { key: 'apps', label: 'Apps' },
  { key: 'connections', label: 'Conexiones' },
  { key: 'account', label: 'Cuenta' },
];

export interface TabBarProps {
  active: TabKey;
  onChange: (key: TabKey) => void;
  /** `true` oculta la barra (translateY) — hide-on-scroll del chat (EXTRACT §2.3). Default `false`. */
  hidden?: boolean;
}

/**
 * Tab-bar flotante (Task 9, EXTRACT §2.3): 4 ítems fijos, táctil (≥44px), estado activo/inactivo
 * por tokens `--tab-*`, `aria-current="page"` en el activo. Blur + radio 26px vía shell.css.
 * Íconos SVG (`NAV_ICONS`) verbatim del diseño.
 *
 * Hide-on-scroll (EXTRACT §2.3): al scrollear el chat hacia abajo la barra se oculta
 * (`translateY`), reaparece al subir. `AppShell` calcula `hidden` desde el scroll del chat y lo
 * baja acá + al composer (shift en espejo).
 */
export function TabBar({ active, onChange, hidden = false }: TabBarProps) {
  const { mode } = useMode();
  const navClasses = ['tab-bar', hidden ? 'tab-bar--hidden' : ''].filter(Boolean).join(' ');
  return (
    <nav className={navClasses} data-testid="tab-bar" aria-label="Navegación principal">
      {TABS.map((tab) => {
        const isActive = tab.key === active;
        const classes = ['tab-bar__item', isActive ? 'tab-bar__item--active' : '']
          .filter(Boolean)
          .join(' ');
        const Icon = NAV_ICONS[tab.key];
        // Badge-dot sobre "Apps" con modo activo (dc.html:202-205, gap #18) — deuda ya
        // documentada en el diseño previo, se cierra acá con el mismo dato (`useMode()`) que ya
        // usa el `Rail` de escritorio.
        const showModeBadge = tab.key === 'apps' && mode !== null;
        return (
          <button
            key={tab.key}
            type="button"
            className={classes}
            aria-current={isActive ? 'page' : undefined}
            onClick={() => onChange(tab.key)}
          >
            <span className="tab-bar__icon" aria-hidden="true">
              {showModeBadge ? (
                <span className="tab-bar__icon-wrap">
                  {Icon()}
                  <span className="tab-bar__dot" data-testid="tab-bar-mode-dot" />
                </span>
              ) : (
                Icon()
              )}
            </span>
            <span className="tab-bar__label">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

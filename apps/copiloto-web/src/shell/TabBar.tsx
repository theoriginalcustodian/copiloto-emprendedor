import './shell.css';

export type TabKey = 'chat' | 'apps' | 'connections' | 'account';

export interface TabDefinition {
  key: TabKey;
  label: string;
  /** Glyph decorativo (emoji), `aria-hidden` — mismo criterio que el mic/enviar del Composer
   * (chat/Composer.tsx: 🎙/↑), no un set de íconos SVG propio. */
  icon: string;
}

/**
 * Registro declarativo de tabs (EXTRACT §2.3/§4: Chat · Apps · Conexiones · Cuenta). Sumar o
 * quitar un tab es editar este array — TabBar y AppShell son data-driven de acá, cero refactor.
 */
export const TABS: readonly TabDefinition[] = [
  { key: 'chat', label: 'Chat', icon: '💬' },
  { key: 'apps', label: 'Apps', icon: '▦' },
  { key: 'connections', label: 'Conexiones', icon: '🔗' },
  { key: 'account', label: 'Cuenta', icon: '👤' },
];

export interface TabBarProps {
  active: TabKey;
  onChange: (key: TabKey) => void;
}

/**
 * Tab-bar flotante (Task 9, EXTRACT §2.3): 4 ítems fijos, táctil (≥44px), estado activo/inactivo
 * por tokens `--tab-*`, `aria-current="page"` en el activo. Blur + radio 26px vía shell.css.
 *
 * Hide-on-scroll (EXTRACT) queda deliberadamente FUERA de esta implementación — ver nota de
 * layout en shell.css: la tab-bar vive en el flujo (no overlay), así que no hay nada que ocultar;
 * decisión documentada en el report, no un olvido.
 */
export function TabBar({ active, onChange }: TabBarProps) {
  return (
    <nav className="tab-bar" data-testid="tab-bar" aria-label="Navegación principal">
      {TABS.map((tab) => {
        const isActive = tab.key === active;
        const classes = ['tab-bar__item', isActive ? 'tab-bar__item--active' : '']
          .filter(Boolean)
          .join(' ');
        return (
          <button
            key={tab.key}
            type="button"
            className={classes}
            aria-current={isActive ? 'page' : undefined}
            onClick={() => onChange(tab.key)}
          >
            <span className="tab-bar__icon" aria-hidden="true">
              {tab.icon}
            </span>
            <span className="tab-bar__label">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

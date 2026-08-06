import { NAV_ICONS } from './navIcons';
import './shell.css';

export type TabKey =
  | 'chat'
  | 'apps'
  | 'connections'
  | 'gastos'
  | 'clientes'
  | 'contabilidad'
  | 'ingresos'
  | 'actividad'
  | 'presupuestos'
  | 'inteligencia'
  | 'midia'
  | 'escritorio'
  | 'recientes'
  | 'ajustes'
  | 'facturacion'
  | 'account';

export interface TabDefinition {
  key: TabKey;
  label: string;
}

/**
 * Registro declarativo de tabs (EXTRACT §2.3/§4). Sumar o quitar un tab es editar este array —
 * TabBar y AppShell son data-driven de acá, cero refactor. El ícono sale de `NAV_ICONS[key]` (SVG
 * verbatim del diseño), no de un glyph emoji.
 *
 * **Depuración 2026-08-06** (pedido del operador, *"sólo las funciones de la app"*): `apps`,
 * `connections`, `recientes` y `account` salieron de este array — sus pantallas siguen existiendo
 * y son alcanzables por otro camino (`apps`/`account` vía `TILES_AJUSTES` en Ajustes, `recientes`
 * vía "ver recientes" de Escritorio), así que sus valores de `TabKey` NO se tocan, sólo se retiran
 * de la barra visible. `ajustes` **no** salió pese a estar en el pedido original: el reemplazo
 * ("se entra por el ícono del usuario") no existe en el shell mobile — `ChatHeader` (que tendría
 * el avatar) está deliberadamente sin montar ahí desde 2026-07-04 (ver AppShell.tsx) — y el único
 * otro camino (Facturación → "Configurar") es un atajo incidental, no una puerta real. Mismo
 * criterio que el contrato pide para este caso: si el reemplazo no existe, el tab se queda.
 *
 * `gastos`, `clientes`, `contabilidad`, `ingresos`, `actividad`, `presupuestos`, `inteligencia`,
 * `midia`, `escritorio` y `facturacion` sumados en M-WEB (2026-08-04), orden de llegada. Reordenados
 * acá por agrupación temática (pedido del operador, *"mal ubicados"*): día a día · la plata · con
 * quién · herramientas.
 */
export const TABS: readonly TabDefinition[] = [
  { key: 'chat', label: 'Chat' },
  { key: 'midia', label: 'Mi día' },
  { key: 'actividad', label: 'Actividad' },
  { key: 'ingresos', label: 'Ingresos' },
  { key: 'gastos', label: 'Gastos' },
  { key: 'contabilidad', label: 'Contabilidad' },
  { key: 'facturacion', label: 'Facturación' },
  { key: 'presupuestos', label: 'Presupuestos' },
  { key: 'clientes', label: 'Clientes' },
  { key: 'inteligencia', label: 'Inteligencia' },
  { key: 'escritorio', label: 'Funciones' },
  { key: 'ajustes', label: 'Ajustes' },
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
  const navClasses = ['tab-bar', hidden ? 'tab-bar--hidden' : ''].filter(Boolean).join(' ');
  return (
    <nav className={navClasses} data-testid="tab-bar" aria-label="Navegación principal">
      {TABS.map((tab) => {
        const isActive = tab.key === active;
        const classes = ['tab-bar__item', isActive ? 'tab-bar__item--active' : '']
          .filter(Boolean)
          .join(' ');
        const Icon = NAV_ICONS[tab.key];
        return (
          <button
            key={tab.key}
            type="button"
            className={classes}
            aria-current={isActive ? 'page' : undefined}
            onClick={() => onChange(tab.key)}
          >
            <span className="tab-bar__icon" aria-hidden="true">
              {Icon()}
            </span>
            <span className="tab-bar__label">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

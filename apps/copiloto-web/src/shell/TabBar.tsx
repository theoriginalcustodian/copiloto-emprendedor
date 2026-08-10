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
  | 'admin'
  | 'account'
  | 'soporte';

export interface TabDefinition {
  key: TabKey;
  label: string;
  /** El tab sólo existe para un operador (`me.es_admin`). **Ergonomía, no control de acceso**: el
   *  guard real es `require_admin` en el backend. Ver `tabsVisibles`. */
  soloAdmin?: boolean;
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
 * de la barra visible.
 *
 * **`ajustes` salió el 2026-08-07**, completando aquel pedido. Antes se había quedado porque su
 * reemplazo no existía; ahora hay DOS puertas verificadas, una por shell — el tile "Ajustes" del
 * escritorio (`EscritorioScreen.tsx:57`, alcanzable en el teléfono porque `escritorio` sigue en
 * este array) y el bloque de usuario del rail, que dejó de ser un `<div>` muerto en el PR 299. El
 * criterio no cambió: el tab sale cuando el reemplazo existe, no cuando se pide.
 * (El número de PR va escrito sin almohadilla a propósito: `shellNoHexLiterals.test.ts` toma
 * almohadilla + 3 dígitos hex como un color literal, y un PR de 3 cifras la dispara.)
 *
 * `admin` (la Consola de operador) es el único con `soloAdmin` — ver `tabsVisibles`.
 *
 * `soporte` (SOP5) es `TabKey` pero deliberadamente NO entra a este array — mismo mecanismo que
 * `account`/`connections`/`recientes` (depuración 2026-08-06): se llega por una fila de
 * `AccountScreen`, no por la barra. Es "paridad con mobile" (`PantallaCuenta` reusa el mismo
 * patrón), no una omisión.
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
  { key: 'admin', label: 'Consola', soloAdmin: true },
];

/**
 * Los tabs que este usuario ve. **Única** implementación del filtro — Rail (escritorio) y TabBar
 * (teléfono) la comparten para que la puerta no pueda aparecer en un shell y no en el otro.
 *
 * Fail-closed por defecto: `esAdmin` es `false` salvo prueba en contrario, así que un shell que se
 * olvidara de pasarlo esconde la consola en vez de mostrarla. El tab **no se renderiza** (no es un
 * `display:none`): sin el claim, la palabra "Consola" no existe en el DOM.
 *
 * Y lo que esto NO es: control de acceso. El guard real es `require_admin` del backend, con su test
 * adversarial propio. Esconder la entrada es ergonomía — que nadie lea este filtro como la defensa.
 */
export function tabsVisibles(esAdmin: boolean): readonly TabDefinition[] {
  return TABS.filter((tab) => !tab.soloAdmin || esAdmin);
}

export interface TabBarProps {
  active: TabKey;
  onChange: (key: TabKey) => void;
  /** ¿Mostrar los tabs `soloAdmin`? Lo baja el shell desde `me.es_admin`. Default `false`. */
  esAdmin?: boolean;
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
export function TabBar({ active, onChange, hidden = false, esAdmin = false }: TabBarProps) {
  const navClasses = ['tab-bar', hidden ? 'tab-bar--hidden' : ''].filter(Boolean).join(' ');
  return (
    <nav className={navClasses} data-testid="tab-bar" aria-label="Navegación principal">
      {tabsVisibles(esAdmin).map((tab) => {
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

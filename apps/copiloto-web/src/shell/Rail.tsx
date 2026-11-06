import { useState } from 'react';

import { useSession } from '../auth/useSession';
import { NAV_ICONS } from './navIcons';
import { tabsVisibles, type TabKey } from './TabBar';
import './desktop.css';

export interface RailProps {
  active: TabKey;
  onChange: (key: TabKey) => void;
  /** ¿Mostrar los tabs `soloAdmin` (la Consola)? Lo baja `DesktopShell` desde `me.es_admin`.
   *  Default `false` — fail-closed. Se recibe por prop y no se lee de `useSession()` acá aunque el
   *  componente ya lo tenga a mano: el shell calcula la condición UNA vez y la usa para las dos
   *  cosas que tienen que coincidir (mostrar la entrada / montar la pantalla). Derivarla dos veces
   *  es exactamente cómo se desincronizan. */
  esAdmin?: boolean;
}

/** Mismo helper que `accountLabel`/`initial` de AccountScreen.tsx (no exportados de ahí) — el
 * bloque de usuario del rail necesita el mismo fallback ("Tu cuenta" / iniciales) sin backend de
 * nombre/email todavía (`/me` solo trae `cliente_id`, ver AccountScreen.tsx). */
function accountLabel(clienteId: string | undefined): string {
  if (!clienteId) return 'Tu cuenta';
  return `Cuenta #${clienteId.trim().slice(0, 8)}`;
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
export function Rail({ active, onChange, esAdmin = false }: RailProps) {
  const [railOpen, setRailOpen] = useState(false);
  const { me } = useSession();

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
        {/* La puerta a Ajustes va ARRIBA del rail, no al fondo: abajo dependía de que la altura de
            la ventana fuera la esperada y, medido con el operador (2026-11-06), en su navegador el
            bloque no se veía ni con zoom mínimo — sin ninguna otra entrada a Ajustes en escritorio.
            Arriba no depende de ninguna altura. */}
        <div className="rail__top">
          <button
            type="button"
            className={['rail__user', active === 'ajustes' ? 'rail__user--active' : '']
              .filter(Boolean)
              .join(' ')}
            data-testid="rail-user"
            aria-current={active === 'ajustes' ? 'page' : undefined}
            aria-label="Tu cuenta y ajustes"
            title="Tu cuenta y ajustes"
            onClick={() => onChange('ajustes')}
          >
            <span className="rail__avatar" aria-hidden="true">
              {NAV_ICONS.account()}
            </span>
            <div className="rail__user-text">
              <span className="rail__user-name">{accountLabel(me?.cliente_id)}</span>
              <span className="rail__user-email">Cuenta y ajustes</span>
            </div>
          </button>
        </div>

        <div className="rail__items">
          {tabsVisibles(esAdmin).map((tab) => {
            const isActive = tab.key === active;
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
                </span>
                <span className="rail__label">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Bloque inferior (dc.html:66-84): Usuario pegado al fondo (`margin-top:auto`). El
            selector de skin que vivía acá se movió a Ajustes > Apariencia (2026-08-06, pedido del
            operador): estaba escondido dentro del rail, sin relación visible con el tile
            "Apariencia" del menú de Ajustes — ver `modules/ajustes/PantallaApariencia.tsx`. */}
      </nav>
    </>
  );
}

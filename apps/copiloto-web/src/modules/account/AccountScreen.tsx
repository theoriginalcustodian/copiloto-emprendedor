import { useState } from 'react';

import { MonoLabel, PresenceOrb, Surface } from '../../design-system';
import { useSession } from '../../auth/useSession';
import { useTheme, type Theme } from '../../design-system/ThemeProvider';
import './account.css';

/** Nombres es-AR "lindos" del selector de tema (EXTRACT §2.12) — los IDs internos (`aurora` etc.)
 * son los mismos 4 de `ThemeProvider`, esto es solo la etiqueta visible. */
const THEME_LABELS: Record<Theme, string> = {
  aurora: 'Aurora',
  daylight: 'Amanecer',
  refined: 'Refinado',
  ai: 'IA',
};

function accountLabel(clienteId: string | undefined): string {
  if (!clienteId) return 'Tu cuenta';
  // ASUNCIÓN documentada (ver report): `/me` hoy NO trae nombre/email (solo `cliente_id`,
  // `mp_connected`, `composio_connected` — confirmado en lib/api/types.ts). Mostramos un
  // identificador abreviado en vez de inventar un nombre. Cuando `/me` sume `nombre`/`email`
  // (backend, fuera de mi ownership), este helper pasa a preferir esos campos.
  const trimmed = clienteId.trim();
  return `Cuenta #${trimmed.slice(0, 8)}`;
}

function initial(clienteId: string | undefined): string {
  return (clienteId?.trim()?.[0] ?? '?').toUpperCase();
}

/** Chevron de fila (mismo patrón que `modules/apps/AppsScreen.tsx` `ChevronIcon`, verbatim
 * diseño `Copiloto App.dc.html:425` etc. — `path d="M9 6l6 6-6 6"`). Color por defecto `--label`,
 * override a `--danger-fg` en la fila de "Cerrar sesión" (diseño línea 444). */
function ChevronIcon({ color = 'var(--label)' }: { color?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M9 6l6 6-6 6" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Toggle visual de "Notificaciones" (Task 21). SOLO visual — no hay endpoint/preferencia real en
 * el backend hoy (ninguna ruta de `/me` o afín expone ni acepta esta config, ver lib/api/types.ts).
 * Queda en estado local (`useState`, default "activadas") documentado como deuda de-facto: cuando
 * el backend sume una preferencia real, este componente pasa a leerla/escribirla en vez de estado
 * local (candidato natural: un campo en `/me` + un endpoint `PATCH /me/preferences`, fuera de mi
 * ownership hoy).
 */
function NotificationsToggle() {
  const [enabled, setEnabled] = useState(true);
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-label="Notificaciones"
      className={['account-switch', enabled ? 'account-switch--on' : ''].filter(Boolean).join(' ')}
      onClick={() => setEnabled((value) => !value)}
    >
      <span className="account-switch__knob" aria-hidden="true" />
    </button>
  );
}

/**
 * Módulo Cuenta (Task 21, EXTRACT §2.9/§2.12/§3.4) — perfil + selector de 4 temas + card de
 * durabilidad + preferencias + logout. Reemplaza el placeholder de Task 9.
 *
 * Header a 2 bloques (diseño `Copiloto App.dc.html:409-418` / `Copiloto Web.dc.html:330-337`,
 * mobile y desktop coinciden en estructura): H1 "Cuenta" solo arriba, fila identidad
 * (avatar+nombre+email) debajo — NO una sola fila horizontal con el H1 al lado del avatar.
 */
export function AccountScreen() {
  const { me, logout } = useSession();
  const { theme, setTheme, themes } = useTheme();

  return (
    <div className="account-screen" data-testid="account-screen">
      <header className="account-screen__header">
        <h1 className="account-screen__title">Cuenta</h1>
        <div className="account-screen__identity">
          <span className="account-screen__avatar" aria-hidden="true">
            {initial(me?.cliente_id)}
          </span>
          {/* TODO backend: nombre/email real desde /me (hoy `MeResponse` solo trae `cliente_id`,
              ver lib/api/types.ts). Usamos el mismo fallback derivado de `cliente_id` en la
              posición de "nombre" del diseño; no fabricamos un email inexistente. */}
          <p className="account-screen__name">{accountLabel(me?.cliente_id)}</p>
        </div>
      </header>

      <section className="account-screen__section" aria-label="Tema">
        <MonoLabel>Elegí el tema</MonoLabel>
        <div className="account-screen__theme-grid" role="group" aria-label="Selector de tema">
          {themes.map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={t === theme}
              data-testid={`theme-pill-${t}`}
              className={[
                'account-screen__theme-pill',
                t === theme ? 'account-screen__theme-pill--active' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => setTheme(t)}
            >
              {THEME_LABELS[t]}
            </button>
          ))}
        </div>
      </section>

      <div className="account-screen__list">
        {/* TODO backend: plan real desde /me (hoy no hay campo de plan/suscripción en
            `MeResponse`) — fila estática hasta que el backend lo exponga. */}
        <div className="account-screen__row">
          <span className="account-screen__row-label">Plan</span>
          <span className="account-screen__row-value">
            Profesional
            <ChevronIcon />
          </span>
        </div>
        <div className="account-screen__row">
          <span className="account-screen__row-label">Idioma</span>
          <span className="account-screen__row-value">
            Español (AR)
            <ChevronIcon />
          </span>
        </div>
        <div className="account-screen__row">
          <span className="account-screen__row-label">Notificaciones</span>
          <NotificationsToggle />
        </div>
      </div>

      <div className="account-screen__list">
        <div className="account-screen__row">
          <span className="account-screen__row-label">Privacidad del historial</span>
          <ChevronIcon />
        </div>
        <button type="button" className="account-screen__row" onClick={logout}>
          <span className="account-screen__row-label account-screen__row-label--danger">
            Cerrar sesión
          </span>
          <ChevronIcon color="var(--danger-fg)" />
        </button>
      </div>

      <Surface
        variant="bubble"
        blur
        className="account-screen__durability"
        data-testid="account-durability-card"
      >
        <PresenceOrb size={14} />
        <div className="account-screen__durability-text">
          <p className="account-screen__durability-title">Tu copiloto sigue activo</p>
          <p className="account-screen__durability-copy">
            Aunque cierres la app, nada se pierde. Retomá donde quedaron.
          </p>
        </div>
      </Surface>
    </div>
  );
}

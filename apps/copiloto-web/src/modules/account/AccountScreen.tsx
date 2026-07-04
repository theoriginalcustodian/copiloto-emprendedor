import { useState } from 'react';

import { Button, MonoLabel, PresenceOrb, Surface } from '../../design-system';
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
 */
export function AccountScreen() {
  const { me, logout } = useSession();
  const { theme, setTheme, themes } = useTheme();

  return (
    <div className="account-screen" data-testid="account-screen">
      <header className="account-screen__header">
        <span className="account-screen__avatar" aria-hidden="true">
          {initial(me?.cliente_id)}
        </span>
        <div>
          <h1 className="account-screen__title">Cuenta</h1>
          <p className="account-screen__subtitle">{accountLabel(me?.cliente_id)}</p>
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

      <Surface
        variant="bubble"
        blur
        className="account-screen__durability"
        data-testid="account-durability-card"
      >
        <PresenceOrb size={20} />
        <div className="account-screen__durability-text">
          <p className="account-screen__durability-title">Tu copiloto sigue activo</p>
          <p className="account-screen__durability-copy">
            Aunque cierres la app, nada se pierde. Retoma donde quedaron.
          </p>
        </div>
      </Surface>

      <section className="account-screen__section">
        <MonoLabel>Preferencias</MonoLabel>
        <div className="account-screen__list">
          <div className="account-screen__row">
            <span className="account-screen__row-label">Notificaciones</span>
            <NotificationsToggle />
          </div>
        </div>
      </section>

      <section className="account-screen__section">
        <MonoLabel>Privacidad y seguridad</MonoLabel>
        <div className="account-screen__list">
          <div className="account-screen__row account-screen__row--stacked">
            <span className="account-screen__row-label">Privacidad del historial</span>
            <span className="account-screen__row-hint">Próximamente</span>
          </div>
          <div className="account-screen__row account-screen__row--stacked">
            <span className="account-screen__row-label">¿Olvidaste tu contraseña?</span>
            <span className="account-screen__row-hint">
              Escribinos para recuperarla — todavía no hay reset automático por email.
            </span>
          </div>
        </div>
      </section>

      <Button variant="danger" className="account-screen__logout" onClick={logout}>
        Cerrar sesión
      </Button>
    </div>
  );
}

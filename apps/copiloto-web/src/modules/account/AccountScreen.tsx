import { useState } from 'react';

import { Button, PresenceOrb, Surface } from '../../design-system';
import { useSession } from '../../auth/useSession';
import './account.css';

/** `email` sale de `/me` (`apps/copiloto/web.py:625-636`) — mismo claim ya validado por
 * `require_tenant`, no una segunda fuente. `null`/ausente = login sin claim de email (teléfono,
 * anónimo, o `require_claims` apagado): se dice, no se inventa un placeholder que parezca real
 * (M-WEB módulo 13, confirmado contra el código del backend, no asumido). */
function accountLabel(me: { cliente_id?: string; email?: string | null } | undefined): string {
  if (me?.email) return me.email;
  if (!me?.cliente_id) return 'Tu cuenta';
  return 'Tu cuenta no tiene un email asociado.';
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
 * Módulo Cuenta (Task 21, EXTRACT §2.9/§3.4) — perfil + card de durabilidad + preferencias +
 * logout. Reemplaza el placeholder de Task 9.
 *
 * Header a 2 bloques (diseño `Copiloto App.dc.html:409-418` / `Copiloto Web.dc.html:330-337`,
 * mobile y desktop coinciden en estructura): H1 "Cuenta" solo arriba, fila identidad
 * (avatar+nombre+email) debajo — NO una sola fila horizontal con el H1 al lado del avatar.
 *
 * 🔴 **Fusión con `PantallaCuenta` de mobile (M-WEB módulo 13, 2026-08-04, decisión de
 * planificación).** Mobile tenía una sola pantalla de cuenta; acá también, por "espejo total" —
 * no dos superficies separadas. Lo que sumó esta fusión: email REAL (antes derivado de
 * `cliente_id`), la fila "No molestar" (inerte, misma razón que mobile: es un ajuste GLOBAL del
 * sistema operativo, requiere restaurador ante crash, se implementa en otra tarea) y la
 * confirmación antes de cerrar sesión. Lo que YA tenía web y mobile no (plan/idioma/
 * notificaciones/privacidad/card de durabilidad) se queda — es unión, no reemplazo.
 *
 * 🔴 **El selector de tema SALIÓ de acá (2026-08-06, pedido directo del operador).** Vivía en una
 * sección propia ("Elegí el tema") duplicando el selector del Rail de escritorio -- ahí quedaba
 * oculto por CSS (`desktop.css`), así que en escritorio "Apariencia" (que navegaba a este mismo
 * componente) no mostraba ningún control de apariencia. Movido a
 * `modules/ajustes/PantallaApariencia.tsx`, con sub-vista propia.
 */
export interface AccountScreenProps {
  /** SOP5 — navega al chat de soporte, que vive como `TabKey` fuera de `TABS` (mismo mecanismo que
   * `AjustesScreen.onNavegarTab`: unión angosta, no el `TabKey` completo del shell, para no atar
   * este módulo al registro entero). Opcional para no romper usos/tests que aún no lo pasan. */
  onNavegarTab?: (tab: 'soporte') => void;
}

export function AccountScreen({ onNavegarTab }: AccountScreenProps = {}) {
  const { me, logout } = useSession();
  const [confirmandoSalida, setConfirmandoSalida] = useState(false);

  return (
    <div className="account-screen" data-testid="account-screen">
      <header className="account-screen__header">
        <h1 className="account-screen__title">Cuenta</h1>
        <div className="account-screen__identity">
          <span className="account-screen__avatar" aria-hidden="true">
            {initial(me?.cliente_id)}
          </span>
          <p className="account-screen__name" data-testid="account-email">
            {accountLabel(me)}
          </p>
        </div>
      </header>

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
        {/* "No molestar" muta un ajuste GLOBAL del sistema operativo -- necesita un restaurador
            ante crash (si el copiloto lo prende y la app se cae antes de apagarlo, el teléfono
            queda en silencio sin que nadie lo haya decidido). Eso es MAYOR y se resuelve en otra
            tarea; sin `onClick` a propósito, mismo criterio que mobile (`PantallaCuenta.tsx`). */}
        <div className="account-screen__row" data-testid="account-no-molestar">
          <div className="account-screen__row-texts">
            <span className="account-screen__row-label">No molestar</span>
            <span className="account-screen__row-desc">
              Pendiente — muta un ajuste del sistema operativo, se implementa en otra tarea.
            </span>
          </div>
        </div>
      </div>

      <div className="account-screen__list">
        {/* SOP5 — `<button>`, no `<div>`: el rail ya aprendió esa lección (PR 299, "bloque de
            usuario MUERTO"). `onNavegarTab` es opcional para no romper contextos sin shell (tests,
            o un futuro consumidor que no navegue tabs); sin él la fila queda visible pero inerte,
            nunca oculta — visibilidad y funcionamiento son cosas distintas. */}
        <button
          type="button"
          className="account-screen__row"
          data-testid="account-soporte"
          onClick={() => onNavegarTab?.('soporte')}
        >
          <span className="account-screen__row-label">Soporte</span>
          <ChevronIcon />
        </button>
        <div className="account-screen__row">
          <span className="account-screen__row-label">Privacidad del historial</span>
          <ChevronIcon />
        </div>
        {!confirmandoSalida ? (
          <button
            type="button"
            className="account-screen__row"
            data-testid="account-cerrar-sesion"
            onClick={() => setConfirmandoSalida(true)}
          >
            <span className="account-screen__row-label account-screen__row-label--danger">
              Cerrar sesión
            </span>
            <ChevronIcon color="var(--danger-fg)" />
          </button>
        ) : (
          <div className="account-screen__confirmar-salida" data-testid="account-confirmar-salida">
            <p>
              Vas a tener que volver a entrar con tu usuario y contraseña. Tus datos y tus facturas
              no se borran.
            </p>
            <div className="account-screen__confirmar-salida-botones">
              <Button
                variant="danger"
                onClick={logout}
                data-testid="account-cerrar-sesion-si"
              >
                Sí, cerrar sesión
              </Button>
              <Button
                variant="ghost"
                onClick={() => setConfirmandoSalida(false)}
                data-testid="account-cerrar-sesion-no"
              >
                No
              </Button>
            </div>
          </div>
        )}
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

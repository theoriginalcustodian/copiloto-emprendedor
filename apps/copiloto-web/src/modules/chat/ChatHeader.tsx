import { PresenceOrb } from '../../design-system';
import { useSession } from '../../auth/useSession';
import './chat.css';

/**
 * Header de marca del Chat (Task 10, EXTRACT §2.2 — "restaurado", decisión congelada del plan:
 * este header vivía en `Direcciones.dc.html`/screenshots y se perdió en `App.dc.html` por
 * regresión de edición, ver EXTRACT §5 desviación #5). PresenceOrb + "Copiloto" (Clash 19/600) +
 * chip "ES-AR" (mono) + subtítulo "en línea · durable" (mono 11, minúscula — NO usa `MonoLabel`
 * porque ese primitivo fuerza `text-transform:uppercase`, que rompería este subtítulo) + avatar
 * inicial.
 *
 * Sin botón "Salir": el diseño NO pone "Cerrar sesión" en este header — el logout vive en Cuenta
 * (AccountScreen). El affordance temporal que existía acá (cuando Chat era la única pantalla
 * autenticada) se retiró al existir el tab Cuenta.
 */
export function ChatHeader() {
  const { me } = useSession();
  const initial = (me?.cliente_id?.trim()?.[0] ?? '?').toUpperCase();

  return (
    <header className="chat-header" data-testid="chat-header">
      <div className="chat-header__brand">
        <PresenceOrb size={20} />
        <div className="chat-header__text">
          <div className="chat-header__title-row">
            <span className="chat-header__title">Copiloto</span>
            <span className="chat-header__lang-chip" aria-hidden="true">
              ES-AR
            </span>
          </div>
          <span className="chat-header__status">en línea · durable</span>
        </div>
      </div>
      <div className="chat-header__meta">
        <span className="chat-header__avatar" aria-hidden="true">
          {initial}
        </span>
      </div>
    </header>
  );
}

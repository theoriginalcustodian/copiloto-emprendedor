import { Button, PresenceOrb } from '../../design-system';
import { useSession } from '../../auth/useSession';
import './chat.css';

export interface ChatHeaderProps {
  onLogout?: () => void;
}

/**
 * Header de marca del Chat (Task 10, EXTRACT §2.2 — "restaurado", decisión congelada del plan:
 * este header vivía en `Direcciones.dc.html`/screenshots y se perdió en `App.dc.html` por
 * regresión de edición, ver EXTRACT §5 desviación #5). PresenceOrb + "Copiloto" (Clash 19/600) +
 * chip "ES-AR" (mono) + subtítulo "en línea · durable" (mono 11, minúscula — NO usa `MonoLabel`
 * porque ese primitivo fuerza `text-transform:uppercase`, que rompería este subtítulo) + avatar
 * inicial.
 *
 * `onLogout` es un affordance TEMPORAL fuera del EXTRACT: el diseño real no pone "Cerrar sesión"
 * en este header (vive en Cuenta, Task 21, todavía no construida). Sin AppShell/TabBar (Task 9)
 * ni Cuenta, `ChatScreen` es HOY la única pantalla autenticada — sin esto no habría forma de
 * salir de la sesión. Documentado en el report para que el parent decida si lo retira cuando
 * Cuenta exista.
 */
export function ChatHeader({ onLogout }: ChatHeaderProps) {
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
        {onLogout && (
          <Button
            variant="ghost"
            className="chat-header__logout"
            onClick={onLogout}
            aria-label="Cerrar sesión"
          >
            Salir
          </Button>
        )}
        <span className="chat-header__avatar" aria-hidden="true">
          {initial}
        </span>
      </div>
    </header>
  );
}

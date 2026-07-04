import './chat.css';

export interface DesktopChatHeaderProps {
  /** `session_id` activo — se muestra un fragmento corto (`sess_9f2a`). */
  sessionId: string;
  /** Resetea la sesión y arranca una conversación nueva. */
  onNewConversation: () => void;
}

/** Ícono "+" del botón "Nueva conversación" (verbatim `Copiloto Web.dc.html:99`). */
function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Header de Chat de ESCRITORIO (verbatim `Copiloto Web.dc.html:94-102`) — barra de 52px con el
 * estado de sesión a la izquierda y el botón "Nueva conversación" a la derecha. Reemplaza al header
 * de MARCA de mobile (`ChatHeader.tsx`), que el diseño desktop NO usa. Sólo se monta desde
 * `ChatScreen` cuando `variant === 'desktop'`; el shell mobile jamás lo ve.
 */
export function DesktopChatHeader({ sessionId, onNewConversation }: DesktopChatHeaderProps) {
  const shortId = sessionId ? sessionId.replace(/-/g, '').slice(0, 4) : '····';
  return (
    <div className="desktop-chat-header" data-testid="desktop-chat-header">
      <div className="desktop-chat-header__session">
        <span className="desktop-chat-header__dot" aria-hidden="true" />
        SESIÓN ACTIVA · sess_{shortId}
      </div>
      <button
        type="button"
        className="desktop-chat-header__new"
        onClick={onNewConversation}
        data-testid="new-conversation"
      >
        <PlusIcon />
        Nueva conversación
      </button>
    </div>
  );
}

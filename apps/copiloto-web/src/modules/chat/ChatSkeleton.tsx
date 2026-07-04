import { useState, type CSSProperties, type FormEvent } from 'react';

import { Button, Surface } from '../../design-system';
import { useSession } from '../../auth/useSession';
import { useChat } from './useChat';

/**
 * Pantalla mínima funcional del chat (Task 8) — in-theme básico con primitivos, NO el diseño
 * final (burbujas/composer/voz pulidos son de otra fase, ver módulo Chat completo FASE 2/4).
 * Prueba la integración: login -> chat -> el agente responde (vía polling durable de useChat).
 */

const inputStyle: CSSProperties = {
  flex: 1,
  padding: '10px 12px',
  borderRadius: 10,
  border: '1px solid var(--cancel-border, rgba(150, 150, 180, 0.3))',
  background: 'transparent',
  color: 'inherit',
  font: 'inherit',
};

export function ChatSkeleton() {
  const { messages, sendStatus, send } = useChat();
  const { logout } = useSession();
  const [draft, setDraft] = useState('');

  const thinking = sendStatus === 'sending' || sendStatus === 'waiting';
  const canSend = draft.trim() !== '' && sendStatus !== 'sending';

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSend) return;
    const text = draft;
    setDraft('');
    void send(text);
  }

  return (
    <div className="app-frame" data-testid="chat-skeleton">
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh' }}>
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 16 }}>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 18 }}>Copiloto</span>
          <Button variant="ghost" onClick={logout}>
            Cerrar sesión
          </Button>
        </header>

        <main style={{ flex: 1, overflowY: 'auto', padding: '0 16px 16px' }}>
          {messages.length === 0 && (
            <p style={{ fontFamily: 'var(--font-mono)', color: 'var(--mono)', fontSize: 13 }}>
              Contame qué necesitás y arrancamos.
            </p>
          )}
          {messages.map((message) => (
            <div
              key={message.id}
              style={{ display: 'flex', justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start' }}
            >
              <Surface variant="bubble" blur style={{ marginBottom: 12, maxWidth: '85%' }}>
                <p style={{ fontSize: 14 }}>{message.text}</p>
                {message.choices && message.choices.length > 0 && (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                    {message.choices.map((choice) => (
                      <Button
                        key={choice.value}
                        variant="cancel"
                        onClick={() => void send(choice.value, { kind: 'callback' })}
                      >
                        {choice.label}
                      </Button>
                    ))}
                  </div>
                )}
              </Surface>
            </div>
          ))}
          {thinking && (
            <p role="status" style={{ fontFamily: 'var(--font-mono)', color: 'var(--mono)', fontSize: 13 }}>
              Pensando…
            </p>
          )}
          {sendStatus === 'timeout' && (
            <p role="alert" style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>
              Está tardando más de lo normal. Podés esperar o volver a intentar.
            </p>
          )}
          {sendStatus === 'error' && (
            <p role="alert" style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>
              No pudimos enviar tu mensaje. Probá de nuevo.
            </p>
          )}
        </main>

        <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 8, padding: 16 }}>
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Escribí tu mensaje…"
            disabled={sendStatus === 'sending'}
            style={inputStyle}
          />
          <Button type="submit" disabled={!canSend}>
            Enviar
          </Button>
        </form>
      </div>
    </div>
  );
}

import { useState, type KeyboardEvent } from 'react';

import { useMode } from '../../shell/modeStore';
import type { SendStatus } from './useChat';
import './chat.css';

export interface ComposerProps {
  sendStatus: SendStatus;
  /**
   * El 2do argumento es la `key` del modo activo (o `null` en modo general) — Composer la lee de
   * `useMode()` (estado GLOBAL, compartido con `modules/apps/AppsScreen`, Feature addendum
   * 2026-07-03) y la agrega a CADA envío. El caller (`ChatScreen`) solo la reenvía a
   * `useChat().send(text, { mode })` (spec §5 — sin endpoint nuevo, `mode` ya es opcional en
   * `ChatRequest`).
   */
  onSend: (text: string, mode: string | null) => void;
}

function StatusHint({ sendStatus }: { sendStatus: SendStatus }) {
  if (sendStatus === 'sending') {
    return (
      <p className="composer__status" role="status">
        Procesando…
      </p>
    );
  }
  if (sendStatus === 'waiting') {
    return (
      <p className="composer__status" role="status">
        Pensando… · Podés cerrar la app, te sigo respondiendo.
      </p>
    );
  }
  if (sendStatus === 'timeout') {
    return (
      <p className="composer__status composer__status--alert" role="alert">
        Está tardando más de lo normal. Podés esperar o volver a intentar.
      </p>
    );
  }
  if (sendStatus === 'error') {
    return (
      <p className="composer__status composer__status--alert" role="alert">
        No pudimos enviar tu mensaje. Probá de nuevo.
      </p>
    );
  }
  return null;
}

/**
 * `category` -> hint de acción corto del placeholder adaptado (spec §8). Data-driven por
 * CATEGORÍA (`ActiveMode.category`, ya viene del `CatalogService` elegido en `AppsScreen`), no por
 * servicio puntual — degrada con gracia a `DEFAULT_HINT` para categorías nuevas sin tocar este
 * archivo, mismo criterio que `CATEGORY_ICON` en `modules/apps/AppsScreen.tsx`.
 */
const CATEGORY_HINT: Record<string, string> = {
  pagos: 'decime monto y a quién…',
  comunicacion: 'mandá un mail a…',
  agenda: 'agendá o consultá un turno…',
  archivos: 'buscá o compartí un archivo…',
  clientes: 'buscá o guardá un cliente…',
  publicacion: 'preparé un posteo para…',
};
const DEFAULT_HINT = 'contame qué necesitás…';
const DEFAULT_PLACEHOLDER = 'Escribí tu mensaje…';

/**
 * Composer de texto (Task 15, EXTRACT §2.10 — solo la parte texto-only; el mic/voz es Task 19,
 * FASE 4, fuera de este scope: acá solo el slot deshabilitado, sin lógica de grabación). Enter
 * envía, Shift+Enter salta línea, vacío/solo-espacios no envía. Indicador de `sendStatus`
 * (procesando/pensando/tardando/error) + copy de durabilidad en `waiting`.
 *
 * Modo activo (Feature addendum 2026-07-03, spec §3/§6/§8): lee `useMode()` — el placeholder se
 * adapta ("Modo Mail: mandá un mail a…") y aparece un chip "Modo Mail ✕" pegado arriba del input.
 * FOCO BLANDO (spec §1): la adaptación es puramente visual — `canSend`/`submit` NUNCA validan
 * contra el modo, cualquier texto se envía igual (nunca se bloquea "fuera del modo").
 */
export function Composer({ sendStatus, onSend }: ComposerProps) {
  const [draft, setDraft] = useState('');
  const { mode, clearMode } = useMode();
  const canSend = draft.trim() !== '' && sendStatus !== 'sending';

  const placeholder = mode
    ? `Modo ${mode.label}: ${CATEGORY_HINT[mode.category] ?? DEFAULT_HINT}`
    : DEFAULT_PLACEHOLDER;

  function submit() {
    if (!canSend) return;
    const text = draft;
    setDraft('');
    onSend(text, mode?.key ?? null);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  }

  return (
    <div className="composer" data-testid="composer">
      {mode && (
        <div className="composer__mode-chip" data-testid="active-mode-chip">
          <span className="composer__mode-chip-label">Modo {mode.label}</span>
          <button
            type="button"
            className="composer__mode-chip-close"
            aria-label="Salir del modo"
            onClick={clearMode}
          >
            ✕
          </button>
        </div>
      )}

      <StatusHint sendStatus={sendStatus} />
      <form
        className="composer__row"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <button
          type="button"
          className="composer__mic"
          disabled
          aria-label="Grabar audio (próximamente)"
        >
          🎙
        </button>
        <textarea
          className="composer__input"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={1}
          disabled={sendStatus === 'sending'}
        />
        <button
          type="submit"
          className="composer__send"
          disabled={!canSend}
          aria-label="Enviar mensaje"
        >
          ↑
        </button>
      </form>
    </div>
  );
}

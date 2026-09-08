import './chat.css';

export interface RecordingOverlayProps {
  /** Milisegundos transcurridos desde que arrancó la grabación — se formatea a `mm:ss`. */
  elapsedMs: number;
  /** `true` cuando el usuario deslizó el dedo >46px hacia arriba ("fijado", manos libres). */
  locked: boolean;
  onCancel: () => void;
  onSend: () => void;
}

function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Overlay de grabación (Task 19, EXTRACT §2.10 "estado grabando"; recontenido 2026-09-08 — Revisión
 * 24/08 de `03-home-conversacional/DECISIONES.md`: "no se tapa nada", vive DENTRO de la barra del
 * composer en vez de un scrim full-screen) — puramente presentacional, el gesto/MediaRecorder viven
 * en `MicButton`. El waveform SVG de 420×96 del diseño original no entra en una barra de ~54px de
 * alto y se retira; dot rojo (`recdot`) + timer mono + sub-estados:
 *   - **unlocked** (dedo sostenido): hint "Soltá para enviar · deslizá ↑ para fijar".
 *   - **locked** (deslizó >46px, `MicButton` decide el threshold): botones Cancelar/Enviar.
 */
export function RecordingOverlay({ elapsedMs, locked, onCancel, onSend }: RecordingOverlayProps) {
  return (
    <div
      className="recording-overlay"
      data-testid="recording-overlay"
      role="status"
      aria-live="polite"
    >
      <div className="recording-overlay__meta">
        <span className="recording-overlay__dot" aria-hidden="true" />
        <span className="recording-overlay__timer">{formatElapsed(elapsedMs)}</span>
      </div>

      {locked ? (
        <div className="recording-overlay__actions">
          <button type="button" className="recording-overlay__cancel" onClick={onCancel}>
            Cancelar
          </button>
          <button
            type="button"
            className="recording-overlay__send"
            onClick={onSend}
            aria-label="Enviar audio"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M12 19V5M5 12l7-7 7 7"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      ) : (
        <p className="recording-overlay__hint">
          Soltá para enviar · deslizá <span className="recording-overlay__hint-arrow">↑</span> para
          fijar
        </p>
      )}
    </div>
  );
}

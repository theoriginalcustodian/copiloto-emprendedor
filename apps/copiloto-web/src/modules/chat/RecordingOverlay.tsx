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
 * Overlay full-screen de grabación (Task 19, EXTRACT §2.10 "estado grabando") — puramente
 * presentacional, el gesto/MediaRecorder viven en `MicButton` (que la monta/desmonta). Waveform
 * (barras con keyframe `wavePulse`, ya en motion.css) + dot rojo (`recdot`) + timer mono +
 * sub-estados:
 *   - **unlocked** (dedo sostenido): hint "Soltá para enviar · deslizá ↑ para fijar".
 *   - **locked** (deslizó >46px, `MicButton` decide el threshold): botones Cancelar/Enviar.
 */
export function RecordingOverlay({ elapsedMs, locked, onCancel, onSend }: RecordingOverlayProps) {
  return (
    <div className="recording-overlay" data-testid="recording-overlay" role="status" aria-live="polite">
      <div className="recording-overlay__waveform" aria-hidden="true">
        {Array.from({ length: 6 }, (_, index) => (
          <span
            key={index}
            className="recording-overlay__wave-bar"
            style={{ animationDelay: `${index * 0.08}s` }}
          />
        ))}
      </div>

      <div className="recording-overlay__meta">
        <span className="recording-overlay__dot" aria-hidden="true" />
        <span className="recording-overlay__timer">{formatElapsed(elapsedMs)}</span>
      </div>

      {locked ? (
        <div className="recording-overlay__actions">
          <button type="button" className="uc-btn uc-btn--cancel" onClick={onCancel}>
            Cancelar
          </button>
          <button
            type="button"
            className="recording-overlay__send"
            onClick={onSend}
            aria-label="Enviar audio"
          >
            ↑
          </button>
        </div>
      ) : (
        <p className="recording-overlay__hint">Soltá para enviar · deslizá ↑ para fijar</p>
      )}
    </div>
  );
}

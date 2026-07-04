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

/** Las 6 curvas del waveform (verbatim diseño Copiloto App.dc.html:280-285): solo difieren en el
 * punto de control Y (`cy`), el grosor y la opacidad; la cola `T…` es constante. */
const WAVE_TAIL =
  'T70,48 T105,48 T140,48 T175,48 T210,48 T245,48 T280,48 T315,48 T350,48 T385,48 T420,48';
const WAVES: ReadonlyArray<{ cy: number; sw: number; op: number }> = [
  { cy: 12, sw: 1.4, op: 0.95 },
  { cy: 20, sw: 1.3, op: 0.75 },
  { cy: 28, sw: 1.2, op: 0.6 },
  { cy: 36, sw: 1.1, op: 0.45 },
  { cy: 4, sw: 1.3, op: 0.85 },
  { cy: -6, sw: 1, op: 0.35 },
];
const WAVE_GRADIENT_ID = 'uc-wave-gradient';

/**
 * Overlay full-screen de grabación (Task 19, EXTRACT §2.10 "estado grabando") — puramente
 * presentacional, el gesto/MediaRecorder viven en `MicButton` (que lo monta por PORTAL a <body>
 * para que `position:fixed` cubra el viewport real, no la cajita del composer). Waveform SVG del
 * diseño (gradiente cian→azul→violeta→magenta, 6 curvas apiladas, animado por `wavePulse` sobre el
 * grupo + `waveSlide` por dentro) + dot rojo (`recdot`) + timer mono + sub-estados:
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
      <div className="recording-overlay__waveform" aria-hidden="true">
        <svg
          className="recording-overlay__wave-svg"
          width="420"
          height="96"
          viewBox="0 0 420 96"
        >
          <defs>
            <linearGradient id={WAVE_GRADIENT_ID} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" style={{ stopColor: 'var(--wave-stop-0)' }} />
              <stop offset="0.3" style={{ stopColor: 'var(--wave-stop-1)' }} />
              <stop offset="0.55" style={{ stopColor: 'var(--wave-stop-2)' }} />
              <stop offset="0.8" style={{ stopColor: 'var(--wave-stop-3)' }} />
              <stop offset="1" style={{ stopColor: 'var(--wave-stop-0)' }} />
            </linearGradient>
          </defs>
          <g className="recording-overlay__wave-pulse">
            <g className="recording-overlay__wave-slide">
              {WAVES.map((wave, index) => (
                <path
                  key={index}
                  d={`M0,48 Q17.5,${wave.cy} 35,48 ${WAVE_TAIL}`}
                  fill="none"
                  stroke={`url(#${WAVE_GRADIENT_ID})`}
                  strokeWidth={wave.sw}
                  opacity={wave.op}
                />
              ))}
            </g>
          </g>
        </svg>
      </div>

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

import { useEffect, type CSSProperties } from 'react';

import './EntradaDiaria.css';
import { ENTRADA_FADE_MS, ENTRADA_TOTAL_MS } from './tempos';

/** Arcos/ondas — `explorations/isotipo-david/entrada.html` (viewBox 0 0 24 24, pathLength=100
 * independiza el draw-on de la longitud real del path). */
const ARCOS = [
  { d: 'M11 3.5a8.5 8.5 0 1 0 0 17', duracion: 420, delay: 0 },
  { d: 'M11 7.5a4.5 4.5 0 1 0 0 9', duracion: 340, delay: 140 },
];
const ONDAS = [
  { d: 'M16.5 8.8a4.8 4.8 0 0 1 0 6.4', duracion: 460, delay: 300 },
  { d: 'M19.5 6.5a9 9 0 0 1 0 11', duracion: 460, delay: 420 },
];

function usePrefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * BL-X10 — entrada diaria: arranques 2..n con token restaurado. Cubre la latencia de `/me`, NO es
 * el splash de identidad acelerado (`Splash.tsx`) — duración total provisional (~1,5 s, ver
 * `tempos.ts`), a ajustar contra la carga real de "Mi día".
 */
export function EntradaDiaria({ onFin }: { onFin: () => void }) {
  const reducido = usePrefersReducedMotion();

  useEffect(() => {
    const ms = reducido ? 0 : ENTRADA_TOTAL_MS;
    const t = window.setTimeout(onFin, ms);
    return () => window.clearTimeout(t);
  }, [reducido, onFin]);

  const fadeStyle: CSSProperties = reducido
    ? { animation: 'none' }
    : { animationDelay: `${ENTRADA_TOTAL_MS - ENTRADA_FADE_MS}ms`, animationDuration: `${ENTRADA_FADE_MS}ms` };

  return (
    <div className="identidad-entrada" data-testid="identidad-entrada" style={fadeStyle}>
      <svg className="identidad-entrada__signo" viewBox="0 0 24 24" aria-hidden="true">
        {ARCOS.map((a) => (
          <path
            key={a.d}
            className="identidad-entrada__trazo"
            d={a.d}
            pathLength={100}
            style={
              reducido
                ? undefined
                : { animationDuration: `${a.duracion}ms`, animationDelay: `${a.delay}ms` }
            }
          />
        ))}
        {ONDAS.map((o) => (
          <path
            key={o.d}
            className="identidad-entrada__onda"
            d={o.d}
            style={
              reducido
                ? undefined
                : { animationDuration: `${o.duracion}ms`, animationDelay: `${o.delay}ms` }
            }
          />
        ))}
      </svg>
    </div>
  );
}

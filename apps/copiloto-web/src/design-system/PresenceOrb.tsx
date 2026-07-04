import { useEffect, useState, type CSSProperties } from 'react';

import './motion.css';

export interface PresenceOrbProps {
  /** Override en px de `--core-size` (default: el del tema activo). */
  size?: number;
  className?: string;
}

const REDUCE_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

function readPrefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia(REDUCE_MOTION_QUERY).matches;
}

/**
 * Hook local — jsdom (tests) no evalúa `@media (prefers-reduced-motion)` contra la preferencia
 * del SO, así que la regla CSS global (design-system/global.css) no es suficiente para que el
 * comportamiento "no anima" sea verificable por test. Por eso PresenceOrb chequea `matchMedia`
 * en JS y decide en base a eso, en vez de confiar solo en la cascada CSS (que sí cubre a todos
 * los demás componentes con `animation`, ver motion.css).
 */
function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(readPrefersReducedMotion);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia(REDUCE_MOTION_QUERY);
    const handleChange = () => setReduced(mql.matches);
    mql.addEventListener?.('change', handleChange);
    return () => mql.removeEventListener?.('change', handleChange);
  }, []);

  return reduced;
}

/**
 * Punto de presencia "vivo" (EXTRACT §2.1/§2.9): anillo(s) `--halo` (keyframe `ring`) + núcleo
 * `--core` (keyframe `core`, glow `--core-glow`), tamaño `--core-size`. Reutilizable en el
 * header de Chat (Task 10) y en la card de durabilidad de Cuenta (Task 21).
 */
export function PresenceOrb({ size, className }: PresenceOrbProps) {
  const reducedMotion = usePrefersReducedMotion();
  const style = size ? ({ '--core-size': `${size}px` } as CSSProperties) : undefined;

  return (
    <span
      className={['presence-orb', className].filter(Boolean).join(' ')}
      style={style}
      data-testid="presence-orb"
      data-reduced-motion={reducedMotion}
    >
      <span
        className={`presence-orb__halo${reducedMotion ? ' presence-orb__halo--static' : ''}`}
        aria-hidden="true"
      />
      <span
        className={`presence-orb__core${reducedMotion ? ' presence-orb__core--static' : ''}`}
        aria-hidden="true"
      />
    </span>
  );
}

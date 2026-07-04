import type { CSSProperties, HTMLAttributes } from 'react';

import './motion.css';
import './primitives.css';

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  width?: CSSProperties['width'];
  height?: CSSProperties['height'];
  radius?: CSSProperties['borderRadius'];
}

/**
 * Placeholder de carga (shimmer, keyframe en motion.css). La regla global de reduced-motion
 * (design-system/global.css) ya fuerza `animation-duration ~ 0` bajo
 * `prefers-reduced-motion: reduce`, así que el shimmer queda estático automáticamente sin
 * lógica JS adicional acá (a diferencia de PresenceOrb, que sí la necesita — ver motion.css).
 */
export function Skeleton({
  width = '100%',
  height = 16,
  radius = 10,
  style,
  className,
  ...rest
}: SkeletonProps) {
  return (
    <div
      className={['uc-skeleton', className].filter(Boolean).join(' ')}
      style={{ width, height, borderRadius: radius, ...style }}
      {...rest}
      aria-hidden="true"
    />
  );
}

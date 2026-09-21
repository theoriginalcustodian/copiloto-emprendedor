/**
 * `Marca` — el isotipo Odobi (O concéntrica + 2 ondas, geometría canónica de
 * `docs/Imagen de marca/isotipo-odobi/*.svg`) sobre un badge redondeado. Port de
 * `apps/mobile/src/theme/Marca.tsx`: mismos 4 trazos, mismo trazo **1,3 plano** (decisión de Martín,
 * DEC-10) y misma proporción símbolo/badge.
 *
 * Cero color propio: badge `--btn-bg` y signo `--btn-fg` (el par de la acción primaria, que ya está
 * verificado para contraste en las tres pieles). El trazo se predivide por la escala para verse
 * igual de fino a cualquier tamaño (mismo mecanismo que mobile), y el isotipo va inline: sin asset.
 */
interface MarcaProps {
  size?: number;
}

const ISOTIPO_VIEWBOX = 24;
const ISOTIPO_STROKE_BASE = 1.3;
const ISOTIPO_RATIO = 34 / 80;
const TRAZOS = [
  'M11 3.5a8.5 8.5 0 1 0 0 17',
  'M11 7.5a4.5 4.5 0 1 0 0 9',
  'M16.5 8.8a4.8 4.8 0 0 1 0 6.4',
  'M19.5 6.5a9 9 0 0 1 0 11',
];

export function Marca({ size = 64 }: MarcaProps) {
  const simbolo = size * ISOTIPO_RATIO;
  const escala = simbolo / ISOTIPO_VIEWBOX;
  const offset = (size - simbolo) / 2;

  return (
    <span
      data-testid="marca"
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.3),
        background: 'var(--btn-bg)',
        color: 'var(--btn-fg)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} fill="none" stroke="currentColor">
        <g transform={`translate(${offset} ${offset}) scale(${escala})`}>
          {TRAZOS.map((d, i) => (
            <path
              key={i}
              data-testid={`marca-isotipo-trazo-${i + 1}`}
              d={d}
              strokeWidth={ISOTIPO_STROKE_BASE / escala}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
        </g>
      </svg>
    </span>
  );
}

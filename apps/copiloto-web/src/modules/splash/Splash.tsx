import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';

import { PRONUNCIACION_MARCA } from '@copiloto/core';

import { Button } from '../../design-system';
import { scallopPath } from './scallopPath';
import './Splash.css';
import { BLOB_STAGGER, SPLASH_TOTAL_MS, T_O, T_WORDMARK, LETTER_STAGGER } from './tempos';

type Blob = {
  key: string;
  r0: number;
  r1: number;
  background?: string;
  borderRadius?: string;
  svg?: boolean;
  last?: boolean;
};

/** Orden de nacimiento — colores y rotaciones de `explorations/splash-o/v2-inmersivo.html`. */
const BLOBS: readonly Blob[] = [
  { key: 'scallop', r0: 8, r1: -26, svg: true },
  { key: 'squircle', r0: -12, r1: 34, background: 'linear-gradient(160deg,#E8A088,#DE7250)', borderRadius: '34%' },
  {
    key: 'super',
    r0: -6,
    r1: 22,
    background: '#FFFFFF',
    borderRadius: '58% 42% 47% 53% / 47% 55% 45% 53%',
  },
  {
    key: 'egg',
    r0: 10,
    r1: -16,
    background: 'linear-gradient(155deg,#DE7250,#B04A2E)',
    borderRadius: '46% 54% 52% 48% / 53% 46% 54% 47%',
    last: true,
  },
];

const LETRAS = ['d', 'o', 'b', 'i'];

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

export interface SplashCta {
  primario: string;
  /** Vacío = no hay alta pública todavía (BETA-4b): el botón secundario no se dibuja. */
  secundario: string;
  onPrimario: () => void;
  onSecundario: () => void;
}

/**
 * BL-X10 — identidad (splash): primer ingreso / post-logout, 4 formas colapsando (y desvaneciéndose)
 * en el lugar donde entra la "O" real del wordmark "Odobi" (glifo de texto, no la forma) + reveal de
 * pronunciación. UNA vez por ingreso (no es la entrada diaria acelerada, ver `EntradaDiaria.tsx` —
 * `splash-port-reanimada.md`).
 *
 * H-A4-2: la "O" es un `<span>` de texto — el mismo lockup del prototipo
 * (`explorations/splash-o/v2-inmersivo.html`, `<span class="o">O</span>` + `<span class="rest">`),
 * no la forma que colapsa. La forma sólo simula el tránsito (crece, se contrae, se desvanece a
 * `opacity:0`) mientras la "O" real hace fade-in por debajo — si la forma quedara visible sería un
 * disco permanente tapando la palabra, que es el bug que este componente tenía antes del fix.
 *
 * `--ox` (destino X del colapso del último blob) se mide contra el ancho de "dobi" SIN la "O"
 * (`.identidad-splash__rest`, igual que el prototipo: `rest.getBoundingClientRect().width/2`), no
 * un valor fijo: depende de la fuente/tamaño real (spec §7).
 *
 * `cta` (BL-X12w, `?ver=volver`): el MISMO aterrizaje sirve para el post-logout — no es una
 * segunda pantalla, sólo agrega las dos puertas al reveal ya existente (gemelo de mobile
 * `RevealEntrada`, PR #597 — "no hay un segundo splash"). Sin `cta`, el reveal es el de siempre.
 */
export function Splash({
  onFin,
  cta,
  pronunciacionAsset,
}: {
  onFin: () => void;
  cta?: SplashCta;
  /** BL-X10 (fila 2) — asset de audio real; sin él (`undefined`/`null`), sin botón. Gemelo de mobile `RevealEntrada`. */
  pronunciacionAsset?: string | null;
}) {
  const reducido = usePrefersReducedMotion();
  const restRef = useRef<HTMLSpanElement>(null);
  const [ox, setOx] = useState<number | null>(null);

  useEffect(() => {
    if (restRef.current) setOx(-restRef.current.getBoundingClientRect().width / 2);
  }, []);

  useEffect(() => {
    const ms = reducido ? 0 : SPLASH_TOTAL_MS;
    const t = window.setTimeout(onFin, ms);
    return () => window.clearTimeout(t);
  }, [reducido, onFin]);

  const containerStyle = useMemo<CSSProperties>(
    () => (ox !== null ? ({ '--ox': `${ox}px` } as CSSProperties) : {}),
    [ox],
  );

  return (
    <div className="identidad-splash" data-testid="identidad-entrada" style={containerStyle}>
      {/* H-A4-2: con movimiento reducido, las 4 formas NO se dibujan (igual que el prototipo,
          `.play .blob{opacity:0!important}` sin excepción) — la "O" completa la sigue el glifo
          de texto de abajo, no una forma congelada. */}
      {!reducido && (
        <div className="identidad-splash__formas" aria-hidden="true">
          {BLOBS.map((b, i) => {
            const style: CSSProperties = {
              animationDelay: `${i * BLOB_STAGGER}ms`,
              background: b.background,
              borderRadius: b.borderRadius,
              ['--rot0' as string]: `${b.r0}deg`,
              ['--rot1' as string]: `${b.r1}deg`,
            };
            return (
              <div
                key={b.key}
                className={`identidad-splash__blob${b.last ? ' identidad-splash__blob--last' : ''}`}
                style={style}
              >
                {b.svg && (
                  <svg viewBox="0 0 1 1" width="100%" height="100%">
                    <path d={scallopPath()} fill="#1A1512" />
                  </svg>
                )}
              </div>
            );
          })}
        </div>
      )}

      <span className="identidad-splash__wordmark">
        <span
          className="identidad-splash__o"
          style={{
            animationDelay: reducido ? '0ms' : `${T_O}ms`,
            opacity: reducido ? 1 : undefined,
            transform: reducido ? 'none' : undefined,
          }}
        >
          O
        </span>
        <span className="identidad-splash__rest" ref={restRef}>
          {LETRAS.map((l, i) => (
            <span
              key={l + i}
              className="identidad-splash__letra"
              style={{
                animationDelay: reducido ? '0ms' : `${T_WORDMARK + i * LETTER_STAGGER}ms`,
                opacity: reducido ? 1 : undefined,
                transform: reducido ? 'none' : undefined,
              }}
            >
              {l}
            </span>
          ))}
        </span>
      </span>

      <div
        className="identidad-splash__reveal"
        style={reducido ? { opacity: 1, animation: 'none' } : undefined}
      >
        <div className="identidad-splash__caption">
          <span>{PRONUNCIACION_MARCA}</span>
          {pronunciacionAsset != null && (
            <button
              type="button"
              className="identidad-splash__pronunciar"
              aria-label="Escuchar cómo se pronuncia Odobi"
              onClick={() => new Audio(pronunciacionAsset).play().catch(() => {})}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M6.9 4.54c-.4-.24-.9.05-.9.51v13.9c0 .46.5.75.9.51l11.72-6.95c.4-.23.4-.8 0-1.03L6.9 4.54Z" />
              </svg>
            </button>
          )}
        </div>

        {cta && (
          <div className="identidad-splash__cta">
            <Button variant="primary" onClick={cta.onPrimario}>
              {cta.primario}
            </Button>
            {cta.secundario !== '' && (
              <Button variant="ghost" onClick={cta.onSecundario}>
                {cta.secundario}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

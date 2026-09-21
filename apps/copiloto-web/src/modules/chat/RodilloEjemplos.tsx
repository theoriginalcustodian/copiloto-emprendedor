import { useEffect, useState } from 'react';

import { EJEMPLOS_CHAT } from '@copiloto/core';

import './chat.css';

/** Cada cuánto cambia el ejemplo (BL-W4: «un ejemplo por vez cada ~4 s»). */
export const MS_POR_EJEMPLO = 4000;

const REDUCE_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

function leerReducido(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia(REDUCE_MOTION_QUERY).matches;
}

/** jsdom no evalúa `@media (prefers-reduced-motion)`: se lee en JS, igual que `PresenceOrb`. */
function useMovimientoReducido(): boolean {
  const [reducido, setReducido] = useState(leerReducido);
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia(REDUCE_MOTION_QUERY);
    const alCambiar = () => setReducido(mql.matches);
    mql.addEventListener?.('change', alCambiar);
    return () => mql.removeEventListener?.('change', alCambiar);
  }, []);
  return reducido;
}

/**
 * El rodillo de ejemplos del chat vacío (BL-W4): un ejemplo por vez, dicho como lo diría el usuario.
 * Las frases van superpuestas (mismo criterio que mobile: sin rebobinado) y sólo la activa está
 * expuesta al lector de pantalla.
 *
 * **WCAG 2.2.2** — movimiento automático de más de 5 s necesita pausa: hay botón Pausar/Reanudar, y con
 * `prefers-reduced-motion` el rodillo queda QUIETO en el primer ejemplo y no ofrece pausa (no hay
 * nada que pausar).
 */
export function RodilloEjemplos() {
  const [indice, setIndice] = useState(0);
  const [pausado, setPausado] = useState(false);
  const reducido = useMovimientoReducido();
  const corre = !pausado && !reducido;

  useEffect(() => {
    if (!corre) return;
    const timer = setInterval(() => setIndice((i) => (i + 1) % EJEMPLOS_CHAT.length), MS_POR_EJEMPLO);
    return () => clearInterval(timer);
  }, [corre]);

  return (
    <div className="rodillo" data-testid="rodillo-ejemplos">
      <div className="rodillo__ventana">
        {EJEMPLOS_CHAT.map((frase, i) => {
          const posicion = i === indice ? 'activa' : i === (indice - 1 + EJEMPLOS_CHAT.length) % EJEMPLOS_CHAT.length ? 'sale' : 'espera';
          return (
            <p
              key={frase}
              className={`rodillo__frase rodillo__frase--${posicion}`}
              data-testid={`rodillo-frase-${i}`}
              aria-hidden={posicion !== 'activa'}
            >
              {frase}
            </p>
          );
        })}
      </div>
      {!reducido && (
        <button
          type="button"
          className="rodillo__pausa"
          onClick={() => setPausado((p) => !p)}
          aria-pressed={pausado}
          data-testid="rodillo-pausa"
        >
          {pausado ? 'Reanudar ejemplos' : 'Pausar ejemplos'}
        </button>
      )}
    </div>
  );
}

import { describe, expect, it } from 'vitest';

// eslint-disable-next-line import/no-unresolved -- `?raw` es una convención de Vite (import de
// texto crudo), mismo patrón que `midiaNoHexLiterals.test.ts`.
import midiaCss from './midia.css?raw';

/**
 * BL-D6: las tarjetas de «Para hoy» se veían en blanco colapsadas. `alto` del `<p>` colapsado medido
 * en vivo (DevTools) daba un valor real (no 0) y el texto reaparecía al expandir (que saca esta
 * clase y fuerza un reflow) — no es un bug de layout, es de PINTADO: sin la propiedad estándar
 * `line-clamp`, Chromium depende sólo del modelo legado `-webkit-box`, que a veces no repinta el
 * texto tras el font-swap hasta el próximo reflow. `connections.css` (`service-card__description`,
 * `:162-166`) ya tiene ambas propiedades y nunca mostró este bug en el barrido BL-Q3 — este test
 * exige el mismo patrón acá.
 */
describe('midia.css — .midia-tarjeta__frase--clamp trae la propiedad estándar line-clamp', () => {
  it('declara line-clamp junto a -webkit-line-clamp (no sólo el legado)', () => {
    const match = midiaCss.match(/\.midia-tarjeta__frase--clamp\s*\{([^}]*)\}/);
    expect(match, 'no se encontró la regla .midia-tarjeta__frase--clamp en midia.css').not.toBeNull();
    const cuerpo = match?.[1] ?? '';
    expect(cuerpo).toMatch(/-webkit-line-clamp:\s*2/);
    // La propiedad estándar, NO precedida por "-webkit-" — evita que el match anterior la disfrace.
    expect(cuerpo).toMatch(/(?<!-webkit-)\bline-clamp:\s*2/);
  });
});

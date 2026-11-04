import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Marca } from './Marca';

describe('Marca', () => {
  it('dibuja los 4 trazos con 1,3 en unidades del viewBox de 24: el grosor renderizado ESCALA con el tamaño', () => {
    // 🔴 Antes el test afirmaba `attr × escala = 1,3` (px absolutos a cualquier tamaño) y era verde POR el
    // defecto: a 96 px el isotipo salía 4× más fino que el del prototipo. La regla correcta es la de
    // EntradaDiaria: `stroke-width: 1.3` sobre viewBox 24, sin predividir.
    const efectivo = (size: number) => {
      const { unmount } = render(<Marca size={size} />);
      const attrs: number[] = [];
      for (let i = 1; i <= 4; i++) {
        attrs.push(Number(screen.getByTestId(`marca-isotipo-trazo-${i}`).getAttribute('stroke-width')));
      }
      unmount();
      const escala = (size * (34 / 80)) / 24;
      return { attrs, px: attrs[0]! * escala };
    };
    for (const size of [24, 44, 96]) {
      expect(efectivo(size).attrs).toEqual([1.3, 1.3, 1.3, 1.3]);
    }
    // Proporcional: duplicar el tamaño duplica el trazo renderizado (con el bug eran iguales).
    expect(efectivo(96).px / efectivo(48).px).toBeCloseTo(2, 5);
    expect(efectivo(96).px).toBeCloseTo(1.3 * ((96 * (34 / 80)) / 24), 5);
  });

  it('usa los tokens de la acción primaria, sin color propio', () => {
    render(<Marca />);
    const badge = screen.getByTestId('marca');
    expect(badge.style.background).toContain('var(--btn-bg)');
    expect(badge.style.color).toContain('var(--btn-fg)');
  });
});

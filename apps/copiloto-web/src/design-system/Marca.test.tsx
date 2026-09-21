import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Marca } from './Marca';

describe('Marca', () => {
  it('dibuja los 4 trazos del isotipo con el trazo plano 1,3 (independiente del tamaño)', () => {
    for (const size of [24, 44, 96]) {
      const { unmount } = render(<Marca size={size} />);
      for (let i = 1; i <= 4; i++) {
        const trazo = screen.getByTestId(`marca-isotipo-trazo-${i}`);
        const escala = (size * (34 / 80)) / 24;
        // stroke-width en el espacio del grupo escalado: el efectivo (× escala) es siempre 1,3.
        expect(Number(trazo.getAttribute('stroke-width')) * escala).toBeCloseTo(1.3, 5);
      }
      unmount();
    }
  });

  it('usa los tokens de la acción primaria, sin color propio', () => {
    render(<Marca />);
    const badge = screen.getByTestId('marca');
    expect(badge.style.background).toContain('var(--btn-bg)');
    expect(badge.style.color).toContain('var(--btn-fg)');
  });
});

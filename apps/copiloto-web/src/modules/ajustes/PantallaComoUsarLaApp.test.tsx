import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { tomarPendiente, TEMAS_AYUDA } from '@copiloto/core';

import { PantallaComoUsarLaApp } from './PantallaComoUsarLaApp';

describe('PantallaComoUsarLaApp (BL-W9)', () => {
  it('muestra los 5 temas', () => {
    render(<PantallaComoUsarLaApp onAbrirChat={vi.fn()} />);
    expect(screen.getAllByTestId(/^como-usar-tema-/)).toHaveLength(5);
  });

  it.each(TEMAS_AYUDA.map((t, i) => [i, t.pregunta] as const))(
    'el tema %i deja SU pregunta en el buzón y abre el chat principal',
    (i, pregunta) => {
      const onAbrirChat = vi.fn();
      render(<PantallaComoUsarLaApp onAbrirChat={onAbrirChat} />);
      fireEvent.click(screen.getByTestId(`como-usar-tema-${i}`));
      expect(onAbrirChat).toHaveBeenCalledTimes(1);
      expect(tomarPendiente()).toBe(pregunta);
    },
  );
});

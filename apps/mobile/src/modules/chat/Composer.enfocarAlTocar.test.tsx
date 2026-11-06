/**
 * SM-P16 — el campo bajo un gesto de arrastre (pie de Mi día): el input no toma el toque (si lo tomara, el
 * teclado se abriría en pleno arrastre) y el toque de un `Pressable` encima lo enfoca.
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { ThemeProvider } from '../../theme/ThemeProvider';
import { Composer } from './Composer';

async function montar(props: { enfocarAlTocar?: boolean }) {
  await render(
    <ThemeProvider>
      <Composer sendStatus="idle" onSend={() => {}} {...props} />
    </ThemeProvider>,
  );
}

describe('Composer.enfocarAlTocar', () => {
  it('con enfocarAlTocar: el input es inerte al toque y hay una superficie de toque que lo enfoca', async () => {
    await montar({ enfocarAlTocar: true });
    expect(screen.getByTestId('chat-composer').props.pointerEvents).toBe('none');
    // El foco real (teclado) sólo se ejerce en device; acá se prueba que la superficie existe y tocarla no rompe.
    await fireEvent.press(screen.getByTestId('chat-composer-tocar'));
    expect(screen.getByTestId('chat-composer')).toBeTruthy();
  });

  it('sin enfocarAlTocar: el input recibe el toque como siempre y no hay superficie encima', async () => {
    await montar({});
    expect(screen.getByTestId('chat-composer').props.pointerEvents).toBeUndefined();
    expect(screen.queryByTestId('chat-composer-tocar')).toBeNull();
  });
});

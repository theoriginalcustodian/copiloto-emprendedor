import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

// Jest (jest-expo) -- describe/it/expect/jest son globales, no se importan de vitest.

import { ThemeProvider } from '../../theme/ThemeProvider';
import { Composer } from './Composer';

function renderComposer(props: Partial<React.ComponentProps<typeof Composer>> = {}) {
  return render(
    <ThemeProvider>
      <Composer sendStatus="idle" onSend={jest.fn()} {...props} />
    </ThemeProvider>,
  );
}

describe('Composer -- botón de foto (Gastos Fase 2, la única excepción a "sin botones propios")', () => {
  it('sin `onFoto`, el botón de cámara NO existe -- default es el composer sin excepciones', async () => {
    await renderComposer();
    await waitFor(() => expect(screen.getByTestId('chat-composer')).toBeTruthy());
    expect(screen.queryByTestId('chat-foto')).toBeNull();
  });

  it('con `onFoto`, el botón existe y lo dispara al tocarlo', async () => {
    const onFoto = jest.fn();
    await renderComposer({ onFoto });
    await waitFor(() => expect(screen.getByTestId('chat-foto')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('chat-foto'));

    expect(onFoto).toHaveBeenCalledTimes(1);
  });

  it('`disabled` también deshabilita el botón de foto -- no sólo el de enviar', async () => {
    const onFoto = jest.fn();
    await renderComposer({ onFoto, disabled: true });
    await waitFor(() => expect(screen.getByTestId('chat-foto')).toBeTruthy());

    expect(screen.getByTestId('chat-foto').props.accessibilityState?.disabled).toBe(true);
  });
});

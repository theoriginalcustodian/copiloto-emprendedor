import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import '../../design-system/themes.css';
import { Composer, type ComposerProps } from './Composer';

/**
 * `onSendAudio` (Task 19) tiene un default `vi.fn()` acá para no tener que tocar cada `it(...)`
 * existente que llamaba `renderComposer({sendStatus, onSend})` antes de que el mic real existiera
 * — los tests de `MicButton`/`onSendAudio` en sí viven en `MicButton.test.tsx`.
 */
function renderComposer(props: Partial<ComposerProps> = {}) {
  const merged: ComposerProps = { sendStatus: 'idle', onSend: vi.fn(), onSendAudio: vi.fn(), ...props };
  return render(<Composer {...merged} />);
}

describe('Composer', () => {
  it('Enter envía el mensaje y limpia el input', () => {
    const onSend = vi.fn();
    renderComposer({ sendStatus: 'idle', onSend });
    const textarea = screen.getByPlaceholderText('Escribí, o hablá…');
    fireEvent.change(textarea, { target: { value: 'Hola' } });
    fireEvent.keyDown(textarea, { key: 'Enter' });
    expect(onSend).toHaveBeenCalledWith('Hola');
    expect(textarea).toHaveValue('');
  });

  it('Shift+Enter NO envía', () => {
    const onSend = vi.fn();
    renderComposer({ sendStatus: 'idle', onSend });
    const textarea = screen.getByPlaceholderText('Escribí, o hablá…');
    fireEvent.change(textarea, { target: { value: 'Hola' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true });
    expect(onSend).not.toHaveBeenCalled();
  });

  it('vacío/solo espacios no envía (botón enviar deshabilitado)', () => {
    const onSend = vi.fn();
    renderComposer({ sendStatus: 'idle', onSend });
    expect(screen.getByRole('button', { name: 'Enviar mensaje' })).toBeDisabled();

    const textarea = screen.getByPlaceholderText('Escribí, o hablá…');
    fireEvent.change(textarea, { target: { value: '   ' } });
    fireEvent.keyDown(textarea, { key: 'Enter' });
    expect(onSend).not.toHaveBeenCalled();
  });

  it('muestra el copy de durabilidad cuando sendStatus=waiting', () => {
    renderComposer({ sendStatus: 'waiting', onSend: vi.fn() });
    expect(screen.getByText(/Podés cerrar la app, te sigo respondiendo/)).toBeInTheDocument();
  });

  it('muestra alerta de error cuando sendStatus=error', () => {
    renderComposer({ sendStatus: 'error', onSend: vi.fn() });
    expect(screen.getByRole('alert')).toHaveTextContent('No pudimos enviar tu mensaje. Probá de nuevo.');
  });

  it('deshabilita el input mientras sendStatus=sending', () => {
    renderComposer({ sendStatus: 'sending', onSend: vi.fn() });
    expect(screen.getByPlaceholderText('Escribí, o hablá…')).toBeDisabled();
  });

  // SM-D3 (issue 1019): los «modos por app» se retiraron — ninguna pantalla los activaba. Esto fija que
  // no queda rastro: ni chip, ni segundo argumento en `onSend` (`toHaveBeenCalledWith` es exacto:
  // un `mode: null` residual lo haría fallar).
  it('no hay chip de modo y onSend recibe SÓLO el texto', () => {
    const onSend = vi.fn();
    renderComposer({ sendStatus: 'idle', onSend });
    expect(screen.queryByTestId('active-mode-chip')).not.toBeInTheDocument();
    const textarea = screen.getByPlaceholderText('Escribí, o hablá…');
    fireEvent.change(textarea, { target: { value: 'Mandale un mail a Juan' } });
    fireEvent.keyDown(textarea, { key: 'Enter' });
    expect(onSend).toHaveBeenCalledTimes(1);
    expect(onSend.mock.calls[0]).toEqual(['Mandale un mail a Juan']);
  });

  describe('mic (Task 19)', () => {
    it('ya no muestra el mic deshabilitado "próximamente" — hay un MicButton real y habilitado', () => {
      renderComposer();
      expect(screen.queryByLabelText('Grabar audio (próximamente)')).not.toBeInTheDocument();
      expect(screen.getByTestId('mic-button')).toBeEnabled();
    });

    it('deshabilita el mic mientras sendStatus=sending (mismo criterio que el textarea)', () => {
      renderComposer({ sendStatus: 'sending' });
      expect(screen.getByTestId('mic-button')).toBeDisabled();
    });
  });
});

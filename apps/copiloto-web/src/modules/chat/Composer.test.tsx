import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import '../../design-system/themes.css';
import { Composer } from './Composer';

describe('Composer', () => {
  it('Enter envía el mensaje y limpia el input', () => {
    const onSend = vi.fn();
    render(<Composer sendStatus="idle" onSend={onSend} />);
    const textarea = screen.getByPlaceholderText('Escribí tu mensaje…');
    fireEvent.change(textarea, { target: { value: 'Hola' } });
    fireEvent.keyDown(textarea, { key: 'Enter' });
    expect(onSend).toHaveBeenCalledWith('Hola');
    expect(textarea).toHaveValue('');
  });

  it('Shift+Enter NO envía', () => {
    const onSend = vi.fn();
    render(<Composer sendStatus="idle" onSend={onSend} />);
    const textarea = screen.getByPlaceholderText('Escribí tu mensaje…');
    fireEvent.change(textarea, { target: { value: 'Hola' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true });
    expect(onSend).not.toHaveBeenCalled();
  });

  it('vacío/solo espacios no envía (botón enviar deshabilitado)', () => {
    const onSend = vi.fn();
    render(<Composer sendStatus="idle" onSend={onSend} />);
    expect(screen.getByRole('button', { name: 'Enviar mensaje' })).toBeDisabled();

    const textarea = screen.getByPlaceholderText('Escribí tu mensaje…');
    fireEvent.change(textarea, { target: { value: '   ' } });
    fireEvent.keyDown(textarea, { key: 'Enter' });
    expect(onSend).not.toHaveBeenCalled();
  });

  it('muestra el copy de durabilidad cuando sendStatus=waiting', () => {
    render(<Composer sendStatus="waiting" onSend={vi.fn()} />);
    expect(screen.getByText(/Podés cerrar la app, te sigo respondiendo/)).toBeInTheDocument();
  });

  it('muestra alerta de error cuando sendStatus=error', () => {
    render(<Composer sendStatus="error" onSend={vi.fn()} />);
    expect(screen.getByRole('alert')).toHaveTextContent('No pudimos enviar tu mensaje. Probá de nuevo.');
  });

  it('deshabilita el input mientras sendStatus=sending', () => {
    render(<Composer sendStatus="sending" onSend={vi.fn()} />);
    expect(screen.getByPlaceholderText('Escribí tu mensaje…')).toBeDisabled();
  });
});

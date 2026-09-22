import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { tomarPendiente } from '@copiloto/core';

import { PreguntarInteligencia } from './PreguntarInteligencia';

// BL-X3: la pregunta libre ya no se contesta en un mini-chat propio — queda pendiente y se abre el
// chat principal durable, que la envía al montar.
describe('PreguntarInteligencia', () => {
  beforeEach(() => {
    tomarPendiente();
  });

  it('enviar deja la pregunta pendiente y abre el chat principal', () => {
    const onAbrirChat = vi.fn();
    render(<PreguntarInteligencia onAbrirChat={onAbrirChat} />);

    fireEvent.change(screen.getByTestId('preguntar-inteligencia-input'), { target: { value: '  ¿quién me debe?  ' } });
    fireEvent.click(screen.getByTestId('preguntar-inteligencia-enviar'));

    expect(onAbrirChat).toHaveBeenCalledTimes(1);
    expect(tomarPendiente()).toBe('¿quién me debe?');
  });

  it('Enter envía; Shift+Enter no', () => {
    const onAbrirChat = vi.fn();
    render(<PreguntarInteligencia onAbrirChat={onAbrirChat} />);
    const input = screen.getByTestId('preguntar-inteligencia-input');
    fireEvent.change(input, { target: { value: 'hola' } });

    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });
    expect(onAbrirChat).not.toHaveBeenCalled();

    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onAbrirChat).toHaveBeenCalledTimes(1);
    expect(tomarPendiente()).toBe('hola');
  });

  it('vacío: el botón está deshabilitado y no deja nada pendiente', () => {
    const onAbrirChat = vi.fn();
    render(<PreguntarInteligencia onAbrirChat={onAbrirChat} />);
    expect(screen.getByTestId('preguntar-inteligencia-enviar')).toBeDisabled();
    fireEvent.keyDown(screen.getByTestId('preguntar-inteligencia-input'), { key: 'Enter' });
    expect(onAbrirChat).not.toHaveBeenCalled();
    expect(tomarPendiente()).toBeNull();
  });
});

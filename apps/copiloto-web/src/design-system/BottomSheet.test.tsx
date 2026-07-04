import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import './themes.css';
import { BottomSheet } from './BottomSheet';
import { THEMES } from './ThemeProvider';

/**
 * jsdom NO implementa `PointerEvent` (verificado: `typeof window.PointerEvent === 'undefined'`)
 * — `fireEvent.pointerDown`/`fireEvent.pointerMove` de testing-library caen a `window.Event`
 * (event-map.js mapea `EventType: 'PointerEvent'`, ausente -> fallback a `Event`), que ignora
 * `clientY` del init dict (el constructor de `Event` solo lee bubbles/cancelable/composed).
 * Workaround: construir el Event a mano y adjuntar `clientY` con `Object.defineProperty` antes
 * de dispararlo — necesario para ejercitar el drag-to-dismiss (que lee `event.clientY`).
 */
function firePointerEvent(
  target: Element | Document,
  type: 'pointerdown' | 'pointermove',
  clientY: number,
) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'clientY', { value: clientY, configurable: true });
  fireEvent(target, event);
}

describe('BottomSheet', () => {
  it('renderiza con role="dialog" y el título como accessible name', () => {
    render(
      <BottomSheet open onClose={() => {}} title="Tus apps">
        <p>contenido</p>
      </BottomSheet>,
    );
    expect(screen.getByRole('dialog', { name: 'Tus apps' })).toBeInTheDocument();
  });

  it('abre y cierra reflejando `open` en la clase --open', () => {
    const { rerender } = render(
      <BottomSheet open={false} onClose={() => {}} title="Tus apps">
        <p>contenido</p>
      </BottomSheet>,
    );
    expect(screen.getByTestId('bottom-sheet-scrim').parentElement).not.toHaveClass(
      'uc-sheet-root--open',
    );

    rerender(
      <BottomSheet open onClose={() => {}} title="Tus apps">
        <p>contenido</p>
      </BottomSheet>,
    );
    expect(screen.getByTestId('bottom-sheet-scrim').parentElement).toHaveClass(
      'uc-sheet-root--open',
    );
  });

  it('cierra al click en el scrim', () => {
    const onClose = vi.fn();
    render(
      <BottomSheet open onClose={onClose} title="Tus apps">
        <p>contenido</p>
      </BottomSheet>,
    );
    fireEvent.click(screen.getByTestId('bottom-sheet-scrim'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('cierra con la tecla Escape', () => {
    const onClose = vi.fn();
    render(
      <BottomSheet open onClose={onClose} title="Tus apps">
        <p>contenido</p>
      </BottomSheet>,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('arrastra el CUERPO del sheet (no el handle) hacia abajo por encima del umbral ⇒ cierra', () => {
    const onClose = vi.fn();
    render(
      <BottomSheet open onClose={onClose} title="Tus apps">
        <p data-testid="sheet-body">contenido</p>
      </BottomSheet>,
    );
    firePointerEvent(screen.getByTestId('sheet-body'), 'pointerdown', 100);
    firePointerEvent(document, 'pointermove', 200);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('pointerdown sobre un hijo interactivo (botón) + movimiento ⇒ NO cierra (guard)', () => {
    const onClose = vi.fn();
    render(
      <BottomSheet open onClose={onClose} title="Tus apps">
        <button type="button">Acción</button>
      </BottomSheet>,
    );
    firePointerEvent(screen.getByRole('button', { name: 'Acción' }), 'pointerdown', 100);
    firePointerEvent(document, 'pointermove', 300);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('atrapa el foco al abrir (mueve el foco dentro del sheet)', () => {
    render(
      <BottomSheet open onClose={() => {}} title="Tus apps">
        <button type="button">Primero</button>
        <button type="button">Segundo</button>
      </BottomSheet>,
    );
    expect(screen.getByRole('button', { name: 'Primero' })).toHaveFocus();
  });

  it.each(THEMES)('renderiza bajo el tema "%s" sin romper', (theme) => {
    document.documentElement.setAttribute('data-theme', theme);
    render(
      <BottomSheet open onClose={() => {}} title="Tus apps">
        <p>contenido</p>
      </BottomSheet>,
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});

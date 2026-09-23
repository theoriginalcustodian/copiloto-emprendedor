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
  type: 'pointerdown' | 'pointermove' | 'pointerup',
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
    // El cierre se dispara al SOLTAR (pointerup) si el arrastre pasó el umbral — el sheet sigue el
    // dedo durante el pointermove y recién decide en el release.
    firePointerEvent(screen.getByTestId('sheet-body'), 'pointerdown', 100);
    firePointerEvent(document, 'pointermove', 200);
    firePointerEvent(document, 'pointerup', 200);
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
    firePointerEvent(document, 'pointerup', 300);
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

  // HOJA — a 390px la tab-bar del shell (`.tab-bar`, z-index:30) tapaba el 100% de «Ahora no»
  // porque el sheet vivía dentro de un ancestro `isolation: isolate` (`ChatScreen`'s `.app-frame`,
  // shell.css) que acotaba su z-index:50 a esa sub-jerarquía — medido con Playwright contra el CSS
  // real del repo (harness `scratchpad/hoja-repro/`): `elementFromPoint` en el centro del botón
  // devolvía la tab-bar, no el botón (`esElMismo:false`, `pctTapado:100`). jsdom no renderiza layout
  // real (no puede reproducir esa medición), pero SÍ puede verificar el mecanismo que la resuelve:
  // el sheet portado a `document.body` deja de ser descendiente de CUALQUIER contenedor con
  // `isolation`/`overflow` ajeno, así que su z-index siempre compite en el nivel más alto.
  it('HOJA: el sheet se porta a document.body — no queda anidado en el contenedor del que lo renderiza', () => {
    const { container } = render(
      <BottomSheet open onClose={() => {}} title="Tus apps">
        <p>contenido</p>
      </BottomSheet>,
    );

    // El contenedor de `render` (normalmente hijo de document.body) queda VACÍO: el sheet no es su
    // descendiente. El diálogo sí existe, pero como hijo directo de document.body (el portal).
    expect(container).toBeEmptyDOMElement();
    const dialog = screen.getByRole('dialog', { name: 'Tus apps' });
    expect(dialog.closest('.uc-sheet-root')?.parentElement).toBe(document.body);
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

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import './themes.css';
import { BottomSheet } from './BottomSheet';
import { THEMES } from './ThemeProvider';

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

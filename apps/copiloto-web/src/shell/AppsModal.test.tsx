import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import '../design-system/themes.css';
import { THEMES } from '../design-system/ThemeProvider';
import { AppsModal } from './AppsModal';

describe('AppsModal', () => {
  it('renderiza con role="dialog" y "Tus apps" como accessible name', () => {
    render(
      <AppsModal open onClose={() => {}}>
        <p>contenido</p>
      </AppsModal>,
    );
    expect(screen.getByRole('dialog', { name: 'Tus apps' })).toBeInTheDocument();
  });

  it('abre y cierra reflejando `open` en la clase --open', () => {
    const { rerender } = render(
      <AppsModal open={false} onClose={() => {}}>
        <p>contenido</p>
      </AppsModal>,
    );
    expect(screen.getByTestId('apps-modal-root')).not.toHaveClass('apps-modal-root--open');

    rerender(
      <AppsModal open onClose={() => {}}>
        <p>contenido</p>
      </AppsModal>,
    );
    expect(screen.getByTestId('apps-modal-root')).toHaveClass('apps-modal-root--open');
  });

  it('cierra al click en el scrim', () => {
    const onClose = vi.fn();
    render(
      <AppsModal open onClose={onClose}>
        <p>contenido</p>
      </AppsModal>,
    );
    fireEvent.click(screen.getByTestId('apps-modal-scrim'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('cierra al click en el botón X', () => {
    const onClose = vi.fn();
    render(
      <AppsModal open onClose={onClose}>
        <p>contenido</p>
      </AppsModal>,
    );
    fireEvent.click(screen.getByTestId('apps-modal-close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('cierra con la tecla Escape', () => {
    const onClose = vi.fn();
    render(
      <AppsModal open onClose={onClose}>
        <p>contenido</p>
      </AppsModal>,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('atrapa el foco al abrir (mueve el foco dentro del panel)', () => {
    render(
      <AppsModal open onClose={() => {}}>
        <button type="button">Primero</button>
      </AppsModal>,
    );
    // El primer foco-able dentro del panel es el propio botón X (antes que `children`).
    expect(screen.getByTestId('apps-modal-close')).toHaveFocus();
  });

  it.each(THEMES)('renderiza bajo el tema "%s" sin romper', (theme) => {
    document.documentElement.setAttribute('data-theme', theme);
    render(
      <AppsModal open onClose={() => {}}>
        <p>contenido</p>
      </AppsModal>,
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});

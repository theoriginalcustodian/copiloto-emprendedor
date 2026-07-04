import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import './themes.css';
import { THEMES } from './ThemeProvider';
import { Toast, type ToastVariant } from './Toast';

const VARIANTS: ToastVariant[] = ['neutral', 'ok', 'danger'];

describe('Toast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renderiza sin crashear con role="status" por default', () => {
    render(<Toast message="Cobro confirmado" />);
    expect(screen.getByRole('status')).toHaveTextContent('Cobro confirmado');
  });

  it('variant="danger" usa role="alert"', () => {
    render(<Toast message="No se pudo confirmar" variant="danger" />);
    expect(screen.getByRole('alert')).toHaveTextContent('No se pudo confirmar');
  });

  it('se auto-descarta a los durationMs', () => {
    const onDismiss = vi.fn();
    render(<Toast message="Listo" onDismiss={onDismiss} durationMs={1000} />);
    expect(onDismiss).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('el botón de cerrar dispara onDismiss', () => {
    const onDismiss = vi.fn();
    render(<Toast message="Listo" onDismiss={onDismiss} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar notificación' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it.each(VARIANTS)('renderiza la variante "%s"', (variant) => {
    render(<Toast message="Mensaje" variant={variant} />);
    expect(screen.getByText('Mensaje').closest('.uc-toast')?.className).toContain(
      `uc-toast--${variant}`,
    );
  });

  it.each(THEMES)('renderiza bajo el tema "%s" sin romper', (theme) => {
    document.documentElement.setAttribute('data-theme', theme);
    render(<Toast message="Mensaje" />);
    expect(screen.getByText('Mensaje')).toBeInTheDocument();
  });
});

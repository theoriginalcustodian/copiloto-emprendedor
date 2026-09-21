import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import '../../design-system/themes.css';
import { THEMES, ThemeProvider } from '../../design-system/ThemeProvider';
import { PantallaApariencia } from './PantallaApariencia';

/** Mismo criterio de integración real que `AccountScreen.test.tsx` (de donde se movió este
 *  selector, 2026-08-06) — ejercita `useTheme` de verdad, no un mock del hook. */
function renderApariencia() {
  return render(
    <ThemeProvider>
      <PantallaApariencia />
    </ThemeProvider>,
  );
}

describe('PantallaApariencia', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  it('ofrece Claro, Oscuro y «Como el teléfono», y ya no Nocturno', () => {
    renderApariencia();
    expect(screen.getByText('Claro')).toBeInTheDocument();
    expect(screen.getByText('Oscuro')).toBeInTheDocument();
    expect(screen.getByText('Como el teléfono')).toBeInTheDocument();
    expect(screen.queryByText('Nocturno')).toBeNull();
  });

  it('cada opción muestra su muestra real; «Como el teléfono» muestra las dos pieles', () => {
    const { container } = renderApariencia();
    expect(container.querySelectorAll('[data-muestra="claro"]').length).toBe(2);
    expect(container.querySelectorAll('[data-muestra="oscuro"]').length).toBe(2);
  });

  it('elegir «Como el teléfono» persiste sistema', () => {
    renderApariencia();
    fireEvent.click(screen.getByTestId('theme-pill-sistema'));
    expect(window.localStorage.getItem('copiloto-theme')).toBe('sistema');
    expect(screen.getByTestId('theme-pill-sistema')).toHaveAttribute('aria-pressed', 'true');
  });

  it('el selector de tema cambia el theme activo y persiste en localStorage', () => {
    renderApariencia();

    fireEvent.click(screen.getByTestId('theme-pill-oscuro'));

    expect(document.documentElement.getAttribute('data-theme')).toBe('oscuro');
    expect(window.localStorage.getItem('copiloto-theme')).toBe('oscuro');
    expect(screen.getByTestId('theme-pill-oscuro')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('theme-pill-claro')).toHaveAttribute('aria-pressed', 'false');
  });

  it.each(THEMES)('renderiza sin romper bajo el tema "%s"', (theme) => {
    document.documentElement.setAttribute('data-theme', theme);
    renderApariencia();
    expect(screen.getByTestId('pantalla-apariencia')).toBeInTheDocument();
  });
});

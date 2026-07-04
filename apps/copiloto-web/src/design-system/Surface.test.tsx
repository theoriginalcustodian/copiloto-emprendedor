import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import './themes.css';
import { Surface, type SurfaceVariant } from './Surface';
import { THEMES } from './ThemeProvider';

const VARIANTS: SurfaceVariant[] = ['card', 'tile', 'bubble'];

describe('Surface', () => {
  it('renderiza sin crashear', () => {
    render(<Surface>Contenido</Surface>);
    expect(screen.getByText('Contenido')).toBeInTheDocument();
  });

  it.each(VARIANTS)('renderiza la variante "%s"', (variant) => {
    render(<Surface variant={variant}>Contenido</Surface>);
    expect(screen.getByText('Contenido').className).toContain(`uc-surface--${variant}`);
  });

  it('blur agrega la clase --blur', () => {
    render(
      <Surface variant="bubble" blur>
        Burbuja
      </Surface>,
    );
    expect(screen.getByText('Burbuja').className).toContain('uc-surface--blur');
  });

  it.each(THEMES)('renderiza bajo el tema "%s" sin romper', (theme) => {
    document.documentElement.setAttribute('data-theme', theme);
    render(<Surface variant="card">Contenido</Surface>);
    expect(screen.getByText('Contenido')).toBeInTheDocument();
  });
});

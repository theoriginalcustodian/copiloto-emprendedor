import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import './themes.css';
import { Badge, type BadgeVariant } from './Badge';
import { THEMES } from './ThemeProvider';

const VARIANTS: BadgeVariant[] = ['warning', 'danger', 'ok', 'neutral'];

describe('Badge', () => {
  it('renderiza sin crashear', () => {
    render(<Badge>REVISAR</Badge>);
    expect(screen.getByText('REVISAR')).toBeInTheDocument();
  });

  it.each(VARIANTS)('renderiza la variante "%s"', (variant) => {
    render(<Badge variant={variant}>ESTADO</Badge>);
    expect(screen.getByText('ESTADO').className).toContain(`uc-badge--${variant}`);
  });

  it.each(THEMES)('renderiza bajo el tema "%s" sin romper', (theme) => {
    document.documentElement.setAttribute('data-theme', theme);
    render(<Badge variant="warning">REVISAR</Badge>);
    expect(screen.getByText('REVISAR')).toBeInTheDocument();
  });
});

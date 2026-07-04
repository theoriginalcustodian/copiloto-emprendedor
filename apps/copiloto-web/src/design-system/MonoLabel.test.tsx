import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import './themes.css';
import { MonoLabel } from './MonoLabel';
import { THEMES } from './ThemeProvider';

describe('MonoLabel', () => {
  it('renderiza sin crashear como <span> por default', () => {
    render(<MonoLabel>PARA</MonoLabel>);
    const label = screen.getByText('PARA');
    expect(label.tagName).toBe('SPAN');
  });

  it('renderiza como <label> cuando se pasa htmlFor', () => {
    render(<MonoLabel htmlFor="monto-input">MONTO</MonoLabel>);
    const label = screen.getByText('MONTO');
    expect(label.tagName).toBe('LABEL');
    expect(label).toHaveAttribute('for', 'monto-input');
  });

  it.each(THEMES)('renderiza bajo el tema "%s" sin romper', (theme) => {
    document.documentElement.setAttribute('data-theme', theme);
    render(<MonoLabel>CUÁNDO</MonoLabel>);
    expect(screen.getByText('CUÁNDO')).toBeInTheDocument();
  });
});

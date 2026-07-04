import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import './themes.css';
import { Chip } from './Chip';
import { THEMES } from './ThemeProvider';

describe('Chip', () => {
  it('renderiza sin crashear', () => {
    render(<Chip>Juan Pérez</Chip>);
    expect(screen.getByRole('button', { name: 'Juan Pérez' })).toBeInTheDocument();
  });

  it('selected=true usa el estilo "user" y aria-pressed=true', () => {
    render(<Chip selected>Juan Pérez</Chip>);
    const chip = screen.getByRole('button', { name: 'Juan Pérez' });
    expect(chip.className).toContain('uc-chip--selected');
    expect(chip).toHaveAttribute('aria-pressed', 'true');
  });

  it('selected=false (default) usa el estilo outline y aria-pressed=false', () => {
    render(<Chip>Juan Gómez</Chip>);
    const chip = screen.getByRole('button', { name: 'Juan Gómez' });
    expect(chip.className).toContain('uc-chip--outline');
    expect(chip).toHaveAttribute('aria-pressed', 'false');
  });

  it('dispara onClick al tocarlo', () => {
    const onClick = vi.fn();
    render(<Chip onClick={onClick}>Juan Pérez</Chip>);
    fireEvent.click(screen.getByRole('button', { name: 'Juan Pérez' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it.each(THEMES)('renderiza bajo el tema "%s" sin romper', (theme) => {
    document.documentElement.setAttribute('data-theme', theme);
    render(<Chip>Juan Pérez</Chip>);
    expect(screen.getByRole('button', { name: 'Juan Pérez' })).toBeInTheDocument();
  });
});

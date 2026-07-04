import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import './themes.css';
import { Button, type ButtonVariant } from './Button';
import { THEMES } from './ThemeProvider';

const VARIANTS: ButtonVariant[] = ['primary', 'cancel', 'ghost', 'danger'];

describe('Button', () => {
  it('renderiza sin crashear', () => {
    render(<Button>Confirmar</Button>);
    expect(screen.getByRole('button', { name: 'Confirmar' })).toBeInTheDocument();
  });

  it.each(VARIANTS)('renderiza la variante "%s"', (variant) => {
    render(<Button variant={variant}>Acción</Button>);
    expect(screen.getByRole('button', { name: 'Acción' }).className).toContain(
      `uc-btn--${variant}`,
    );
  });

  it.each(THEMES)('renderiza bajo el tema "%s" sin romper', (theme) => {
    document.documentElement.setAttribute('data-theme', theme);
    render(<Button>Acción</Button>);
    expect(screen.getByRole('button', { name: 'Acción' })).toBeInTheDocument();
  });

  it('disabled no dispara onClick', () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Deshabilitado
      </Button>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Deshabilitado' }));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('recibe foco por teclado', () => {
    render(<Button>Foco</Button>);
    const btn = screen.getByRole('button', { name: 'Foco' });
    btn.focus();
    expect(btn).toHaveFocus();
  });
});

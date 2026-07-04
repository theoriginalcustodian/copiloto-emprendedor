import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import './themes.css';
import { Skeleton } from './Skeleton';
import { THEMES } from './ThemeProvider';

describe('Skeleton', () => {
  it('renderiza sin crashear, oculto para a11y (decorativo)', () => {
    const { container } = render(<Skeleton />);
    const el = container.querySelector('.uc-skeleton');
    expect(el).toBeInTheDocument();
    expect(el).toHaveAttribute('aria-hidden', 'true');
  });

  it('aplica width/height/radius pasados por prop', () => {
    const { container } = render(<Skeleton width={120} height={20} radius={4} />);
    const el = container.querySelector('.uc-skeleton') as HTMLElement;
    expect(el.style.width).toBe('120px');
    expect(el.style.height).toBe('20px');
    expect(el.style.borderRadius).toBe('4px');
  });

  it.each(THEMES)('renderiza bajo el tema "%s" sin romper', (theme) => {
    document.documentElement.setAttribute('data-theme', theme);
    const { container } = render(<Skeleton />);
    expect(container.querySelector('.uc-skeleton')).toBeInTheDocument();
  });
});

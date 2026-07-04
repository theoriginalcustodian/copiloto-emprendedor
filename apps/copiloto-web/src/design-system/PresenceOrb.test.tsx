import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import './themes.css';
import { PresenceOrb } from './PresenceOrb';
import { THEMES } from './ThemeProvider';

function mockMatchMedia(matches: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

describe('PresenceOrb', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renderiza sin crashear', () => {
    mockMatchMedia(false);
    render(<PresenceOrb />);
    expect(screen.getByTestId('presence-orb')).toBeInTheDocument();
  });

  it('anima (sin clase --static) cuando NO hay prefers-reduced-motion', () => {
    mockMatchMedia(false);
    render(<PresenceOrb />);
    const orb = screen.getByTestId('presence-orb');
    expect(orb.querySelector('.presence-orb__halo')).not.toHaveClass('presence-orb__halo--static');
    expect(orb.querySelector('.presence-orb__core')).not.toHaveClass('presence-orb__core--static');
  });

  it('NO anima (clase --static) cuando prefers-reduced-motion está activo', () => {
    mockMatchMedia(true);
    render(<PresenceOrb />);
    const orb = screen.getByTestId('presence-orb');
    expect(orb.querySelector('.presence-orb__halo')).toHaveClass('presence-orb__halo--static');
    expect(orb.querySelector('.presence-orb__core')).toHaveClass('presence-orb__core--static');
  });

  it('aplica el override de `size` como --core-size inline', () => {
    mockMatchMedia(false);
    render(<PresenceOrb size={28} />);
    const orb = screen.getByTestId('presence-orb');
    expect(orb.style.getPropertyValue('--core-size')).toBe('28px');
  });

  it.each(THEMES)('renderiza bajo el tema "%s" sin romper', (theme) => {
    mockMatchMedia(false);
    document.documentElement.setAttribute('data-theme', theme);
    render(<PresenceOrb />);
    expect(screen.getByTestId('presence-orb')).toBeInTheDocument();
  });
});

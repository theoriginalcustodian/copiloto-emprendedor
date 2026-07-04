import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import './themes.css';
import { Kit } from './Kit';
import { ThemeProvider } from './ThemeProvider';

describe('Kit', () => {
  it('renderiza sin crashear dentro de un ThemeProvider (incluye PresenceOrb con matchMedia mockeado)', () => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    render(
      <ThemeProvider>
        <Kit />
      </ThemeProvider>,
    );
    expect(screen.getByText('Tema')).toBeInTheDocument();
    expect(screen.getByTestId('status-bar')).toBeInTheDocument();
  });
});

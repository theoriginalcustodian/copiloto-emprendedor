import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ThemeProvider } from '../design-system/ThemeProvider';
import { AppShell } from './AppShell';

describe('AppShell', () => {
  it('renderiza sin crashear envuelto en ThemeProvider (scaffold Fase 0)', () => {
    render(
      <ThemeProvider>
        <AppShell />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('app-shell')).toBeInTheDocument();
  });
});

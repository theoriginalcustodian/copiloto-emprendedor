import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import './themes.css';
import { StatusBar } from './StatusBar';
import { THEMES } from './ThemeProvider';

describe('StatusBar', () => {
  it('renderiza sin crashear', () => {
    render(<StatusBar time="14:32" />);
    expect(screen.getByTestId('status-bar')).toBeInTheDocument();
  });

  it('muestra el `time` pasado por prop (override determinístico para tests/Kit)', () => {
    render(<StatusBar time="09:41" />);
    expect(screen.getByTestId('status-bar')).toHaveTextContent('09:41');
  });

  it.each(THEMES)('renderiza bajo el tema "%s" sin romper', (theme) => {
    document.documentElement.setAttribute('data-theme', theme);
    render(<StatusBar time="14:32" />);
    expect(screen.getByTestId('status-bar')).toBeInTheDocument();
  });
});

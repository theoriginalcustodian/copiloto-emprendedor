import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import '../design-system/themes.css';
import { THEMES } from '../design-system/ThemeProvider';
import { TABS, TabBar } from './TabBar';

describe('TabBar', () => {
  it('renderiza los 4 tabs del registro declarativo (Chat · Apps · Conexiones · Cuenta)', () => {
    render(<TabBar active="chat" onChange={vi.fn()} />);
    expect(TABS).toHaveLength(4);
    for (const tab of TABS) {
      expect(screen.getByRole('button', { name: tab.label })).toBeInTheDocument();
    }
  });

  it('marca el tab activo con aria-current="page" y los demás sin el atributo', () => {
    render(<TabBar active="connections" onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Conexiones' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('button', { name: 'Chat' })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('button', { name: 'Apps' })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('button', { name: 'Cuenta' })).not.toHaveAttribute('aria-current');
  });

  it('click en un tab dispara onChange con su key', () => {
    const onChange = vi.fn();
    render(<TabBar active="chat" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Apps' }));
    expect(onChange).toHaveBeenCalledWith('apps');
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it.each(THEMES)('renderiza bajo el tema "%s" sin romper', (theme) => {
    document.documentElement.setAttribute('data-theme', theme);
    render(<TabBar active="chat" onChange={vi.fn()} />);
    expect(screen.getByTestId('tab-bar')).toBeInTheDocument();
  });
});

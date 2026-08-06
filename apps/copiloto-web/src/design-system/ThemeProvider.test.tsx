import { render, screen, waitFor } from '@testing-library/react';
import { act } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';

import './themes.css';
import { THEMES, ThemeProvider, useTheme, type Theme } from './ThemeProvider';

const STORAGE_KEY = 'copiloto-theme';

function readBg(): string {
  return getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
}

function ThemeProbe() {
  const { theme, setTheme, themes } = useTheme();
  return (
    <div>
      <span data-testid="current-theme">{theme}</span>
      {themes.map((t) => (
        <button key={t} data-testid={`set-${t}`} onClick={() => setTheme(t)}>
          {t}
        </button>
      ))}
    </div>
  );
}

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
});

describe('ThemeProvider / useTheme', () => {
  it('renderiza sin crashear un consumidor envuelto en ThemeProvider', () => {
    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('current-theme')).toBeInTheDocument();
  });

  it('default es "claro" cuando no hay nada persistido', () => {
    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('current-theme')).toHaveTextContent('claro');
  });

  it('lee el tema persistido en localStorage al montar', () => {
    window.localStorage.setItem(STORAGE_KEY, 'oscuro');
    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('current-theme')).toHaveTextContent('oscuro');
  });

  it('ignora un valor corrupto/desconocido en localStorage y cae al default', () => {
    window.localStorage.setItem(STORAGE_KEY, 'no-existe');
    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('current-theme')).toHaveTextContent('claro');
  });

  it('setTheme persiste en localStorage', async () => {
    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );
    act(() => {
      screen.getByTestId('set-nocturno').click();
    });
    await waitFor(() => {
      expect(window.localStorage.getItem(STORAGE_KEY)).toBe('nocturno');
    });
    expect(screen.getByTestId('current-theme')).toHaveTextContent('nocturno');
  });

  it('cada uno de los 3 data-theme produce un --bg distinto (mínimo requerido por el plan)', () => {
    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );

    const bgByTheme = new Map<Theme, string>();
    for (const theme of THEMES) {
      act(() => {
        screen.getByTestId(`set-${theme}`).click();
      });
      bgByTheme.set(theme, readBg());
    }

    // Todos los valores deben existir (la cascada CSS realmente aplicó) y ser únicos entre sí.
    const values = [...bgByTheme.values()];
    for (const [theme, value] of bgByTheme) {
      expect(value, `--bg para el tema "${theme}" no debería estar vacío`).not.toBe('');
    }
    expect(new Set(values).size).toBe(THEMES.length);
  });

  it('aplica data-theme al <html> (documentElement), no solo al estado en memoria', () => {
    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );
    act(() => {
      screen.getByTestId('set-oscuro').click();
    });
    expect(document.documentElement.getAttribute('data-theme')).toBe('oscuro');
  });
});

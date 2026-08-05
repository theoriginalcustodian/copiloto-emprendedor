import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SessionProvider } from '../auth/SessionProvider';
import '../design-system/themes.css';
import { THEMES, ThemeProvider } from '../design-system/ThemeProvider';
import { ModeProvider } from './modeStore';
import { Rail } from './Rail';
import { TABS } from './TabBar';

function renderRail(active: (typeof TABS)[number]['key'] = 'chat', onChange = vi.fn()) {
  return {
    onChange,
    ...render(
      <ThemeProvider>
        <SessionProvider>
          <ModeProvider>
            <Rail active={active} onChange={onChange} />
          </ModeProvider>
        </SessionProvider>
      </ThemeProvider>,
    ),
  };
}

describe('Rail', () => {
  // `setTheme` (test "cambia de tema al click") persiste en localStorage — limpiar entre tests
  // evita que un test contamine el default `ai` del siguiente (mismo criterio que
  // AppShell.test.tsx / ThemeProvider.test.tsx).
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  it('renderiza los 16 ítems del registro declarativo (Chat · Apps · Conexiones · Gastos · Clientes · Contabilidad · Ingresos · Actividad · Presupuestos · Inteligencia · Mi día · Funciones · Recientes · Ajustes · Facturación · Cuenta)', () => {
    renderRail();
    expect(TABS).toHaveLength(16);
    for (const tab of TABS) {
      expect(screen.getByRole('button', { name: tab.label })).toBeInTheDocument();
    }
  });

  it('marca el ítem activo con aria-current="page"', () => {
    renderRail('connections');
    expect(screen.getByRole('button', { name: 'Conexiones' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('button', { name: 'Chat' })).not.toHaveAttribute('aria-current');
  });

  it('click en un ítem dispara onChange con su key', () => {
    const { onChange } = renderRail();
    fireEvent.click(screen.getByRole('button', { name: 'Apps' }));
    expect(onChange).toHaveBeenCalledWith('apps');
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('arranca colapsado y se expande/colapsa con pointer enter/leave (auto-hide por hover)', () => {
    renderRail();
    const rail = screen.getByTestId('rail');
    expect(rail.className).not.toContain('rail--open');

    fireEvent.pointerEnter(rail);
    expect(rail.className).toContain('rail--open');

    fireEvent.pointerLeave(rail);
    expect(rail.className).not.toContain('rail--open');
  });

  it('renderiza los 4 swatches de skin, marca el tema actual como activo y cambia de tema al click', () => {
    renderRail();
    for (const t of THEMES) {
      expect(screen.getByTestId(`rail-swatch-${t}`)).toBeInTheDocument();
    }
    expect(screen.getByTestId('rail-swatch-ai')).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(screen.getByTestId('rail-swatch-refined'));
    expect(screen.getByTestId('rail-swatch-refined')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('rail-swatch-ai')).toHaveAttribute('aria-pressed', 'false');
  });

  it('renderiza el bloque de usuario', () => {
    renderRail();
    expect(screen.getByTestId('rail-user')).toBeInTheDocument();
  });

  it.each(THEMES)('renderiza bajo el tema "%s" sin romper', (theme) => {
    document.documentElement.setAttribute('data-theme', theme);
    renderRail();
    expect(screen.getByTestId('rail')).toBeInTheDocument();
  });
});

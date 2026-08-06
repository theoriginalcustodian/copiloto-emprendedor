import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SessionProvider } from '../auth/SessionProvider';
import '../design-system/themes.css';
import { THEMES, ThemeProvider } from '../design-system/ThemeProvider';
import { Rail } from './Rail';
import { TABS, type TabKey } from './TabBar';

function renderRail(active: (typeof TABS)[number]['key'] = 'chat', onChange = vi.fn()) {
  return {
    onChange,
    ...render(
      <ThemeProvider>
        <SessionProvider>
          <Rail active={active} onChange={onChange} />
        </SessionProvider>
      </ThemeProvider>,
    ),
  };
}

// Mismo guard que TabBar.test.tsx (2026-08-06): keys exactas, no cantidad.
const KEYS_ESPERADAS: readonly TabKey[] = [
  'chat',
  'midia',
  'actividad',
  'ingresos',
  'gastos',
  'contabilidad',
  'facturacion',
  'presupuestos',
  'clientes',
  'inteligencia',
  'escritorio',
  'ajustes',
];

describe('Rail', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  it('el registro TABS (compartido con TabBar) tiene exactamente las 12 keys esperadas', () => {
    expect(TABS.map((t) => t.key)).toEqual(KEYS_ESPERADAS);
  });

  it('renderiza un botón por cada tab del registro', () => {
    renderRail();
    for (const tab of TABS) {
      expect(screen.getByRole('button', { name: tab.label })).toBeInTheDocument();
    }
  });

  it('marca el ítem activo con aria-current="page"', () => {
    renderRail('gastos');
    expect(screen.getByRole('button', { name: 'Gastos' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Chat' })).not.toHaveAttribute('aria-current');
  });

  it('click en un ítem dispara onChange con su key', () => {
    const { onChange } = renderRail();
    fireEvent.click(screen.getByRole('button', { name: 'Ajustes' }));
    expect(onChange).toHaveBeenCalledWith('ajustes');
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

  it('renderiza el bloque de usuario', () => {
    renderRail();
    expect(screen.getByTestId('rail-user')).toBeInTheDocument();
  });

  // Era un `<div>` informativo que no llevaba a ningún lado. Estos tres tests fijan que es la puerta
  // a Ajustes: si alguien lo vuelve a un `div`, o le saca el onChange, la barra pierde el acceso que
  // habilita discutir si `ajustes` sigue haciendo falta como entrada propia del registro.
  it('el bloque de usuario es un botón, no un div decorativo', () => {
    renderRail();
    expect(screen.getByTestId('rail-user').tagName).toBe('BUTTON');
  });

  it('click en el bloque de usuario abre Ajustes', () => {
    const { onChange } = renderRail();
    fireEvent.click(screen.getByTestId('rail-user'));
    expect(onChange).toHaveBeenCalledWith('ajustes');
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('con Ajustes activo, el bloque de usuario se marca como página actual', () => {
    renderRail('ajustes');
    expect(screen.getByTestId('rail-user')).toHaveAttribute('aria-current', 'page');
  });

  // Control negativo del test de arriba: sin esto, un `aria-current` puesto SIEMPRE lo haría pasar
  // igual, y el guard mediría la constante en vez de la lógica.

  it('con otra pantalla activa, el bloque de usuario NO se marca como página actual', () => {
    renderRail('gastos');
    expect(screen.getByTestId('rail-user')).not.toHaveAttribute('aria-current');
  });

  it.each(THEMES)('renderiza bajo el tema "%s" sin romper', (theme) => {
    document.documentElement.setAttribute('data-theme', theme);
    renderRail();
    expect(screen.getByTestId('rail')).toBeInTheDocument();
  });
});

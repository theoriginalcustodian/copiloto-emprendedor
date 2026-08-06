import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import '../design-system/themes.css';
import { THEMES } from '../design-system/ThemeProvider';
import { TABS, TabBar, type TabKey } from './TabBar';

function renderTabBar(active: (typeof TABS)[number]['key'] = 'chat', onChange = vi.fn()) {
  return render(<TabBar active={active} onChange={onChange} />);
}

// Guard contra la regresión que motivó este archivo (2026-08-06): "apps"/"connections"/
// "recientes"/"account" salieron de la barra ("sólo las funciones de la app"). Un test que sólo
// contara `TABS.length` pasaría igual si alguien vuelve a agregar una key equivocada mientras
// mantiene el número en 12 -- por eso asertamos las KEYS exactas, no la cantidad.
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

describe('TabBar', () => {
  it('el registro TABS tiene exactamente las 12 keys esperadas, en ese orden -- no sólo la cantidad', () => {
    expect(TABS.map((t) => t.key)).toEqual(KEYS_ESPERADAS);
  });

  it('no vuelve a filtrarse ninguna de las 4 keys sacadas de la barra (apps/connections/recientes/account)', () => {
    const keys = TABS.map((t) => t.key);
    expect(keys).not.toContain('apps');
    expect(keys).not.toContain('connections');
    expect(keys).not.toContain('recientes');
    expect(keys).not.toContain('account');
  });

  it('renderiza un botón por cada tab del registro', () => {
    renderTabBar();
    for (const tab of TABS) {
      expect(screen.getByRole('button', { name: tab.label })).toBeInTheDocument();
    }
  });

  it('marca el tab activo con aria-current="page" y los demás sin el atributo', () => {
    renderTabBar('gastos');
    expect(screen.getByRole('button', { name: 'Gastos' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Chat' })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('button', { name: 'Ajustes' })).not.toHaveAttribute('aria-current');
  });

  it('click en un tab dispara onChange con su key', () => {
    const onChange = vi.fn();
    renderTabBar('chat', onChange);
    fireEvent.click(screen.getByRole('button', { name: 'Ajustes' }));
    expect(onChange).toHaveBeenCalledWith('ajustes');
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it.each(THEMES)('renderiza bajo el tema "%s" sin romper', (theme) => {
    document.documentElement.setAttribute('data-theme', theme);
    renderTabBar();
    expect(screen.getByTestId('tab-bar')).toBeInTheDocument();
  });
});

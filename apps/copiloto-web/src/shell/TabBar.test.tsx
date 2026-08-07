import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import '../design-system/themes.css';
import { THEMES } from '../design-system/ThemeProvider';
import { TABS, TabBar, tabsVisibles, type TabKey } from './TabBar';

function renderTabBar(
  active: (typeof TABS)[number]['key'] = 'chat',
  onChange = vi.fn(),
  esAdmin?: boolean,
) {
  return render(<TabBar active={active} onChange={onChange} esAdmin={esAdmin} />);
}

// Guard contra la regresión que motivó este archivo (2026-08-06): "apps"/"connections"/
// "recientes"/"account" salieron de la barra ("sólo las funciones de la app"). Un test que sólo
// contara `TABS.length` pasaría igual si alguien vuelve a agregar una key equivocada mientras
// mantiene el número -- por eso asertamos las KEYS exactas, no la cantidad.
//
// 2026-08-07: `ajustes` salió (ya tiene dos puertas verificadas, ver el docstring de `TABS`) y
// entró `admin`, que es `soloAdmin` -- por eso esta lista es la del REGISTRO COMPLETO, y lo que un
// usuario ve se testea aparte vía `tabsVisibles`.
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
  'admin',
];

describe('TabBar', () => {
  it('el registro TABS tiene exactamente las 12 keys esperadas, en ese orden -- no sólo la cantidad', () => {
    expect(TABS.map((t) => t.key)).toEqual(KEYS_ESPERADAS);
  });

  it('no vuelve a filtrarse ninguna de las keys sacadas de la barra (apps/connections/recientes/account/ajustes)', () => {
    const keys = TABS.map((t) => t.key);
    expect(keys).not.toContain('apps');
    expect(keys).not.toContain('connections');
    expect(keys).not.toContain('recientes');
    expect(keys).not.toContain('account');
    expect(keys).not.toContain('ajustes');
  });

  it('renderiza un botón por cada tab visible del registro', () => {
    renderTabBar();
    for (const tab of tabsVisibles(false)) {
      expect(screen.getByRole('button', { name: tab.label })).toBeInTheDocument();
    }
  });

  it('marca el tab activo con aria-current="page" y los demás sin el atributo', () => {
    renderTabBar('gastos');
    expect(screen.getByRole('button', { name: 'Gastos' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Chat' })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('button', { name: 'Funciones' })).not.toHaveAttribute('aria-current');
  });

  it('click en un tab dispara onChange con su key', () => {
    const onChange = vi.fn();
    renderTabBar('chat', onChange);
    fireEvent.click(screen.getByRole('button', { name: 'Funciones' }));
    expect(onChange).toHaveBeenCalledWith('escritorio');
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it.each(THEMES)('renderiza bajo el tema "%s" sin romper', (theme) => {
    document.documentElement.setAttribute('data-theme', theme);
    renderTabBar();
    expect(screen.getByTestId('tab-bar')).toBeInTheDocument();
  });
});

// La entrada a la Consola es lo único condicional de la barra. Los dos sentidos se testean a
// propósito: un filtro que devolviera SIEMPRE la lista completa pasa el caso admin, y uno que
// devolviera siempre la corta pasa el caso no-admin -- sólo el par distingue que discrimina.
describe('tabsVisibles -- la Consola sólo existe para un operador', () => {
  it('sin el claim, `admin` NO está en la lista', () => {
    expect(tabsVisibles(false).map((t) => t.key)).not.toContain('admin');
  });

  it('con el claim, `admin` aparece -- y es el único que cambia', () => {
    const sin = tabsVisibles(false).map((t) => t.key);
    const con = tabsVisibles(true).map((t) => t.key);
    expect(con).toContain('admin');
    expect(con.filter((k) => !sin.includes(k))).toEqual(['admin']);
    expect(sin.filter((k) => !con.includes(k))).toEqual([]);
  });

  it('el default es fail-closed: sin pasar `esAdmin`, la barra no muestra "Consola"', () => {
    renderTabBar();
    expect(screen.queryByRole('button', { name: 'Consola' })).not.toBeInTheDocument();
  });

  it('el DoD del contrato: con esAdmin=false la palabra "Consola" no está en el DOM (no es display:none)', () => {
    const { container } = renderTabBar('chat', vi.fn(), false);
    expect(container.textContent).not.toContain('Consola');
  });

  it('control positivo del anterior: con esAdmin=true sí aparece el botón', () => {
    renderTabBar('chat', vi.fn(), true);
    expect(screen.getByRole('button', { name: 'Consola' })).toBeInTheDocument();
  });
});

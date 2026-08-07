import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SessionProvider } from '../auth/SessionProvider';
import '../design-system/themes.css';
import { THEMES, ThemeProvider } from '../design-system/ThemeProvider';
import { Rail } from './Rail';
import { TABS, tabsVisibles, type TabKey } from './TabBar';

function renderRail(
  active: (typeof TABS)[number]['key'] = 'chat',
  onChange = vi.fn(),
  esAdmin?: boolean,
) {
  return {
    onChange,
    ...render(
      <ThemeProvider>
        <SessionProvider>
          <Rail active={active} onChange={onChange} esAdmin={esAdmin} />
        </SessionProvider>
      </ThemeProvider>,
    ),
  };
}

// Mismo guard que TabBar.test.tsx: keys exactas, no cantidad. Es el registro COMPLETO -- `admin`
// es `soloAdmin`, y lo que un usuario ve de verdad se testea abajo con `tabsVisibles`.
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

describe('Rail', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  it('el registro TABS (compartido con TabBar) tiene exactamente las 12 keys esperadas', () => {
    expect(TABS.map((t) => t.key)).toEqual(KEYS_ESPERADAS);
  });

  it('renderiza un botón por cada tab visible del registro', () => {
    renderRail();
    for (const tab of tabsVisibles(false)) {
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
    fireEvent.click(screen.getByRole('button', { name: 'Funciones' }));
    expect(onChange).toHaveBeenCalledWith('escritorio');
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

// El mismo par de casos que TabBar.test.tsx, a propósito: el filtro es compartido, pero que los DOS
// shells lo apliquen no se deduce de que la función exista -- un shell que se olvidara de pasar el
// prop mostraría la Consola a cualquiera, y el test del otro shell seguiría verde.
describe('Rail -- la Consola sólo existe para un operador', () => {
  it('sin el claim, el rail no muestra "Consola"', () => {
    renderRail('chat', vi.fn(), false);
    expect(screen.queryByRole('button', { name: 'Consola' })).not.toBeInTheDocument();
  });

  it('el default es fail-closed: sin pasar `esAdmin` tampoco aparece', () => {
    renderRail();
    expect(screen.queryByRole('button', { name: 'Consola' })).not.toBeInTheDocument();
  });

  it('control positivo: con el claim, el botón está y navega a la consola', () => {
    const { onChange } = renderRail('chat', vi.fn(), true);
    const boton = screen.getByRole('button', { name: 'Consola' });
    expect(boton).toBeInTheDocument();
    fireEvent.click(boton);
    expect(onChange).toHaveBeenCalledWith('admin');
  });
});

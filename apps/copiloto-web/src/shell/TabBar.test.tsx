import { fireEvent, render, screen } from '@testing-library/react';
import { useEffect } from 'react';
import { describe, expect, it, vi } from 'vitest';

import '../design-system/themes.css';
import { THEMES } from '../design-system/ThemeProvider';
import { ModeProvider, useMode } from './modeStore';
import { TABS, TabBar } from './TabBar';

// `TabBar` lee `useMode()` (badge-dot del tab "Apps", gap #18) — necesita `<ModeProvider>` como
// ancestro, mismo criterio que `Rail.test.tsx`/`AppShell.test.tsx`.
function renderTabBar(active: (typeof TABS)[number]['key'] = 'chat', onChange = vi.fn()) {
  return render(
    <ModeProvider>
      <TabBar active={active} onChange={onChange} />
    </ModeProvider>,
  );
}

/** Setea el modo activo al montar (efecto, no en render — evita "update a component while
 * rendering a different component"), mismo espíritu que `ModeProbe` de `AppsScreen.test.tsx` pero
 * en la dirección de escritura. */
function ModeSetter({ label }: { label: string }) {
  const { setMode } = useMode();
  useEffect(() => {
    setMode({ key: 'gmail', label, category: 'comunicacion' });
  }, [label, setMode]);
  return null;
}

describe('TabBar', () => {
  it('renderiza los 16 tabs del registro declarativo (Chat · Apps · Conexiones · Gastos · Clientes · Contabilidad · Ingresos · Actividad · Presupuestos · Inteligencia · Mi día · Funciones · Recientes · Ajustes · Facturación · Cuenta)', () => {
    renderTabBar();
    expect(TABS).toHaveLength(16);
    for (const tab of TABS) {
      expect(screen.getByRole('button', { name: tab.label })).toBeInTheDocument();
    }
  });

  it('marca el tab activo con aria-current="page" y los demás sin el atributo', () => {
    renderTabBar('connections');
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
    renderTabBar('chat', onChange);
    fireEvent.click(screen.getByRole('button', { name: 'Apps' }));
    expect(onChange).toHaveBeenCalledWith('apps');
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('sin modo activo NO muestra el badge-dot del tab "Apps"', () => {
    renderTabBar();
    expect(screen.queryByTestId('tab-bar-mode-dot')).not.toBeInTheDocument();
  });

  it('con modo activo muestra el badge-dot del tab "Apps" (gap #18)', () => {
    render(
      <ModeProvider>
        <ModeSetter label="Mail" />
        <TabBar active="chat" onChange={vi.fn()} />
      </ModeProvider>,
    );
    expect(screen.getByTestId('tab-bar-mode-dot')).toBeInTheDocument();
  });

  it.each(THEMES)('renderiza bajo el tema "%s" sin romper', (theme) => {
    document.documentElement.setAttribute('data-theme', theme);
    renderTabBar();
    expect(screen.getByTestId('tab-bar')).toBeInTheDocument();
  });
});

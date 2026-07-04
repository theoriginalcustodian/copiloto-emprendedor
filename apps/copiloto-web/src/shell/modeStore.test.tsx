import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ReactNode } from 'react';

import { ModeProvider, useMode, type ActiveMode } from './modeStore';

const GMAIL: ActiveMode = { key: 'gmail', label: 'Mail', category: 'comunicacion' };
const CALENDAR: ActiveMode = { key: 'google-calendar', label: 'Agenda', category: 'agenda' };

function wrapper({ children }: { children: ReactNode }) {
  return <ModeProvider>{children}</ModeProvider>;
}

describe('modeStore (ModeProvider + useMode)', () => {
  it('arranca en modo general (mode=null)', () => {
    const { result } = renderHook(() => useMode(), { wrapper });
    expect(result.current.mode).toBeNull();
  });

  it('setMode activa un modo', () => {
    const { result } = renderHook(() => useMode(), { wrapper });

    act(() => result.current.setMode(GMAIL));

    expect(result.current.mode).toEqual(GMAIL);
  });

  it('setMode con otro modo reemplaza el anterior (uno solo a la vez, spec §3.2)', () => {
    const { result } = renderHook(() => useMode(), { wrapper });

    act(() => result.current.setMode(GMAIL));
    expect(result.current.mode).toEqual(GMAIL);

    act(() => result.current.setMode(CALENDAR));
    expect(result.current.mode).toEqual(CALENDAR);
  });

  it('clearMode vuelve a modo general (spec §3.3)', () => {
    const { result } = renderHook(() => useMode(), { wrapper });

    act(() => result.current.setMode(GMAIL));
    expect(result.current.mode).not.toBeNull();

    act(() => result.current.clearMode());
    expect(result.current.mode).toBeNull();
  });

  it('useMode fuera de <ModeProvider> tira un error explícito', () => {
    // Sin wrapper: el contexto es `null`, el hook debe fallar rápido y explícito (mismo criterio
    // que `useSession` sobre `SessionContext`).
    expect(() => renderHook(() => useMode())).toThrow('useMode debe usarse dentro de <ModeProvider>');
  });
});

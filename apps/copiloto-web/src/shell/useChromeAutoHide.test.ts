import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useChromeAutoHide } from './useChromeAutoHide';

describe('useChromeAutoHide', () => {
  it('arranca visible', () => {
    const { result } = renderHook(() => useChromeAutoHide());
    expect(result.current.hidden).toBe(false);
  });

  it('NO se auto-oculta por inactividad — sigue visible por más que pase el tiempo', () => {
    // Blindaje del fix 2026-07-04: el idle-hide obligaba a un doble-tap para abrir "Apps" (el 1er
    // toque sólo revelaba la barra oculta). Ya no hay timer: sin acción del usuario, no se esconde.
    vi.useFakeTimers();
    try {
      const { result } = renderHook(() => useChromeAutoHide());
      act(() => {
        vi.advanceTimersByTime(60_000);
      });
      expect(result.current.hidden).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('toggle alterna el estado', () => {
    const { result } = renderHook(() => useChromeAutoHide());
    act(() => {
      result.current.toggle();
    });
    expect(result.current.hidden).toBe(true);
    act(() => {
      result.current.toggle();
    });
    expect(result.current.hidden).toBe(false);
  });

  it('setHidden fija el estado explícitamente (hide-on-scroll / cambio de tab)', () => {
    const { result } = renderHook(() => useChromeAutoHide());
    act(() => {
      result.current.setHidden(true);
    });
    expect(result.current.hidden).toBe(true);
    act(() => {
      result.current.setHidden(false);
    });
    expect(result.current.hidden).toBe(false);
  });
});

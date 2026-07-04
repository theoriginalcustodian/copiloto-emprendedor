import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useChromeAutoHide } from './useChromeAutoHide';

describe('useChromeAutoHide', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('arranca visible y se auto-oculta tras la inactividad', () => {
    const { result } = renderHook(() => useChromeAutoHide(1000));
    expect(result.current.hidden).toBe(false);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.hidden).toBe(true);
  });

  it('toggle alterna el estado y re-arma el auto-hide al mostrar', () => {
    const { result } = renderHook(() => useChromeAutoHide(1000));
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.hidden).toBe(true);

    act(() => {
      result.current.toggle();
    });
    expect(result.current.hidden).toBe(false);

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.hidden).toBe(true);
  });

  it('setHidden(true) oculta y cancela el timer; setHidden(false) muestra y lo re-arma', () => {
    const { result } = renderHook(() => useChromeAutoHide(1000));
    act(() => {
      result.current.setHidden(true);
    });
    expect(result.current.hidden).toBe(true);

    act(() => {
      result.current.setHidden(false);
    });
    expect(result.current.hidden).toBe(false);

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.hidden).toBe(true);
  });
});

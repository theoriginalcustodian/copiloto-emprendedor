import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DESKTOP_MEDIA_QUERY, useBreakpoint } from './useBreakpoint';

type Listener = () => void;

/**
 * Mock mínimo de `MediaQueryList` — captura el listener de `change` para poder dispararlo a mano
 * y mover `matches` en caliente (simula un resize real sin depender de jsdom, que no re-evalúa
 * media queries por sí solo).
 */
function mockMatchMedia(initialMatches: boolean) {
  let matches = initialMatches;
  let listener: Listener | null = null;

  const mql = {
    get matches() {
      return matches;
    },
    media: DESKTOP_MEDIA_QUERY,
    addEventListener: vi.fn((_event: string, cb: Listener) => {
      listener = cb;
    }),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  };

  window.matchMedia = vi.fn().mockImplementation(() => mql);

  return {
    setMatches(next: boolean) {
      matches = next;
      listener?.();
    },
  };
}

describe('useBreakpoint', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('resuelve "mobile" cuando la media query NO matchea (viewport angosto)', () => {
    mockMatchMedia(false);
    const { result } = renderHook(() => useBreakpoint());
    expect(result.current).toBe('mobile');
  });

  it('resuelve "desktop" cuando la media query matchea (viewport ancho, >=900px)', () => {
    mockMatchMedia(true);
    const { result } = renderHook(() => useBreakpoint());
    expect(result.current).toBe('desktop');
  });

  it('es reactivo: reacciona al evento "change" de matchMedia sin re-montar', () => {
    const media = mockMatchMedia(false);
    const { result } = renderHook(() => useBreakpoint());
    expect(result.current).toBe('mobile');

    act(() => {
      media.setMatches(true);
    });
    expect(result.current).toBe('desktop');

    act(() => {
      media.setMatches(false);
    });
    expect(result.current).toBe('mobile');
  });
});

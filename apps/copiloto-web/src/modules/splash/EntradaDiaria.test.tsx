import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EntradaDiaria } from './EntradaDiaria';
import { ENTRADA_TOTAL_MS } from './tempos';

function mockMatchMedia(reducido: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: reducido,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

describe('EntradaDiaria (BL-X10, arranques 2..n)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockMatchMedia(false);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('llama a onFin después de ENTRADA_TOTAL_MS (no antes)', () => {
    const onFin = vi.fn();
    render(<EntradaDiaria onFin={onFin} />);
    vi.advanceTimersByTime(ENTRADA_TOTAL_MS - 1);
    expect(onFin).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onFin).toHaveBeenCalledOnce();
  });

  it('con movimiento reducido, llama a onFin de inmediato', () => {
    mockMatchMedia(true);
    const onFin = vi.fn();
    render(<EntradaDiaria onFin={onFin} />);
    vi.advanceTimersByTime(0);
    expect(onFin).toHaveBeenCalledOnce();
  });
});

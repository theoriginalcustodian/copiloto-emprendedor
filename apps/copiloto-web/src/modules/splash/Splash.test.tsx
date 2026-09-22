import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Splash } from './Splash';
import { SPLASH_TOTAL_MS } from './tempos';

function mockMatchMedia(reducido: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: reducido,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

describe('Splash (BL-X10, identidad)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockMatchMedia(false);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('llama a onFin después de SPLASH_TOTAL_MS (no antes)', () => {
    const onFin = vi.fn();
    render(<Splash onFin={onFin} />);
    vi.advanceTimersByTime(SPLASH_TOTAL_MS - 1);
    expect(onFin).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onFin).toHaveBeenCalledOnce();
  });

  it('con movimiento reducido, llama a onFin de inmediato', () => {
    mockMatchMedia(true);
    const onFin = vi.fn();
    render(<Splash onFin={onFin} />);
    vi.advanceTimersByTime(0);
    expect(onFin).toHaveBeenCalledOnce();
  });

  it('el botón de pronunciación llama a speechSynthesis con "odóbi" en es-AR', () => {
    const speak = vi.fn();
    const cancel = vi.fn();
    // jsdom no implementa Web Speech API -- se stubea acá, no en el setup global, porque es la
    // única suite que la usa.
    class SpeechSynthesisUtteranceStub {
      text: string;
      lang = '';
      rate = 1;
      constructor(text: string) {
        this.text = text;
      }
    }
    vi.stubGlobal('SpeechSynthesisUtterance', SpeechSynthesisUtteranceStub);
    Object.defineProperty(window, 'speechSynthesis', {
      value: { speak, cancel },
      writable: true,
      configurable: true,
    });
    render(<Splash onFin={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Escuchar cómo se pronuncia Odobi' }));
    expect(cancel).toHaveBeenCalledOnce();
    expect(speak).toHaveBeenCalledOnce();
    const u = speak.mock.calls[0][0] as SpeechSynthesisUtterance;
    expect(u.text).toBe('odóbi');
    expect(u.lang).toBe('es-AR');
    expect(u.rate).toBe(0.85);
  });
});

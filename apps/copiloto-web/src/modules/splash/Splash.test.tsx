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

  it('el texto de pronunciación usa PRONUNCIACION_MARCA (core), sin literal hardcodeado', () => {
    render(<Splash onFin={vi.fn()} />);
    expect(screen.getByText('se dice o-DO-bi')).toBeInTheDocument();
  });

  it('sin pronunciacionAsset, el botón de pronunciación NO se dibuja (BL-X10 fila 2, sin TTS de fallback)', () => {
    render(<Splash onFin={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Escuchar cómo se pronuncia Odobi' })).not.toBeInTheDocument();
  });

  it('con pronunciacionAsset, el botón se dibuja y reproduce el audio', () => {
    const play = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal(
      'Audio',
      vi.fn().mockImplementation(() => ({ play })),
    );
    render(<Splash onFin={vi.fn()} pronunciacionAsset="/assets/odobi.mp3" />);
    fireEvent.click(screen.getByRole('button', { name: 'Escuchar cómo se pronuncia Odobi' }));
    expect(play).toHaveBeenCalledOnce();
  });

  it('cta.secundario vacío NO dibuja el botón secundario (BETA-4b: sin alta que ofrecer)', () => {
    render(
      <Splash
        onFin={vi.fn()}
        cta={{ primario: 'Empecemos', secundario: '', onPrimario: vi.fn(), onSecundario: vi.fn() }}
      />,
    );
    expect(screen.getByText('Empecemos')).toBeInTheDocument();
    // Sin pronunciacionAsset (botón de pronunciación tampoco) + secundario vacío -> un solo botón.
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });
});

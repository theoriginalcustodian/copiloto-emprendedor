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

  describe('H-A4-2 — la "O" de "Odobi" es un glifo de texto real, no la forma que colapsa', () => {
    it('la "O" (glifo de texto) está SIEMPRE en el DOM, con o sin movimiento reducido', () => {
      mockMatchMedia(true);
      const { container } = render(<Splash onFin={vi.fn()} />);
      // Control negativo: con el bug viejo, `dobi` no tenía NINGÚN glifo "o" propio (sólo la forma
      // animada, que con reducido desaparecía entera) — "Odobi" se leía "dobi".
      const o = container.querySelector('.identidad-splash__o');
      expect(o).toBeInTheDocument();
      expect(o).toHaveTextContent('O');
    });

    it('con movimiento reducido, NINGUNA de las 4 formas se dibuja (van derecho al fondo final)', () => {
      mockMatchMedia(true);
      const { container } = render(<Splash onFin={vi.fn()} />);
      expect(container.querySelectorAll('.identidad-splash__blob').length).toBe(0);
    });

    it('sin movimiento reducido, la forma final SÍ se dibuja (es el tránsito hacia la "O")', () => {
      const { container } = render(<Splash onFin={vi.fn()} />);
      expect(container.querySelector('.identidad-splash__blob--last')).toBeInTheDocument();
    });

    it('el --ox del contenedor se mide contra "dobi" SIN la "O" (`.identidad-splash__rest`), no contra el wordmark completo', () => {
      // Control negativo: si el cálculo tomara el wordmark ENTERO (con la "O" ya adentro), el
      // colapso apuntaría a un punto distinto y corrido — la spec (`targetX()` del prototipo) mide
      // sólo `rest` ("dobi"), nunca el wordmark completo.
      const rectSpy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
        const width = this.className?.includes('identidad-splash__rest') ? 80 : 200;
        return { width, height: 40, top: 0, left: 0, right: 0, bottom: 0, x: 0, y: 0, toJSON() {} } as DOMRect;
      });

      const { container } = render(<Splash onFin={vi.fn()} />);
      const splash = container.querySelector('.identidad-splash') as HTMLElement;
      const oxPx = parseFloat(splash.style.getPropertyValue('--ox'));

      // Fórmula esperada (igual a `targetX()` del prototipo): -(anchoRest/2) = -(80/2) = -40.
      expect(oxPx).toBeCloseTo(-40, 1);

      rectSpy.mockRestore();
    });
  });
});

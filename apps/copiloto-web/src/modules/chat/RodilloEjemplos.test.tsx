import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EJEMPLOS_CHAT } from '@copiloto/core';

import { MS_POR_EJEMPLO, RodilloEjemplos } from './RodilloEjemplos';

function mockMatchMedia(reducido: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: reducido && query.includes('reduce'),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
}

const activa = () =>
  EJEMPLOS_CHAT.findIndex((_, i) => screen.getByTestId(`rodillo-frase-${i}`).getAttribute('aria-hidden') === 'false');

describe('RodilloEjemplos (BL-W4)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockMatchMedia(false);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('un ejemplo por vez cada ~4 s y vuelve al primero sin saltos', () => {
    render(<RodilloEjemplos />);
    expect(activa()).toBe(0);
    act(() => void vi.advanceTimersByTime(MS_POR_EJEMPLO));
    expect(activa()).toBe(1);
    act(() => void vi.advanceTimersByTime(MS_POR_EJEMPLO * 2));
    expect(activa()).toBe(0);
  });

  it('Pausar frena la rotación y Reanudar la retoma', () => {
    render(<RodilloEjemplos />);
    fireEvent.click(screen.getByTestId('rodillo-pausa'));
    expect(screen.getByTestId('rodillo-pausa')).toHaveAttribute('aria-pressed', 'true');
    act(() => void vi.advanceTimersByTime(MS_POR_EJEMPLO * 5));
    expect(activa()).toBe(0);
    fireEvent.click(screen.getByTestId('rodillo-pausa'));
    act(() => void vi.advanceTimersByTime(MS_POR_EJEMPLO));
    expect(activa()).toBe(1);
  });

  it('con prefers-reduced-motion queda QUIETO y no ofrece pausa', () => {
    mockMatchMedia(true);
    render(<RodilloEjemplos />);
    act(() => void vi.advanceTimersByTime(MS_POR_EJEMPLO * 5));
    expect(activa()).toBe(0);
    expect(screen.queryByTestId('rodillo-pausa')).not.toBeInTheDocument();
  });
});

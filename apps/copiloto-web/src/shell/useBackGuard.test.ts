import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useBackGuard } from './useBackGuard';

function fireBack() {
  act(() => {
    window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state }));
  });
}

describe('useBackGuard', () => {
  it('con overlay abierto (depth>0), "atrás" llama onBack en vez de salir', () => {
    const onBack = vi.fn();
    renderHook(() => useBackGuard(1, onBack));
    fireBack();
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('sin overlay (depth=0), "atrás" NO llama onBack (deja salir de la app)', () => {
    const onBack = vi.fn();
    renderHook(() => useBackGuard(0, onBack));
    fireBack();
    expect(onBack).not.toHaveBeenCalled();
  });

  it('pela una capa por cada "atrás" cuando hay overlays anidados', () => {
    const onBack = vi.fn();
    const { rerender } = renderHook(({ depth }) => useBackGuard(depth, onBack), {
      initialProps: { depth: 2 },
    });

    fireBack(); // pela la capa de arriba (ej. sheet)
    expect(onBack).toHaveBeenCalledTimes(1);

    rerender({ depth: 1 }); // el caller bajó depth al cerrar esa capa
    fireBack(); // pela la capa siguiente (ej. tab)
    expect(onBack).toHaveBeenCalledTimes(2);

    rerender({ depth: 0 });
    fireBack(); // ya sin overlay → no pela más
    expect(onBack).toHaveBeenCalledTimes(2);
  });
});

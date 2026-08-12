import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
});

/**
 * `@tanstack/react-virtual` (C6, `MessageList.tsx`) mide el scroller real vía `ResizeObserver`/
 * `getBoundingClientRect` — bajo jsdom el contenedor mide 0×0 siempre, así que `getVirtualItems()`
 * devolvería una ventana vacía y CUALQUIER test que lea texto de un mensaje (`screen.getByText`)
 * fallaría, aunque el componente esté bien. Mismo motivo y mismo remedio que el stub de `FlatList`
 * en `apps/mobile/jest.setup.js`: un stub GLOBAL, no-virtualizado, que devuelve TODOS los índices
 * como si entraran en pantalla — el layout/scroll real de la virtualización se valida en el device/
 * browser, no acá. Vive en `setupFiles` (no en `MessageList.test.tsx`) porque `ChatScreen.test.tsx`
 * también monta `MessageList` indirectamente.
 */
vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: (opts: {
    count: number;
    estimateSize: () => number;
    getItemKey?: (index: number) => unknown;
  }) => {
    const size = opts.estimateSize();
    const items = Array.from({ length: opts.count }, (_, index) => ({
      index,
      key: opts.getItemKey ? opts.getItemKey(index) : index,
      start: index * size,
      size,
    }));
    return {
      getVirtualItems: () => items,
      getTotalSize: () => opts.count * size,
      scrollToIndex: () => {},
      measureElement: () => {},
    };
  },
}));

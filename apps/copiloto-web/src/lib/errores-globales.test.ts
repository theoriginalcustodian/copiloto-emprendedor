/**
 * Item 0.5b (capa PWA) — lo que un `ErrorBoundary` NO puede cubrir.
 *
 * React sólo atrapa errores de render. Una promesa rechazada sin `catch` —el modo de fallo natural de
 * cada `fetch` que nadie envolvió— pasa de largo y hoy no deja absolutamente nada. Estos tests miden
 * que quede rastro, que es la mitad que suele olvidarse.
 */
import { afterEach, describe, expect, it } from 'vitest';

import { instalarCapturaGlobal } from './errores-globales';

describe('instalarCapturaGlobal', () => {
  let desinstalar: (() => void) | undefined;

  afterEach(() => {
    desinstalar?.();
    desinstalar = undefined;
  });

  it('deja rastro de un error global del runtime', () => {
    const vistos: unknown[] = [];
    desinstalar = instalarCapturaGlobal((r) => vistos.push(r));

    window.dispatchEvent(new ErrorEvent('error', { message: 'boom global' }));

    expect(vistos).toHaveLength(1);
    expect(vistos[0]).toMatchObject({ origen: 'window.onerror', mensaje: 'boom global' });
  });

  it('deja rastro de una promesa rechazada sin catch', () => {
    const vistos: any[] = [];
    desinstalar = instalarCapturaGlobal((r) => vistos.push(r));

    // `PromiseRejectionEvent` no existe en jsdom: se emula el evento con la forma que el handler lee.
    const ev = new Event('unhandledrejection') as Event & { reason?: unknown };
    ev.reason = new Error('fetch sin catch');
    window.dispatchEvent(ev);

    expect(vistos).toHaveLength(1);
    expect(vistos[0].origen).toBe('unhandledrejection');
    expect(vistos[0].mensaje).toBe('fetch sin catch');
  });

  it('un reporter que explota NO genera un error nuevo', () => {
    desinstalar = instalarCapturaGlobal(() => {
      throw new Error('el reporter falló');
    });

    // Si el handler no tragara la excepción del reporter, esto propagaría y el test fallaría:
    // registrar un error jamás puede producir otro (mismo principio que el `handleGlobalError` de ARCA).
    expect(() =>
      window.dispatchEvent(new ErrorEvent('error', { message: 'x' })),
    ).not.toThrow();
  });

  it('CONTROL NEGATIVO: tras desinstalar, deja de escuchar', () => {
    const vistos: unknown[] = [];
    const off = instalarCapturaGlobal((r) => vistos.push(r));
    off();

    window.dispatchEvent(new ErrorEvent('error', { message: 'ya no' }));

    expect(vistos).toHaveLength(0);
  });
});

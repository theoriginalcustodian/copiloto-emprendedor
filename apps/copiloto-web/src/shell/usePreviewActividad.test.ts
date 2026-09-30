import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@copiloto/core', async (importOriginal) => {
  const original = await importOriginal<typeof import('@copiloto/core')>();
  return {
    ...original,
    listarActividad: vi.fn(),
  };
});

import { listarActividad, type ActividadItem } from '@copiloto/core';

import { usePreviewActividad } from './usePreviewActividad';

const mockListarActividad = vi.mocked(listarActividad);

function itemFixture(id: string): ActividadItem {
  return {
    id,
    tipo: 'gasto',
    fecha: '2026-09-30T12:00:00-03:00',
    titulo: 'Nuevo gasto',
    detalle: 'Ferretería Central',
    monto: '15000.50',
    signo: 'sale',
  };
}

describe('usePreviewActividad', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // El control de CEGUERA del contrato: si nadie pasa `activo=true`, el fetch no existe. Este es
  // el test que se pone rojo si alguien desconecta el wiring del shell (comentar el `activeTab ===
  // 'escritorio'` de `AppShell`/`DesktopShell` y dejar `activo` en `false` a mano reproduce el rojo).
  it('con activo=false, nunca pide — ni actividad ni loading', () => {
    const { result } = renderHook(() => usePreviewActividad(false));
    expect(mockListarActividad).not.toHaveBeenCalled();
    expect(result.current.actividad).toEqual([]);
    expect(result.current.cargandoActividad).toBe(false);
  });

  // Positivo: con ítems reales, el hook los expone y termina sin loading.
  it('con activo=true, pide y expone los ítems reales de la respuesta', async () => {
    mockListarActividad.mockResolvedValue({
      status: 'ok',
      items: [itemFixture('gasto:1'), itemFixture('gasto:2')],
      cursor: null,
    });

    const { result } = renderHook(() => usePreviewActividad(true));

    await waitFor(() => expect(result.current.cargandoActividad).toBe(false));
    expect(result.current.actividad).toHaveLength(2);
    expect(mockListarActividad).toHaveBeenCalledWith({ limit: 5 });
  });

  // Negativo: actividad genuinamente vacía sigue siendo `[]`, sin romper nada.
  it('con activo=true y actividad genuinamente vacía, expone []', async () => {
    mockListarActividad.mockResolvedValue({ status: 'ok', items: [], cursor: null });

    const { result } = renderHook(() => usePreviewActividad(true));

    await waitFor(() => expect(result.current.cargandoActividad).toBe(false));
    expect(result.current.actividad).toEqual([]);
  });

  // Degradación: `no_disponible` o un fetch que rechaza no tumban el hook -- quedan en `[]`.
  it('con no_disponible, no rompe y deja actividad en []', async () => {
    mockListarActividad.mockResolvedValue({ status: 'no_disponible' });

    const { result } = renderHook(() => usePreviewActividad(true));

    await waitFor(() => expect(result.current.cargandoActividad).toBe(false));
    expect(result.current.actividad).toEqual([]);
  });

  it('con un fetch que rechaza, no rompe y deja actividad en []', async () => {
    mockListarActividad.mockRejectedValue(new Error('red caída'));

    const { result } = renderHook(() => usePreviewActividad(true));

    await waitFor(() => expect(result.current.cargandoActividad).toBe(false));
    expect(result.current.actividad).toEqual([]);
  });

  // Es un preview cacheado, no una pantalla con "Actualizar": una vez traído, salir y volver a
  // entrar a Escritorio (activo: true -> false -> true) NO vuelve a pedir.
  it('una vez cargado, desactivar y reactivar no vuelve a pedir', async () => {
    mockListarActividad.mockResolvedValue({
      status: 'ok',
      items: [itemFixture('gasto:1')],
      cursor: null,
    });

    const { result, rerender } = renderHook(({ activo }) => usePreviewActividad(activo), {
      initialProps: { activo: true },
    });
    await waitFor(() => expect(result.current.cargandoActividad).toBe(false));
    expect(mockListarActividad).toHaveBeenCalledTimes(1);

    rerender({ activo: false });
    rerender({ activo: true });

    expect(mockListarActividad).toHaveBeenCalledTimes(1);
    expect(result.current.actividad).toHaveLength(1);
  });
});

import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * SM-D2 (3) — «Esperando respuesta» NO puede salir de una página truncada sin decirlo.
 *
 * El mock modela el ENDPOINT, no la pantalla: `GET /presupuestos` corta en `limit` y, sin `limit`, en
 * `LIMITE_LISTADO_DEFAULT = 50` (`apps/copiloto/presupuestos_web.py:41`), con tope en 200 (`:42`). Un mock
 * que devolviera todo lo que se le pasó es el instrumento que confirma en vez de verificar: con 60
 * pendientes el bug no se ve, porque el mock nunca truncó.
 */
vi.mock('@copiloto/core', async (importOriginal) => {
  const original = await importOriginal<typeof import('@copiloto/core')>();
  return { ...original, listarPresupuestos: vi.fn() };
});

import { listarPresupuestos, type Presupuesto } from '@copiloto/core';

import { PresupuestosScreen } from './PresupuestosScreen';

const mockListar = vi.mocked(listarPresupuestos);

const DEFAULT_BACKEND = 50;
const MAX_BACKEND = 200;

function pendiente(id: number, total = '1000.00'): Presupuesto {
  return {
    id, numero: id, fecha: '2026-10-01T10:00:00Z', concepto: `Trabajo ${id}`,
    receptor: { nombre: 'Cliente', docTipo: 96, docNro: '1', condicionIva: 5, domicilio: '', contacto: '' },
    items: [], cantidadItems: 1, total, moneda: 'ARS', docLink: null, docId: null, sheetFila: null,
    reemplazaA: null, reemplazadoPor: null, facturaId: null, facturado: false,
    estado: 'pendiente', estadoActualizadoEn: null, sinRespuesta: false,
  } as Presupuesto;
}

/** El backend de verdad: respeta `limit`, lo clampa a 200 y, sin él, devuelve 50. */
function backendConTotal(total: number) {
  const todos = Array.from({ length: total }, (_, i) => pendiente(i + 1));
  mockListar.mockImplementation(async (params) => {
    const limit = Math.max(1, Math.min(params?.limit ?? DEFAULT_BACKEND, MAX_BACKEND));
    return { status: 'ok', presupuestos: todos.slice(0, limit) };
  });
}

describe('PresupuestosScreen — el resumen no se deriva de una página truncada (SM-D2 punto 3)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('🔴 con 60 pendientes la cifra es la de LOS 60, no la de los 50 que corta el default', async () => {
    backendConTotal(60);
    render(<PresupuestosScreen onFacturar={vi.fn()} />);

    const total = await screen.findByTestId('presupuestos-resumen-total');
    expect(total).toHaveTextContent('60.000');
    expect(screen.getByTestId('presupuestos-resumen-comparacion')).toHaveTextContent('60 sin contestar');
    // Debajo del tope no hay nada que avisar: un aviso que grita en el caso normal se desarma solo.
    expect(screen.queryByTestId('presupuestos-resumen-aviso')).not.toBeInTheDocument();
  });

  it('🔴 si la página llegó al TOPE del backend (más de 200), la cifra se declara parcial — nunca se muestra como total', async () => {
    backendConTotal(250);
    render(<PresupuestosScreen onFacturar={vi.fn()} />);

    await screen.findByTestId('presupuestos-resumen-total');
    const aviso = await screen.findByTestId('presupuestos-resumen-aviso');
    expect(aviso).toHaveTextContent(String(MAX_BACKEND));
  });

  it('control de no-regresión: la pantalla PIDE el tope — si vuelve a llamar sin `limit`, el listado se corta en 50 en silencio', async () => {
    backendConTotal(10);
    render(<PresupuestosScreen onFacturar={vi.fn()} />);
    await screen.findByTestId('presupuestos-resumen-total');

    const params = mockListar.mock.calls[0]?.[0];
    expect(params?.limit).toBe(MAX_BACKEND);
  });
});

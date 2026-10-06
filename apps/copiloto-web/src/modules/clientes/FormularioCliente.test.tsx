import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/** Partial mock: solo la red. Lo demás, REAL (mismo arnés que `FormularioGasto.test.tsx`). */
vi.mock('@copiloto/core', async (importOriginal) => {
  const original = await importOriginal<typeof import('@copiloto/core')>();
  return {
    ...original,
    crearCliente: vi.fn(),
  };
});

import { crearCliente, type Cliente } from '@copiloto/core';

import '../../design-system/themes.css';
import { FormularioCliente } from './FormularioCliente';

const mockCrear = vi.mocked(crearCliente);

/**
 * IDEMINGCLI — gemelo web del molde de gasto. Sin esto, un remonte con el alta en vuelo nacía con
 * una idem-key nueva (`claveAlta` arranca en `null`) y el backend no podía dedupear el alta. Lo medido
 * es la `idemKey` que `FormularioCliente` manda a `crearCliente`, sin mockear más que la red.
 */
describe('FormularioCliente — idemKey deriva del mensajeId (IDEMINGCLI)', () => {
  const CLIENTE_GUARDADO = { id: 1, nombre: 'Ana Pérez' } as unknown as Cliente;

  beforeEach(() => {
    mockCrear.mockClear();
    mockCrear.mockResolvedValue({ status: 'ok', cliente: CLIENTE_GUARDADO } as never);
  });

  /** Monta, completa el nombre, guarda y DESMONTA — como una card real. */
  async function montarGuardarYDesmontar(mensajeId: string | undefined) {
    const { unmount } = render(
      <FormularioCliente
        mensajeId={mensajeId}
        onGuardado={() => {}}
        onDuplicado={() => {}}
        onAbrirCliente={() => {}}
        onCancelar={() => {}}
      />,
    );
    fireEvent.change(screen.getByTestId('cliente-nombre'), { target: { value: 'Ana Pérez' } });
    fireEvent.click(screen.getByTestId('cliente-guardar'));
    await waitFor(() => expect(mockCrear).toHaveBeenCalled());
    unmount();
  }

  it('🔴 CONTROL POSITIVO: mismo mensajeId, tras DESMONTAR y volver a montar ⇒ MISMA idemKey', async () => {
    // Con la derivación revertida (`claveAlta.current = generarId()`) este test da ROJO. Medido por
    // efecto: mutar, correr, revertir.
    await montarGuardarYDesmontar('assistant-123');
    await montarGuardarYDesmontar('assistant-123');

    expect(mockCrear).toHaveBeenCalledTimes(2);
    expect(mockCrear.mock.calls[0]?.[1]?.idemKey).toBe('cliente:assistant-123');
    expect(mockCrear.mock.calls[1]?.[1]?.idemKey).toBe('cliente:assistant-123');
  });

  it('CONTROL NEGATIVO: dos mensajeId distintos ⇒ idemKey DISTINTAS (no se rompe el alta)', async () => {
    await montarGuardarYDesmontar('assistant-123');
    await montarGuardarYDesmontar('assistant-456');

    expect(mockCrear.mock.calls[0]?.[1]?.idemKey).toBe('cliente:assistant-123');
    expect(mockCrear.mock.calls[1]?.[1]?.idemKey).toBe('cliente:assistant-456');
  });

  it('sin mensajeId (alta manual, sin card): una clave por instancia — comportamiento previo intacto', async () => {
    await montarGuardarYDesmontar(undefined);
    await montarGuardarYDesmontar(undefined);

    const primera = mockCrear.mock.calls[0]?.[1]?.idemKey;
    const segunda = mockCrear.mock.calls[1]?.[1]?.idemKey;
    expect(primera).toMatch(/^[0-9a-f-]{36}$/);
    expect(segunda).toMatch(/^[0-9a-f-]{36}$/);
    expect(primera).not.toBe(segunda);
  });
});

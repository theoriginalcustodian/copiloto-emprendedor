import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/** Partial mock: solo la red. Lo demás, REAL (mismo arnés que `FormularioGasto.test.tsx`). */
vi.mock('@copiloto/core', async (importOriginal) => {
  const original = await importOriginal<typeof import('@copiloto/core')>();
  return {
    ...original,
    registrarIngreso: vi.fn(),
  };
});

import { registrarIngreso, type Ingreso } from '@copiloto/core';

import '../../design-system/themes.css';
import { FormularioIngreso } from './FormularioIngreso';

const mockRegistrar = vi.mocked(registrarIngreso);

/**
 * IDEMINGCLI — gemelo web del molde de gasto (`gastos/FormularioGasto.test.tsx`). Sin esto, un remonte
 * con el POST en vuelo nacía con una `idemKey` nueva (`claveGesto` arranca en `null`) y el backend no
 * podía dedupear un ingreso de dinero. Lo medido es la `idemKey` que `FormularioIngreso` manda a
 * `registrarIngreso`, sin mockear más que la red.
 */
describe('FormularioIngreso — idemKey deriva del mensajeId (IDEMINGCLI)', () => {
  const INGRESO_GUARDADO = { id: 1, monto: '15000.00' } as unknown as Ingreso;

  beforeEach(() => {
    mockRegistrar.mockClear();
    mockRegistrar.mockResolvedValue({ status: 'ok', ingreso: INGRESO_GUARDADO } as never);
  });

  /** Monta, completa el monto, guarda y DESMONTA — como una card real. */
  async function montarGuardarYDesmontar(mensajeId: string | undefined) {
    const { unmount } = render(
      <FormularioIngreso origen="voz" mensajeId={mensajeId} onGuardado={() => {}} onCancelar={() => {}} />,
    );
    fireEvent.change(screen.getByTestId('ingreso-monto'), { target: { value: '15000' } });
    fireEvent.click(screen.getByTestId('ingreso-guardar'));
    await waitFor(() => expect(mockRegistrar).toHaveBeenCalled());
    unmount();
  }

  it('🔴 CONTROL POSITIVO: mismo mensajeId, tras DESMONTAR y volver a montar ⇒ MISMA idemKey', async () => {
    // Con la derivación revertida (`claveGesto.current ?? generarId()`) este test da ROJO: cada
    // montaje genera un UUID distinto. Medido por efecto: mutar, correr, revertir.
    await montarGuardarYDesmontar('assistant-123');
    await montarGuardarYDesmontar('assistant-123');

    expect(mockRegistrar).toHaveBeenCalledTimes(2);
    expect(mockRegistrar.mock.calls[0]?.[0]?.idemKey).toBe('ingreso:assistant-123');
    expect(mockRegistrar.mock.calls[1]?.[0]?.idemKey).toBe('ingreso:assistant-123');
  });

  it('CONTROL NEGATIVO: dos mensajeId distintos ⇒ idemKey DISTINTAS (no se rompe el alta)', async () => {
    await montarGuardarYDesmontar('assistant-123');
    await montarGuardarYDesmontar('assistant-456');

    const primera = mockRegistrar.mock.calls[0]?.[0]?.idemKey;
    const segunda = mockRegistrar.mock.calls[1]?.[0]?.idemKey;
    expect(primera).toBe('ingreso:assistant-123');
    expect(segunda).toBe('ingreso:assistant-456');
  });

  it('sin mensajeId (alta manual, sin card): una clave por instancia — comportamiento previo intacto', async () => {
    await montarGuardarYDesmontar(undefined);
    await montarGuardarYDesmontar(undefined);

    const primera = mockRegistrar.mock.calls[0]?.[0]?.idemKey;
    const segunda = mockRegistrar.mock.calls[1]?.[0]?.idemKey;
    expect(primera).toMatch(/^[0-9a-f-]{36}$/);
    expect(segunda).toMatch(/^[0-9a-f-]{36}$/);
    expect(primera).not.toBe(segunda);
  });
});

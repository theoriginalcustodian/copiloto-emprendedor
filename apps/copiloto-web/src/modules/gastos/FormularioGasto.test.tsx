import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/** Partial mock: solo la red. Mismo arnes que `TarjetaGastoPropuesto.test.tsx`: lo demas, REAL. */
vi.mock('@copiloto/core', async (importOriginal) => {
  const original = await importOriginal<typeof import('@copiloto/core')>();
  return {
    ...original,
    crearGasto: vi.fn(),
  };
});

import { crearGasto, ETIQUETA_ORIGEN_GASTO, type Gasto, type OrigenGasto } from '@copiloto/core';

import '../../design-system/themes.css';
import { FormularioGasto } from './FormularioGasto';

const ORIGENES: OrigenGasto[] = ['voz', 'foto', 'manual'];
const mockCrear = vi.mocked(crearGasto);

describe('FormularioGasto — origen de la propuesta (BL-C4)', () => {
  it.each(ORIGENES)('muestra de dónde salió el gasto cuando origen=%s', (origen) => {
    render(<FormularioGasto origen={origen} onCreado={vi.fn()} onCancelar={vi.fn()} />);
    const linea = screen.getByTestId('gasto-origen');
    expect(linea).toHaveTextContent(ETIQUETA_ORIGEN_GASTO[origen]);
    expect(linea).toHaveAttribute('data-origen', origen);
  });

  it('las tres etiquetas son distintas entre sí (el usuario distingue una lectura de foto de algo que tipeó)', () => {
    expect(new Set(ORIGENES.map((o) => ETIQUETA_ORIGEN_GASTO[o])).size).toBe(ORIGENES.length);
  });
});

/**
 * IDEM-gasto/BL-V33 — **el gemelo web del test de mobile**
 * (`apps/mobile/src/modules/gastos/FormularioGasto.test.tsx:38-93`).
 *
 * Por qué hacía falta acá, y no es redundante con el guard: web YA tenía el guard cross-reload en
 * `TarjetaGastoPropuesto.test.tsx` («card guardada + remount ⇒ estado terminal»), pero ése ejercita
 * **otra capa** — la marca que sobrevive en `localStorage`. Si esa capa no aplica (otro dispositivo,
 * otra sesión, `localStorage` limpio o fallando abierto), la **segunda** defensa es que la `idemKey`
 * sea la MISMA entre dos montajes, y eso no lo ejercitaba ningún test web: el único
 * `FormularioGasto.test.tsx` de web no mencionaba `idemKey`. El verde de web no decía que estuviera
 * bien — decía que nadie había preguntado por esta capa.
 *
 * Qué verifica: el mecanismo REAL, la prop `mensajeId` tal como la pasa `TarjetaGastoPropuesto`
 * (`:113`), sin mockear más que la red. Lo medido es la `idemKey` que `FormularioGasto` efectivamente
 * manda a `crearGasto` (`FormularioGasto.tsx:68,87`).
 */
describe('FormularioGasto — idemKey deriva del mensajeId (BL-V33, gemelo del de mobile)', () => {
  const GASTO_GUARDADO = { id: 1, monto: '15000.00' } as unknown as Gasto;

  beforeEach(() => {
    mockCrear.mockClear();
    mockCrear.mockResolvedValue({ status: 'ok', gasto: GASTO_GUARDADO });
  });

  /** Monta, completa lo mínimo para habilitar «Guardar», guarda y DESMONTA — como una card real. */
  async function montarCompletarGuardarYDesmontar(mensajeId: string | undefined) {
    const { unmount } = render(
      <FormularioGasto origen="manual" mensajeId={mensajeId} onCreado={() => {}} onCancelar={() => {}} />,
    );
    fireEvent.change(screen.getByTestId('gasto-monto'), { target: { value: '15000' } });
    fireEvent.click(screen.getByTestId('gasto-guardar'));
    await waitFor(() => expect(mockCrear).toHaveBeenCalled());
    unmount();
  }

  it('🔴 CONTROL POSITIVO: mismo mensajeId, tras DESMONTAR y volver a montar ⇒ MISMA idemKey', async () => {
    // Sin el fix (`idemKey = useRef(generarId())`) este test da ROJO: cada montaje generaría un UUID
    // distinto y el backend no podría dedupear el remount — el bug real de esta clase (BL-V32/K-01).
    // Medido por efecto, no afirmado: ver el `cierre_` de A2-web con las tres corridas.
    await montarCompletarGuardarYDesmontar('assistant-123');
    await montarCompletarGuardarYDesmontar('assistant-123');

    expect(mockCrear).toHaveBeenCalledTimes(2);
    expect(mockCrear.mock.calls[0]?.[0]?.idemKey).toBe('gasto:assistant-123');
    expect(mockCrear.mock.calls[1]?.[0]?.idemKey).toBe('gasto:assistant-123');
  });

  it('CONTROL NEGATIVO: dos mensajeId legítimamente distintos ⇒ idemKey DISTINTAS (no se rompe el alta)', async () => {
    await montarCompletarGuardarYDesmontar('assistant-123');
    await montarCompletarGuardarYDesmontar('assistant-456');

    const primera = mockCrear.mock.calls[0]?.[0]?.idemKey;
    const segunda = mockCrear.mock.calls[1]?.[0]?.idemKey;
    expect(primera).toBe('gasto:assistant-123');
    expect(segunda).toBe('gasto:assistant-456');
    expect(primera).not.toBe(segunda);
  });

  it('sin mensajeId (alta manual desde Gastos, sin card): una clave por instancia — comportamiento previo intacto', async () => {
    await montarCompletarGuardarYDesmontar(undefined);
    await montarCompletarGuardarYDesmontar(undefined);

    const primera = mockCrear.mock.calls[0]?.[0]?.idemKey;
    const segunda = mockCrear.mock.calls[1]?.[0]?.idemKey;
    expect(primera).toMatch(/^[0-9a-f-]{36}$/);
    expect(segunda).toMatch(/^[0-9a-f-]{36}$/);
    expect(primera).not.toBe(segunda);
  });
});

jest.mock('@copiloto/core', () => {
  const actual = jest.requireActual('@copiloto/core');
  return { ...actual, registrarIngreso: jest.fn() };
});

import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { registrarIngreso, type Ingreso } from '@copiloto/core';

import { ThemeProvider } from '../../theme/ThemeProvider';
import { FormularioIngreso } from './FormularioIngreso';

const registrarMock = registrarIngreso as jest.MockedFunction<typeof registrarIngreso>;
const INGRESO_GUARDADO = { id: 1, monto: '15000.00' } as unknown as Ingreso;

/**
 * `FormularioIngreso` — IDEMINGCLI: la `idemKey` se deriva de `mensajeId` (molde: `FormularioGasto`,
 * IDEM-gasto/BL-V33). Un remount de la card mientras el POST sigue en vuelo no puede cambiar la clave,
 * porque el guard de `TarjetaIngresoPropuesto` todavía no se escribió (se escribe en `onListo`).
 * Lo que se verifica es la `idemKey` que el formulario efectivamente manda a `registrarIngreso`.
 */
describe('FormularioIngreso — idemKey deriva del mensajeId (IDEMINGCLI)', () => {
  beforeEach(() => {
    registrarMock.mockClear();
    registrarMock.mockResolvedValue({ status: 'ok', ingreso: INGRESO_GUARDADO });
  });

  /** Monta, completa el monto, anota, y DESMONTA — como una card real. */
  async function montarCompletarGuardarYDesmontar(mensajeId: string | undefined) {
    const r = await render(
      <ThemeProvider>
        <FormularioIngreso mensajeId={mensajeId} onGuardado={() => {}} onCancelar={() => {}} />
      </ThemeProvider>,
    );
    await fireEvent.changeText(screen.getByTestId('ingreso-form-monto-input'), '15000');
    await fireEvent.press(screen.getByTestId('ingreso-form-guardar'));
    await waitFor(() => expect(registrarMock).toHaveBeenCalled());
    await r.unmount();
  }

  it('🔴 CONTROL POSITIVO: mismo mensajeId, tras DESMONTAR y volver a montar ⇒ MISMA idemKey', async () => {
    // Con la derivación revertida (`useRef<string | null>(null)`) este test da ROJO: cada montaje
    // genera un UUID nuevo y el backend no puede dedupear el remount — un ingreso de más en la caja.
    await montarCompletarGuardarYDesmontar('assistant-123');
    await montarCompletarGuardarYDesmontar('assistant-123');

    expect(registrarMock).toHaveBeenCalledTimes(2);
    expect(registrarMock.mock.calls[0]?.[0]?.idemKey).toBe('ingreso:assistant-123');
    expect(registrarMock.mock.calls[1]?.[0]?.idemKey).toBe('ingreso:assistant-123');
  });

  it('CONTROL NEGATIVO: dos mensajeId distintos ⇒ idemKey DISTINTAS (no se rompe el alta de un ingreso nuevo)', async () => {
    await montarCompletarGuardarYDesmontar('assistant-123');
    await montarCompletarGuardarYDesmontar('assistant-456');

    const primera = registrarMock.mock.calls[0]?.[0]?.idemKey;
    const segunda = registrarMock.mock.calls[1]?.[0]?.idemKey;
    expect(primera).toBe('ingreso:assistant-123');
    expect(segunda).toBe('ingreso:assistant-456');
    expect(primera).not.toBe(segunda);
  });

  /**
   * 🔴 **Por qué este caso, y no "segundo `guardar()` real después de un `ok`" tal cual.** Medí los
   * tres call-sites (`PantallaIngresos` alta manual, `TarjetaIngresoPropuesto` por voz) y el propio
   * render de este componente: tras un `ok`, el bloque que expone el botón `-guardar` exige
   * `guardado == null` (`FormularioIngreso.tsx:301`) — una vez guardado, NINGÚN botón restante
   * (`-completar`, `-listo`) vuelve a llamar `guardar()`; sólo `completar()` (PATCH, sin `idemKey`).
   * Confirmado con un diagnóstico empírico: tras el `ok`, `queryByTestId('ingreso-form-guardar')` es
   * `null` en el propio render. Ningún padre conocido reutiliza la instancia para un segundo POST sin
   * desmontar — `TarjetaIngresoPropuesto` recién desmonta `FormularioIngreso` en `onListo`, después
   * de que ya no hay ningún `guardar()` pendiente. El camino real de "dos guardados, una instancia,
   * sin desmontar" es el de abajo: duplicado detectado → confirmarlo.
   */
  it('CONFIRMAR DUPLICADO: dos llamadas reales en la MISMA instancia (sin desmontar) ⇒ MISMA idemKey', async () => {
    registrarMock.mockResolvedValueOnce({
      status: 'posible_duplicado',
      mensaje: 'Parece que ya anotaste un ingreso así.',
      candidato: null,
    });
    registrarMock.mockResolvedValueOnce({ status: 'ok', ingreso: INGRESO_GUARDADO });

    await render(
      <ThemeProvider>
        <FormularioIngreso mensajeId="assistant-123" onGuardado={() => {}} onCancelar={() => {}} />
      </ThemeProvider>,
    );
    await fireEvent.changeText(screen.getByTestId('ingreso-form-monto-input'), '15000');
    await fireEvent.press(screen.getByTestId('ingreso-form-guardar'));
    await waitFor(() => expect(screen.getByTestId('ingreso-form-confirmar-duplicado')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('ingreso-form-confirmar-duplicado'));
    await waitFor(() => expect(registrarMock).toHaveBeenCalledTimes(2));

    expect(registrarMock.mock.calls[0]?.[0]?.idemKey).toBe('ingreso:assistant-123');
    expect(registrarMock.mock.calls[1]?.[0]?.idemKey).toBe('ingreso:assistant-123');
  });

  it('sin mensajeId (alta manual, sin card): clave por gesto — comportamiento previo intacto', async () => {
    await montarCompletarGuardarYDesmontar(undefined);
    await montarCompletarGuardarYDesmontar(undefined);

    const primera = registrarMock.mock.calls[0]?.[0]?.idemKey;
    const segunda = registrarMock.mock.calls[1]?.[0]?.idemKey;
    expect(primera).toMatch(/^[0-9a-f-]{36}$/);
    expect(segunda).toMatch(/^[0-9a-f-]{36}$/);
    expect(primera).not.toBe(segunda);
  });
});

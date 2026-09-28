jest.mock('@copiloto/core', () => {
  const actual = jest.requireActual('@copiloto/core');
  return { ...actual, crearGasto: jest.fn() };
});

import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { crearGasto, ETIQUETA_ORIGEN_GASTO, type Gasto, type OrigenGasto } from '@copiloto/core';

import { ThemeProvider } from '../../theme/ThemeProvider';
import { FormularioGasto } from './FormularioGasto';

const ORIGENES: OrigenGasto[] = ['voz', 'foto', 'manual'];
const crearMock = crearGasto as jest.MockedFunction<typeof crearGasto>;

describe('FormularioGasto — origen de la propuesta (BL-C4)', () => {
  it.each(ORIGENES)('muestra de dónde salió el gasto cuando origen=%s', async (origen) => {
    // `render` es asíncrono en RNTL 14 + React 19: sin `await` el árbol todavía no existe.
    const { getByTestId } = await render(
      <ThemeProvider>
        <FormularioGasto origen={origen} onCreado={jest.fn()} onCancelar={jest.fn()} />
      </ThemeProvider>,
    );
    expect(getByTestId('gasto-origen')).toHaveTextContent(ETIQUETA_ORIGEN_GASTO[origen]);
  });
});

/**
 * `FormularioGasto` — IDEM-gasto/BL-V33: la `idemKey` se deriva de `mensajeId`, mismo mecanismo
 * (y mismo bug de origen) que `FormularioPresupuesto` (BL-V32/K-01 ampliado, ver su test para el
 * porqué). Gastos no tenía idempotencia en NINGUNA capa: un remount de la card (scroll, recarga del
 * hilo, reabrir la app) mientras seguía "sin guardar" para el backend, con el guard cross-remount de
 * `TarjetaGastoPropuesto` fallando abierto, dejaba tocar Guardar dos veces y crear dos gastos con la
 * misma plata, en silencio. Ejercita el mecanismo REAL (la prop `mensajeId` tal como la pasa
 * `TarjetaGastoPropuesto`), sin mockear el store: lo que se verifica es la `idemKey` que
 * `FormularioGasto` efectivamente manda a `crearGasto`.
 */
describe('FormularioGasto — idemKey deriva del mensajeId (BL-V33)', () => {
  const GASTO_GUARDADO = { id: 1, monto: '15000.00' } as unknown as Gasto;

  beforeEach(() => {
    crearMock.mockClear();
    crearMock.mockResolvedValue({ status: 'ok', gasto: GASTO_GUARDADO });
  });

  /** Monta, completa lo mínimo para habilitar "Guardar", guarda, y DESMONTA — como una card real. */
  async function montarCompletarGuardarYDesmontar(mensajeId: string | undefined) {
    const r = await render(
      <ThemeProvider>
        <FormularioGasto origen="manual" mensajeId={mensajeId} onCreado={() => {}} onCancelar={() => {}} />
      </ThemeProvider>,
    );
    await fireEvent.changeText(screen.getByTestId('gasto-monto-input'), '15000');
    await fireEvent.press(screen.getByTestId('gasto-guardar'));
    await waitFor(() => expect(crearMock).toHaveBeenCalled());
    await r.unmount();
  }

  it('🔴 CONTROL POSITIVO: mismo mensajeId, tras DESMONTAR y volver a montar ⇒ MISMA idemKey', async () => {
    // Sin el fix (idemKey = useRef(generarId())) este test da ROJO: cada montaje generaría un UUID
    // distinto y el backend no podría dedupear el remount — el bug real de esta clase (BL-V32/K-01).
    await montarCompletarGuardarYDesmontar('assistant-123');
    await montarCompletarGuardarYDesmontar('assistant-123');

    expect(crearMock).toHaveBeenCalledTimes(2);
    const primera = crearMock.mock.calls[0]?.[0]?.idemKey;
    const segunda = crearMock.mock.calls[1]?.[0]?.idemKey;
    expect(primera).toBe('gasto:assistant-123');
    expect(segunda).toBe('gasto:assistant-123');
  });

  it('CONTROL NEGATIVO: dos mensajeId legítimamente distintos ⇒ idemKey DISTINTAS (no se rompe el alta)', async () => {
    await montarCompletarGuardarYDesmontar('assistant-123');
    await montarCompletarGuardarYDesmontar('assistant-456');

    const primera = crearMock.mock.calls[0]?.[0]?.idemKey;
    const segunda = crearMock.mock.calls[1]?.[0]?.idemKey;
    expect(primera).toBe('gasto:assistant-123');
    expect(segunda).toBe('gasto:assistant-456');
    expect(primera).not.toBe(segunda);
  });

  it('sin mensajeId (alta manual, sin card): se mantiene una clave por instancia — comportamiento previo intacto', async () => {
    await montarCompletarGuardarYDesmontar(undefined);
    await montarCompletarGuardarYDesmontar(undefined);

    const primera = crearMock.mock.calls[0]?.[0]?.idemKey;
    const segunda = crearMock.mock.calls[1]?.[0]?.idemKey;
    expect(primera).toMatch(/^[0-9a-f-]{36}$/);
    expect(segunda).toMatch(/^[0-9a-f-]{36}$/);
    expect(primera).not.toBe(segunda);
  });
});

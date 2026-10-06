jest.mock('@copiloto/core', () => {
  const actual = jest.requireActual('@copiloto/core');
  return { ...actual, crearCliente: jest.fn() };
});

import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { crearCliente, type Cliente } from '@copiloto/core';

import { ThemeProvider } from '../../theme/ThemeProvider';
import { FormularioCliente } from './FormularioCliente';

const crearMock = crearCliente as jest.MockedFunction<typeof crearCliente>;
const CLIENTE_CREADO = { id: 1, nombre: 'Ana Pérez' } as unknown as Cliente;

/**
 * `FormularioCliente` — IDEMINGCLI: la `idemKey` del ALTA se deriva de `mensajeId` cuando la card de
 * voz lo pasa (molde: `FormularioGasto`, IDEM-gasto/BL-V33). Sin `mensajeId` (alta manual desde
 * `PantallaClientes`) la clave nace por gesto. Lo que se verifica es la `idemKey` que llega a
 * `crearCliente`, no la ref interna.
 */
describe('FormularioCliente — idemKey del alta deriva del mensajeId (IDEMINGCLI)', () => {
  beforeEach(() => {
    crearMock.mockClear();
    crearMock.mockResolvedValue({ status: 'ok', cliente: CLIENTE_CREADO });
  });

  /** Monta, completa el nombre, da de alta, y DESMONTA — como una card real. */
  async function montarCompletarGuardarYDesmontar(mensajeId: string | undefined) {
    const r = await render(
      <ThemeProvider>
        <FormularioCliente mensajeId={mensajeId} onGuardado={() => {}} onDuplicado={() => {}} onAbrirCliente={() => {}} onCancelar={() => {}} />
      </ThemeProvider>,
    );
    await fireEvent.changeText(screen.getByTestId('formulario-cliente-nombre-input'), 'Ana Pérez');
    await fireEvent.press(screen.getByTestId('formulario-cliente-guardar'));
    await waitFor(() => expect(crearMock).toHaveBeenCalled());
    await r.unmount();
  }

  it('🔴 CONTROL POSITIVO: mismo mensajeId, tras DESMONTAR y volver a montar ⇒ MISMA idemKey', async () => {
    // Con la derivación revertida (`useRef<string | null>(null)`) este test da ROJO: cada montaje genera
    // un UUID nuevo y el backend no puede dedupear el remount — dos clientes idénticos.
    await montarCompletarGuardarYDesmontar('assistant-123');
    await montarCompletarGuardarYDesmontar('assistant-123');

    expect(crearMock).toHaveBeenCalledTimes(2);
    expect(crearMock.mock.calls[0]?.[1]?.idemKey).toBe('cliente:assistant-123');
    expect(crearMock.mock.calls[1]?.[1]?.idemKey).toBe('cliente:assistant-123');
  });

  it('CONTROL NEGATIVO: dos mensajeId distintos ⇒ idemKey DISTINTAS (no se rompe el alta de otro cliente)', async () => {
    await montarCompletarGuardarYDesmontar('assistant-123');
    await montarCompletarGuardarYDesmontar('assistant-456');

    const primera = crearMock.mock.calls[0]?.[1]?.idemKey;
    const segunda = crearMock.mock.calls[1]?.[1]?.idemKey;
    expect(primera).toBe('cliente:assistant-123');
    expect(segunda).toBe('cliente:assistant-456');
    expect(primera).not.toBe(segunda);
  });

  it('sin mensajeId (alta manual, sin card): clave por gesto — comportamiento previo intacto', async () => {
    await montarCompletarGuardarYDesmontar(undefined);
    await montarCompletarGuardarYDesmontar(undefined);

    const primera = crearMock.mock.calls[0]?.[1]?.idemKey;
    const segunda = crearMock.mock.calls[1]?.[1]?.idemKey;
    expect(primera).toMatch(/^[0-9a-f-]{36}$/);
    expect(segunda).toMatch(/^[0-9a-f-]{36}$/);
    expect(primera).not.toBe(segunda);
  });
});

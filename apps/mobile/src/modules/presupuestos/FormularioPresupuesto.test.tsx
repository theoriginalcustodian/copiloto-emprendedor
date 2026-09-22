/**
 * `FormularioPresupuesto` — **armarlo eligiendo del catálogo** (contrato §3).
 *
 * Lo que se fija acá es que el catálogo sea un **acelerador y no un requisito**: si no hay, si no está
 * desplegado o si falla, el formulario tiene que funcionar exactamente igual que antes. El backend
 * acepta un presupuesto sin ítems del catálogo, y cualquier cosa que sugiera lo contrario sería
 * validación de más disfrazada de ayuda.
 *
 * ⚠️ Todo `fireEvent` va con `await` — ver el docstring de `jest.config.js`.
 */
jest.mock('@copiloto/core', () => {
  const actual = jest.requireActual('@copiloto/core');
  return { ...actual, listarConceptos: jest.fn(), crearPresupuesto: jest.fn() };
});

import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { crearPresupuesto, listarConceptos, type Concepto, type Presupuesto } from '@copiloto/core';

import { FormularioPresupuesto } from './FormularioPresupuesto';
import { ThemeProvider } from '../../theme/ThemeProvider';

const listarMock = listarConceptos as jest.MockedFunction<typeof listarConceptos>;
const crearMock = crearPresupuesto as jest.MockedFunction<typeof crearPresupuesto>;

const CORTE: Concepto = { id: 1, nombre: 'Corte de pelo', precioReferencia: '8000.00', activo: true };
const A_MEDIDA: Concepto = { id: 2, nombre: 'Trabajo a medida', precioReferencia: null, activo: true };

async function montar() {
  return render(
    <ThemeProvider>
      <FormularioPresupuesto onCreado={() => {}} onCancelar={() => {}} />
    </ThemeProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  listarMock.mockResolvedValue({ status: 'ok', conceptos: [CORTE, A_MEDIDA] });
});

describe('FormularioPresupuesto — el catálogo', () => {
  it('🔴 pide los ACTIVOS (el default), no los desactivados', async () => {
    // Al revés que el ABM de Ajustes: ofrecer un trabajo que el emprendedor retiró lo pondría en un
    // presupuesto que ya decidió no vender.
    await montar();

    await waitFor(() => expect(listarMock).toHaveBeenCalled());
    expect(listarMock.mock.calls[0][0]).toBeUndefined();
  });

  it('tocar un concepto lo mete como ítem, con su precio de referencia', async () => {
    await montar();
    await waitFor(() => expect(screen.getByTestId('formulario-presupuesto-catalogo-1')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('formulario-presupuesto-catalogo-1'));

    await waitFor(() =>
      expect(screen.getByTestId('formulario-presupuesto-item-0-descripcion-input').props.value).toBe('Corte de pelo'),
    );
    expect(screen.getByTestId('formulario-presupuesto-item-0-precio-input').props.value).toBe('8000.00');
  });

  it('🔴 el precio queda EDITABLE — es de referencia, no una tarifa cerrada', async () => {
    // El trabajo de hoy puede salir otro precio; bloquearlo obligaría a editar el catálogo para
    // cotizar distinto una sola vez.
    await montar();
    await waitFor(() => expect(screen.getByTestId('formulario-presupuesto-catalogo-1')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('formulario-presupuesto-catalogo-1'));
    await waitFor(() =>
      expect(screen.getByTestId('formulario-presupuesto-item-0-precio-input').props.value).toBe('8000.00'),
    );

    await fireEvent.changeText(screen.getByTestId('formulario-presupuesto-item-0-precio-input'), '9500');

    await waitFor(() =>
      expect(screen.getByTestId('formulario-presupuesto-item-0-precio-input').props.value).toBe('9500'),
    );
  });

  it('🔴 un concepto SIN precio deja el campo vacío, nunca en "0"', async () => {
    // Un cero es un precio. Un presupuesto que sale en cero por un default es un documento que se
    // manda mal sin que nadie lo note.
    await montar();
    await waitFor(() => expect(screen.getByTestId('formulario-presupuesto-catalogo-2')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('formulario-presupuesto-catalogo-2'));

    await waitFor(() =>
      expect(screen.getByTestId('formulario-presupuesto-item-0-descripcion-input').props.value).toBe('Trabajo a medida'),
    );
    expect(screen.getByTestId('formulario-presupuesto-item-0-precio-input').props.value).toBe('');
  });

  it('tocar dos conceptos deja DOS líneas — el segundo no pisa al primero', async () => {
    await montar();
    await waitFor(() => expect(screen.getByTestId('formulario-presupuesto-catalogo-1')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('formulario-presupuesto-catalogo-1'));
    await waitFor(() =>
      expect(screen.getByTestId('formulario-presupuesto-item-0-descripcion-input').props.value).toBe('Corte de pelo'),
    );
    await fireEvent.press(screen.getByTestId('formulario-presupuesto-catalogo-2'));

    await waitFor(() =>
      expect(screen.getByTestId('formulario-presupuesto-item-1-descripcion-input').props.value).toBe('Trabajo a medida'),
    );
    expect(screen.getByTestId('formulario-presupuesto-item-0-descripcion-input').props.value).toBe('Corte de pelo');
  });

  it('🔴 sin catálogo NO se dibuja nada — ni la tira, ni un aviso', async () => {
    // Un renglón que diga "no tenés nada en tu lista" convertiría una función opcional en una
    // carencia, y el formulario sigue teniendo que funcionar entero sin ella.
    listarMock.mockResolvedValue({ status: 'ok', conceptos: [] });

    await montar();

    await waitFor(() => expect(screen.getByTestId('formulario-presupuesto-item-0-descripcion')).toBeTruthy());
    expect(screen.queryByTestId('formulario-presupuesto-catalogo')).toBeNull();
    expect(screen.queryByText(/lista/i)).toBeNull();
  });

  it('🔴 con el catálogo NO desplegado tampoco se rompe ni se avisa', async () => {
    listarMock.mockResolvedValue({ status: 'no_disponible' });

    await montar();

    await waitFor(() => expect(screen.getByTestId('formulario-presupuesto-item-0-descripcion')).toBeTruthy());
    expect(screen.queryByTestId('formulario-presupuesto-catalogo')).toBeNull();
  });

  it('y si la consulta explota, el formulario sigue entero', async () => {
    listarMock.mockRejectedValue(new Error('red caída'));

    await montar();

    await waitFor(() => expect(screen.getByTestId('formulario-presupuesto-item-0-descripcion')).toBeTruthy());
    expect(screen.queryByTestId('formulario-presupuesto-catalogo')).toBeNull();
  });
});

/**
 * `FormularioPresupuesto` — BL-V32 (IDEM/K-01 ampliado): la `idem_key` se deriva de `mensajeId`.
 *
 * El bug real (prod): la clave nacía con el MONTAJE del formulario. Si la card que lo envuelve
 * (`TarjetaPresupuestoPropuesto`) se remontaba mientras la propuesta seguía "sin guardar" para el
 * backend (guard cross-remount best-effort fallando abierto), el remount generaba una clave NUEVA y
 * el backend no podía dedupear — "un click en Guardar ahí generaba un presupuesto duplicado en prod".
 *
 * Estos tests ejercitan el mecanismo REAL de producción (la prop `mensajeId` tal como la pasa
 * `TarjetaPresupuestoPropuesto`), sin mockear el store: lo que se verifica es la `idem_key` que
 * `FormularioPresupuesto` efectivamente manda a `crearPresupuesto`.
 */
describe('FormularioPresupuesto — idemKey deriva del mensajeId (BL-V32)', () => {
  const PRESUPUESTO_GUARDADO = { id: 1, numero: 1 } as unknown as Presupuesto;

  beforeEach(() => {
    crearMock.mockResolvedValue({ status: 'ok', presupuesto: PRESUPUESTO_GUARDADO, sugerencias: null });
  });

  /** Monta, completa lo mínimo para habilitar "Guardar", guarda, y DESMONTA — como una card real. */
  async function montarCompletarGuardarYDesmontar(mensajeId: string | undefined) {
    const r = await render(
      <ThemeProvider>
        <FormularioPresupuesto mensajeId={mensajeId} onCreado={() => {}} onCancelar={() => {}} />
      </ThemeProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('formulario-presupuesto-item-0-descripcion')).toBeTruthy());
    await fireEvent.changeText(screen.getByTestId('formulario-presupuesto-concepto-input'), 'Instalación');
    await fireEvent.changeText(screen.getByTestId('formulario-presupuesto-nombre-input'), 'Juan Pérez');
    await fireEvent.changeText(screen.getByTestId('formulario-presupuesto-item-0-descripcion-input'), 'Mano de obra');
    await fireEvent.press(screen.getByTestId('formulario-presupuesto-guardar'));
    await waitFor(() => expect(crearMock).toHaveBeenCalled());
    await r.unmount();
  }

  it('🔴 CONTROL POSITIVO: mismo mensajeId, tras DESMONTAR y volver a montar ⇒ MISMA idem_key', async () => {
    // Sin el fix (idemKey = useRef(generarId())) este test da ROJO: cada montaje generaría un UUID
    // distinto y el backend no podría dedupear el remount — exactamente el bug de prod.
    await montarCompletarGuardarYDesmontar('assistant-123');
    await montarCompletarGuardarYDesmontar('assistant-123');

    expect(crearMock).toHaveBeenCalledTimes(2);
    const primera = crearMock.mock.calls[0]?.[0]?.idemKey;
    const segunda = crearMock.mock.calls[1]?.[0]?.idemKey;
    expect(primera).toBe('presupuesto:assistant-123');
    expect(segunda).toBe('presupuesto:assistant-123');
  });

  it('CONTROL NEGATIVO: dos mensajeId legítimamente distintos ⇒ idem_key DISTINTAS (no se rompe el alta)', async () => {
    await montarCompletarGuardarYDesmontar('assistant-123');
    await montarCompletarGuardarYDesmontar('assistant-456');

    const primera = crearMock.mock.calls[0]?.[0]?.idemKey;
    const segunda = crearMock.mock.calls[1]?.[0]?.idemKey;
    expect(primera).toBe('presupuesto:assistant-123');
    expect(segunda).toBe('presupuesto:assistant-456');
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

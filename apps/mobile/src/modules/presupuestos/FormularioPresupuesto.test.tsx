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

import { listarConceptos, type Concepto } from '@copiloto/core';

import { FormularioPresupuesto } from './FormularioPresupuesto';
import { ThemeProvider } from '../../theme/ThemeProvider';

const listarMock = listarConceptos as jest.MockedFunction<typeof listarConceptos>;

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

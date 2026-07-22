/**
 * `SeccionCatalogo` — el ABM de lo que vende, en Ajustes → Mi negocio.
 *
 * Lo que se fija acá: que los desactivados se PIDAN (si no, son irrecuperables sin que nadie note
 * nada), que quitar sea desactivar y no borrar, y que no se exija más de lo que el backend exige.
 */
jest.mock('@copiloto/core', () => {
  const actual = jest.requireActual('@copiloto/core');
  return {
    ...actual,
    listarConceptos: jest.fn(),
    crearConcepto: jest.fn(),
    editarConcepto: jest.fn(),
    desactivarConcepto: jest.fn(),
  };
});

import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { crearConcepto, desactivarConcepto, editarConcepto, listarConceptos } from '@copiloto/core';

import { ThemeProvider } from '../../../theme/ThemeProvider';
import { SeccionCatalogo } from './SeccionCatalogo';

const listarMock = listarConceptos as jest.MockedFunction<typeof listarConceptos>;
const crearMock = crearConcepto as jest.MockedFunction<typeof crearConcepto>;
const editarMock = editarConcepto as jest.MockedFunction<typeof editarConcepto>;
const desactivarMock = desactivarConcepto as jest.MockedFunction<typeof desactivarConcepto>;

const CORTE = { id: 1, nombre: 'Corte de pelo', precioReferencia: '8000.00', activo: true };
const COLOR = { id: 2, nombre: 'Color', precioReferencia: null, activo: false };

/**
 * Tipear en un `CampoTexto`. Ojo con dos cosas que costaron un rato acá:
 *
 * 1. El `testID` del input lleva sufijo **`-input`**: el que se pasa al componente queda en el `View`
 *    contenedor, y `changeText` sobre un `View` no hace nada **ni protesta**.
 * 2. `fireEvent` hay que **`await`-earlo** (RNTL 14 + React 19). Ver el docstring de `jest.config.js`.
 */
async function tipear(testID: string, texto: string) {
  await fireEvent.changeText(screen.getByTestId(testID), texto);
  await waitFor(() => expect(screen.getByTestId(testID).props.value).toBe(texto));
}

async function montar() {
  return render(
    <ThemeProvider>
      <SeccionCatalogo />
    </ThemeProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  listarMock.mockResolvedValue({ status: 'ok', conceptos: [CORTE, COLOR] });
  crearMock.mockResolvedValue({ status: 'ok', concepto: { id: 3, nombre: 'Barba', precioReferencia: null, activo: true } });
  editarMock.mockResolvedValue({ status: 'ok', concepto: { ...COLOR, activo: true } });
  desactivarMock.mockResolvedValue({ status: 'ok', concepto: { ...CORTE, activo: false } });
});

describe('SeccionCatalogo', () => {
  it('🔴 pide los DESACTIVADOS — es la única pantalla desde donde se reactivan', async () => {
    // Sin esto, un concepto retirado queda irrecuperable y nadie lo nota: ver sólo los activos es
    // exactamente lo que uno espera ver.
    await montar();

    await waitFor(() => expect(listarMock).toHaveBeenCalledWith({ incluirInactivos: true }));
  });

  it('el inactivo se ve, marcado como tal, y ofrece volver a ofrecerlo', async () => {
    await montar();

    await waitFor(() => expect(screen.getByTestId('catalogo-fila-2')).toBeTruthy());
    expect(screen.getByText('Volver a ofrecerlo')).toBeTruthy();
  });

  it('🔴 el botón dice «Ya no lo ofrezco», no «Borrar» — porque no borra', async () => {
    // Prometer un borrado que no ocurre es peor que no ofrecerlo: los presupuestos viejos siguen
    // apuntando al concepto.
    await montar();

    await waitFor(() => expect(screen.getByTestId('catalogo-alternar-1')).toBeTruthy());
    expect(screen.getByText('Ya no lo ofrezco')).toBeTruthy();
    expect(screen.queryByText(/borrar|eliminar/i)).toBeNull();
  });

  it('🔴 se puede agregar SIN precio — no se exige más que el backend', async () => {
    // Exigir el precio trabaría el caso común (todavía no lo decidió) y escondería bugs de las dos
    // capas, porque el formulario nunca mandaría el body que el backend acepta.
    await montar();
    await waitFor(() => expect(screen.getByTestId('catalogo-guardar')).toBeTruthy());

    await tipear('catalogo-nombre-input', 'Barba');
    await fireEvent.press(screen.getByTestId('catalogo-guardar'));

    await waitFor(() => expect(crearMock).toHaveBeenCalledWith({ nombre: 'Barba' }));
  });

  it('🔴 el precio viaja como STRING tal cual se tipeó, sin pasar por Number', async () => {
    await montar();
    await waitFor(() => expect(screen.getByTestId('catalogo-guardar')).toBeTruthy());

    await tipear('catalogo-nombre-input', 'Barba');
    await tipear('catalogo-precio-input', '8000.10');
    await fireEvent.press(screen.getByTestId('catalogo-guardar'));

    await waitFor(() => expect(crearMock).toHaveBeenCalledWith({ nombre: 'Barba', precioReferencia: '8000.10' }));
  });

  it('el duplicado NOMBRA el que ya existe, en vez de dejar buscando a ciegas', async () => {
    crearMock.mockResolvedValue({ status: 'duplicado', existente: CORTE });
    await montar();
    await waitFor(() => expect(screen.getByTestId('catalogo-guardar')).toBeTruthy());

    await tipear('catalogo-nombre-input', 'corte de pelo');
    await fireEvent.press(screen.getByTestId('catalogo-guardar'));

    await waitFor(() =>
      expect(screen.getByTestId('catalogo-aviso').props.children).toContain('Corte de pelo'),
    );
  });

  it('🔴 y si el duplicado está DESACTIVADO lo dice — si no, el aviso parece un bug', async () => {
    // El emprendedor no lo ve en su lista y le dicen que ya existe: sin esta aclaración concluye que
    // la app se equivocó.
    crearMock.mockResolvedValue({ status: 'duplicado', existente: COLOR });
    await montar();
    await waitFor(() => expect(screen.getByTestId('catalogo-guardar')).toBeTruthy());

    await tipear('catalogo-nombre-input', 'color');
    await fireEvent.press(screen.getByTestId('catalogo-guardar'));

    await waitFor(() => expect(screen.getByTestId('catalogo-aviso').props.children).toContain('ya no lo ofrecés'));
  });

  it('tocar una fila la pone en edición, y guardar manda PATCH', async () => {
    editarMock.mockResolvedValue({ status: 'ok', concepto: { ...CORTE, precioReferencia: '9000' } });
    await montar();
    await waitFor(() => expect(screen.getByTestId('catalogo-editar-1')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('catalogo-editar-1'));
    await tipear('catalogo-precio-input', '9000');
    await fireEvent.press(screen.getByTestId('catalogo-guardar'));

    await waitFor(() =>
      expect(editarMock).toHaveBeenCalledWith(1, { nombre: 'Corte de pelo', precioReferencia: '9000' }),
    );
    // Y se espera a que la escritura TERMINE de asentarse (el guardado relee la lista). Un caso que
    // corta con trabajo en vuelo lo deja corriendo dentro del siguiente — y el que falla es el otro,
    // que no tiene nada que ver.
    await waitFor(() => expect(listarMock).toHaveBeenCalledTimes(2));
  });

  it('🔴 vaciar el precio EN EDICIÓN manda null — «sacale el precio» no es «no lo toques»', async () => {
    await montar();
    await waitFor(() => expect(screen.getByTestId('catalogo-editar-1')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('catalogo-editar-1'));
    await waitFor(() => expect(screen.getByTestId('catalogo-nombre-input').props.value).toBe('Corte de pelo'));
    await tipear('catalogo-precio-input', '');
    await fireEvent.press(screen.getByTestId('catalogo-guardar'));

    await waitFor(() =>
      expect(editarMock).toHaveBeenCalledWith(1, { nombre: 'Corte de pelo', precioReferencia: null }),
    );
  });

  it('desactivar RELEE la lista en vez de asumir el efecto', async () => {
    // El DELETE puede no devolver el concepto: pintar «desactivado» sin verlo sería mostrar un efecto
    // que nadie confirmó.
    await montar();
    await waitFor(() => expect(screen.getByTestId('catalogo-alternar-1')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('catalogo-alternar-1'));

    await waitFor(() => expect(desactivarMock).toHaveBeenCalledWith(1));
    await waitFor(() => expect(listarMock).toHaveBeenCalledTimes(2));
  });

  it('reactivar es un PATCH con activo:true, no un endpoint aparte', async () => {
    await montar();
    await waitFor(() => expect(screen.getByTestId('catalogo-alternar-2')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('catalogo-alternar-2'));

    await waitFor(() => expect(editarMock).toHaveBeenCalledWith(2, { activo: true }));
  });

  it('sin catálogo desplegado lo dice, y no muestra una lista vacía', async () => {
    listarMock.mockResolvedValue({ status: 'no_disponible' });

    await montar();

    await waitFor(() => expect(screen.getByTestId('catalogo-no-disponible')).toBeTruthy());
    expect(screen.queryByTestId('catalogo-vacio')).toBeNull();
    // Y no se ofrece agregar contra un endpoint que no está.
    expect(screen.queryByTestId('catalogo-guardar')).toBeNull();
  });
});

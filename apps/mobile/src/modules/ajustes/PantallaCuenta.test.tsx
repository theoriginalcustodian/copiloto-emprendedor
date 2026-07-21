import { fireEvent, render, screen } from '@testing-library/react-native';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn() } }));

// Prefijo `mock` obligatorio: es lo único que jest permite referenciar desde una factory de
// `jest.mock` (hoisting — la factory corre antes de las declaraciones del módulo).
const mockLogout = jest.fn();
const mockSesion = {
  estado: 'autenticado',
  me: { cliente_id: 'c-1', email: 'ana@negocio.test' } as { cliente_id: string; email: string | null },
  login: jest.fn(),
  logout: mockLogout,
};
jest.mock('../auth', () => ({ useSession: () => mockSesion }));

import { ThemeProvider } from '../../theme/ThemeProvider';
import { PantallaCuenta } from './PantallaCuenta';

async function montar() {
  return render(
    <ThemeProvider>
      <PantallaCuenta />
    </ThemeProvider>,
  );
}

describe('PantallaCuenta', () => {
  beforeEach(() => {
    mockLogout.mockClear();
    mockSesion.me = { cliente_id: 'c-1', email: 'ana@negocio.test' };
  });

  /**
   * 🔴 **Decir con qué cuenta estás adentro no es cosmético.** En este mismo proyecto el tenant con
   * el que entra el teléfono resultó ser distinto del que el operador creía (`pruebas-facturacion@`
   * en vez de su cuenta personal), y eso explicaba por qué el archivado en Drive no funcionaba. No
   * había forma de verlo desde la app: hubo que ir a la base de datos.
   */
  it('muestra el email real de la sesión', async () => {
    await montar();
    expect(screen.getByTestId('cuenta-email')).toHaveTextContent('ana@negocio.test');
  });

  /** Sin email se DICE; no se inventa un placeholder que parezca una dirección. */
  it('sin email no inventa uno', async () => {
    mockSesion.me = { cliente_id: 'c-1', email: null };
    await montar();
    expect(screen.getByTestId('cuenta-email')).toHaveTextContent('no tiene un email', { exact: false });
  });

  /** Un toque accidental en una grilla de íconos no puede echarte de la sesión. */
  it('cerrar sesión pide confirmación antes de hacerlo', async () => {
    await montar();

    await fireEvent.press(screen.getByTestId('cuenta-cerrar-sesion'));

    expect(screen.getByTestId('cuenta-confirmar-salida')).toBeTruthy();
    expect(mockLogout).not.toHaveBeenCalled();
  });

  it('confirmar cierra la sesión; decir que no, no', async () => {
    await montar();

    await fireEvent.press(screen.getByTestId('cuenta-cerrar-sesion'));
    await fireEvent.press(screen.getByTestId('cuenta-cerrar-sesion-no'));
    expect(mockLogout).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByTestId('cuenta-cerrar-sesion'));
    await fireEvent.press(screen.getByTestId('cuenta-cerrar-sesion-si'));
    expect(mockLogout).toHaveBeenCalledTimes(1);
  });
});

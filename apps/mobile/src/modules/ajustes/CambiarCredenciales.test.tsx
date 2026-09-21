import { fireEvent, render, screen } from '@testing-library/react-native';

const mockContrasena = jest.fn();
const mockEmail = jest.fn();
jest.mock('@copiloto/core', () => ({
  ...jest.requireActual('@copiloto/core'),
  cambiarContrasena: (...a: unknown[]) => mockContrasena(...a),
  cambiarEmail: (...a: unknown[]) => mockEmail(...a),
}));

import { ThemeProvider } from '../../theme/ThemeProvider';
import { CambiarCredenciales } from './CambiarCredenciales';

async function montar(cuentaGoogle = false) {
  return render(
    <ThemeProvider>
      <CambiarCredenciales cuentaGoogle={cuentaGoogle} />
    </ThemeProvider>,
  );
}

describe('CambiarCredenciales (K-12 / BL-J11)', () => {
  beforeEach(() => {
    mockContrasena.mockReset();
    mockEmail.mockReset();
  });

  it('cuenta de Google: la fila de contraseña no se renderiza; la de email sí', async () => {
    await montar(true);
    expect(screen.queryByTestId('cuenta-cambiar-contrasena')).toBeNull();
    expect(screen.getByTestId('cuenta-cambiar-email')).toBeTruthy();
  });

  it('contraseña actual incorrecta: error inline con el mensaje del backend', async () => {
    mockContrasena.mockResolvedValue({ ok: false, codigo: 'contrasena_actual_incorrecta', mensaje: 'La contraseña actual no coincide.' });
    await montar();
    await fireEvent.press(screen.getByTestId('cuenta-cambiar-contrasena'));
    await fireEvent.changeText(screen.getByTestId('cuenta-contrasena-actual-campo-input'), 'mala');
    await fireEvent.changeText(screen.getByTestId('cuenta-contrasena-nueva-campo-input'), 'nueva-larga');
    await fireEvent.changeText(screen.getByTestId('cuenta-contrasena-repetida-campo-input'), 'nueva-larga');
    await fireEvent.press(screen.getByTestId('cuenta-contrasena-guardar'));
    expect(await screen.findByText('La contraseña actual no coincide.')).toBeTruthy();
    expect(mockContrasena).toHaveBeenCalledWith('mala', 'nueva-larga');
  });

  it('cambio de email 200: muestra «revisá tu mail para confirmar»', async () => {
    mockEmail.mockResolvedValue({ ok: true, confirmacionPendiente: true });
    await montar();
    await fireEvent.press(screen.getByTestId('cuenta-cambiar-email'));
    await fireEvent.changeText(screen.getByTestId('cuenta-email-nuevo-input'), 'nueva@direccion.com');
    await fireEvent.press(screen.getByTestId('cuenta-email-guardar'));
    expect(await screen.findByTestId('cuenta-email-pendiente')).toBeTruthy();
  });
});

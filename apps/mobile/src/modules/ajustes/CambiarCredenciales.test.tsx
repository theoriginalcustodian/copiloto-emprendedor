import { fireEvent, render, screen } from '@testing-library/react-native';

const mockContrasena = jest.fn();
jest.mock('@copiloto/core', () => ({
  ...jest.requireActual('@copiloto/core'),
  cambiarContrasena: (...a: unknown[]) => mockContrasena(...a),
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
  });

  it('cuenta de Google: no se renderiza nada (ni fila de contraseña ni de email)', async () => {
    await montar(true);
    expect(screen.queryByTestId('cuenta-credenciales')).toBeNull();
  });

  // [DIFERIDO_CIERRE_B] la fila «Cambiar email» no se monta hasta que haya SMTP real: un 200 sin mail
  // sería un éxito falso (planificación, K-12 opción b).
  it('la fila «Cambiar email» NO existe', async () => {
    await montar();
    expect(screen.getByTestId('cuenta-cambiar-contrasena')).toBeTruthy();
    expect(screen.queryByTestId('cuenta-cambiar-email')).toBeNull();
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
});

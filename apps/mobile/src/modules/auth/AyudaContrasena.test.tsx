/**
 * «¿Olvidaste tu contraseña?» (Martin 12/11): sin reseteo en el backend, explica y ofrece entrar con Google.
 */
import { fireEvent, render, screen } from '@testing-library/react-native';

import { ThemeProvider } from '../../theme/ThemeProvider';
import { AyudaContrasena } from './AyudaContrasena';

describe('AyudaContrasena', () => {
  it('cerrada muestra sólo el link; abierta explica que no hay reseteo y lleva a Google', async () => {
    const onOtrasFormas = jest.fn();
    await render(
      <ThemeProvider>
        <AyudaContrasena onOtrasFormas={onOtrasFormas} />
      </ThemeProvider>,
    );
    expect(screen.queryByTestId('ayuda-contrasena')).toBeNull();
    await fireEvent.press(screen.getByTestId('ayuda-contrasena-abrir'));
    expect(screen.getByText(/Todavía no podemos mandarte un mail/)).toBeTruthy();
    await fireEvent.press(screen.getByTestId('ayuda-contrasena-google'));
    expect(onOtrasFormas).toHaveBeenCalledTimes(1);
  });
});

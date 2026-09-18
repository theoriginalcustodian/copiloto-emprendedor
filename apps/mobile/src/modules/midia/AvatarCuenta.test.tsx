import { fireEvent, render, screen } from '@testing-library/react-native';

import { ThemeProvider } from '../../theme/ThemeProvider';
import { AvatarCuenta } from './AvatarCuenta';

async function envolver(props: Partial<React.ComponentProps<typeof AvatarCuenta>> = {}) {
  return render(
    <ThemeProvider>
      <AvatarCuenta {...props} />
    </ThemeProvider>,
  );
}

describe('AvatarCuenta — la única puerta a Ajustes (Ola 4)', () => {
  it('el nombre accesible dice a DÓNDE lleva, no qué es', async () => {
    // "Avatar" no es un destino. Y acá pesa más que en cualquier otro control: si este nombre no se
    // entiende, Ajustes queda inalcanzable — no hay una segunda puerta.
    await envolver();
    expect(screen.getByTestId('avatar-cuenta').props.accessibilityLabel).toBe('Tu cuenta y ajustes');
  });

  it('al tocarlo llama a onPress', async () => {
    const onPress = jest.fn();
    await envolver({ onPress });

    fireEvent.press(screen.getByTestId('avatar-cuenta'));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('muestra la inicial del negocio, en mayúscula', async () => {
    await envolver({ inicial: 'el galpón' });
    expect(screen.getByTestId('avatar-cuenta-inicial')).toHaveTextContent('E');
  });

  it('sin inicial dibuja el signo neutro, nunca una letra inventada', async () => {
    await envolver();
    expect(screen.getByTestId('avatar-cuenta-inicial')).toHaveTextContent('·');
  });

  it('🔴 el punto de estado NO se dibuja por defecto', async () => {
    // Es media salvaguarda del modelo de capas: el punto avisa que hay algo para mirar en Ajustes,
    // que es lo que compensa haberlo sacado del escritorio. Pero la señal de salud por conexión no
    // existe todavía en el contrato (hueco H-3), así que va cableado y APAGADO — un punto que avisa
    // de algo que no se sabe es peor que ninguno.
    await envolver();
    expect(screen.queryByTestId('avatar-cuenta-punto')).toBeNull();
  });

  it('con `avisa`, el punto aparece y el estado viaja en el nombre accesible', async () => {
    await envolver({ avisa: true });
    expect(screen.getByTestId('avatar-cuenta-punto')).toBeTruthy();
    expect(screen.getByTestId('avatar-cuenta').props.accessibilityLabel).toBe(
      'Tu cuenta y ajustes — hay algo para mirar',
    );
  });
});

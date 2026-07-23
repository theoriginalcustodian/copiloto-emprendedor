import { fireEvent, render, screen } from '@testing-library/react-native';

import { ThemeProvider } from '../ThemeProvider';
import { EncabezadoListado } from './EncabezadoListado';

function montar(props: React.ComponentProps<typeof EncabezadoListado>) {
  return render(
    <ThemeProvider>
      <EncabezadoListado {...props} />
    </ThemeProvider>,
  );
}

describe('EncabezadoListado', () => {
  it('tapeable: muestra la flecha, es botón, y dispara onPress', async () => {
    const onPress = jest.fn();
    await montar({ titulo: 'Actividad reciente', onPress, testID: 'enc' });

    expect(screen.getByText('Actividad reciente')).toBeTruthy();
    // La flecha es la afordancia de "se toca para entrar".
    expect(screen.getByTestId('enc-flecha')).toBeTruthy();
    expect(screen.getByTestId('enc').props.accessibilityRole).toBe('button');

    await fireEvent.press(screen.getByTestId('enc'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('🔴 sin onPress NO muestra flecha ni es botón — nunca una flecha sin destino', async () => {
    // CONTROL: un `›` sin navegación mentiría igual que una fila que se toca y no hace nada.
    await montar({ titulo: 'Actividad reciente', testID: 'enc' });

    expect(screen.getByText('Actividad reciente')).toBeTruthy();
    expect(screen.queryByTestId('enc-flecha')).toBeNull();
    expect(screen.getByTestId('enc').props.accessibilityRole).toBeUndefined();
  });

  it('el nombre accesible del control dice que se ENTRA, no sólo el título', async () => {
    await montar({ titulo: 'Actividad reciente', onPress: jest.fn(), testID: 'enc' });
    expect(screen.getByTestId('enc').props.accessibilityLabel).toBe('Actividad reciente, entrar');
  });
});

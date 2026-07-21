import { fireEvent, render, screen } from '@testing-library/react-native';

// Jest (jest-expo) -- describe/it/expect/jest son globales, no se importan de vitest.

import { ThemeProvider } from '../../theme/ThemeProvider';
import { BotonVoz, type BotonVozProps } from './BotonVoz';

async function montar(props: Partial<Omit<BotonVozProps, 'onPress'>> = {}) {
  const onPress = jest.fn();
  await render(
    <ThemeProvider>
      <BotonVoz onPress={onPress} {...props} />
    </ThemeProvider>,
  );
  return { onPress };
}

describe('BotonVoz -- toque simple que arranca el dictado (sin gesto de anclaje, ver docstring)', () => {
  it('un toque dispara onPress', async () => {
    const { onPress } = await montar();

    await fireEvent.press(screen.getByTestId('boton-voz'));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('deshabilitado (HUD de voz ya abierto) no dispara onPress', async () => {
    const { onPress } = await montar({ disabled: true });

    await fireEvent.press(screen.getByTestId('boton-voz'));

    expect(onPress).not.toHaveBeenCalled();
    expect(screen.getByTestId('boton-voz').props.accessibilityState?.disabled).toBe(true);
  });

  it('sin `disabled`, accessibilityState no marca deshabilitado -- nunca hubo selector de cliente que lo gatee', async () => {
    await montar();

    expect(screen.getByTestId('boton-voz').props.accessibilityState?.disabled).toBeFalsy();
  });
});

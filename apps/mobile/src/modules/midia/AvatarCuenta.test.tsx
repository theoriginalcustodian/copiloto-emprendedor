import { StyleSheet } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { ThemeProvider } from '../../theme/ThemeProvider';
import { SKINS, type NombreSkin } from '../../theme/tokens';
import { AvatarCuenta, tonoAvatar } from './AvatarCuenta';

function luminancia(hex: string): number {
  const h = hex.replace('#', '');
  const canal = (i: number) => {
    const s = parseInt(h.slice(i, i + 2), 16) / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * canal(0) + 0.7152 * canal(2) + 0.0722 * canal(4);
}

function contraste(a: string, b: string): number {
  const [mayor, menor] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (mayor + 0.05) / (menor + 0.05);
}

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

  it('sin inicial dibuja el glifo de cuenta, nunca una letra inventada', async () => {
    await envolver();
    expect(screen.queryByTestId('avatar-cuenta-inicial')).toBeNull();
    expect(screen.getByTestId('glass-icon-cuenta')).toBeTruthy();
  });

  it('🔴 SM-N16: el círculo pinta el aro medido, no el borde tenue que lo hacía invisible', async () => {
    await envolver();
    const estilo = StyleSheet.flatten(screen.getByTestId('avatar-cuenta-circulo').props.style);
    expect(estilo.borderColor).toBe(tonoAvatar(SKINS.claro).aro);
  });

  it.each<NombreSkin>(['claro', 'oscuro'])('🔴 SM-N16: en %s se lee como botón contra el lienzo', (piel) => {
    const tema = SKINS[piel];
    const tono = tonoAvatar(tema);
    for (const lienzo of [tema.color.fondo, ...tema.color.fondoDegradado]) {
      expect(contraste(tono.aro, lienzo)).toBeGreaterThanOrEqual(3);
    }
    expect(contraste(tono.tinta, tono.relleno)).toBeGreaterThanOrEqual(4.5);
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

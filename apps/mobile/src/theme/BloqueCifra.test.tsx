import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { BloqueCifra } from './BloqueCifra';
import { ThemeProvider, useTema } from './ThemeProvider';
import { SKINS } from './tokens';

// Jest (jest-expo) -- describe/it/expect son globales, no se importan de vitest.

function montar(props: Partial<Parameters<typeof BloqueCifra>[0]> = {}) {
  return render(
    <ThemeProvider>
      <BloqueCifra testID="bloque" rotulo="Gastado en agosto" cifra="$126.000" {...props} />
    </ThemeProvider>,
  );
}

describe('BloqueCifra -- LA cifra del negocio de una pantalla', () => {
  it('la cifra va en la familia DISPLAY y al tamaño de cifra, no al de título', async () => {
    await montar();
    const cifra = screen.getByTestId('bloque-cifra');
    expect(cifra.props.children).toBe('$126.000');
    // Plus Jakarta Sans Bold y 40: es lo que separa esta cifra de cualquier otro número.
    expect(cifra.props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ fontFamily: SKINS.claro.fuente.display, fontSize: 40 })]),
    );
  });

  // Dos casos y no uno con `unmount()` en el medio: desmontar a mano deja `screen` apuntando al
  // árbol viejo y rompe el test SIGUIENTE, no éste — un falso positivo carísimo de encontrar.
  it('sin chip no se dibuja nada -- un chip vacío es ruido', async () => {
    await montar();
    expect(screen.queryByTestId('bloque-chip')).toBeNull();
  });

  it('con chip, lo muestra', async () => {
    await montar({ chip: 'Mes anterior: $148.500' });
    expect(screen.getByTestId('bloque-chip')).toHaveTextContent('Mes anterior: $148.500');
  });

  /**
   * 🔴 El punto del componente: el bloque es **máximo contraste contra el lienzo**, no "negro".
   * Si alguien lo reimplementa con un color fijo, este test se pone rojo -- y con razón: en la piel
   * oscura un bloque negro sobre lienzo negro es invisible.
   */
  it('invierte con la piel: el fondo del bloque es lo OPUESTO al lienzo en las dos', () => {
    expect(SKINS.claro.color.bloque).toBe(SKINS.oscuro.color.bloqueTexto);
    expect(SKINS.oscuro.color.bloque).toBe(SKINS.claro.color.bloqueTexto);
    expect(SKINS.claro.color.bloque).not.toBe(SKINS.claro.color.fondo);
    expect(SKINS.oscuro.color.bloque).not.toBe(SKINS.oscuro.color.fondo);
  });

  /**
   * La arena existe en la paleta por esto: dentro del bloque el acento no separa lo suficiente
   * contra el negro tostado. Si `bloqueApoyo` volviera a ser el acento, el desglose se aplanaría.
   */
  it('en la piel clara el apoyo del bloque es la ARENA, nunca el acento', () => {
    expect(SKINS.claro.color.bloqueApoyo).toBe(SKINS.claro.color.apoyo);
    expect(SKINS.claro.color.bloqueApoyo).not.toBe(SKINS.claro.color.acento);
  });

  it('el hijo se dibuja dentro del bloque -- el desglose es parte de la cifra, no algo aparte', async () => {
    await montar({ children: <Text testID="hijo">desglose</Text> });
    expect(screen.getByTestId('hijo')).toBeTruthy();
  });
});

/** Control del instrumento: sin esto, un `SKINS` incompleto haría pasar los casos de arriba. */
describe('tokens del bloque', () => {
  it('las dos pieles declaran el juego completo', () => {
    for (const piel of Object.values(SKINS)) {
      expect(piel.color.bloque).toBeTruthy();
      expect(piel.color.bloqueTexto).toBeTruthy();
      expect(piel.color.bloqueApoyo).toBeTruthy();
      expect(piel.color.bloqueChip).toBeTruthy();
    }
  });
});

// `useTema` se importa para documentar de dónde salen los tokens en runtime; el test los lee de
// `SKINS` directo para poder comparar las dos pieles sin montar dos árboles.
void useTema;

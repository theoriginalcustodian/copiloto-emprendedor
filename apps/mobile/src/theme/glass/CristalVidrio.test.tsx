import { render, screen } from '@testing-library/react-native';
import { StyleSheet, Text, type ViewStyle } from 'react-native';

import { ThemeProvider } from '../ThemeProvider';
import { CristalVidrio } from './CristalVidrio';

// Jest (jest-expo) -- describe/it/expect/jest son globales, no se importan de vitest.

/**
 * Medido en device (2026-10-15): la tarjeta «Tus servicios» del onboarding medía 4 px. El cuerpo interno
 * es `flex: 1` (= `flexBasis: 0`), así que en un padre de alto AUTOMÁTICO colapsa a 0 y `overflow: hidden`
 * recorta el contenido: «Conectar…» y «Después» no se veían ni se podían tocar. Jest no calcula layout:
 * lo que sí se puede afirmar es el ESTILO que decide el colapso.
 */
async function cuerpo(alturaAuto?: boolean) {
  await render(
    <ThemeProvider>
      <CristalVidrio nivel="informe" alturaAuto={alturaAuto} testID="cristal-test">
        <Text>contenido</Text>
      </CristalVidrio>
    </ThemeProvider>
  );
  const externo = screen.getByTestId('cristal-test');
  const interno = externo.children[0] as unknown as { props: { style: ViewStyle | ViewStyle[] } };
  return StyleSheet.flatten(interno.props.style) as ViewStyle;
}

describe('CristalVidrio — alto del cuerpo', () => {
  it('por defecto el cuerpo llena al contenedor (flex: 1): el panel y el fondo absoluto siguen igual', async () => {
    expect((await cuerpo()).flex).toBe(1);
  });

  it('🔴 con `alturaAuto` el cuerpo NO es flex: 1 — mide su contenido y no colapsa a 0', async () => {
    const estilo = await cuerpo(true);
    expect(estilo.flex).toBeUndefined();
    expect(estilo.overflow).toBe('hidden'); // el radio sigue recortando
  });
});

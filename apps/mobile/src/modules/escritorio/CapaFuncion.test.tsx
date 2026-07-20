import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

// Jest (jest-expo) — describe/it/expect son globales, no se importan de vitest.
//
// Reanimated está mockeado a un stub inerte (`jest.setup.js`): `useAnimatedStyle` devuelve `{}` y
// `withTiming` devuelve el destino sin animar. Acá se cubre que la capa monta con el encabezado
// correcto y que "Cerrar" dispara el callback — el comportamiento visual de la animación de entrada
// se valida en el device, igual criterio que `PanelDeslizable.test.tsx`.

import { ThemeProvider } from '../../theme/ThemeProvider';
import { CapaFuncion } from './CapaFuncion';

async function envolver(onCerrar = jest.fn()) {
  const resultado = await render(
    <ThemeProvider>
      <CapaFuncion testID="capa-test" titulo="Ajustes" icono="settings" onCerrar={onCerrar}>
        <Text>contenido-de-la-funcion</Text>
      </CapaFuncion>
    </ThemeProvider>,
  );
  return { ...resultado, onCerrar };
}

describe('CapaFuncion — el mecanismo de abrir/cerrar una función (capa, no ruta)', () => {
  it('monta el encabezado (ícono + título) y el contenido, sin crashear', async () => {
    await envolver();

    expect(screen.getByTestId('capa-test')).toBeTruthy();
    expect(screen.getByTestId('capa-funcion-titulo').props.children).toBe('Ajustes');
    expect(screen.getByText('contenido-de-la-funcion')).toBeTruthy();
  });

  it('el ícono del encabezado es el MISMO que el de entrada (evita el "entré por un ícono, veo otro")', async () => {
    await envolver();
    expect(screen.getByTestId('glass-icon-settings')).toBeTruthy();
  });

  it('tocar "Cerrar" llama a onCerrar', async () => {
    const { onCerrar } = await envolver();

    fireEvent.press(screen.getByTestId('capa-funcion-cerrar'));

    expect(onCerrar).toHaveBeenCalledTimes(1);
  });

  it('no tiene gesto de arrastre propio — a propósito (ver docstring: superficie bajo sospecha del tirón)', async () => {
    await envolver();
    // Ningún `testID` de handle/zona-de-arrastre: `MarcoGlass`/`PanelDeslizable` sí lo exponen
    // (`glass-handle`/`panel-handle`). Su ausencia acá es la garantía de que no se coló un
    // `GestureDetector` nuevo antes de la Medición 1.
    expect(screen.queryByTestId('glass-handle')).toBeNull();
    expect(screen.queryByTestId('panel-handle')).toBeNull();
  });
});

import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet, Text } from 'react-native';

import { ThemeProvider } from '../ThemeProvider';
import { MarcoGlass } from './MarcoGlass';

// Jest (jest-expo) -- describe/it/expect/jest son globales, no se importan de vitest.

/**
 * `MarcoGlass` no tenía test propio — se ejercitaba sólo indirecto vía las 9 pantallas que lo
 * consumen (todas siguen 573/573 verdes tras este cambio, ver el suite completo). Este archivo fija
 * la estructura del `hallazgo_..._el-repro-no-cuadra` (freeze del dismiss): la zona de arrastre
 * creció de sólo el handle a handle+identidad, "Volver" quedó afuera del `GestureDetector` — lo que
 * se puede probar en jsdom es que "Volver" SIGUE funcionando igual (mismo testID, mismo onPress,
 * misma etiqueta), no el gesto en sí (`GestureDetector` es passthrough mockeado, `jest.setup.js`).
 */
jest.mock('expo-router', () => {
  const { useEffect } = require('react');
  return {
    router: { back: jest.fn() },
    useFocusEffect: (cb: () => void) => useEffect(cb, [cb]),
  };
});

async function montar() {
  return render(
    <ThemeProvider>
      <MarcoGlass titulo="Ingresos" icono="ingresos" testID="marco-test">
        <Text>contenido</Text>
      </MarcoGlass>
    </ThemeProvider>,
  );
}

describe('MarcoGlass -- la zona de arrastre creció (handle+identidad), "Volver" quedó intacto', () => {
  it('renderiza el handle, el título y "Volver", sin reventar', async () => {
    await montar();
    expect(screen.getByTestId('glass-handle')).toBeTruthy();
    expect(screen.getByTestId('glass-titulo')).toBeTruthy();
    expect(screen.getByText('Ingresos')).toBeTruthy();
    expect(screen.getByTestId('glass-volver')).toBeTruthy();
  });

  it('🔴 "Volver" sigue funcionando -- tocarlo llama router.back(), igual que antes', async () => {
    const { router } = require('expo-router');
    await montar();

    await fireEvent.press(screen.getByTestId('glass-volver'));

    expect(router.back).toHaveBeenCalledTimes(1);
  });

  it('la nueva zona de arrastre (ícono+título) existe con su propio testID', async () => {
    await montar();
    expect(screen.getByTestId('glass-zona-arrastre-identidad')).toBeTruthy();
  });

  it('el contenido (children) sigue montando debajo del encabezado', async () => {
    await montar();
    expect(screen.getByText('contenido')).toBeTruthy();
  });
});

/**
 * Decisión 7 del operador (2026-10-16): «‹ Volver» va ARRIBA A LA IZQUIERDA — gana el prototipo
 * (`.fn-head { justify-content:flex-start }`). jsdom no mide pixeles, así que lo que se fija es el
 * ANCLAJE (`left` y no `right`), el chevron, y que el título dejó de reservar ancho a la derecha.
 * La posición real a 390 px se prueba en device (capturas en el doc de concordancia, fila E5).
 */
describe('MarcoGlass -- «‹ Volver» arriba a la izquierda (decisión 7)', () => {
  it('lleva el chevron «‹» antes de la palabra «Volver»', async () => {
    await montar();

    expect(screen.getByText('‹')).toBeTruthy();
    expect(screen.getByTestId('glass-volver')).toHaveTextContent('‹Volver');
  });

  it('🔴 está anclado a la IZQUIERDA: tiene `left` y NO tiene `right`', async () => {
    await montar();

    const estilo = StyleSheet.flatten(screen.getByTestId('glass-volver').props.style);

    expect(estilo.position).toBe('absolute');
    expect(estilo.left).toBeGreaterThan(0);
    expect(estilo.right).toBeUndefined();
  });

  it('vive en el renglón del handle (arriba del título), no en el del título', async () => {
    await montar();

    const estilo = StyleSheet.flatten(screen.getByTestId('glass-volver').props.style);

    expect(estilo.top).toBe(0);
  });

  it('el título ya no reserva ancho a la derecha para «Volver»', async () => {
    await montar();

    const identidad = StyleSheet.flatten(screen.getByTestId('glass-zona-arrastre-identidad').props.style);

    expect(identidad.paddingRight).toBeUndefined();
  });

  it('«Volver» sigue AFUERA de la zona de arrastre (no es hijo de la identidad ni del handle)', async () => {
    await montar();

    const volver = screen.getByTestId('glass-volver');
    const identidad = screen.getByTestId('glass-zona-arrastre-identidad');
    const handle = screen.getByTestId('glass-handle');

    expect(identidad).not.toContainElement(volver);
    expect(handle).not.toContainElement(volver);
  });
});

describe('MarcoGlass -- etiqueta junto al título (el período de la función)', () => {
  async function montarConEtiqueta(etiqueta?: string) {
    return render(
      <ThemeProvider>
        <MarcoGlass titulo="Ingresos" icono="ingresos" etiqueta={etiqueta} testID="marco-test">
          <Text>contenido</Text>
        </MarcoGlass>
      </ThemeProvider>,
    );
  }

  it('con etiqueta, se dibuja junto al título y dentro de la zona de arrastre', async () => {
    await montarConEtiqueta('Agosto');

    expect(screen.getByTestId('glass-etiqueta')).toHaveTextContent('Agosto');
    expect(screen.getByTestId('glass-titulo')).toHaveTextContent('Ingresos');
  });

  it.each([[undefined], ['']])('sin etiqueta (%p) no se dibuja nada: las otras pantallas no cambian', async (valor) => {
    await montarConEtiqueta(valor);

    expect(screen.queryByTestId('glass-etiqueta')).toBeNull();
    expect(screen.getByTestId('glass-volver')).toBeTruthy();
  });
});

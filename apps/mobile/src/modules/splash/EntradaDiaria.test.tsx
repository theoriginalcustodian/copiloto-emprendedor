import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { ThemeProvider, useTema } from '../../theme/ThemeProvider';
import { EntradaDiaria } from './EntradaDiaria';

// Jest (jest-expo) -- describe/it/expect son globales, no se importan de vitest.

jest.useFakeTimers();

function montar(onFin: () => void = jest.fn()) {
  return render(
    <ThemeProvider>
      <EntradaDiaria onFin={onFin} />
    </ThemeProvider>,
  );
}

describe('EntradaDiaria -- BL-X10, arranques 2..n', () => {
  it('dibuja los mismos 2 arcos canónicos del isotipo (Marca.tsx), con draw-on de largo 100', async () => {
    await montar();
    expect(screen.getByTestId('entrada-diaria-trazo-1').props.d).toBe('M11 3.5a8.5 8.5 0 1 0 0 17');
    expect(screen.getByTestId('entrada-diaria-trazo-1').props.pathLength).toBe(100);
    expect(screen.getByTestId('entrada-diaria-trazo-2').props.d).toBe('M11 7.5a4.5 4.5 0 1 0 0 9');
    expect(screen.getByTestId('entrada-diaria')).toBeTruthy();
  });

  it('pinta blanco puro en la piel clara (`#entrada{background:var(--blanco)}`) y el lienzo del tema en la oscura', async () => {
    let tema: ReturnType<typeof useTema> | undefined;
    function Sonda() {
      tema = useTema();
      return null;
    }
    await render(
      <ThemeProvider>
        <Sonda />
        <EntradaDiaria onFin={jest.fn()} />
      </ThemeProvider>,
    );
    const fondo = StyleSheet.flatten(screen.getByTestId('entrada-diaria').props.style).backgroundColor;
    expect(fondo).toBe(tema!.glass.esLight ? '#FFFFFF' : tema!.color.fondo);
    // Control positivo del contrato: en la piel clara NO es el crema del lienzo.
    if (tema!.glass.esLight) expect(fondo).not.toBe(tema!.color.fondo);
  });

  it('llama a onFin después de ENTRADA_TOTAL_MS (no antes)', async () => {
    const onFin = jest.fn();
    await montar(onFin);
    jest.advanceTimersByTime(1499);
    expect(onFin).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(onFin).toHaveBeenCalledTimes(1);
  });
});

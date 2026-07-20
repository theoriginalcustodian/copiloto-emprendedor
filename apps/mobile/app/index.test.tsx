import { fireEvent, render, screen } from '@testing-library/react-native';

// Jest (jest-expo) — describe/it/expect/jest son globales, no se importan de vitest.
//
// Mock de `expo-router` a sólo `router.push` (jest.fn): esta pantalla no navega por rutas para abrir
// funciones (son capas, ver `CapaFuncion.tsx`) — el único uso real de `expo-router` acá es el link
// discreto al spike. Mismo criterio que `_staging/documed/apps/mobile/src/rutas/proximamente.test.tsx`:
// mockear el hook/función puntual que se consume es más simple y más fiel que envolver con
// `expo-router/testing-library` (reservado para pruebas de navegación real, ver `shell.test.tsx`).
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

import { router } from 'expo-router';

import { ThemeProvider } from '../src/theme/ThemeProvider';
import PantallaPrincipal from './index';

async function envolver() {
  return render(
    <ThemeProvider>
      <PantallaPrincipal />
    </ThemeProvider>,
  );
}

describe('PantallaPrincipal (app/index.tsx) — el shell real', () => {
  beforeEach(() => {
    jest.mocked(router.push).mockClear();
  });

  it('monta el panel, el escritorio de 6 funciones y el placeholder de chat', async () => {
    await envolver();

    expect(screen.getByTestId('panel-principal')).toBeTruthy();
    expect(screen.getByTestId('tile-facturacion')).toBeTruthy();
    expect(screen.getByTestId('chat-placeholder')).toBeTruthy();
  });

  it('el placeholder de chat se ve intencional, no roto: explica que la conversación llega en otra fase', async () => {
    await envolver();
    expect(screen.getByText(/se cablea en la próxima fase/i)).toBeTruthy();
  });

  // `await fireEvent.press(...)`: RNTL 14 necesita el await para que el `act()` interno flushee el
  // re-render disparado por `setFuncionActiva` antes de la siguiente query — mismo criterio que
  // `shell.test.tsx` (`await fireEvent.changeText(...)`). Sin el await, la query corre sobre el
  // árbol de ANTES del tap y `getByTestId` no encuentra la capa recién montada.
  it('tocar una función abre su CapaFuncion, con el mismo ícono/título del tile', async () => {
    await envolver();

    await fireEvent.press(screen.getByTestId('tile-ajustes'));

    expect(screen.getByTestId('capa-funcion-ajustes')).toBeTruthy();
    expect(screen.getByTestId('capa-funcion-titulo').props.children).toBe('Ajustes');
    expect(screen.getByTestId('capa-funcion-contenido-pendiente')).toBeTruthy();
  });

  it('sólo una función abierta a la vez: tocar otra reemplaza la capa anterior', async () => {
    await envolver();

    await fireEvent.press(screen.getByTestId('tile-ajustes'));
    expect(screen.getByTestId('capa-funcion-ajustes')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('tile-metricas'));
    expect(screen.queryByTestId('capa-funcion-ajustes')).toBeNull();
    expect(screen.getByTestId('capa-funcion-metricas')).toBeTruthy();
  });

  it('"Cerrar" en la capa la desmonta y vuelve a mostrar sólo el escritorio', async () => {
    await envolver();

    await fireEvent.press(screen.getByTestId('tile-recientes'));
    expect(screen.getByTestId('capa-funcion-recientes')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('capa-funcion-cerrar'));
    expect(screen.queryByTestId('capa-funcion-recientes')).toBeNull();
  });

  it('el link discreto al spike navega a /spike', async () => {
    await envolver();

    await fireEvent.press(screen.getByTestId('escritorio-abrir-spike'));

    expect(router.push).toHaveBeenCalledWith('/spike');
  });
});

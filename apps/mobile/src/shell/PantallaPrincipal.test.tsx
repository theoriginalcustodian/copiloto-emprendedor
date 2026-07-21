import { fireEvent, render, screen, within } from '@testing-library/react-native';

// Jest (jest-expo) — describe/it/expect/jest son globales, no se importan de vitest.
//
// Esta pantalla no navega por rutas para abrir funciones (son capas, ver `CapaFuncion.tsx`) — no
// consume `expo-router`, así que no hace falta mockearlo acá.

import { ThemeProvider } from '../theme/ThemeProvider';
import { PantallaPrincipal } from './PantallaPrincipal';

async function envolver() {
  return render(
    <ThemeProvider>
      <PantallaPrincipal />
    </ThemeProvider>,
  );
}

describe('PantallaPrincipal (src/shell/PantallaPrincipal.tsx) — el shell real', () => {
  it('monta el panel, el escritorio de 6 funciones y el chat real', async () => {
    await envolver();

    expect(screen.getByTestId('panel-principal')).toBeTruthy();
    expect(screen.getByTestId('tile-facturacion')).toBeTruthy();
    expect(screen.getByTestId('chat-view')).toBeTruthy();
  });

  /**
   * 🔴 El placeholder que estos dos tests fijaban ya no existe: F5 lo reemplazó por `ChatView`. Se
   * reescribieron en vez de borrarlos porque lo que importaba nunca fue el placeholder — era que la
   * Capa 1 del panel monte ALGO de conversación. Un test que sólo comprobaba el texto provisorio
   * habría muerto con él y habría dejado el hueco sin cubrir justo al integrar.
   */
  it('el chat vive en la Capa 1 del panel, dentro del cristal — no como pantalla aparte', async () => {
    await envolver();

    const panel = screen.getByTestId('panel-principal');
    // `within` en vez de un getBy suelto: que `chat-view` exista en algún lado del árbol no prueba
    // que esté DENTRO del panel, que es el contrato que se quiere fijar.
    expect(within(panel).getByTestId('chat-view')).toBeTruthy();
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
    // Antes acá se esperaba `capa-funcion-contenido-pendiente`, el placeholder que hubo mientras
    // los módulos se portaban en paralelo. La integración lo reemplazó por la pantalla real, así
    // que el test pasa a verificar eso — que es lo que de verdad importa: que la capa monte el
    // contenido de ESA función y no el de otra.
    expect(screen.getByTestId('pantalla-ajustes')).toBeTruthy();
  });

  /**
   * 🔴 Cada tile monta SU pantalla. Sin esto, un error en el mapa `CONTENIDO_POR_FUNCION` —dos keys
   * apuntando al mismo componente, por ejemplo— pasaría desapercibido: la capa abre, el encabezado
   * dice el nombre correcto, y adentro hay otra cosa. Se vería bien y estaría mal.
   */
  it.each([
    ['apps', 'pantalla-apps'],
    ['recientes', 'pantalla-recientes'],
    ['redes', 'pantalla-redes'],
    ['metricas', 'pantalla-metricas'],
    ['facturacion', 'pantalla-facturacion'],
  ])('la función %s monta su propia pantalla', async (funcion, testIdPantalla) => {
    await envolver();
    await fireEvent.press(screen.getByTestId(`tile-${funcion}`));
    expect(screen.getByTestId(testIdPantalla)).toBeTruthy();
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
});

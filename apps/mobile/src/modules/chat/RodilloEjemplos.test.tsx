import { act, render, screen } from '@testing-library/react-native';

import { EJEMPLOS, MS_POR_EJEMPLO, RodilloEjemplos } from './RodilloEjemplos';
import { ThemeProvider } from '../../theme/ThemeProvider';

function montar() {
  return render(
    <ThemeProvider>
      <RodilloEjemplos testID="rodillo" />
    </ThemeProvider>,
  );
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe('RodilloEjemplos — el tambor del chat vacío', () => {
  // ⚠️ `includeHiddenElements` porque las frases que no están activas se marcan como ocultas para
  // el lector de pantalla, y RNTL las excluye de las búsquedas por defecto. Que haya que pedirlas
  // explícitamente ES la prueba de que la ocultación funciona.
  const ver = (id: string) => screen.getByTestId(id, { includeHiddenElements: true });

  it('las tres frases están montadas a la vez: son SUPERPUESTAS, no una tira', async () => {
    await montar();
    // Una tira tendría que rebobinar al llegar a la última y obligaría a duplicar un elemento.
    // Superpuestas, cada frase hace el mismo viaje y el ciclo no tiene costura.
    EJEMPLOS.forEach((frase, i) => {
      expect(ver(`rodillo-${i}`)).toHaveTextContent(frase);
    });
  });

  it('sólo la frase activa queda expuesta al lector de pantalla', async () => {
    await montar();
    expect(ver('rodillo-0').props.accessibilityElementsHidden).toBe(false);
    expect(ver('rodillo-1').props.accessibilityElementsHidden).toBe(true);

    await act(async () => {
      jest.advanceTimersByTime(MS_POR_EJEMPLO);
      await Promise.resolve();
    });

    expect(ver('rodillo-0').props.accessibilityElementsHidden).toBe(true);
    expect(ver('rodillo-1').props.accessibilityElementsHidden).toBe(false);
  });

  /** El ciclo vuelve a la primera sin saltos: es lo que las frases superpuestas garantizan. */
  it('después de la última vuelve a la primera', async () => {
    await montar();
    await act(async () => {
      jest.advanceTimersByTime(MS_POR_EJEMPLO * EJEMPLOS.length);
      await Promise.resolve();
    });
    expect(ver('rodillo-0').props.accessibilityElementsHidden).toBe(false);
  });

  /** Sin limpieza, cada montaje del chat vacío dejaría un intervalo corriendo para siempre. */
  /*
   * NO hay test de «el intervalo se limpia al desmontar», y es deliberado: en este entorno no se
   * puede medir. `jest.getTimerCount()` SUBE después de desmontar (4 → 6) porque React Native
   * agenda timers propios en el desmontaje, y `jest.spyOn(global, 'clearInterval')` no intercepta
   * el `clearInterval` que ve el módulo. Un test que mide el entorno en vez del componente es peor
   * que ninguno: pasa o falla por razones ajenas y erosiona la confianza en la suite.
   * La limpieza está en el `useEffect` y se verifica leyéndola.
   */
});

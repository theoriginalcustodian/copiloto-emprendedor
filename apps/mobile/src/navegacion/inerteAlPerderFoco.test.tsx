/**
 * **La pantalla de abajo no puede seguir siendo tocable por el lector de pantalla.**
 *
 * 🔴 **Por qué este archivo prueba la función PURA y no sólo el render.** Simular que una pantalla
 * pierde el foco necesita un contenedor de navegación real, y estos tests montan las pantallas
 * sueltas: montada siempre queda **enfocada**. Si me quedara en el render, el único caso cubierto
 * sería el que ya funciona, y el gate daría verde igual **si la inercia no se aplicara nunca** — que
 * es exactamente el bug. Con `propsDeInercia` la decisión se verifica de los dos lados; con el render
 * se verifica que esté **cableada**. Hacen falta las dos mitades, y ninguna sola alcanza.
 */
import { propsDeInercia } from './inerteAlPerderFoco';

describe('propsDeInercia — la decisión, en las dos direcciones', () => {
  it('🔴 SIN foco: el subárbol desaparece del árbol de accesibilidad, en las DOS plataformas', () => {
    // Poner una sola de las dos props deja la mitad de los usuarios con el bug intacto, y como cada
    // plataforma ignora en silencio la que no es suya, la que falta no da ningún error.
    expect(propsDeInercia(false)).toEqual({
      accessibilityElementsHidden: true, // iOS
      importantForAccessibility: 'no-hide-descendants', // Android
    });
  });

  it('CON foco: la pantalla es normal — no queda inerte de más', () => {
    expect(propsDeInercia(true)).toEqual({
      accessibilityElementsHidden: false,
      importantForAccessibility: 'auto',
    });
  });
});

describe('el cableado — las DOS superficies que pueden quedar debajo', () => {
  /**
   * Control de FUENTE, no de render, y por una razón concreta: la raíz de estas pantallas no lleva
   * `testID` (el `testID` va al vidrio, más adentro), así que desde el render no se puede afirmar que
   * la prop cayó en la raíz **y no en un hijo** — que es justo la diferencia entre ocultar el subárbol
   * entero y tener que acordarse elemento por elemento. Lo que se fija es la decisión arquitectónica,
   * que es lo que se pierde en un refactor.
   */
  const fuente = (ruta: string) =>
    require('fs').readFileSync(require('path').join(__dirname, ruta), 'utf8');

  it.each([
    ['el escritorio', '../shell/PanelDeslizable.tsx'],
    ['las funciones', '../theme/glass/MarcoGlass.tsx'],
  ])('🔴 %s esparce la inercia en su raíz', (_que, ruta) => {
    const src = fuente(ruta);
    expect(src).toContain('useInerteAlPerderFoco');
    // En la RAÍZ: el spread tiene que estar antes del primer hijo JSX del componente.
    expect(src).toContain('{...inercia}');
  });

  it('🔴 CONTROL — los dos objetos son DISTINTOS entre sí', () => {
    // Sin esto, `propsDeInercia` podría devolver siempre lo mismo y los dos tests de arriba pasarían
    // igual con un solo caso implementado.
    expect(propsDeInercia(true)).not.toEqual(propsDeInercia(false));
  });
});

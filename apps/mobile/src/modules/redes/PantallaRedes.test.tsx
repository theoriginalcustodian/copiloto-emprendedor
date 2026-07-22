import { render, screen } from '@testing-library/react-native';

import { ThemeProvider } from '../../theme/ThemeProvider';
import { PantallaRedes } from './PantallaRedes';

async function envolver() {
  return render(
    <ThemeProvider>
      <PantallaRedes />
    </ThemeProvider>,
  );
}

describe('PantallaRedes', () => {
  it('renderiza su descripción', async () => {
    await envolver();
    expect(screen.getByTestId('redes-descripcion')).toBeTruthy();
  });

  /**
   * 🔴 El invariante del boundary — vale más que "renderiza el título".
   *
   * Esta pantalla trae su propio `MarcoGlass` (2026-07-21, convergencia con documed) que ya pinta el
   * vidrio. Si el contenido PROPIO (`redes-contenido`) le agrega un `backgroundColor`, tapa ese
   * vidrio — el mismo defecto que motivó este test cuando el chrome lo aportaba `CapaFuncion` (ya
   * borrada).
   */
  it('no pinta fondo propio — el vidrio lo aporta MarcoGlass', async () => {
    await envolver();
    const estilos = [screen.getByTestId('redes-contenido').props.style].flat(Infinity);
    for (const e of estilos) {
      expect(e?.backgroundColor).toBeUndefined();
    }
  });

  /**
   * 🔴 Invariante invertido con la convergencia a `MarcoGlass` (2026-07-21): antes el título lo
   * aportaba `CapaFuncion` y esta pantalla no podía repetirlo. Ahora es esta misma pantalla la que
   * trae `MarcoGlass` — el título tiene que aparecer, pero UNA sola vez.
   */
  it('el título "Redes Sociales" lo aporta el MarcoGlass propio, una sola vez', async () => {
    await envolver();
    expect(screen.getAllByText('Redes Sociales')).toHaveLength(1);
  });
});

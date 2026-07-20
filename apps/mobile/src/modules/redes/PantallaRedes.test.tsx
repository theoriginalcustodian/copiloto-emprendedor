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
   * Esta pantalla se monta dentro de `CapaFuncion`, que ya pinta el vidrio y el encabezado. Si
   * alguna vez le agregan `backgroundColor`, el vidrio queda opaco y el efecto glass —que es lo que
   * vinimos a construir— desaparece sin que ningún test lo note.
   *
   * Nació de la integración: los tres cascarones se escribieron como pantallas autónomas, con fondo
   * y título propios, y al montarlos en la capa tapaban el vidrio y duplicaban el nombre.
   */
  it('no pinta fondo propio — el vidrio lo aporta CapaFuncion', async () => {
    await envolver();
    const estilos = [screen.getByTestId('pantalla-redes').props.style].flat(Infinity);
    for (const e of estilos) {
      expect(e?.backgroundColor).toBeUndefined();
    }
  });

  it('no repite el título — el encabezado lo aporta CapaFuncion', async () => {
    await envolver();
    expect(screen.queryByText('Redes Sociales')).toBeNull();
  });
});

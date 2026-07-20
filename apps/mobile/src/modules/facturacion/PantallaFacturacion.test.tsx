import { render, screen } from '@testing-library/react-native';

import { ThemeProvider } from '../../theme/ThemeProvider';
import { PantallaFacturacion } from './PantallaFacturacion';

async function envolver() {
  return render(
    <ThemeProvider>
      <PantallaFacturacion />
    </ThemeProvider>,
  );
}

describe('PantallaFacturacion', () => {
  it('renderiza su descripción', async () => {
    await envolver();
    expect(screen.getByTestId('facturacion-descripcion')).toBeTruthy();
  });

  /** El porqué extendido está en `PantallaRedes.test.tsx`: la capa aporta el chrome, la pantalla el
   *  contenido. Un `backgroundColor` acá deja opaco el vidrio y nadie se entera. */
  it('no pinta fondo propio — el vidrio lo aporta CapaFuncion', async () => {
    await envolver();
    const estilos = [screen.getByTestId('pantalla-facturacion').props.style].flat(Infinity);
    for (const e of estilos) {
      expect(e?.backgroundColor).toBeUndefined();
    }
  });

  it('no repite el título — el encabezado lo aporta CapaFuncion', async () => {
    await envolver();
    expect(screen.queryByText('Facturación')).toBeNull();
  });
});

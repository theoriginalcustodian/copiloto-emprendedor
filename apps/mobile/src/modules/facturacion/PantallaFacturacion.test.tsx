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

  /** El porqué extendido está en `PantallaRedes.test.tsx`: esta pantalla trae su propio `MarcoGlass`,
   *  que ya aporta el vidrio. Un `backgroundColor` en `facturacion-contenido` lo tapa y nadie se entera. */
  it('no pinta fondo propio — el vidrio lo aporta MarcoGlass', async () => {
    await envolver();
    const estilos = [screen.getByTestId('facturacion-contenido').props.style].flat(Infinity);
    for (const e of estilos) {
      expect(e?.backgroundColor).toBeUndefined();
    }
  });

  /** Invariante invertido con la convergencia a `MarcoGlass` (2026-07-21) — ver
   *  `PantallaRedes.test.tsx`: el título ahora lo aporta esta misma pantalla, una sola vez. */
  it('el título "Facturación" lo aporta el MarcoGlass propio, una sola vez', async () => {
    await envolver();
    expect(screen.getAllByText('Facturación')).toHaveLength(1);
  });
});

import { render, screen } from '@testing-library/react-native';

import { ThemeProvider } from '../../theme/ThemeProvider';
import { PantallaInteligencia } from './PantallaInteligencia';

async function envolver() {
  return render(
    <ThemeProvider>
      <PantallaInteligencia />
    </ThemeProvider>,
  );
}

describe('PantallaInteligencia', () => {
  it('renderiza su descripción', async () => {
    await envolver();
    expect(screen.getByTestId('inteligencia-descripcion')).toBeTruthy();
  });

  /** El porqué extendido está en `PantallaRedes.test.tsx`: esta pantalla trae su propio `MarcoGlass`,
   *  que ya aporta el vidrio. Un `backgroundColor` en `inteligencia-contenido` lo tapa y nadie se entera. */
  it('no pinta fondo propio — el vidrio lo aporta MarcoGlass', async () => {
    await envolver();
    const estilos = [screen.getByTestId('inteligencia-contenido').props.style].flat(Infinity);
    for (const e of estilos) {
      expect(e?.backgroundColor).toBeUndefined();
    }
  });

  /** Invariante invertido con la convergencia a `MarcoGlass` (2026-07-21) — ver
   *  `PantallaRedes.test.tsx`: el título ahora lo aporta esta misma pantalla, una sola vez. */
  it('el título "Inteligencia de Negocio" lo aporta el MarcoGlass propio, una sola vez', async () => {
    await envolver();
    expect(screen.getAllByText('Inteligencia de Negocio')).toHaveLength(1);
  });
});

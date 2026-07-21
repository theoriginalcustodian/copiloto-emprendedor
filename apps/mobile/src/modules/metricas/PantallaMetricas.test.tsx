import { render, screen } from '@testing-library/react-native';

import { ThemeProvider } from '../../theme/ThemeProvider';
import { PantallaMetricas } from './PantallaMetricas';

async function envolver() {
  return render(
    <ThemeProvider>
      <PantallaMetricas />
    </ThemeProvider>,
  );
}

describe('PantallaMetricas', () => {
  it('renderiza su descripción', async () => {
    await envolver();
    expect(screen.getByTestId('metricas-descripcion')).toBeTruthy();
  });

  /** El porqué extendido está en `PantallaRedes.test.tsx`: esta pantalla trae su propio `MarcoGlass`,
   *  que ya aporta el vidrio. Un `backgroundColor` en `metricas-contenido` lo tapa y nadie se entera. */
  it('no pinta fondo propio — el vidrio lo aporta MarcoGlass', async () => {
    await envolver();
    const estilos = [screen.getByTestId('metricas-contenido').props.style].flat(Infinity);
    for (const e of estilos) {
      expect(e?.backgroundColor).toBeUndefined();
    }
  });

  /** Invariante invertido con la convergencia a `MarcoGlass` (2026-07-21) — ver
   *  `PantallaRedes.test.tsx`: el título ahora lo aporta esta misma pantalla, una sola vez. */
  it('el título "Métricas" lo aporta el MarcoGlass propio, una sola vez', async () => {
    await envolver();
    expect(screen.getAllByText('Métricas')).toHaveLength(1);
  });
});

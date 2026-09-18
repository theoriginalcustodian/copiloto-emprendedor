import { render, screen } from '@testing-library/react-native';

import { ThemeProvider } from '../../theme/ThemeProvider';
import { hayLogoDe, LogoMarca } from './LogoMarca';
import { LOGOS_MARCA } from './logosMarca';

async function envolver(servicio: string) {
  return render(
    <ThemeProvider>
      <LogoMarca servicio={servicio} testID="logo" />
    </ThemeProvider>,
  );
}

describe('LogoMarca — los logos reales de los servicios', () => {
  it('están los seis que publica el catálogo', () => {
    expect(Object.keys(LOGOS_MARCA).sort()).toEqual([
      'gmail',
      'googlecalendar',
      'googledocs',
      'googledrive',
      'googlesheets',
      'mercadopago',
    ]);
  });

  it('🔴 cada XML conserva su `viewBox` y no trae medidas propias', () => {
    // Sin `viewBox` el SVG no escala; con `width`/`height` del archivo, el tamaño lo decidiría el
    // asset en vez del componente y cada logo mediría distinto.
    Object.values(LOGOS_MARCA).forEach((l) => {
      expect(l.xml).toMatch(/viewBox="/);
      expect(l.xml).not.toMatch(/<svg[^>]*\swidth="/);
      expect(l.xml).not.toMatch(/<svg[^>]*\sheight="/);
    });
  });

  it('🔴 Mercado Pago no depende de CSS: sus clases quedaron inlineadas como `fill`', () => {
    // `react-native-svg` no aplica hojas de estilo. Con el `<style>` original, el logo salía negro.
    expect(LOGOS_MARCA.mercadopago!.xml).not.toMatch(/class="/);
    expect(LOGOS_MARCA.mercadopago!.xml).toMatch(/fill="#/);
  });

  it('se iguala por el eje largo, sin deformar la marca', async () => {
    // Docs es vertical (73×100) y Drive apaisado (112×100): igualar por ancho deja a uno flaco y al
    // otro gigante. El lado corto sale de la proporción, nunca estirado.
    await envolver('googledrive');
    const svg = screen.getByTestId('logo').children[0] as { props: Record<string, number> };
    expect(svg.props.width).toBe(24);
    expect(svg.props.height).toBe(Math.round(24 / LOGOS_MARCA.googledrive!.proporcion));
  });

  it('un servicio sin logo no dibuja nada — el llamador cae en el ícono genérico', async () => {
    expect(hayLogoDe('hubspot')).toBe(false);
    const { toJSON } = await envolver('hubspot');
    expect(toJSON()).toBeNull();
  });
});

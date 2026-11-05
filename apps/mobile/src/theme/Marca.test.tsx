import { render, screen } from '@testing-library/react-native';

import { ThemeProvider } from './ThemeProvider';
import { Marca } from './Marca';

// Jest (jest-expo) -- describe/it/expect son globales, no se importan de vitest.

/**
 * `react-native-svg` está mockeado a Views que reenvían sus props (`jest.setup.js`), así que
 * `d`/`strokeWidth`/`stroke` quedan legibles tal cual se los pasamos -- mismo patrón que
 * `modules/chat/BotonVoz.test.tsx`, fuente del mismo mecanismo `logoScale`.
 */
function montar(props: Partial<Parameters<typeof Marca>[0]> = {}) {
  return render(
    <ThemeProvider>
      <Marca {...props} />
    </ThemeProvider>,
  );
}

describe('Marca -- isotipo Odobi (reemplaza el placeholder de "onda de voz" heredado)', () => {
  it('renderiza los 4 trazos con la MISMA geometría canónica que BotonVoz -- un solo símbolo, no dos', async () => {
    await montar();
    expect(screen.getByTestId('marca-isotipo-trazo-1').props.d).toBe('M11 3.5a8.5 8.5 0 1 0 0 17');
    expect(screen.getByTestId('marca-isotipo-trazo-2').props.d).toBe('M11 7.5a4.5 4.5 0 1 0 0 9');
    expect(screen.getByTestId('marca-isotipo-trazo-3').props.d).toBe('M16.5 8.8a4.8 4.8 0 0 1 0 6.4');
    expect(screen.getByTestId('marca-isotipo-trazo-4').props.d).toBe('M19.5 6.5a9 9 0 0 1 0 11');
  });

  it('proporcionalidad: el stroke-width va en unidades de viewBox (constante) y el grosor en pantalla crece con `size`', async () => {
    // Cada mount consulta SU propio árbol (no el `screen` global).
    const chico = await montar({ size: 64, tono: 'desnudo' });
    const grande = await montar({ size: 128, tono: 'desnudo' });

    const strokeChico = chico.getByTestId('marca-isotipo-trazo-1').props.strokeWidth;
    const strokeGrande = grande.getByTestId('marca-isotipo-trazo-1').props.strokeWidth;
    // Mismo valor en unidades de viewBox a cualquier tamaño (1.3, el del prototipo)...
    expect(strokeChico).toBeCloseTo(1.3, 5);
    expect(strokeGrande).toBeCloseTo(1.3, 5);

    // ...y el <G> lo escala: grosor en pantalla = strokeWidth × escala, proporcional al tamaño.
    const escala = (el: ReturnType<typeof chico.getByTestId>) =>
      Number(/scale\(([\d.]+)\)/.exec(String(el.parent?.props.transform ?? ''))?.[1]);
    const pxChico = strokeChico * escala(chico.getByTestId('marca-isotipo-trazo-1'));
    const pxGrande = strokeGrande * escala(grande.getByTestId('marca-isotipo-trazo-1'));
    expect(pxGrande / pxChico).toBeCloseTo(2, 5);
    // Prototipo `index.html:1876`: a 96 px el trazo rinde 5,2 px.
    const p96 = await montar({ size: 96, tono: 'desnudo' });
    const t96 = p96.getByTestId('marca-isotipo-trazo-1');
    expect(t96.props.strokeWidth * escala(t96)).toBeCloseTo(5.2, 5);
  });

  it('tono="acento" (default) pinta el badge y el trazo con colores DISTINTOS', async () => {
    await montar();
    const badge = screen.getByTestId('marca');
    const trazo = screen.getByTestId('marca-isotipo-trazo-1');
    expect(badge.props.style.backgroundColor).not.toBe(trazo.props.stroke);
  });

  it('tono="superficie" pinta el trazo con `tema.color.acento` -- el mismo tono que el badge de tono="acento"', async () => {
    const acento = await montar({ tono: 'acento' });
    const superficie = await montar({ tono: 'superficie' });

    const badgeAcento = acento.getByTestId('marca').props.style.backgroundColor;
    const trazoAcento = acento.getByTestId('marca-isotipo-trazo-1').props.stroke;
    const badgeSuperficie = superficie.getByTestId('marca').props.style.backgroundColor;
    const trazoSuperficie = superficie.getByTestId('marca-isotipo-trazo-1').props.stroke;

    // El trazo de tono="superficie" es `tema.color.acento` -- el MISMO valor que pinta el badge de
    // tono="acento" (no son tokens independientes, es el mismo acento aplicado al rol contrario).
    expect(trazoSuperficie).toBe(badgeAcento);
    // Y el resto del par SÍ cambia de token entre tonos (no es un no-op disfrazado).
    expect(badgeSuperficie).not.toBe(badgeAcento);
    expect(trazoAcento).not.toBe(trazoSuperficie);
  });

  it('tono="desnudo": sin badge, el signo mide `size` (prototipo `index.html:1876`, svg 96) y es del color de acento', async () => {
    const desnudo = await montar({ size: 96, tono: 'desnudo' });
    const acento = await montar({ size: 96, tono: 'acento' });

    expect(desnudo.getByTestId('marca').props.style.backgroundColor).toBe('transparent');
    // El trazo es el acento (terracota), igual que el badge de tono="acento".
    expect(desnudo.getByTestId('marca-isotipo-trazo-1').props.stroke).toBe(
      acento.getByTestId('marca').props.style.backgroundColor,
    );
    // Signo a `size` ⇒ escala 96/24 = 4. El strokeWidth es el mismo (viewBox) en ambos tonos; lo que
    // cambia es la escala del <G>: con badge el signo mide 96·34/80, así que se ve más chico.
    const transform = (r: typeof desnudo) =>
      String(r.getByTestId('marca-isotipo-trazo-1').parent?.props.transform ?? '');
    expect(transform(desnudo)).toContain('scale(4)');
    expect(transform(acento)).not.toContain('scale(4)');
  });

  it('badge redondeado: tamaño y radio siguen derivando de `size` (30% -- sin cambios de layout)', async () => {
    await montar({ size: 76 });
    const badge = screen.getByTestId('marca');
    expect(badge.props.style.width).toBe(76);
    expect(badge.props.style.height).toBe(76);
    expect(badge.props.style.borderRadius).toBe(Math.round(76 * 0.3));
  });
});

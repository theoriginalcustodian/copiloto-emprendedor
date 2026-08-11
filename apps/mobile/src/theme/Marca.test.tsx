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

  it('logoScale: al doblar `size`, el stroke-width final se divide a la mitad (trazo visualmente constante)', async () => {
    // Cada mount consulta SU propio árbol (no el `screen` global) -- necesario porque este test
    // compara dos tamaños montados en paralelo dentro del mismo `it`.
    const chico = await montar({ size: 64 });
    const grande = await montar({ size: 128 });

    const strokeChico = chico.getByTestId('marca-isotipo-trazo-1').props.strokeWidth;
    const strokeGrande = grande.getByTestId('marca-isotipo-trazo-1').props.strokeWidth;

    // El doble de tamaño con el mismo trazo canónico (1.7 en viewBox 24) implica la mitad de
    // stroke-width predividido -- si alguien rompe la predivisión por escala, este ratio se mueve.
    expect(strokeChico / strokeGrande).toBeCloseTo(2, 5);
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

  it('badge redondeado: tamaño y radio siguen derivando de `size` (30% -- sin cambios de layout)', async () => {
    await montar({ size: 76 });
    const badge = screen.getByTestId('marca');
    expect(badge.props.style.width).toBe(76);
    expect(badge.props.style.height).toBe(76);
    expect(badge.props.style.borderRadius).toBe(Math.round(76 * 0.3));
  });
});

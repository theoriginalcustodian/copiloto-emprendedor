import { render, screen } from '@testing-library/react-native';

// Jest (jest-expo) -- describe/it/expect son globales, no se importan de vitest.

import { ThemeProvider } from '../ThemeProvider';
import type { NombreIconoGlass } from './icons';
import { ICONO_DEL_SISTEMA } from './mapaIconos';
import { GlassIcon } from './GlassIcon';

const NOMBRES = Object.keys(ICONO_DEL_SISTEMA) as NombreIconoGlass[];

describe('GlassIcon -- el catálogo de íconos Odobi', () => {
  // Lista EXPLÍCITA y no `NOMBRES.length`: así agregar un ícono obliga a nombrarlo acá, y no queda
  // un catálogo que crece solo.
  //
  // 18/09: `memoria` salió (no existe en ninguna pantalla del prototipo; confirmado por Martin) y
  // entraron `soporte` y `feedback`, que el prototipo distingue — Soporte lleva `headset` y
  // «Contanos qué tal» su propio glifo, no el de conversación ni el del micrófono, que era lo que
  // tenían las dos pantallas.
  it('el catálogo tiene exactamente los nombres de función del sistema', () => {
    expect(NOMBRES.sort()).toEqual(
      [
        'conversacion',
        'facturacion',
        'ingresos',
        'gastos',
        'presupuestos',
        'clientes',
        'miDia',
        'inteligencia',
        'contabilidad',
        'cobros',
        'appsConectadas',
        'actividadReciente',
        'soporte',
        'feedback',
        'grabar',
        'comoHablarle',
        'miNegocio',
        'perfilFiscal',
        'ajustes',
        'apariencia',
        'miPlan',
        'cuenta',
      ].sort(),
    );
  });

  it.each(NOMBRES)('renderiza "%s" sin crashear, con el viewBox de Phosphor', async (nombre) => {
    await render(
      <ThemeProvider>
        <GlassIcon name={nombre} />
      </ThemeProvider>,
    );

    // `react-native-svg` está mockeado a Views que REENVIAN sus props (ver `jest.setup.js` -- el svg
    // real es pesado y no asienta en el render de arbol completo de `shell.test`), así que el `<Svg>`
    // expone `viewBox` tal cual se lo pasamos, sin la descomposición minX/vbWidth del host real.
    const svg = screen.getByTestId(`glass-icon-${nombre}`);
    expect(svg.props.viewBox).toBe('0 0 256 256');
  });

  it('respeta el `size` recibido (width/height del <Svg>)', async () => {
    await render(
      <ThemeProvider>
        <GlassIcon name="facturacion" size={40} />
      </ThemeProvider>,
    );

    const svg = screen.getByTestId('glass-icon-facturacion');
    expect(svg.props.width).toBe(40);
    expect(svg.props.height).toBe(40);
  });

  it('sin `size`, usa el default de 24', async () => {
    await render(
      <ThemeProvider>
        <GlassIcon name="grabar" />
      </ThemeProvider>,
    );

    const svg = screen.getByTestId('glass-icon-grabar');
    expect(svg.props.width).toBe(24);
  });
});

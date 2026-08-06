import { render, screen } from '@testing-library/react-native';

// Jest (jest-expo) -- describe/it/expect son globales, no se importan de vitest.

import { ThemeProvider } from '../ThemeProvider';
import { CATALOGO_ICONOS } from './icons';
import { GlassIcon } from './GlassIcon';

const NOMBRES = Object.keys(CATALOGO_ICONOS) as (keyof typeof CATALOGO_ICONOS)[];

describe('GlassIcon -- el catálogo de íconos Odobi', () => {
  // Lista EXPLÍCITA y no `NOMBRES.length`: así agregar un ícono obliga a nombrarlo acá, y no queda
  // un catálogo que crece solo. Los 21 nombres de función del set Odobi (`Iconos Odobi.dc.html`).
  it('el catálogo tiene exactamente los 21 nombres de función requeridos', () => {
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
        'memoria',
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

  it.each(NOMBRES)('renderiza "%s" sin crashear, con el viewBox 0 0 24 24', async (nombre) => {
    await render(
      <ThemeProvider>
        <GlassIcon name={nombre} />
      </ThemeProvider>,
    );

    // `react-native-svg` está mockeado a Views que REENVIAN sus props (ver `jest.setup.js` -- el svg
    // real es pesado y no asienta en el render de arbol completo de `shell.test`), así que el `<Svg>`
    // expone `viewBox` tal cual se lo pasamos, sin la descomposición minX/vbWidth del host real.
    const svg = screen.getByTestId(`glass-icon-${nombre}`);
    expect(svg.props.viewBox).toBe('0 0 24 24');
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

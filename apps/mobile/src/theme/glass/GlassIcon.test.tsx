import { render, screen } from '@testing-library/react-native';

// Jest (jest-expo) -- describe/it/expect son globales, no se importan de vitest.

import { CATALOGO_ICONOS } from './icons';
import { GlassIcon } from './GlassIcon';

const NOMBRES = Object.keys(CATALOGO_ICONOS) as (keyof typeof CATALOGO_ICONOS)[];

describe('GlassIcon -- el catálogo de iconos glass', () => {
  // Lista EXPLÍCITA y no `NOMBRES.length`: así agregar un ícono obliga a nombrarlo acá, y no queda
  // un catálogo que crece solo. `user` entró cuando Pacientes (Clientes acá) pasó a tener su ícono de
  // entrada propio en el escritorio (2026-07-18).
  it('el catálogo tiene exactamente los nombres semánticos requeridos', () => {
    expect(NOMBRES.sort()).toEqual(
      ['chart', 'chat', 'clock', 'doc_search', 'folder', 'media', 'mic', 'note', 'settings', 'user',
       // `wallet` entró con Gastos (2026-07-21). Se AGREGÓ en vez de reusar `chart` —que ya es
       // Métricas—: dos tiles con el mismo glifo en el mismo grid no se distinguen de un vistazo.
       'wallet'].sort()
    );
  });

  it.each(NOMBRES)('renderiza "%s" sin crashear, con el viewBox 0 0 100 100', async (nombre) => {
    await render(<GlassIcon name={nombre} />);

    // `react-native-svg` está mockeado a Views que REENVIAN sus props (ver `jest.setup.js` -- el svg
    // real es pesado y no asienta en el render de arbol completo de `shell.test`), así que el `<Svg>`
    // expone `viewBox` tal cual se lo pasamos, sin la descomposición minX/vbWidth del host real.
    const svg = screen.getByTestId(`glass-icon-${nombre}`);
    expect(svg.props.viewBox).toBe('0 0 100 100');
  });

  it('respeta el `size` recibido (width/height del <Svg>)', async () => {
    await render(<GlassIcon name="folder" size={40} />);

    const svg = screen.getByTestId('glass-icon-folder');
    expect(svg.props.width).toBe(40);
    expect(svg.props.height).toBe(40);
  });

  it('sin `size`, usa el default de 72', async () => {
    await render(<GlassIcon name="mic" />);

    const svg = screen.getByTestId('glass-icon-mic');
    expect(svg.props.width).toBe(72);
  });
});

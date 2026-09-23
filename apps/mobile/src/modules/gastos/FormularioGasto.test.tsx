import { render } from '@testing-library/react-native';

import { ETIQUETA_ORIGEN_GASTO, type OrigenGasto } from '@copiloto/core';

import { ThemeProvider } from '../../theme/ThemeProvider';
import { FormularioGasto } from './FormularioGasto';

const ORIGENES: OrigenGasto[] = ['voz', 'foto', 'manual'];

describe('FormularioGasto — origen de la propuesta (BL-C4)', () => {
  it.each(ORIGENES)('muestra de dónde salió el gasto cuando origen=%s', async (origen) => {
    // `render` es asíncrono en RNTL 14 + React 19: sin `await` el árbol todavía no existe.
    const { getByTestId } = await render(
      <ThemeProvider>
        <FormularioGasto origen={origen} onCreado={jest.fn()} onCancelar={jest.fn()} />
      </ThemeProvider>,
    );
    expect(getByTestId('gasto-origen')).toHaveTextContent(ETIQUETA_ORIGEN_GASTO[origen]);
  });
});

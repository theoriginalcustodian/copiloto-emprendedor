import { render, screen } from '@testing-library/react-native';

import { ThemeProvider } from '../../theme/ThemeProvider';
import { AvisoDictado } from '../voz/AvisoDictado';
import { EsperaOdobi } from './EsperaOdobi';

// Jest (jest-expo): describe/it/expect son globales.
describe('EsperaOdobi -- el isotipo animado que cubre la espera de la card', () => {
  it('dibuja los 4 trazos del isotipo (2 arcos largos + 2 ondas cortas), el mismo de la entrada', async () => {
    await render(
      <ThemeProvider>
        <EsperaOdobi />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('espera-odobi-trazo-1')).toBeTruthy();
    expect(screen.getByTestId('espera-odobi-trazo-2')).toBeTruthy();
    expect(screen.getByTestId('espera-odobi-onda-1')).toBeTruthy();
    expect(screen.getByTestId('espera-odobi-onda-2')).toBeTruthy();
  });

  it('AvisoDictado: ocupado muestra el isotipo; sin ocupar no hay espera', async () => {
    const { rerender } = await render(
      <ThemeProvider>
        <AvisoDictado ocupado aviso={null} testID="x" />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('x-logo')).toBeTruthy();
    await rerender(
      <ThemeProvider>
        <AvisoDictado ocupado={false} aviso={null} testID="x" />
      </ThemeProvider>,
    );
    expect(screen.queryByTestId('x-logo')).toBeNull();
  });
});

import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { IdentidadEntrada } from './IdentidadEntrada';

describe('IdentidadEntrada (BL-X10, animación de entrada sobre el reveal)', () => {
  it('monta las 4 formas y el lockup (children) sin romper', async () => {
    await render(
      <IdentidadEntrada>
        <Text>Odobi</Text>
      </IdentidadEntrada>,
    );
    expect(screen.getByTestId('identidad-entrada')).toBeTruthy();
    expect(screen.getByTestId('identidad-entrada-forma-1')).toBeTruthy();
    expect(screen.getByTestId('identidad-entrada-forma-4')).toBeTruthy();
    expect(screen.getByText('Odobi')).toBeTruthy();
  });
});

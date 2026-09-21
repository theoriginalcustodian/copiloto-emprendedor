import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { ThemeProvider } from '../../theme/ThemeProvider';
import { Recibo } from './Recibo';

async function montar(ui: React.ReactElement) {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
}

describe('Recibo (BL-F1)', () => {
  it('🔴 el título es región viva polite: el resultado se anuncia (WCAG 4.1.3)', async () => {
    await montar(<Recibo testID="r" tono="exito" titulo="Gasto anotado: $ 1.000" />);
    const titulo = screen.getByTestId('r-titulo');
    expect(titulo.props.accessibilityLiveRegion).toBe('polite');
    expect(titulo.props.children).toBe('Gasto anotado: $ 1.000');
  });

  it('pinta nota y children (los datos y la acción de cada card)', async () => {
    await montar(
      <Recibo testID="r" tono="exito" titulo="Factura emitida." nota={{ texto: 'Preparando el PDF…', testID: 'nota' }}>
        <Text testID="dato">CAE 7412</Text>
      </Recibo>,
    );
    expect(screen.getByTestId('dato')).toBeTruthy();
    expect(screen.getByTestId('nota').props.children).toBe('Preparando el PDF…');
  });
});

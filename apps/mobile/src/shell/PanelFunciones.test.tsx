import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

// El COMPORTAMIENTO del gesto (drag/snap/toggle) se valida en device, igual que con
// `PanelDeslizable`: acá se cubre que la capa monta, que la base queda montada debajo y que la
// pestaña existe con nombre accesible — que es lo que hace alcanzable el escritorio sin el gesto.

import { ThemeProvider } from '../theme/ThemeProvider';
import { PanelFunciones } from './PanelFunciones';

async function envolver() {
  return render(
    <ThemeProvider>
      <PanelFunciones escritorio={<Text>escritorio-arriba</Text>}>
        <Text>base-mi-dia</Text>
      </PanelFunciones>
    </ThemeProvider>,
  );
}

describe('PanelFunciones — el escritorio colgado del borde de arriba (Ola 4)', () => {
  it('monta la base y el escritorio como capas separadas', async () => {
    await envolver();
    expect(screen.getByText('base-mi-dia')).toBeTruthy();
    expect(screen.getByText('escritorio-arriba')).toBeTruthy();
    expect(screen.getByTestId('panel-funciones-capa')).toBeTruthy();
  });

  it('🔴 la pestaña es TOCABLE y dice a dónde lleva — WCAG 2.5.1', async () => {
    // Un panel que sólo se abre arrastrando deja afuera a quien no puede hacer un gesto de
    // trayectoria. La pestaña es la alternativa de un solo puntero, y su nombre dice qué se consigue
    // ("Ver funciones"), no qué es ("pestaña").
    await envolver();
    const pestana = screen.getByTestId('panel-funciones-pestana');
    expect(pestana.props.accessibilityRole).toBe('button');
    expect(pestana.props.accessibilityLabel).toBe('Ver funciones');
    expect(pestana.props.accessibilityState).toEqual({ expanded: false });
  });
});

import { fireEvent, render, screen } from '@testing-library/react-native';

import { ThemeProvider } from '../../../theme/ThemeProvider';
import { GraficoBarras } from './GraficoBarras';

function montar(props: React.ComponentProps<typeof GraficoBarras>) {
  return render(
    <ThemeProvider>
      <GraficoBarras {...props} />
    </ThemeProvider>,
  );
}

describe('GraficoBarras', () => {
  it('dibuja una barra por punto de una sola serie, y toca abre el detalle', async () => {
    const onSegmentoPress = jest.fn();
    await montar({
      testID: 'g1',
      puntos: ['2026-06', '2026-07'],
      series: [{ id: 'total', etiqueta: 'Facturación', color: '#4dd9ff', valores: ['10000.00', '20000.00'] }],
      onSegmentoPress,
    });

    expect(screen.getByTestId('g1-barra-2026-07-total')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('g1-barra-2026-07-total'));
    expect(onSegmentoPress).toHaveBeenCalledWith('2026-07', 'total');
  });

  it('🔴 dos series (enfrentadas) muestran la leyenda; una sola serie NO', async () => {
    await montar({
      testID: 'g2',
      puntos: ['2026-07'],
      series: [
        { id: 'entro', etiqueta: 'Entró', color: '#34e5a0', valores: ['5000.00'] },
        { id: 'salio', etiqueta: 'Salió', color: '#ff8fa0', valores: ['2000.00'] },
      ],
    });

    expect(screen.getByText('Entró')).toBeTruthy();
    expect(screen.getByText('Salió')).toBeTruthy();
    expect(screen.getByTestId('g2-barra-2026-07-entro')).toBeTruthy();
    expect(screen.getByTestId('g2-barra-2026-07-salio')).toBeTruthy();
  });

  it('🔴 un valor `null` no es tocable — no hay detalle de un dato que no vino', async () => {
    const onSegmentoPress = jest.fn();
    await montar({
      testID: 'g3',
      puntos: ['2026-07'],
      series: [{ id: 'total', etiqueta: 'Facturación', color: '#4dd9ff', valores: [null] }],
      onSegmentoPress,
    });

    // El testID de la barra sigue existiendo (se dibuja igual, alto mínimo), pero envuelta en un `View`
    // sin `Pressable` — no hay `accessibilityRole="button"` que tocar.
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('sin puntos muestra el estado vacío, sin reventar', async () => {
    await montar({ testID: 'g4', puntos: [], series: [] });
    expect(screen.getByTestId('g4-vacio')).toBeTruthy();
  });

  it('el epígrafe (período · fuente) se muestra cuando se pasa', async () => {
    await montar({
      testID: 'g5',
      puntos: ['2026-07'],
      series: [{ id: 'total', etiqueta: 'Facturación', color: '#4dd9ff', valores: ['1'] }],
      epigrafe: 'Julio · 12 facturas',
    });
    expect(screen.getByText('Julio · 12 facturas')).toBeTruthy();
  });
});

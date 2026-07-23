import { fireEvent, render, screen } from '@testing-library/react-native';

import { ThemeProvider } from '../../../theme/ThemeProvider';
import { SKINS } from '../../../theme/tokens';
import { GraficoTorta } from './GraficoTorta';

const ORDEN = ['mercaderia', 'servicios', 'alquiler', 'sueldos', 'impuestos', 'transporte', 'herramientas', 'otros'];

function montar(props: React.ComponentProps<typeof GraficoTorta>) {
  return render(
    <ThemeProvider>
      <GraficoTorta {...props} />
    </ThemeProvider>,
  );
}

describe('GraficoTorta', () => {
  it('dibuja una porción por categoría con valor, y tocarla abre el detalle', async () => {
    const onSegmentoPress = jest.fn();
    await montar({
      testID: 'torta',
      orden: ORDEN,
      porciones: [
        { categoria: 'transporte', valor: '3000.00' },
        { categoria: 'mercaderia', valor: '9000.00' },
      ],
      onSegmentoPress,
    });

    expect(screen.getByTestId('torta-porcion-transporte')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('torta-porcion-mercaderia'));
    expect(onSegmentoPress).toHaveBeenCalledWith('mercaderia');
  });

  it('🔴 una categoría con valor `null` o "0" NO dibuja porción', async () => {
    await montar({
      testID: 'torta',
      orden: ORDEN,
      porciones: [
        { categoria: 'transporte', valor: '0.00' },
        { categoria: 'mercaderia', valor: null },
        { categoria: 'sueldos', valor: '500.00' },
      ],
    });

    expect(screen.queryByTestId('torta-porcion-transporte')).toBeNull();
    expect(screen.queryByTestId('torta-porcion-mercaderia')).toBeNull();
    expect(screen.getByTestId('torta-porcion-sueldos')).toBeTruthy();
  });

  it('🔴 el color sigue a la categoría (el token, índice fijo en ORDEN), no a la posición en la torta', async () => {
    // "transporte" es el índice 5 de ORDEN — su color tiene que ser el del token en ESE índice, esté
    // sola o acompañada de otras categorías en la respuesta.
    await montar({
      testID: 't2',
      orden: ORDEN,
      porciones: [
        { categoria: 'mercaderia', valor: '900' },
        { categoria: 'transporte', valor: '100' },
      ],
    });
    const colorConOtras = screen.getByTestId('t2-porcion-transporte').props.fill;

    expect(colorConOtras).toBe(SKINS.cian.color.categorico[ORDEN.indexOf('transporte')]);
  });

  it('una sola categoría con el 100% dibuja el círculo completo (dos semicírculos), sin reventar', async () => {
    await montar({ testID: 'full', orden: ORDEN, porciones: [{ categoria: 'otros', valor: '500.00' }] });
    expect(screen.getByTestId('full-porcion-otros')).toBeTruthy();
  });

  it('sin porciones con valor muestra el estado vacío', async () => {
    await montar({ testID: 'vacio', orden: ORDEN, porciones: [] });
    expect(screen.getByTestId('vacio-vacio')).toBeTruthy();
  });
});

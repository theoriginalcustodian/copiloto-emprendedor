import { fireEvent, render, screen } from '@testing-library/react-native';
import { Alert, Linking, Share } from 'react-native';

import type { LinkDeCobro } from '@copiloto/core';

import { ThemeProvider } from '../../theme/ThemeProvider';
import { TarjetaLinkDeCobro } from './TarjetaLinkDeCobro';

const LINK: LinkDeCobro = { url: 'https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=1', monto: '15000', concepto: 'Diseño de logo' };

async function montar(link = LINK) {
  return render(
    <ThemeProvider>
      <TarjetaLinkDeCobro link={link} />
    </ThemeProvider>,
  );
}

describe('TarjetaLinkDeCobro (BL-F2)', () => {
  afterEach(() => jest.restoreAllMocks());

  it('muestra monto formateado y concepto', async () => {
    await montar();
    expect(screen.getByTestId('tarjeta-link-cobro-monto')).toHaveTextContent('$15.000');
    expect(screen.getByText('Diseño de logo')).toBeTruthy();
  });

  it('Compartir abre la hoja nativa con el link real', async () => {
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' });
    await montar();
    fireEvent.press(screen.getByTestId('tarjeta-link-cobro-compartir'));
    expect(share).toHaveBeenCalledWith({ message: LINK.url, url: LINK.url });
  });

  it('Abrir lleva al link y, si falla, lo dice', async () => {
    const abrir = jest.spyOn(Linking, 'openURL').mockRejectedValue(new Error('sin app'));
    const alerta = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await montar();
    fireEvent.press(screen.getByTestId('tarjeta-link-cobro-abrir'));
    await Promise.resolve();
    await Promise.resolve();
    expect(abrir).toHaveBeenCalledWith(LINK.url);
    expect(alerta).toHaveBeenCalled();
  });

  it('sin monto ni concepto sólo ofrece las acciones', async () => {
    await montar({ url: LINK.url, monto: null, concepto: null });
    expect(screen.queryByTestId('tarjeta-link-cobro-monto')).toBeNull();
    expect(screen.getByTestId('tarjeta-link-cobro-compartir')).toBeTruthy();
  });
});

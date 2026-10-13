import { fireEvent, render, screen } from '@testing-library/react-native';
import { Alert, Linking, Share } from 'react-native';

import type { LinkDeCobro } from '@copiloto/core';

import { ThemeProvider } from '../../theme/ThemeProvider';
import { mailtoLinkDeCobro, NOTA_ANOTA_AL_APROBAR, TarjetaLinkDeCobro } from './TarjetaLinkDeCobro';

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

  it('ofrece «Compartilo por WhatsApp» (hoja del sistema) y «Mandalo por mail»', async () => {
    await montar();
    expect(screen.getByText('Compartilo por WhatsApp')).toBeTruthy();
    expect(screen.getByText('Mandalo por mail')).toBeTruthy();
  });

  it('«Mandalo por mail» abre un mailto con el link, el monto y el concepto', async () => {
    // `Linking.openURL` ya es un jest.fn del preset de RN: `restoreAllMocks` no le limpia las llamadas.
    const abrir = jest.spyOn(Linking, 'openURL').mockClear().mockResolvedValue(true);
    await montar();
    fireEvent.press(screen.getByTestId('tarjeta-link-cobro-mail'));
    await Promise.resolve();
    expect(abrir).toHaveBeenCalledTimes(1);
    const url = abrir.mock.calls[0][0];
    expect(url.startsWith('mailto:?subject=')).toBe(true);
    const cuerpo = decodeURIComponent(url.split('&body=')[1]);
    expect(cuerpo).toContain(LINK.url);
    expect(cuerpo).toContain('Diseño de logo');
    expect(cuerpo).toContain('$15.000');
  });

  it('si no hay app de correo lo dice, sin hablar de un link «vencido»', async () => {
    jest.spyOn(Linking, 'openURL').mockRejectedValue(new Error('sin app'));
    const alerta = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await montar();
    fireEvent.press(screen.getByTestId('tarjeta-link-cobro-mail'));
    await Promise.resolve();
    await Promise.resolve();
    expect(alerta).toHaveBeenCalledTimes(1);
    expect(String(alerta.mock.calls[0][0])).toMatch(/correo/i);
    expect(JSON.stringify(alerta.mock.calls[0])).not.toMatch(/venc/i);
  });

  it('🚫 no promete lo que el backend no tiene: sin «vence en N días» ni «te aviso»', async () => {
    await montar();
    expect(screen.getByTestId('tarjeta-link-cobro-nota')).toHaveTextContent(NOTA_ANOTA_AL_APROBAR);
    expect(screen.queryByText(/venc/i)).toBeNull();
    expect(screen.queryByText(/te aviso/i)).toBeNull();
    expect(screen.queryByText(/\d+ días/)).toBeNull();
  });

  it('mailtoLinkDeCobro sin monto ni concepto sólo lleva el link', () => {
    const url = mailtoLinkDeCobro({ url: LINK.url, monto: null, concepto: null });
    const cuerpo = decodeURIComponent(url.split('&body=')[1]);
    expect(cuerpo).toBe(`Hola, te paso el link para pagar:\n${LINK.url}`);
  });

  it('sin monto ni concepto sólo ofrece las acciones', async () => {
    await montar({ url: LINK.url, monto: null, concepto: null });
    expect(screen.queryByTestId('tarjeta-link-cobro-monto')).toBeNull();
    expect(screen.getByTestId('tarjeta-link-cobro-compartir')).toBeTruthy();
  });
});

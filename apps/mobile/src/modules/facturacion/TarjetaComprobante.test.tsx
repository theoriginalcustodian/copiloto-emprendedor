/**
 * `TarjetaComprobante` — lo que el usuario ve apenas se emite su factura.
 *
 * El invariante que fijan estos tests es de COPY y es el que más caro sale si se rompe: **el aviso
 * cuelga del HECHO de tener copia, no de la intención de guardarla**. Con el ajuste de Drive
 * prendido y el archivado fallado, el único link que le queda al usuario es el de AFIP —que vence a
 * las 24 h— y tiene que enterarse.
 */
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Linking } from 'react-native';

import type { EstadoFacturaResp } from '@copiloto/core';

import { ThemeProvider } from '../../theme/ThemeProvider';
import { TarjetaComprobante } from './TarjetaComprobante';

function estado(over: Partial<EstadoFacturaResp> = {}): EstadoFacturaResp {
  return {
    estado: 'entregada',
    faltantes: [],
    items: [],
    total: '1000.00',
    tokenConfirmacion: null,
    resultado: { ok: true, duplicado: false, cae: '86294776469171', caeVto: '2026-08-01', nro: 8, tipoCbte: 11, puntoVenta: 6 },
    pdf: { url: 'https://afipsdk/f.pdf', nombre: 'f.pdf', expiraAt: null },
    drive: null,
    motivo: null,
    motivoCodigo: null,
    terminado: true,
    ...over,
  };
}

async function montar(e: EstadoFacturaResp) {
  return render(
    <ThemeProvider>
      <TarjetaComprobante estado={e} onNuevaFactura={() => {}} />
    </ThemeProvider>,
  );
}

describe('TarjetaComprobante', () => {
  it('sin copia en Drive avisa las 24 h y descarga del PDF de AFIP', async () => {
    const abrir = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    await montar(estado());

    expect(screen.getByTestId('facturacion-comprobante-aviso-24h')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('facturacion-comprobante-guardar'));
    expect(abrir).toHaveBeenCalledWith('https://afipsdk/f.pdf');
    abrir.mockRestore();
  });

  it('con copia en Drive avisa que el link no vence y usa ESE link', async () => {
    const abrir = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    await montar(estado({ drive: { guardado: true, fileId: '1tnAN', link: 'https://drive/uc?id=1tnAN', compartido: true } }));

    expect(screen.getByTestId('facturacion-comprobante-aviso-drive')).toHaveTextContent('no vence', { exact: false });
    expect(screen.queryByTestId('facturacion-comprobante-aviso-24h')).toBeNull();
    await fireEvent.press(screen.getByTestId('facturacion-comprobante-guardar'));
    expect(abrir).toHaveBeenCalledWith('https://drive/uc?id=1tnAN');
    abrir.mockRestore();
  });

  /**
   * 🔴 El test que justifica todo el diseño: el usuario PIDIÓ guardar en Drive y el archivado falló.
   * Si el aviso colgara del ajuste, acá diría "guardada en tu Drive" sobre una factura cuyo único
   * link muere en 24 horas.
   */
  it('ajuste prendido + archivado fallado -> sigue avisando las 24 h', async () => {
    await montar(estado({ drive: { guardado: false, motivo: 'error_drive: ConnectionRequired' } }));

    expect(screen.getByTestId('facturacion-comprobante-aviso-24h')).toBeTruthy();
    expect(screen.queryByTestId('facturacion-comprobante-aviso-drive')).toBeNull();
  });

  it('sin PDF ni Drive: el CAE es válido y el aviso NO se pinta como error', async () => {
    await montar(estado({ pdf: null }));

    expect(screen.getByTestId('facturacion-comprobante-sin-pdf')).toHaveTextContent('se emitió correctamente', {
      exact: false,
    });
    expect(screen.queryByTestId('facturacion-comprobante-guardar')).toBeNull();
  });

  it('con Drive pero sin PDF de AFIP igual se puede descargar', async () => {
    await montar(estado({ pdf: null, drive: { guardado: true, link: 'https://drive/uc?id=x', fileId: 'x', compartido: true } }));

    expect(screen.getByTestId('facturacion-comprobante-guardar')).toBeTruthy();
    expect(screen.queryByTestId('facturacion-comprobante-sin-pdf')).toBeNull();
  });
});

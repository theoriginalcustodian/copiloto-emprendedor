/**
 * `DetalleComprobante` — el glass chico de una factura.
 *
 * Lo que se fija acá son las decisiones que se rompen sin que nadie note nada: qué link se ofrece
 * (el permanente antes que el que vence), qué aviso acompaña a cada caso, y que un comprobante viejo
 * —sin receptor— no rompa la pantalla.
 */
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Linking } from 'react-native';

import type { Comprobante } from '@copiloto/core';

import { ThemeProvider } from '../../theme/ThemeProvider';
import { DetalleComprobante, numeroFormateado } from './DetalleComprobante';

function comprobante(over: Partial<Comprobante> = {}): Comprobante {
  return {
    cuit: '20111111112',
    tipoCbte: 11,
    puntoVenta: 6,
    nro: 15,
    cae: '86290621776176',
    caeVto: '2026-08-01',
    fechaEmision: '2026-07-21',
    total: '1000.00',
    estado: 'emitida',
    pdfUrl: 'https://afipsdk/f.pdf',
    cbteAsocNro: null,
    driveFileId: null,
    driveLink: null,
    receptorNombre: null,
    docTipo: null,
    docNro: null,
    ...over,
  };
}

async function montar(c: Comprobante, onCerrar = () => {}) {
  return render(
    <ThemeProvider>
      <DetalleComprobante comprobante={c} onCerrar={onCerrar} />
    </ThemeProvider>,
  );
}

describe('numeroFormateado', () => {
  it('arma el número como lo identifica AFIP', () => {
    expect(numeroFormateado(6, 15)).toBe('0006-00000015');
    expect(numeroFormateado(1, 1)).toBe('0001-00000001');
  });
});

describe('DetalleComprobante', () => {
  it('muestra los datos del comprobante', async () => {
    await montar(comprobante({ receptorNombre: 'Juan Pérez SRL', docTipo: 80, docNro: '20111111112' }));

    expect(screen.getByTestId('detalle-comprobante-numero')).toHaveTextContent('0006-00000015');
    expect(screen.getByTestId('detalle-comprobante-cae')).toHaveTextContent('86290621776176');
    expect(screen.getByTestId('detalle-comprobante-receptor')).toHaveTextContent('Juan Pérez SRL');
    expect(screen.getByTestId('detalle-comprobante-documento')).toHaveTextContent('CUIT 20111111112');
  });

  /**
   * 🔴 20 comprobantes del tenant de pruebas no tienen receptor: se emitieron antes de que el campo
   * existiera. Es el caso NORMAL para cualquiera que ya venía facturando, no un borde raro.
   */
  it('un comprobante viejo sin receptor no rompe ni inventa un vacío', async () => {
    await montar(comprobante());

    expect(screen.queryByTestId('detalle-comprobante-receptor')).toBeNull();
    expect(screen.queryByTestId('detalle-comprobante-documento')).toBeNull();
    expect(screen.getByTestId('detalle-comprobante-cae')).toBeTruthy();
  });

  it('ofrece el link de Drive antes que el de AFIP, porque el de AFIP vence', async () => {
    const abrir = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    await montar(comprobante({ driveLink: 'https://drive/uc?id=1tnAN', driveFileId: '1tnAN' }));

    expect(screen.getByTestId('detalle-comprobante-aviso-copia')).toHaveTextContent('no vence', {
      exact: false,
    });
    await fireEvent.press(screen.getByTestId('detalle-comprobante-guardar'));
    expect(abrir).toHaveBeenCalledWith('https://drive/uc?id=1tnAN');
    abrir.mockRestore();
  });

  it('sin copia en Drive avisa las 24 h y usa el PDF de AFIP', async () => {
    const abrir = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    await montar(comprobante());

    expect(screen.getByTestId('detalle-comprobante-aviso-copia')).toHaveTextContent('24 horas', {
      exact: false,
    });
    await fireEvent.press(screen.getByTestId('detalle-comprobante-guardar'));
    expect(abrir).toHaveBeenCalledWith('https://afipsdk/f.pdf');
    abrir.mockRestore();
  });

  it('una factura anulada dice qué nota de crédito la anuló', async () => {
    await montar(comprobante({ estado: 'anulada', cbteAsocNro: 16 }));

    expect(screen.getByTestId('detalle-comprobante-estado')).toHaveTextContent('Anulada');
    expect(screen.getByTestId('detalle-comprobante-anulada-por')).toHaveTextContent('N° 16', {
      exact: false,
    });
  });

  it('sin ningún link no dibuja botones que no llevan a ninguna parte', async () => {
    await montar(comprobante({ pdfUrl: null }));

    expect(screen.queryByTestId('detalle-comprobante-guardar')).toBeNull();
  });

  it('cierra al tocar afuera, pero NO al tocar el panel', async () => {
    const onCerrar = jest.fn();
    await montar(comprobante(), onCerrar);

    await fireEvent.press(screen.getByTestId('detalle-comprobante'));
    expect(onCerrar).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByTestId('detalle-comprobante-scrim'));
    expect(onCerrar).toHaveBeenCalledTimes(1);
  });
});

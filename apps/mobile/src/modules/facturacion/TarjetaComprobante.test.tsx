/**
 * `TarjetaComprobante` — lo que el usuario ve apenas se emite su factura.
 *
 * El invariante que fijan estos tests es de COPY y es el que más caro sale si se rompe: **el aviso
 * cuelga del HECHO de tener copia, no de la intención de guardarla**. Con el ajuste de Drive
 * prendido y el archivado fallado, el único link que le queda al usuario es el de AFIP —que vence a
 * las 24 h— y tiene que enterarse.
 */
/**
 * `SeccionCobro` (embebida en la card de éxito) habla con `@copiloto/core` por red. Se mockea sólo
 * `listarCobros` —la única que corre al montar— con `...requireActual` para no tocar el resto; así el
 * caso «con id» monta la sección sin salir a la red, y los casos «sin id»/nota de crédito la evitan por
 * construcción (la sección ni se dibuja). Ver el docstring de `PantallaPerfilNegocio.test` sobre por
 * qué el partial mock preserva lo real.
 */
jest.mock('@copiloto/core', () => {
  const actual = jest.requireActual('@copiloto/core');
  return { ...actual, listarCobros: jest.fn() };
});

import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Linking } from 'react-native';

import { listarCobros, type EstadoFacturaResp } from '@copiloto/core';

import { ThemeProvider } from '../../theme/ThemeProvider';
import { TarjetaComprobante } from './TarjetaComprobante';

const mockListarCobros = listarCobros as jest.MockedFunction<typeof listarCobros>;

function estado(over: Partial<EstadoFacturaResp> = {}): EstadoFacturaResp {
  return {
    estado: 'entregada',
    faltantes: [],
    items: [],
    total: '1000.00',
    tokenConfirmacion: null,
    // `id: null` por defecto: sin id la card NO ofrece cobrar, que es el estado de hoy (el payload del
    // workflow todavía no trae el id de fila). Los tests de cobro pasan un `resultado` con `id`.
    resultado: { ok: true, duplicado: false, cae: '86294776469171', caeVto: '2026-08-01', nro: 8, tipoCbte: 11, puntoVenta: 6, id: null },
    pdf: { url: 'https://afipsdk/f.pdf', nombre: 'f.pdf', expiraAt: null },
    drive: null,
    receptor: null,
    motivo: null,
    motivoCodigo: null,
    terminado: true,
    ...over,
  };
}

beforeEach(() => {
  mockListarCobros.mockReset();
  // Recién emitida: impaga, saldo = total. Es el estado en el que la card ofrece «Ya me la pagaron».
  mockListarCobros.mockResolvedValue({
    status: 'ok',
    cobros: [],
    comprobante: { id: 15, total: '1000.00', cobrado: '0.00', saldo: '1000.00', estadoCobro: 'impaga' },
  });
});

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

  describe('¿ya la cobraste? — la card de éxito ofrece cargar el cobro en el momento (§2.1)', () => {
    it('🔴 con `resultado.id` y factura emitida, la sección de cobro aparece', async () => {
      // El caso que justifica el campo: apenas se emite, el emprendedor puede marcar «ya me la pagaron»
      // sin navegar a la factura. La sección se alimenta de la MISMA vía viva que el detalle.
      await montar(estado({ resultado: { ok: true, duplicado: false, cae: 'c', caeVto: null, nro: 8, tipoCbte: 11, puntoVenta: 6, id: 15 } }));

      await waitFor(() => expect(screen.getByTestId('facturacion-comprobante-cobro')).toBeTruthy());
      expect(mockListarCobros).toHaveBeenCalledWith(15);
      await waitFor(() => expect(screen.getByTestId('facturacion-comprobante-cobro-marcar')).toBeTruthy());
    });

    /**
     * 🔴 [CONNECT] Degradación honesta: mientras el payload del workflow no traiga el id de fila
     * (`id: null`), la sección NO se dibuja. Un botón que apuntaría a `/undefined/cobros` daría un 404
     * sobre algo que ni se intentó. El día que backend agregue `resultado.id`, el toque aparece solo.
     */
    it('🔴 sin `resultado.id` (hoy) NO dibuja la sección ni sale a la red', async () => {
      await montar(estado()); // id: null por defecto

      expect(screen.queryByTestId('facturacion-comprobante-cobro')).toBeNull();
      expect(mockListarCobros).not.toHaveBeenCalled();
    });

    it('🔴 sobre una nota de crédito (tipo 13) no ofrece cobrar, aunque tenga id', async () => {
      // Una NC no es plata que alguien deba: ofrecer «ya me la pagaron» ahí contradice el documento.
      await montar(estado({ resultado: { ok: true, duplicado: false, cae: 'c', caeVto: null, nro: 8, tipoCbte: 13, puntoVenta: 6, id: 15 } }));

      // La sección se monta pero `SeccionCobro` con `cobrable=false` no dibuja nada ni consulta.
      expect(screen.queryByTestId('facturacion-comprobante-cobro-marcar')).toBeNull();
      expect(mockListarCobros).not.toHaveBeenCalled();
    });
  });
});

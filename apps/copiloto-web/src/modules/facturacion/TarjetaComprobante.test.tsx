import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { EstadoFacturaResp, ResultadoEmision } from '@copiloto/core';

import { TarjetaComprobante } from './TarjetaComprobante';

function resultadoMock(over: Partial<ResultadoEmision> = {}): ResultadoEmision {
  return {
    ok: true,
    duplicado: false,
    cae: '75239876543210',
    caeVto: '2026-10-15',
    nro: 42,
    tipoCbte: 6,
    puntoVenta: 1,
    id: null,
    alertaDobleEmision: false,
    ...over,
  };
}

function estadoMock(over: Partial<EstadoFacturaResp> = {}): EstadoFacturaResp {
  return {
    estado: 'entregada',
    faltantes: [],
    items: [],
    total: '1000.00',
    tokenConfirmacion: null,
    resultado: resultadoMock(),
    pdf: { url: 'https://example.test/factura.pdf', nombre: 'factura.pdf', expiraAt: null },
    drive: null,
    receptor: null,
    datosVenta: null,
    motivo: null,
    motivoCodigo: null,
    terminado: true,
    ...over,
  };
}

describe('TarjetaComprobante — alerta_doble_emision', () => {
  // B-1, caso false/ausente: es el control. Un banner que se muestra siempre es indistinguible de
  // uno que funciona, y este es el caso que corre en producción el 99,99% del tiempo.
  it('NO muestra la alerta cuando alertaDobleEmision es false', () => {
    render(
      <TarjetaComprobante
        estado={estadoMock({ resultado: resultadoMock({ alertaDobleEmision: false }) })}
        onNuevaFactura={vi.fn()}
      />,
    );
    expect(screen.queryByTestId('facturacion-comprobante-alerta-doble-emision')).not.toBeInTheDocument();
  });

  it('NO muestra la alerta cuando no hay resultado', () => {
    render(<TarjetaComprobante estado={estadoMock({ resultado: null })} onNuevaFactura={vi.fn()} />);
    expect(screen.queryByTestId('facturacion-comprobante-alerta-doble-emision')).not.toBeInTheDocument();
  });

  // B-1, caso true: la carrera de idem_key detectada -- test_afip_idem_key_carrera.py:75-90 del lado
  // backend, ver el docstring de `ResultadoEmision.alertaDobleEmision`.
  it('muestra la alerta cuando alertaDobleEmision es true', () => {
    render(
      <TarjetaComprobante
        estado={estadoMock({ resultado: resultadoMock({ alertaDobleEmision: true }) })}
        onNuevaFactura={vi.fn()}
      />,
    );
    expect(screen.getByTestId('facturacion-comprobante-alerta-doble-emision')).toHaveTextContent(
      'Se emitieron dos comprobantes para esta factura.',
    );
  });
});

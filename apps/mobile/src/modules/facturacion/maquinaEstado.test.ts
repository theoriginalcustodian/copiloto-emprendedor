import type { EstadoFacturaResp } from '@copiloto/core';

import { derivarPasoVisible, esRechazoPorFaltaDeCertificado } from './maquinaEstado';

function estadoMock(over: Partial<EstadoFacturaResp> = {}): EstadoFacturaResp {
  return {
    estado: 'borrador',
    faltantes: [],
    items: [],
    total: '0.00',
    tokenConfirmacion: null,
    resultado: null,
    pdf: null,
    drive: null,
    receptor: null,
    datosVenta: null,
    motivo: null,
    motivoCodigo: null,
    terminado: false,
    ...over,
  };
}

describe('derivarPasoVisible', () => {
  it.each([
    ['borrador', 'datos_venta'],
    ['datos_venta_ok', 'items'],
    ['items_ok', 'cliente'],
    ['cliente_ok', 'cliente'],
    ['esperando_confirmacion', 'resumen'],
    ['emitiendo', 'emitiendo'],
    ['emitida', 'comprobante'],
    ['entregada', 'comprobante'],
    ['cancelada', 'cancelada'],
  ] as const)('%s -> %s', (estado, esperado) => {
    expect(derivarPasoVisible(estadoMock({ estado }))).toBe(esperado);
  });

  it('rechazada + motivoCodigo=sin_certificado_afip -> configurar_rechazo (red de seguridad, NUNCA "rechazada")', () => {
    const paso = derivarPasoVisible(estadoMock({ estado: 'rechazada', motivoCodigo: 'sin_certificado_afip' }));
    expect(paso).toBe('configurar_rechazo');
  });

  it('rechazada con cualquier otro motivoCodigo -> rechazada (rechazo fiscal real)', () => {
    const paso = derivarPasoVisible(
      estadoMock({ estado: 'rechazada', motivoCodigo: 'rechazo_afip', motivo: 'AFIP rechazó el comprobante' }),
    );
    expect(paso).toBe('rechazada');
  });

  it('ramifica por motivoCodigo, NO por la frase de motivo -- un motivo en español no se confunde con el código', () => {
    // `motivo` podría (por error del backend) traer texto parecido, pero sólo `motivoCodigo` decide.
    const paso = derivarPasoVisible(
      estadoMock({ estado: 'rechazada', motivo: 'sin_certificado_afip', motivoCodigo: 'rechazo_afip' }),
    );
    expect(paso).toBe('rechazada');
  });

  it('un estado desconocido (unión abierta) no crashea -- devuelve "desconocido"', () => {
    const paso = derivarPasoVisible(estadoMock({ estado: 'un_estado_que_todavia_no_existe' }));
    expect(paso).toBe('desconocido');
  });
});

describe('esRechazoPorFaltaDeCertificado', () => {
  it('true sólo con estado=rechazada Y motivoCodigo=sin_certificado_afip', () => {
    expect(
      esRechazoPorFaltaDeCertificado(estadoMock({ estado: 'rechazada', motivoCodigo: 'sin_certificado_afip' })),
    ).toBe(true);
  });

  it('false si es rechazada pero con otro motivoCodigo', () => {
    expect(
      esRechazoPorFaltaDeCertificado(estadoMock({ estado: 'rechazada', motivoCodigo: 'rechazo_afip' })),
    ).toBe(false);
  });

  it('false si no está rechazada', () => {
    expect(esRechazoPorFaltaDeCertificado(estadoMock({ estado: 'borrador' }))).toBe(false);
  });
});

import type { Presupuesto } from '@copiloto/core';

import { aCentavos, centavosADecimal, chipResumenEspera, etiquetaEstado, resumenEspera } from './resumenEspera';

function p(over: Partial<Presupuesto>): Presupuesto {
  return {
    id: 1, numero: 1, total: '0.00', estado: null, sinRespuesta: null, reemplazadoPor: null,
    ...over,
  } as Presupuesto;
}

describe('resumenEspera (mapeo `presu`)', () => {
  it('suma en centavos exactos, sin float: 0.10 + 0.20 = 0.30', () => {
    expect(aCentavos('0.10') + aCentavos('0.20')).toBe(30);
    expect(centavosADecimal(30)).toBe('0.30');
    expect(aCentavos('325000.00')).toBe(32500000);
    expect(aCentavos('12')).toBe(1200);
    expect(aCentavos('basura')).toBe(0);
  });

  it('🔴 ningún presupuesto trae `estado` → null: no se afirma «$0 esperando» sobre un dato que no llegó', () => {
    expect(resumenEspera([p({ total: '100.00' }), p({ id: 2, total: '50.00' })])).toBeNull();
  });

  it('cuenta pendientes (monto), sin contestar y aceptados; ignora desestimados y reemplazados', () => {
    const r = resumenEspera([
      p({ id: 1, estado: 'pendiente', total: '200000.00', sinRespuesta: true }),
      p({ id: 2, estado: 'pendiente', total: '125000.00', sinRespuesta: false }),
      p({ id: 3, estado: 'aprobado', total: '999.00' }),
      p({ id: 4, estado: 'desestimado', total: '777.00' }),
      p({ id: 5, estado: 'pendiente', total: '5000.00', reemplazadoPor: 9 }),
    ]);
    expect(r).toEqual({ centavosEsperando: 32500000, sinContestar: 1, aceptados: 1 });
    expect(chipResumenEspera(r!)).toBe('1 sin contestar · 1 aceptado');
  });

  it('el chip omite lo que es cero y pluraliza', () => {
    expect(chipResumenEspera({ centavosEsperando: 0, sinContestar: 0, aceptados: 0 })).toBeUndefined();
    expect(chipResumenEspera({ centavosEsperando: 0, sinContestar: 2, aceptados: 3 })).toBe('2 sin contestar · 3 aceptados');
  });
});

describe('etiquetaEstado (mapeo `presu`: el estado de la fila)', () => {
  it('🔴 `estado: null` no es «pendiente»: sin dato no hay etiqueta', () => {
    expect(etiquetaEstado(p({ estado: null }))).toBeNull();
  });

  it('un reemplazado no muestra estado propio', () => {
    expect(etiquetaEstado(p({ estado: 'pendiente', reemplazadoPor: 9 }))).toBeNull();
  });

  it('aprobado → Aceptado (tono éxito)', () => {
    expect(etiquetaEstado(p({ estado: 'aprobado' }))).toEqual({ texto: 'Aceptado', tono: 'exito' });
  });

  it('pendiente distingue «sin respuesta hace más de un mes» de «esperando»', () => {
    expect(etiquetaEstado(p({ estado: 'pendiente', sinRespuesta: true }))?.texto).toBe('Sin respuesta hace más de un mes');
    expect(etiquetaEstado(p({ estado: 'pendiente', sinRespuesta: false }))?.texto).toBe('Esperando respuesta');
    // `sinRespuesta: null` = el backend no lo calculó → NO se afirma que se enfrió.
    expect(etiquetaEstado(p({ estado: 'pendiente', sinRespuesta: null }))?.texto).toBe('Esperando respuesta');
  });

  it('desestimado → Desestimado', () => {
    expect(etiquetaEstado(p({ estado: 'desestimado' }))?.texto).toBe('Desestimado');
  });
});

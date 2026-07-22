import { describe, expect, it } from 'vitest';

import { leerClientePropuesto } from './clientePropuesto';
import type { ReplyCard } from '../api/types';

/** La card TAL COMO SALE DEL VIVO — capturada por backend del `/reply` real, no inventada acá. */
function cardReal(over: Record<string, unknown> = {}): ReplyCard {
  return {
    kind: 'cliente_propuesto',
    data: {
      nombre: 'Ferretería El Tornillo',
      doc_tipo: 80,
      doc_nro: '30712345678',
      condicion_iva: null,
      domicilio: null,
      email: null,
      telefono: null,
      notas: null,
      origen: 'voz',
      ...over,
    },
  } as ReplyCard;
}

describe('leerClientePropuesto', () => {
  it('lee la card medida del vivo, tal cual', () => {
    expect(leerClientePropuesto(cardReal())).toEqual({
      nombre: 'Ferretería El Tornillo',
      docTipo: 80,
      docNro: '30712345678',
      condicionIva: null,
      domicilio: null,
      email: null,
      telefono: null,
      notas: null,
      origen: 'voz',
    });
  });

  it('🔴 `doc_tipo: null` con `doc_nro` LLENO se conserva — no se limpia', () => {
    // Backend lo manda así a propósito cuando el dictado no da 11 ni 7-8 dígitos: el número viaja
    // para que el emprendedor lo corrija. Borrarlo acá haría desaparecer el error JUNTO CON el dato,
    // y el alta saldría "bien" con un cliente sin documento que él creyó haber cargado.
    const r = leerClientePropuesto(cardReal({ doc_tipo: null, doc_nro: '3071234' }));

    expect(r).toMatchObject({ docTipo: null, docNro: '3071234' });
  });

  it('🔴 un `doc_tipo: 99` se descarta pero el NÚMERO se conserva', () => {
    // 99 es "consumidor final" y un CLIENTE nunca vale 99: es el registro fantasma que §3.2 evita.
    // Se tira el tipo, no el dato — elegir cuál es, es justo para lo que sirve la card.
    const r = leerClientePropuesto(cardReal({ doc_tipo: 99, doc_nro: '30712345678' }));

    expect(r).toMatchObject({ docTipo: null, docNro: '30712345678' });
  });

  it('🔴 `origen: voz` no se pisa, y un origen inventado por el LLM cae en `voz`', () => {
    // Es lo que después responde "¿la cartera se armó sola o la cargaron?". Vino de un dictado.
    expect(leerClientePropuesto(cardReal())?.origen).toBe('voz');
    expect(leerClientePropuesto(cardReal({ origen: 'telepatia' }))?.origen).toBe('voz');
    // Y si el backend algún día manda otro válido, se respeta.
    expect(leerClientePropuesto(cardReal({ origen: 'manual' }))?.origen).toBe('manual');
  });

  it('sin nombre NO hay card — es lo único que el backend exige', () => {
    // Pintar un formulario vacío sería pedirle que tipee lo que ya dictó.
    expect(leerClientePropuesto(cardReal({ nombre: '' }))).toBeNull();
    expect(leerClientePropuesto(cardReal({ nombre: '   ' }))).toBeNull();
    expect(leerClientePropuesto(cardReal({ nombre: null }))).toBeNull();
  });

  it('otra card, o ninguna, devuelve null', () => {
    expect(leerClientePropuesto(undefined)).toBeNull();
    expect(leerClientePropuesto({ kind: 'gasto_propuesto', data: {} } as ReplyCard)).toBeNull();
    expect(leerClientePropuesto({ kind: 'cliente_propuesto', data: null } as unknown as ReplyCard)).toBeNull();
  });

  it('un `doc_tipo` que llegue como string se lee, no se descarta', () => {
    expect(leerClientePropuesto(cardReal({ doc_tipo: '96' }))?.docTipo).toBe(96);
  });
});

import { describe, expect, it } from 'vitest';

import { avisoAlChat, ROTULO_DESDE_TU_AVISO, type TarjetaParaChat } from './avisoAlChat';

const tarjeta = (over: Partial<TarjetaParaChat> = {}): TarjetaParaChat => ({
  texto: 'Hace 12 días que le mandaste el presupuesto a Lucía y no te respondió.',
  regla: 'presupuestos_enfriandose',
  verbo: 'Mandarle un recordatorio',
  categoria: 'presupuestos',
  cliente: 'Lucía',
  ...over,
});

describe('avisoAlChat — el puente tarjeta → chat (hitl a, C-D5 Opción A)', () => {
  it('siembra el aviso + la acción, y el chip nombra categoría y cliente (como el prototipo)', () => {
    const a = avisoAlChat(tarjeta());
    expect(a).not.toBeNull();
    expect(a!.texto).toContain('Hace 12 días que le mandaste el presupuesto a Lucía');
    expect(a!.texto).toContain('Mandarle un recordatorio');
    expect(a!.contexto).toBe('Desde tu aviso · Presupuestos · Lucía');
  });

  it('🔴 la tarjeta MANUAL no tiene puente: su verbo («Borrar») es sobre la tarjeta, no un pedido al agente', () => {
    expect(avisoAlChat(tarjeta({ regla: null, verbo: 'Borrar', categoria: 'tuyas' }))).toBeNull();
  });

  it('sin verbo no hay puente (nada que ofrecer)', () => {
    expect(avisoAlChat(tarjeta({ verbo: null }))).toBeNull();
    expect(avisoAlChat(tarjeta({ verbo: '   ' }))).toBeNull();
  });

  it('🔴 el chip no inventa: sin cliente y sin categoría queda «Desde tu aviso» a secas', () => {
    const a = avisoAlChat(tarjeta({ cliente: null, categoria: null }));
    expect(a!.contexto).toBe(ROTULO_DESDE_TU_AVISO);
  });

  it('una categoría que el cliente no conoce no se pinta cruda; «todo» no es una categoría de tarjeta', () => {
    expect(avisoAlChat(tarjeta({ categoria: 'lo-que-sea' }))!.contexto).toBe('Desde tu aviso · Lucía');
    expect(avisoAlChat(tarjeta({ categoria: 'todo' }))!.contexto).toBe('Desde tu aviso · Lucía');
  });

  it('el contexto es sólo del chip: no entra en el texto que viaja', () => {
    const a = avisoAlChat(tarjeta())!;
    expect(a.texto).not.toContain('Desde tu aviso');
  });
});

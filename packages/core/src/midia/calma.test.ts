import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  DIAS_PARA_RETIRAR_EXPLICACION,
  fechaLocalISO,
  mostrarExplicacion,
  parsearDiasVistos,
  registrarDiaVisto,
} from './calma';

/** Simula N visitas, cada una en un instante dado, con el almacén en memoria y el reloj simulado. */
function visitar(instantes: string[]): readonly string[] {
  let dias: readonly string[] = [];
  for (const iso of instantes) {
    vi.setSystemTime(new Date(iso));
    dias = registrarDiaVisto(dias, fechaLocalISO(new Date()));
  }
  return dias;
}

afterEach(() => vi.useRealTimers());

describe('Calma — retiro progresivo de la explicación (BL-W5)', () => {
  it('N es 3 (DEC-10) y es una constante única', () => {
    expect(DIAS_PARA_RETIRAR_EXPLICACION).toBe(3);
  });

  it('🔴 5 visitas el MISMO día no cuentan como 5: la explicación sigue', () => {
    vi.useFakeTimers();
    const dias = visitar([
      '2026-09-21T09:00:00', '2026-09-21T10:00:00', '2026-09-21T12:30:00',
      '2026-09-21T15:00:00', '2026-09-21T18:45:00',
    ]);
    expect(dias).toEqual(['2026-09-21']);
    expect(mostrarExplicacion(dias)).toBe(true);
  });

  it('con 2 días distintos todavía explica; al tercero se retira', () => {
    vi.useFakeTimers();
    const dosDias = visitar(['2026-09-21T09:00:00', '2026-09-22T09:00:00']);
    expect(mostrarExplicacion(dosDias)).toBe(true);

    const tresDias = visitar(['2026-09-21T09:00:00', '2026-09-22T09:00:00', '2026-09-23T09:00:00']);
    expect(tresDias).toHaveLength(DIAS_PARA_RETIRAR_EXPLICACION);
    expect(mostrarExplicacion(tresDias)).toBe(false);
  });

  it('una vez retirada no vuelve aunque siga visitando (los días sólo se suman)', () => {
    vi.useFakeTimers();
    const dias = visitar([
      '2026-09-21T09:00:00', '2026-09-22T09:00:00', '2026-09-23T09:00:00', '2026-09-23T20:00:00',
    ]);
    expect(mostrarExplicacion(dias)).toBe(false);
  });

  it('🔴 el día es el LOCAL del dispositivo: 23:30 y 00:30 locales son días distintos, sin importar UTC', () => {
    vi.useFakeTimers();
    // Sin sufijo `Z`: instantes en hora LOCAL. Con `toISOString()` (UTC) en Argentina, 22:00 local ya
    // caería en el día siguiente y este par de visitas de la misma tarde contaría como dos días.
    const mismaTarde = visitar(['2026-09-21T19:00:00', '2026-09-21T22:30:00']);
    expect(mismaTarde).toEqual(['2026-09-21']);
    const cruzaMedianoche = visitar(['2026-09-21T23:30:00', '2026-09-22T00:30:00']);
    expect(cruzaMedianoche).toEqual(['2026-09-21', '2026-09-22']);
  });

  it('registrarDiaVisto devuelve la MISMA referencia si el día ya estaba (evita escrituras de más)', () => {
    const dias = ['2026-09-21'];
    expect(registrarDiaVisto(dias, '2026-09-21')).toBe(dias);
  });

  it('parsearDiasVistos tolera basura: sin dato, JSON roto o tipo equivocado => lista vacía', () => {
    expect(parsearDiasVistos(null)).toEqual([]);
    expect(parsearDiasVistos(undefined)).toEqual([]);
    expect(parsearDiasVistos('{no es json')).toEqual([]);
    expect(parsearDiasVistos('{"a":1}')).toEqual([]);
    expect(parsearDiasVistos('["2026-09-21", 5, null]')).toEqual(['2026-09-21']);
  });
});

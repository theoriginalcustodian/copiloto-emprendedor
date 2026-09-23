import { describe, expect, it } from 'vitest';

import type { ChatMessage } from './chatMachine';
import { diaArgentina, etiquetaDia, parsearFecha, separadoresDeDia } from './separadoresFecha';

// 2026-09-21 12:00 en Buenos Aires = 15:00Z
const AHORA = Date.UTC(2026, 8, 21, 15, 0, 0);
const msg = (id: string, creadoEn?: number): ChatMessage => ({ id, role: 'user', text: id, creadoEn });

describe('separadoresDeDia (BL-C3)', () => {
  it('un separador por cambio de día, incluido el primero: Ayer / Hoy', () => {
    const mapa = separadoresDeDia(
      [msg('a', Date.UTC(2026, 8, 20, 15)), msg('b', Date.UTC(2026, 8, 20, 16)), msg('c', AHORA)],
      AHORA,
    );
    expect([...mapa.entries()]).toEqual([['a', 'Ayer'], ['c', 'Hoy']]);
  });

  it('borde de medianoche en Buenos Aires: 02:59:59Z sigue siendo el día anterior, 03:00:00Z ya es el nuevo', () => {
    const antes = Date.UTC(2026, 8, 21, 2, 59, 59); // 23:59:59 del 20 en BA
    const despues = Date.UTC(2026, 8, 21, 3, 0, 0); // 00:00:00 del 21 en BA
    expect(diaArgentina(despues) - diaArgentina(antes)).toBe(1);
    const mapa = separadoresDeDia([msg('a', antes), msg('b', despues)], AHORA);
    expect([...mapa.values()]).toEqual(['Ayer', 'Hoy']);
  });

  it('control positivo del borde: dos mensajes dentro del mismo día BA NO abren separador nuevo', () => {
    const mapa = separadoresDeDia(
      [msg('a', Date.UTC(2026, 8, 21, 3, 0, 0)), msg('b', Date.UTC(2026, 8, 22, 2, 59, 59))],
      AHORA,
    );
    expect(mapa.size).toBe(1);
  });

  it('fecha larga con día de semana; con año si no es el actual', () => {
    expect(etiquetaDia(diaArgentina(Date.UTC(2026, 8, 15, 15)), AHORA)).toBe('martes 15 de septiembre');
    expect(etiquetaDia(diaArgentina(Date.UTC(2025, 11, 31, 15)), AHORA)).toBe('miércoles 31 de diciembre de 2025');
  });

  it('un mensaje sin fecha no abre separador y hereda el día anterior', () => {
    const mapa = separadoresDeDia([msg('a', AHORA), msg('b'), msg('c', AHORA)], AHORA);
    expect([...mapa.keys()]).toEqual(['a']);
  });
});


describe('parsearFecha — formato real de reply_store (`str(datetime)` de Python)', () => {
  it('con microsegundos y offset +00:00', () => {
    expect(parsearFecha('2026-09-21 15:00:00.123456+00:00')).toBe(Date.UTC(2026, 8, 21, 15, 0, 0, 123));
  });
  it('con offset distinto de cero lo respeta', () => {
    expect(parsearFecha('2026-09-21 12:00:00-03:00')).toBe(Date.UTC(2026, 8, 21, 15, 0, 0));
  });
  it('ISO con Z y sin fracción; basura -> undefined', () => {
    expect(parsearFecha('2026-09-21T15:00:00Z')).toBe(Date.UTC(2026, 8, 21, 15));
    expect(parsearFecha('t')).toBeUndefined(); // el valor que usan los tests de reply_store
    expect(parsearFecha(undefined)).toBeUndefined();
  });
});

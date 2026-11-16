import {
  leerArtefactoEnlace,
  leerGastoPropuesto,
  leerIngresoPropuesto,
  leerLinkDeCobro,
  leerPresupuestoPropuesto,
  leerRecibo,
} from '@copiloto/core';

import { hiloDemo } from './hiloDemo';
import { respuestaDemo } from './respuestasDemo';

jest.mock('../modules/chat/useChat', () => ({ sembrarHiloLocal: jest.fn() }));

describe('hilo de ejemplo del modo demo', () => {
  const ahora = new Date(2026, 10, 15, 14, 0).getTime();
  const hilo = hiloDemo(ahora);

  it('cada tarjeta la reconoce su lector: ninguna cae a burbuja de texto', () => {
    const lectores = [leerGastoPropuesto, leerLinkDeCobro, leerPresupuestoPropuesto, leerRecibo, leerArtefactoEnlace, leerIngresoPropuesto];
    const conTarjeta = hilo.filter((m) => m.card != null);
    expect(conTarjeta.length).toBeGreaterThanOrEqual(7);
    for (const m of conTarjeta) {
      expect(lectores.some((leer) => leer(m.card) != null)).toBe(true);
    }
  });

  it('va en orden, sin mensajes en el futuro y con ids únicos', () => {
    const tiempos = hilo.map((m) => m.creadoEn ?? 0);
    expect([...tiempos].sort((a, b) => a - b)).toEqual(tiempos);
    expect(Math.max(...tiempos)).toBeLessThan(ahora);
    expect(new Set(hilo.map((m) => m.id)).size).toBe(hilo.length);
  });

  it('el presupuesto guardado existe en los datos de ejemplo: la tarjeta lo vuelve a leer por su id', () => {
    const guardado = hilo.find((m) => m.presupuestoResuelto?.estado === 'guardado')?.presupuestoResuelto;
    const id = guardado?.estado === 'guardado' ? guardado.id : undefined;
    expect(respuestaDemo({ metodo: 'GET', path: `/presupuestos/${id}`, headers: {} })).toBeDefined();
  });
});

import { describe, expect, it } from 'vitest';

import { TABS } from '../../shell/TabBar';
import { FUNCION_A_TAB } from '../../shell/funcionTabMap';
import { TILES } from './EscritorioScreen';

/** BL-X2 (DA-2): 6 funciones. Contabilidad se fusionó en Inteligencia y no debe reaparecer. */
describe('BL-X2 — seis funciones, sin Contabilidad', () => {
  it('el escritorio tiene exactamente 6 tiles y ninguno es contabilidad', () => {
    expect(TILES.map((t) => t.key)).toEqual([
      'facturacion',
      'ingresos',
      'gastos',
      'presupuestos',
      'clientes',
      'inteligencia',
    ]);
  });

  it('ningún tab ni mapeo apunta a contabilidad', () => {
    expect(TABS.some((t) => (t.key as string) === 'contabilidad')).toBe(false);
    expect(Object.keys(FUNCION_A_TAB)).not.toContain('contabilidad');
  });
});

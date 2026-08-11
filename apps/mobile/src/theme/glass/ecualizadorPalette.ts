/**
 * Paleta del ecualizador estático del botón de voz — **datos de color puros, sin lógica**, mismo
 * criterio de admisión que `ondaPalette.ts` en `temaSinHex.test.ts`: el degradé dorado→terracota es
 * intrínseco de este widget puntual (medido del mock, no del tema activo) y no cambia con el skin.
 *
 * Valores y alturas tomados literalmente del contrato ODOBI8 §B (mock Claude Design, sección
 * "Home" — el widget que combina barras + botón). 7 barras, `width:3 · borderRadius:2 · gap:3`,
 * contenedor `height:26`, crecen desde la base (`alignItems:'flex-end'`). Estático: no reactivo al
 * nivel de audio real (excluido explícitamente por el DoD del sprint ODOBI, línea 358).
 */
export interface BarraEcualizador {
  altura: number;
  color: string;
}

export const ECUALIZADOR_BARRAS: readonly BarraEcualizador[] = [
  { altura: 11, color: '#C6952E' },
  { altura: 21, color: '#C2452E' },
  { altura: 15, color: '#C6952E' },
  { altura: 25, color: '#8E2A1C' },
  { altura: 13, color: '#C6952E' },
  { altura: 19, color: '#C2452E' },
  { altura: 10, color: '#C6952E' },
];

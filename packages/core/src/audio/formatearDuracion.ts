/**
 * `7` → `'0:07'`, `75` → `'1:15'`. El formato del chip «Por voz · 0:07» del prototipo (`vozchat`,
 * mapeo 2026-10-12), compartido por la burbuja del chat y el chip del dictado, en mobile **y en web**, desde una sola
 * función: antes cada una armaba su propio «7s» y no había una sola definición del formato.
 *
 * Segundos enteros ≥ 0; un valor negativo o no finito se trata como 0 (no hay duración negativa).
 */
export function formatearDuracion(segundos: number): string {
  const total = Number.isFinite(segundos) && segundos > 0 ? Math.floor(segundos) : 0;
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

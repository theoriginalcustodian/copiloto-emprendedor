/**
 * Formato de los dos campos de `caja` que K-03 suma a la portada (BL-J2 / BL-J3) — compartido por web
 * y mobile para que la misma fecha y el mismo porcentaje se lean igual en las dos.
 *
 * **La cuenta la hace el backend** (una sola definición del número, ver `inteligencia_queries.py`):
 * acá sólo se DIBUJA. Nunca se recalcula la variación con la serie mensual.
 */

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

/**
 * «2026-08-19» → «Al 19 de agosto». Se parte el string en vez de `new Date(iso)`: un `YYYY-MM-DD` se
 * parsea como UTC medianoche y en Argentina (UTC−3) mostraría el día anterior. Devuelve `null` si el
 * valor no es una fecha ISO válida — el llamador omite la etiqueta, no inventa una.
 */
export function formatearFechaCorte(iso: string | null): string | null {
  if (iso == null) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (m == null) return null;
  const mes = Number(m[2]);
  const dia = Number(m[3]);
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;
  return `Al ${dia} de ${MESES[mes - 1]}`;
}

/**
 * «-18.0» → «−18% vs mes anterior»; «5.3» → «+5,3% vs mes anterior». `null` (sin mes anterior completo
 * con datos, o base cero) → `null`: la portada omite el chip ENTERO — ni «0%» ni «—» (K-03 §2).
 * Signo con el menos tipográfico (U+2212), como el prototipo; coma decimal es-AR; un decimal sólo si
 * no es entero.
 */
export function formatearVariacion(pct: string | null): string | null {
  if (pct == null) return null;
  const n = Number(pct);
  if (!Number.isFinite(n)) return null;
  const abs = Math.abs(n);
  const cuerpo = Number.isInteger(abs) ? String(abs) : abs.toFixed(1).replace('.', ',');
  const signo = n > 0 ? '+' : n < 0 ? '−' : '';
  return `${signo}${cuerpo}% vs mes anterior`;
}

/**
 * El chip bajo «En caja»: «Al 19 de agosto · −18% vs mes anterior». Cada mitad se omite si falta;
 * si faltan las dos → `null` y no hay chip. Un solo texto para que web y mobile digan lo mismo.
 */
export function chipDeCaja(caja: {
  fechaCorte: string | null;
  variacionPct: string | null;
  incompleta?: boolean;
}): string | null {
  // K-09: con una conexión caída la comparación contra el mes anterior sería falsa — no se dibuja.
  const variacion = caja.incompleta === true ? null : formatearVariacion(caja.variacionPct);
  const partes = [formatearFechaCorte(caja.fechaCorte), variacion].filter(
    (p): p is string => p != null,
  );
  return partes.length > 0 ? partes.join(' · ') : null;
}

/**
 * El aviso de K-09 bajo el saldo cuando `caja.incompleta`: dice qué falta, no un error genérico.
 *
 * 🔴 **Nombra Mercado Pago explícitamente (BL-W11 fila 4c).** `caja.incompleta` sólo se prende con
 * la salud de MP (`inteligencia_queries.py:210` — la única conexión que este número depende), así
 * que "una conexión" era vago sobre un hecho que el backend ya sabe con precisión: cuál. Nombrarla
 * le dice al emprendedor DÓNDE ir a reconectar, no sólo que algo se cayó.
 */
export const AVISO_CAJA_INCOMPLETA =
  'Se cayó la conexión con Mercado Pago: faltan los cobros de hoy, así que estos números pueden estar incompletos.';

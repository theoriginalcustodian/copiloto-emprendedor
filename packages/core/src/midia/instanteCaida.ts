/**
 * El instante de una conexión caída (`datos.desde` de la tarjeta `conexion_caida`) en una línea:
 * «Hoy, 9:12» · «Ayer, 21:40» · «12 de octubre, 9:12». Es el kv «Se cayó» del prototipo
 * (`index.html:3658`, `<div class="kv"><span>Se cayó</span><b>Hoy, 9:12</b></div>`).
 *
 * 🔴 **Un instante real o nada.** El backend manda `datos.desde` SÓLO cuando conoce cuándo se cayó
 * (`mi_dia_detector.py:270`; Composio no guarda el instante, así que ahí el campo está ausente, no `null`).
 * Si no es un instante parseable devuelve `null` y quien llama omite la fila entera: **jamás se rellena con
 * `creada_en`**, que es cuándo corrió el detector, no cuándo cayó la conexión — pintarla sería inventar la
 * hora de la caída.
 *
 * Misma política que `fechaMiDia.ts`: arrays propios, sin `Intl.DateTimeFormat` (Hermes no garantiza la
 * base de locale/huso en todos los devices, y las dos plataformas tienen que decir IDÉNTICO). El día y la
 * hora son los del reloj del dispositivo, que es lo que el emprendedor mira.
 */
const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

const MS_DIA = 24 * 60 * 60 * 1000;

function inicioDelDia(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export function formatearInstanteDeCaida(iso: string | null | undefined, ahora: Date = new Date()): string | null {
  if (typeof iso !== 'string' || iso.trim() === '') return null;
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return null;

  const hora = `${t.getHours()}:${String(t.getMinutes()).padStart(2, '0')}`;
  // Diferencia en días CALENDARIO (no en múltiplos de 24 h): una caída de las 23:50 es «Ayer» a las 00:10.
  const dias = Math.round((inicioDelDia(ahora) - inicioDelDia(t)) / MS_DIA);
  if (dias === 0) return `Hoy, ${hora}`;
  if (dias === 1) return `Ayer, ${hora}`;
  return `${t.getDate()} de ${MESES[t.getMonth()]}, ${hora}`;
}

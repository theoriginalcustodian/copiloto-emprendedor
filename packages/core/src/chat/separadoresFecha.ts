import type { ChatMessage } from './chatMachine';

/**
 * Separadores de día del historial (BL-C3) — puro, sin DOM ni `Intl`.
 *
 * El día se calcula con el offset fijo de Argentina (UTC−3, sin horario de verano desde 2009) en vez
 * de `Intl.DateTimeFormat({timeZone})`: Hermes no garantiza la base de husos en todos los devices y
 * un separador que cambia según el runtime es el bug que este módulo existe para evitar. La
 * medianoche relevante es la de `America/Argentina/Buenos_Aires`, no la del teléfono del usuario.
 */
const OFFSET_ARG_MS = -3 * 60 * 60 * 1000;
const DIA_MS = 24 * 60 * 60 * 1000;

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];
const DIAS_SEMANA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

/** Número de día (días desde 1970-01-01, hora Buenos Aires) de un instante en ms epoch. */
export function diaArgentina(ms: number): number {
  return Math.floor((ms + OFFSET_ARG_MS) / DIA_MS);
}

/** «Hoy», «Ayer» o «lunes 15 de septiembre» (con el año si no es el actual). */
export function etiquetaDia(dia: number, ahoraMs: number): string {
  const hoy = diaArgentina(ahoraMs);
  if (dia === hoy) return 'Hoy';
  if (dia === hoy - 1) return 'Ayer';
  const fecha = new Date(dia * DIA_MS); // medianoche UTC del día calendario: getUTC* lo lee exacto
  const base = `${DIAS_SEMANA[fecha.getUTCDay()]} ${fecha.getUTCDate()} de ${MESES[fecha.getUTCMonth()]}`;
  const anioActual = new Date(hoy * DIA_MS).getUTCFullYear();
  return fecha.getUTCFullYear() === anioActual ? base : `${base} de ${fecha.getUTCFullYear()}`;
}

/**
 * Mapa `id del mensaje → etiqueta` con una entrada por cada CAMBIO de día: el primer mensaje con
 * fecha y cada uno cuyo día difiere del último mensaje fechado anterior. Los mensajes sin `creadoEn`
 * (historial persistido antes de este cambio, replies sin `created_at`) no abren separador: se
 * agrupan con el día anterior.
 */
export function separadoresDeDia(mensajes: ChatMessage[], ahoraMs: number): Map<string, string> {
  const separadores = new Map<string, string>();
  let diaPrevio: number | null = null;
  for (const mensaje of mensajes) {
    if (mensaje.creadoEn === undefined) continue;
    const dia = diaArgentina(mensaje.creadoEn);
    if (dia !== diaPrevio) {
      separadores.set(mensaje.id, etiquetaDia(dia, ahoraMs));
      diaPrevio = dia;
    }
  }
  return separadores;
}

/**
 * `reply_store` manda `str(datetime)` de Python: `2026-09-21 15:00:00.123456+00:00` (espacio, no `T`;
 * microsegundos). No se le da eso a `Date.parse`: Hermes sólo garantiza el ISO estricto. Se parsea a
 * mano; sin offset se asume UTC. `undefined` si no calza — el mensaje queda sin fecha, nunca con una
 * inventada.
 */
export function parsearFecha(texto?: string): number | undefined {
  if (!texto) return undefined;
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?(?:Z|([+-])(\d{2}):?(\d{2}))?$/.exec(texto.trim());
  if (!m) return undefined;
  const ms = Number(((m[7] ?? '0') + '00').slice(0, 3));
  const offsetMin = m[8] ? (m[8] === '-' ? -1 : 1) * (Number(m[9]) * 60 + Number(m[10])) : 0;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6]), ms) - offsetMin * 60_000;
}

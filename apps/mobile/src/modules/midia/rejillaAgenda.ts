import { instanteDeEvento, type EventoAgenda } from '@copiloto/core';

/**
 * La rejilla horaria de «Hoy» en Agenda, igual que el prototipo (`prototipo/index.html?ver=agenda`,
 * `.cal`/`.rejilla`/`.bcal`, líneas 1469-1500 y 2515-2525): 76 px por hora, desde las 8:00 hasta las 19:00 como
 * mínimo, cada evento un bloque posicionado por su inicio y alto por su duración.
 *
 * Matemática pura: el componente sólo pinta lo que sale de acá. La rejilla se EXTIENDE a las horas que de verdad
 * tienen eventos o a la hora actual — no se recorta un evento a las 7:00 ni se esconde la línea del ahora.
 */
export const PX_POR_HORA = 76;
export const HORA_INICIO_MIN = 8;
export const HORA_FIN_MIN = 19;
/** Alto mínimo de un bloque (`.bcal` de 30 min mide ~25 px en el prototipo; 34 deja leer el título). */
export const ALTO_MIN_BLOQUE = 34;
/** Bajo este alto el subtítulo no entra (`.bcal.corto span{display:none}`). */
export const ALTO_CORTO = 60;
/** Sin hora de fin legible, el bloque dura una hora. */
const DURACION_DEFECTO_MIN = 60;

export interface BloqueRejilla {
  id: string;
  titulo: string;
  top: number;
  alto: number;
  corto: boolean;
  /** Inicio y fin en minutos desde las 00:00, para armar el rótulo sin volver a parsear. */
  iniMin: number;
  finMin: number;
}

export interface Rejilla {
  horas: number[];
  /** Alto total del área de bloques, en px. */
  alto: number;
  bloques: BloqueRejilla[];
  /** `null` si ahora cae fuera de la rejilla (no pasa: la rejilla se extiende hasta cubrirlo). */
  ahoraTop: number | null;
  /** Eventos de hoy que no tienen hora (día completo o forma ilegible): no van en la rejilla. */
  sinHora: EventoAgenda[];
}

const minutosDelDia = (t: number): number => {
  const d = new Date(t);
  return d.getHours() * 60 + d.getMinutes();
};

export function armarRejilla(eventos: readonly EventoAgenda[], ahora: Date): Rejilla {
  const conHora: { ev: EventoAgenda; ini: number; fin: number }[] = [];
  const sinHora: EventoAgenda[] = [];
  for (const ev of eventos) {
    const t = ev.diaCompleto ? null : instanteDeEvento(ev.inicioCrudo);
    if (t == null) {
      sinHora.push(ev);
      continue;
    }
    const ini = minutosDelDia(t);
    const tf = instanteDeEvento(ev.finCrudo);
    let fin = tf != null ? minutosDelDia(tf) : ini + DURACION_DEFECTO_MIN;
    // Un evento que cruza la medianoche, o sin fin posterior al inicio, no puede tener alto negativo.
    if (fin <= ini) fin = ini + DURACION_DEFECTO_MIN;
    conHora.push({ ev, ini, fin });
  }

  // Hoy sin eventos con hora igual dibuja la rejilla (orden del operador 2026-11-07: la Agenda se ve
  // como el prototipo aunque el día esté vacío). El rango 8-19 se estira para incluir el ahora.
  const ahoraMin = ahora.getHours() * 60 + ahora.getMinutes();
  const primera = Math.min(HORA_INICIO_MIN, Math.floor(Math.min(...conHora.map((b) => b.ini), ahoraMin) / 60));
  const ultima = Math.max(HORA_FIN_MIN, Math.ceil(Math.max(...conHora.map((b) => b.fin), ahoraMin) / 60));
  const px = (min: number) => ((min - primera * 60) / 60) * PX_POR_HORA;

  const horas: number[] = [];
  for (let h = primera; h <= ultima; h += 1) horas.push(h);

  const bloques: BloqueRejilla[] = conHora.map(({ ev, ini, fin }) => {
    const alto = Math.max(ALTO_MIN_BLOQUE, px(fin) - px(ini));
    return { id: ev.id, titulo: ev.titulo, top: px(ini), alto, corto: alto < ALTO_CORTO, iniMin: ini, finMin: fin };
  });

  return { horas, alto: (ultima - primera) * PX_POR_HORA, bloques, ahoraTop: px(ahoraMin), sinHora };
}

/** `h:00` como el prototipo (`8:00`, `19:00`), sin cero a la izquierda. */
export const rotuloHora = (h: number): string => `${h}:00`;

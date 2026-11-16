import { instanteDeEvento } from '@copiloto/core';

/** Cuánto sigue contando como «en curso» un evento que ya empezó: no trae hora de fin, así que se le da una hora. */
export const EN_CURSO_MS = 60 * 60_000;

/**
 * La hora de un evento en 24 h («08:30»), armada a mano: `toLocaleTimeString('es-AR')` puede devolver
 * «08:30 a. m.», que no entra en una línea y partía la hora en dos. `null` si el evento no trae hora (todo el día).
 */
export function horaCorta(inicioCrudo: unknown): string | null {
  const instante = instanteDeEvento(inicioCrudo);
  if (instante == null) return null;
  const d = new Date(instante);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** La segunda línea de un evento de hoy: cuánto falta, si está en curso o si ya pasó. */
export function cuandoEs(instante: number, ahora: number): string {
  const min = Math.round((instante - ahora) / 60_000);
  if (instante < ahora - EN_CURSO_MS) return 'Ya pasó';
  if (min < 0) return -min < 2 ? 'Empezó recién' : `Empezó hace ${-min} min`;
  if (min < 1) return 'Ahora';
  if (min < 60) return `En ${min} min`;
  const h = Math.floor(min / 60);
  const resto = min % 60;
  return resto === 0 ? `En ${h} h` : `En ${h} h ${resto} min`;
}

/** Si un evento de hoy ya quedó atrás (pasó su hora en curso). Sin hora reconocible, nunca «pasó». */
export function yaPaso(inicioCrudo: unknown, ahora: number): boolean {
  const instante = instanteDeEvento(inicioCrudo);
  return instante != null && instante < ahora - EN_CURSO_MS;
}

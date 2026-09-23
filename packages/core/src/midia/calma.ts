/**
 * La «Calma» — el retiro progresivo de la explicación del vacío, con UNA sola definición para web y
 * mobile (BL-W5, DEC: N = 3 días distintos).
 *
 * La explicación larga sirve las primeras veces y después estorba: el que ya entendió no necesita que
 * se lo expliquen todos los días. Se cuentan **días distintos**, no visitas — diez entradas en una
 * mañana son un día, no diez. Título, ilustración y salida no se retiran nunca.
 *
 * Todo lo que acá es puro (recibe el reloj y el almacén como argumentos): se prueba con reloj
 * simulado, sin tocar `localStorage` ni AsyncStorage. Cada plataforma sólo aporta dónde guarda la lista.
 */

/** Cuántos días DISTINTOS hay que ver el vacío antes de que la explicación se retire. */
export const DIAS_PARA_RETIRAR_EXPLICACION = 3;

/** Clave del almacén (localStorage en web, AsyncStorage en mobile) — la misma en las dos. */
export const CLAVE_DIAS_CALMA = 'odobi-calma-dias';

/**
 * El día de `ahora` en la zona horaria del DISPOSITIVO, `YYYY-MM-DD`.
 *
 * 🔴 NO `toISOString().slice(0, 10)`: eso es el día en UTC, que en Argentina cambia a las 21:00 —
 * el «día» del usuario se partiría en dos y el contador se adelantaría de noche.
 */
export function fechaLocalISO(ahora: Date): string {
  const mes = String(ahora.getMonth() + 1).padStart(2, '0');
  const dia = String(ahora.getDate()).padStart(2, '0');
  return `${ahora.getFullYear()}-${mes}-${dia}`;
}

/** Lee la lista guardada tolerando basura: cualquier cosa que no sea un array de strings es «vacía». */
export function parsearDiasVistos(crudo: string | null | undefined): string[] {
  if (crudo == null) return [];
  try {
    const v: unknown = JSON.parse(crudo);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

/** Suma `hoy` a la lista si no estaba. Devuelve la MISMA referencia si no hubo cambio. */
export function registrarDiaVisto(dias: readonly string[], hoy: string): readonly string[] {
  return dias.includes(hoy) ? dias : [...dias, hoy];
}

/** ¿Se sigue mostrando el cuerpo? Sólo mientras los días distintos vistos sean < N. */
export function mostrarExplicacion(dias: readonly string[]): boolean {
  return dias.length < DIAS_PARA_RETIRAR_EXPLICACION;
}

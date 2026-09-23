/**
 * Fecha de HOY, es-AR, SIN hora — el encabezado de Mi día (contrato BL-W11 fila 4a: "sin fecha, no
 * se sabe de qué día son las tarjetas", ninguna de las dos apps la tenía). Compartido por web y
 * mobile para que digan lo mismo, mismo criterio que `caja.ts`.
 *
 * 🔴 **Arrays propios, sin `Intl.DateTimeFormat`.** `separadoresFecha.ts` ya documentó por qué:
 * Hermes no garantiza la base de husos del runtime en todos los devices. Acá no hay conversión de
 * huso (es "hoy" del reloj del dispositivo, no un instante UTC que haya que anclar a Buenos Aires),
 * pero evitar `Intl` para un string que las dos plataformas tienen que mostrar IDÉNTICO saca de la
 * ecuación cualquier diferencia de locale data entre el motor JS de la web y Hermes.
 */
const DIAS_SEMANA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

/** «Martes 23 de septiembre» — el día de la semana capitalizado, sin año (es HOY, el año sobra). */
export function fechaDeHoyMidia(ahora: Date = new Date()): string {
  const dia = DIAS_SEMANA[ahora.getDay()]!;
  const capitalizado = dia.charAt(0).toUpperCase() + dia.slice(1);
  return `${capitalizado} ${ahora.getDate()} de ${MESES[ahora.getMonth()]}`;
}

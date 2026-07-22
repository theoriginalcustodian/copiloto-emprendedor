/**
 * El nivel de amplitud que dibuja la onda mientras se graba. **Función pura, cero I/O**: los
 * adaptadores (nativo y web) le pasan las muestras crudas que les da su propia API de audio, y los dos
 * obtienen el mismo número — la onda se ve igual en el teléfono y en el navegador porque la cuenta es
 * la misma, no porque cada uno la haya aproximado parecido.
 */

/**
 * Amplitud de referencia que se considera "voz a volumen normal" y llena la barra.
 *
 * No es una medición: es una **escala de display**, elegida porque el RMS de una voz hablando cerca del
 * micrófono ronda 0,05–0,20 (muy por debajo de 1,0, que es un pico de saturación). Sin esta referencia,
 * una onda que mapeara el RMS crudo a la altura se vería casi plana durante toda la grabación y el
 * usuario concluiría, con razón, que no está grabando.
 */
const RMS_DE_VOZ_NORMAL = 0.15;

/**
 * RMS (raíz de la media cuadrática) de un bloque de muestras PCM en −1..1, mapeado a 0..1 para la onda.
 *
 * Se usa RMS y no el pico porque el pico lo decide una sola muestra: un chasquido, un golpe en el
 * escritorio o un clic del mouse dispararían la barra al máximo con el ambiente en silencio. El RMS
 * mide la energía del bloque, que es lo que se corresponde con "hay alguien hablando".
 *
 * Devuelve 0 para un bloque vacío -- no `NaN`: un `NaN` que llegue a un estilo de React Native rompe el
 * render entero, y un bloque vacío no es un error, es simplemente silencio.
 */
export function nivelDeMuestras(muestras: ArrayLike<number>): number {
  if (muestras.length === 0) return 0;

  let sumaCuadrados = 0;
  for (let i = 0; i < muestras.length; i++) {
    // `?? 0` no es defensa contra un índice fuera de rango (no lo hay): es lo que exige
    // `noUncheckedIndexedAccess`, y un hueco en un bloque de audio es silencio, no un error.
    const m = muestras[i] ?? 0;
    sumaCuadrados += m * m;
  }
  const rms = Math.sqrt(sumaCuadrados / muestras.length);

  // Acotado a 1: una voz más fuerte que la referencia llena la barra y no la desborda (una altura > 1
  // se traduciría en una barra que se sale de su contenedor).
  return Math.min(1, rms / RMS_DE_VOZ_NORMAL);
}

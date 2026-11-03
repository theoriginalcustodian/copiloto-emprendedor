/**
 * Mismo color con otro alfa. Existe porque un degradé hacia `transparent` (= negro alfa 0) se ve sucio a mitad de
 * camino, y porque el relleno translúcido del campo flotante (SM-N25) tiene que salir del TOKEN de la piel, no de un
 * literal. Entrada `#rrggbb`; cualquier otra forma (rgba, nombre) se devuelve tal cual: no se adivina.
 */
export function conAlfa(color: string, alfa: number): string {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(color);
  if (m == null) return color;
  return `rgba(${parseInt(m[1], 16)},${parseInt(m[2], 16)},${parseInt(m[3], 16)},${alfa})`;
}

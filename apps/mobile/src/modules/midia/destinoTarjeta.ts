import type { DestinoTarjeta } from '@copiloto/core';

/**
 * H5b — de `destino` (semántica que emite el backend) a lo que la APP hace con él. El backend no conoce
 * pantallas de mobile; el vocabulario (`tipo`) lo fija el contrato `H5B-destino-en-la-tarjeta-critica` y el
 * ruteo es de acá. Función PURA a propósito: es la mitad que decide si el enum cerrado es seguro, y
 * una pura se ejercita con un valor inventado sin montar una pantalla.
 *
 * `null` = «no sé a dónde llevarte»: quien la usa cae a Ajustes. Eso cubre tres casos distintos con el
 * MISMO resultado (y a propósito): `destino` ausente (backend previo), un `tipo` que esta versión de la app
 * no conoce (backend más nuevo que la app instalada) y un `conexion` sin `id` (no hay a qué conexión ir).
 * Nunca lanza ni devuelve algo a medias: un valor nuevo del backend no puede romper una app ya instalada.
 */
export type RutaDestino = { tipo: 'conexion'; servicio: string };

export function rutaDeDestino(destino: DestinoTarjeta | null | undefined): RutaDestino | null {
  if (destino == null) return null;
  switch (destino.tipo) {
    case 'conexion':
      return destino.id != null ? { tipo: 'conexion', servicio: destino.id } : null;
    default:
      return null;
  }
}

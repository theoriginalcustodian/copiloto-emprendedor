import type { Tokens } from '../../theme/tokens';

/**
 * Los colores de los botones de la barra de entrada, activos y deshabilitados (SM-I3). Sin `opacity`: atenuar
 * el botón entero deja el contraste a merced de lo que haya detrás, y el glifo blanco sobre crema daba 1,07:1.
 * El contraste de cada estado lo mide `tonoBotonEntrada.test.ts`.
 */
export function tonoBotonEntrada(tema: Tokens, activo: boolean): { fondo: string; glifo: string } {
  return activo
    ? { fondo: tema.glass.ub2, glifo: tema.color.acentoTexto }
    : { fondo: tema.color.superficieAlta, glifo: tema.color.textoTenue };
}

/** La foto es secundaria: el fondo no cambia, y apagada pierde el acento del glifo. */
export function tonoBotonFoto(tema: Tokens, activo: boolean): { fondo: string; glifo: string } {
  return { fondo: tema.glass.chip, glifo: activo ? tema.color.acentoTinta : tema.color.textoTenue };
}

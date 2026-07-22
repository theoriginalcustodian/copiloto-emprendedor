import { formatearImporte, type Comprobante } from '@copiloto/core';

/**
 * Cómo se le nombra a un comprobante **en castellano**, y no con el código de la AFIP.
 *
 * 🔴 **Existe porque el mismo mapeo vivía sólo en `DetalleComprobante` y la lista imprimía el código
 * crudo.** En device se veía *«Tipo 11 · N° 18 · 100.0»* — `11` es el código interno de una factura C
 * y el emprendedor no lo conoce; el detalle de esa misma fila, en cambio, decía «Factura C». La misma
 * pantalla hablaba dos idiomas según cuán adentro estuvieras.
 *
 * No fue que alguien decidiera mostrar el código: **fue que el mapeo no estaba a mano**. Un `Record`
 * privado dentro de un componente no se puede reusar sin moverlo, y mover cuesta más que escribir
 * `{c.tipoCbte}` — así que la lista se escribió con lo que tenía. Por eso el arreglo no es cambiar el
 * texto de esa fila: es que **haya un solo lugar donde vive el nombre**, y que sea el camino fácil.
 *
 * 🔴 **La app SÍ compone este texto, y no contradice la regla de `/actividad`.** Allá el backend manda
 * `titulo` armado y la app no debe inventarlo. Acá `/afip/comprobantes` devuelve **códigos** —es un
 * contrato fiscal, no una vista— así que alguien tiene que traducirlos, y el único que sabe cómo se
 * llaman en la pantalla es este lado.
 */

/** 1=A, 6=B, 11=C, 13=Nota de crédito C. Lo que el usuario llama "tipo de factura". */
const NOMBRE_TIPO_CBTE: Record<number, string> = {
  1: 'Factura A',
  6: 'Factura B',
  11: 'Factura C',
  13: 'Nota de crédito C',
};

/**
 * Un tipo que no está en la tabla se muestra **con su número visible**, no como "Comprobante".
 *
 * Es deliberado: el día que la AFIP —o nuestro backend— empiece a emitir un tipo nuevo, el número en
 * pantalla es lo que permite reconocerlo y agregarlo. Un genérico prolijo esconde exactamente el dato
 * que haría falta para arreglarlo. *(Y ya pasó del otro lado: un `12` inexistente en el catálogo se
 * pintó como plata que entra durante días.)*
 */
export function nombreTipoComprobante(tipo: number): string {
  return NOMBRE_TIPO_CBTE[tipo] ?? `Comprobante tipo ${tipo}`;
}

/**
 * El renglón con el que un comprobante se identifica en una lista: **«Factura C 6-18»**.
 *
 * Punto de venta y número van juntos y en ese orden porque **así se lee el comprobante impreso**: es
 * lo que el emprendedor va a comparar contra el papel o el PDF. El número solo no alcanza — se repite
 * entre puntos de venta.
 */
export function tituloComprobante(c: Pick<Comprobante, 'tipoCbte' | 'puntoVenta' | 'nro'>): string {
  return `${nombreTipoComprobante(c.tipoCbte)} ${c.puntoVenta}-${c.nro}`;
}

/**
 * El título con el importe ya formateado como plata: **«Factura C 6-18 · $1.500,00»**.
 *
 * 🔴 **El total NUNCA se imprime crudo.** Viaja como string decimal (`"1500.0"`) justamente para no
 * pasar por `Number`, y mostrarlo tal cual delata la representación interna: en device se leyó
 * `100.0`, en la misma pantalla donde la lista de actividad ya mostraba `$1.500,00`. Que dos vistas
 * del mismo dato se vean distinto es lo que hace dudar de cuál está bien.
 */
export function tituloComprobanteConTotal(
  c: Pick<Comprobante, 'tipoCbte' | 'puntoVenta' | 'nro' | 'total'>,
): string {
  return `${tituloComprobante(c)} · ${formatearImporte(c.total)}`;
}

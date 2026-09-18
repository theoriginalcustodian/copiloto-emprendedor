/**
 * `mensajePendiente` — el buzón de un solo mensaje entre una pantalla y **el chat principal**.
 *
 * 🔴 **Existe para el puente de la Decisión C** (`odobi-ui/CLAUDE.md`): *«cada tema abre el CHAT
 * PRINCIPAL con contexto, no una conversación aparte»*. Un chat de ayuda propio sería la misma
 * duplicación que el sistema ya sacó con la solapa «Preguntar» de Inteligencia: dos hilos que saben
 * cosas distintas del mismo negocio, y el emprendedor teniendo que acordarse en cuál preguntó.
 *
 * **Por qué un módulo con estado y no un parámetro de ruta.** El chat no es una pantalla a la que se
 * navega: vive montado en la base, debajo de todo (`PantallaPrincipal`). No hay una URL que empujar
 * con el texto adentro — hay que cerrar el glass y dejarle algo dicho al que ya está abajo. Mismo
 * mecanismo (y mismo motivo) que `empujarUnaVez`: un flag de módulo, porque sólo hay una pantalla con
 * foco a la vez.
 *
 * ⚠️ **`tomar()` vacía el buzón.** Si no lo vaciara, cada vez que el chat recupera el foco —o sea
 * cada vez que se cierra cualquier glass— volvería a mandar el mismo mensaje. Un mensaje que se
 * reenvía solo es peor que uno que no llega: el emprendedor ve al copiloto repitiéndose sin que él
 * haya escrito nada.
 */
let pendiente: string | null = null;

/** Deja un texto para que el chat principal lo mande apenas recupere el foco. */
export function dejarPendiente(texto: string): void {
  const limpio = texto.trim();
  pendiente = limpio !== '' ? limpio : null;
}

/** Lo toma y lo borra. `null` si no había nada. */
export function tomarPendiente(): string | null {
  const t = pendiente;
  pendiente = null;
  return t;
}

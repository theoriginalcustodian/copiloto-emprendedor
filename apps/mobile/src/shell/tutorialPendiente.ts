/**
 * Buzón de «mostrá el tutorial del primer ingreso» (Martin 13/11). Lo deja la configuración inicial al
 * terminar (`app/_layout.tsx`) y lo toma la pantalla principal al montarse, UNA vez. Mismo patrón que
 * `mensajePendiente`: módulo con estado, leer lo vacía. No persiste a propósito — el tutorial acompaña el
 * primer ingreso; para volver a verlo existe (cuando se sume) la entrada desde la ayuda.
 */
let pendiente = false;

export function pedirTutorial(): void {
  pendiente = true;
}

export function tomarTutorialPendiente(): boolean {
  const v = pendiente;
  pendiente = false;
  return v;
}

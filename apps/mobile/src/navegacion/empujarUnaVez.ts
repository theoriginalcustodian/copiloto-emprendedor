import { router } from 'expo-router';

/**
 * `empujarUnaVez` — desde una pantalla lanzadora se abre UN glass, y no otro hasta volver a ella.
 *
 * 🔴 **Por qué existe.** Reportado por el operador (2026-07-20), en dos pasos: primero *"si apreto
 * rápido dos veces abre dos glass diferentes de la misma función"*, y después la regla completa —
 * *"solo puede abrirse un solo glass hasta minimizarlo y volver a la pantalla de funciones"*. Cada
 * tile hace `router.push`, y `push` APILA sin preguntar: varios taps seguidos apilan varios modales,
 * que después hay que cerrar uno por uno. La causa raíz no es el tile (avisa bien su toque) sino que
 * la navegación no tenía invariante de "uno a la vez".
 *
 * **Por qué un lock por FOCO y no por tiempo.** Un lock temporal (ignorar pushes en los próximos N ms)
 * tapa el doble-tap, pero no la regla real: si el usuario abre un glass, y 2 segundos después —con el
 * glass todavía abierto— el sistema entrega otro toque encolado, el tiempo ya expiró y se apila igual.
 * La invariante correcta no es "no dos seguidos", es "no otro MIENTRAS haya uno abierto". Eso es
 * exactamente el foco: la puerta se cierra al lanzar y se reabre cuando la pantalla lanzadora vuelve a
 * tener el foco —o sea cuando el glass se cerró y volvimos a ella—, ni antes ni después.
 *
 * **Cómo se compone.** `puertaAbierta` es un flag de módulo, y funciona con un solo flag global porque
 * sólo una pantalla tiene foco a la vez (el modal de arriba). Cada pantalla LANZADORA (el escritorio y
 * Ajustes) llama `reabrirNavegacion()` desde su `useFocusEffect`: al ganar foco reabre. Al lanzar, este
 * helper cierra de forma SÍNCRONA, así que un segundo tap disparado un instante después ya ve la puerta
 * cerrada. Las pantallas hoja (Skins, Cuenta, …) no lanzan nada y no participan.
 *
 * Esto deja pasar la navegación legítima —abrir Ajustes, volver, abrir Historias— porque entre una y
 * otra el escritorio recupera el foco y reabre; y bloquea la ilegítima —dos glass a la vez— porque
 * entre los dos taps el foco todavía no volvió.
 */
let puertaAbierta = true;

/** La llama el `useFocusEffect` de cada pantalla lanzadora al ganar foco: reabre la puerta. */
export function reabrirNavegacion(): void {
  puertaAbierta = true;
}

export function empujarUnaVez(ruta: string): void {
  if (!puertaAbierta) return;
  puertaAbierta = false;
  router.push(ruta as never);
}

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
 * sólo una pantalla tiene foco a la vez (el modal de arriba). Cada pantalla LANZADORA llama
 * `reabrirNavegacion()` desde su `useFocusEffect`: al ganar foco reabre. Al lanzar, este helper cierra
 * de forma SÍNCRONA, así que un segundo tap disparado un instante después ya ve la puerta cerrada.
 * Las pantallas hoja (Skins, Cuenta, …) no lanzan nada y no participan.
 *
 * 🔴 **Corrección (SM-N27, 2026-11-02): "ganar foco" NO es "volver" cuando el destino es TAMBIÉN
 * lanzador.** El párrafo anterior afirmaba "ni antes ni después", y es cierto sólo para un destino
 * HOJA. Ajustes, Mi día, Presupuestos y Facturación son destino Y lanzadora: ganan foco a la IDA, o
 * sea que reabrían la puerta justo al llegar, y un segundo toque —entregado por el sistema durante
 * la transición— apilaba una segunda copia (el operador: "se abre dos veces la misma pantalla").
 * Medido: `app/ajustes.tsx` reabría en su `useFocusEffect` sin distinguir llegada de regreso.
 *
 * **Cómo se distingue (sin tiempo).** La puerta recuerda QUÉ ruta la cerró (`cerradaPor`).
 *  - `reabrirNavegacion(rutaPropia)`: si `rutaPropia === cerradaPor`, es la LLEGADA del destino que
 *    cerró la puerta → no reabre. Cualquier otra pantalla que gane foco (el escritorio, o Ajustes al
 *    volver de Cuenta, cuando `cerradaPor` ya es '/ajustes-cuenta') es un REGRESO → reabre.
 *    Sin argumento reabre siempre (escape deliberado: un toque del usuario dentro de la pantalla).
 *  - `empujarUnaVez(destino, desde)`: con la puerta cerrada pasa sólo si `desde === cerradaPor`, es
 *    decir, si lo lanza el destino que acaba de llegar (Ajustes abriendo Cuenta). El doble toque sobre
 *    un mismo tile lo bloquea igual, porque tras el primer lanzamiento `cerradaPor` ya es el destino
 *    nuevo y `desde` no coincide.
 * Un lock por TIEMPO sigue descartado (ver arriba): esto es estado de navegación, no un reloj.
 *
 * Esto deja pasar la navegación legítima —abrir Ajustes, volver, abrir Historias— porque entre una y
 * otra el escritorio recupera el foco y reabre; y bloquea la ilegítima —dos glass a la vez— porque
 * entre los dos taps el foco todavía no volvió.
 */
let puertaAbierta = true;
/** Ruta (sin query) que cerró la puerta; `null` con la puerta abierta. */
let cerradaPor: string | null = null;

const sinQuery = (ruta: string): string => ruta.split('?')[0] ?? ruta;

/**
 * La llama el `useFocusEffect` de cada pantalla lanzadora al ganar foco: reabre la puerta.
 * `rutaPropia`: la ruta de la pantalla que llama, si es destino Y lanzadora. Si es justo la que
 * cerró la puerta, es su llegada y no se reabre (ver el docstring del módulo).
 */
export function reabrirNavegacion(rutaPropia?: string): void {
  if (rutaPropia !== undefined && !puertaAbierta && sinQuery(rutaPropia) === cerradaPor) return;
  puertaAbierta = true;
  cerradaPor = null;
}

/**
 * Un destino con parámetros, para las navegaciones que llevan un dato en la URL.
 *
 * Existe por "Facturar" desde un presupuesto: el backend devuelve el id del **borrador** ya armado y
 * el contrato pide llevar al usuario a la pantalla de facturación **que ya existe** con ese id
 * puesto, en vez de construir una pantalla nueva. Sin poder pasar el parámetro, la única forma de
 * cumplir eso sería duplicar el gate de confirmación fiscal — el único lugar donde se firma la
 * emisión, que no puede tener dos implementaciones.
 */
export interface DestinoConParams {
  pathname: string;
  params: Record<string, string>;
}

/**
 * `desde`: la ruta de la pantalla que lanza, cuando es destino Y lanzadora (Ajustes, Mi día…). Con la
 * puerta cerrada, sólo pasa si `desde` es el destino que la cerró.
 */
export function empujarUnaVez(destino: string | DestinoConParams, desde?: string): void {
  if (!puertaAbierta && (desde === undefined || sinQuery(desde) !== cerradaPor)) return;
  puertaAbierta = false;
  cerradaPor = sinQuery(typeof destino === 'string' ? destino : destino.pathname);
  router.push(destino as never);
}

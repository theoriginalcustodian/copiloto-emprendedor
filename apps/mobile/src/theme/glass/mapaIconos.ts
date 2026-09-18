/**
 * De qué ícono del sistema se dibuja cada cosa de la app.
 *
 * Los nombres de la izquierda son los de la app (`NombreIconoGlass`); los de la derecha, archivos
 * de `odobi-ui/assets/iconos/` portados en `phosphor.ts`.
 *
 * 🔴 **El mapeo no se inventó: se extrajo del prototipo**, comparando el primer `path` de cada
 * `<svg>` inline contra los archivos del set. Donde el prototipo asigna un ícono a una pantalla,
 * ése es el que va — aunque dos pantallas compartan ícono (Clientes y Mi cuenta usan los dos
 * `user`, y así está en el prototipo).
 *
 * ✅ **Los cinco que no tenían asignación clara en el prototipo quedaron CONFIRMADOS por Martin el
 * 2026-09-18**, con los valores que ya estaban puestos: *"vamos con esos, en todo caso después
 * cambiamos"*. Ya no hay nada provisorio acá — si uno cambia, cambia por decisión nueva, no por una
 * duda pendiente. Cada uno conserva la nota de POR QUÉ se eligió, que es lo que hace revisable la
 * decisión más adelante.
 */
import type { NombreIconoGlass } from './icons';

/** Confirmado: los primeros, contra el prototipo (la pantalla y su ícono están juntos ahí); los
 *  cinco del final, por Martin el 2026-09-18. */
export const ICONO_DEL_SISTEMA: Record<NombreIconoGlass, string> = {
  // ── confirmados ──────────────────────────────────────────────────────────
  perfilFiscal: 'arca', //          Facturación ARCA — el signo del organismo, no un glifo genérico
  comoHablarle: 'chat-circle', //   Cómo hablarle
  appsConectadas: 'plugs-connected',
  miPlan: 'sparkle',
  cuenta: 'user', //                Mi cuenta
  apariencia: 'sun',
  gastos: 'wallet',
  clientes: 'user', //              comparte glifo con `cuenta`: así está en el prototipo
  presupuestos: 'clipboard-text',
  facturacion: 'file-text',
  cobros: 'coins',
  grabar: 'microphone',
  // Actividad de conversación y las filas de Mi cuenta que llevan al chat. NO es el ícono de
  // Soporte: ése es `soporte` (headset), como en el prototipo.
  conversacion: 'chat-circle',
  // ⏳ Desaparece cuando se aplique la fusión Contabilidad + Inteligencia (cerrada el 20/08).
  contabilidad: 'calculator',
  soporte: 'headset', //            Soporte técnico
  feedback: 'chat-shield', //       Contanos qué tal
  inteligencia: 'chart-line',

  // ── confirmados por Martin (2026-09-18), sin asignación clara en el prototipo ─
  miNegocio: 'storefront', //       el prototipo lo muestra con `storefront` en un lado y con
  //                                `clipboard-text` en otro. Gana `storefront`: `clipboard-text` ya
  //                                es Presupuestos y repetirlo confunde las dos pantallas.
  ingresos: 'coins', //             mismo glifo que `cobros` — el set no distingue los dos, y un
  //                                cobro ES un ingreso, así que compartirlo no miente.
  miDia: 'list-checks',
  actividadReciente: 'clock', //    ⚠️ el prototipo usa `clock-counter-clockwise`, que NO está en los
  //                                38 archivos del set. `clock` es lo más cercano que hay portado;
  //                                el día que se baje el otro, éste es el único renglón que cambia.
  ajustes: 'gear', //               en el prototipo se entra por el avatar, así que no tiene glifo ahí
};

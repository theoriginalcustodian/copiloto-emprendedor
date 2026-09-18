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
 * ⚠️ **Los marcados `POR CONFIRMAR` no aparecen en el prototipo con una asignación clara.** Se puso
 * el más cercano del set para no dejar la app sin ícono, pero **son elección provisoria, no
 * decisión del sistema**. Están listados aparte para que Martin los confirme de una.
 */
import type { NombreIconoGlass } from './icons';

/** Confirmado contra el prototipo: la pantalla y su ícono están juntos ahí. */
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
  inteligencia: 'chart-line',

  // ── POR CONFIRMAR ────────────────────────────────────────────────────────
  miNegocio: 'storefront', //       ⚠️ el prototipo lo muestra con `storefront` en un lado y con
  //                                   `clipboard-text` en otro. Se eligió `storefront` porque
  //                                   `clipboard-text` ya es Presupuestos y repetirlo los confunde.
  ingresos: 'coins', //             ⚠️ mismo glifo que `cobros`; el set no distingue los dos
  miDia: 'list-checks', //          ⚠️ sin asignación en el prototipo
  contabilidad: 'calculator', //    ⚠️ sin asignación
  conversacion: 'chat-circle', //   ⚠️ repetiría `comoHablarle`
  actividadReciente: 'clock', //    ⚠️ el prototipo usa `clock-counter-clockwise`, que NO está en
  //                                   los 38 archivos del set. Hay que bajarlo o elegir otro.
  memoria: 'package', //            ⚠️ sin asignación
  ajustes: 'gear', //               ⚠️ sin asignación (en el prototipo se entra por el avatar)
};

/** Los que esperan confirmación — se usa en el test que impide que la lista crezca en silencio. */
export const ICONOS_POR_CONFIRMAR: readonly NombreIconoGlass[] = [
  'miNegocio',
  'ingresos',
  'miDia',
  'contabilidad',
  'conversacion',
  'actividadReciente',
  'memoria',
  'ajustes',
];

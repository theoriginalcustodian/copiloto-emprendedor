import { DevSettings } from 'react-native';

import { almacenClave } from '../adapters/almacen';

/**
 * ⚠️ MODO DEMO — SÓLO EN DESARROLLO, SACAR ANTES DEL PR (junto con `VISTA_PREVIA_DISENO` y `REVISAR_ONBOARDING`).
 *
 * Martin 15/11: para decidir diseño hace falta ver las pantallas LLENAS, como si la cuenta ya tuviera Mercado
 * Pago y Google conectados y meses de uso. Con el modo prendido la app no le habla al servidor: los GET se
 * responden con un negocio de ejemplo (`respuestasDemo`), el chat muestra un hilo sembrado (`hiloDemo`) y nada
 * de lo que se toque se guarda (`httpDemo` corta toda escritura). La cuenta real no se lee ni se modifica.
 *
 * Se prende y apaga desde Ajustes. Cambiarlo recarga la app: es la forma honesta de que todas las pantallas
 * vuelvan a pedir sus datos, en vez de perseguir cada caché.
 */
export const HAY_MODO_DEMO = __DEV__ && process.env.NODE_ENV !== 'test';

const CLAVE = 'odobi-modo-demo';

let lectura: Promise<boolean> | null = null;

/** Si el modo demo está prendido. Se lee una vez por arranque: cambiarlo recarga la app. */
export function demoActivo(): Promise<boolean> {
  if (!HAY_MODO_DEMO) return Promise.resolve(false);
  lectura ??= almacenClave
    .leer(CLAVE)
    .then((v) => v === '1')
    .catch(() => false);
  return lectura;
}

/** Prende o apaga el modo, deja sembrado el hilo de ejemplo y recarga la app. */
export async function cambiarModoDemo(activo: boolean): Promise<void> {
  if (!HAY_MODO_DEMO) return;
  // Primero la marca: si sembrar el hilo fallara, el modo igual tiene que quedar como se pidió.
  await almacenClave.guardar(CLAVE, activo ? '1' : '0');
  lectura = Promise.resolve(activo);
  if (activo) {
    try {
      // `require` diferido: el hilo arrastra el módulo del chat, y un import estático cerraría un ciclo con el
      // puerto de red, que se arma al arrancar.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { sembrarHiloDemo } = require('./hiloDemo') as typeof import('./hiloDemo');
      await sembrarHiloDemo();
    } catch (e) {
      console.warn('[modo demo] no se pudo sembrar el hilo de ejemplo', e);
    }
  }
  console.log('[modo demo]', activo ? 'prendido' : 'apagado');
  DevSettings.reload();
}

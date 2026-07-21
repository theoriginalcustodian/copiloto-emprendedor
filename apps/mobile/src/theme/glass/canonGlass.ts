/**
 * Los valores CANÓNICOS de una superficie de vidrio de DocuMed.
 *
 * Orden del operador (2026-07-18): *"el tamaño y formato canónico es el del glass principal… copiá
 * directamente el glass principal y usalo para el resto, no reinventes la rueda"*.
 *
 * 🔴 **Por qué un módulo de constantes y no "copiar y pegar los números".** Copiarlos es exactamente
 * cómo se produjo la divergencia que hubo que arreglar a mano: el principal tenía handle 56 con gesto
 * y las funciones 26 decorativo; el principal era full-bleed y las funciones `marginTop:'8%'`; el
 * principal no tenía scrim y las funciones sí. Cada uno de esos números fue, en su momento, una copia
 * que después se movió sola. Con una sola fuente, "subilo un poco" se cambia una vez y lo heredan
 * todas las superficies.
 *
 * Consumidores: `PanelDeslizable` (el glass principal — el canon) y `MarcoGlass` (el molde con el que
 * se visten las funciones: nota, consulta, documento, clientes).
 */
import { Easing } from 'react-native-reanimated';

import type { NivelCristal } from './CristalVidrio';

/**
 * Alto de la zona del handle. Es lo ÚNICO que queda en pantalla cuando el panel principal baja, así
 * que mide como una card del historial: barra + hint + margen chico.
 */
export const ALTO_HANDLE = 56;

/** La barra del handle (diseño del template: 44×5, radio 3). */
export const BARRA_HANDLE = { width: 44, height: 5, borderRadius: 3 } as const;

/**
 * El nivel de vidrio de toda superficie que flota sobre el escritorio. Uno solo, a propósito: dos
 * niveles distintos para dos superficies que el usuario lee como la misma cosa es la divergencia.
 */
export const NIVEL_CANONICO: NivelCristal = 'conversacion';

/** Curva del diseño al soltar el gesto: `.42s cubic-bezier(.2,.8,.2,1)`. */
export const CONFIG_SNAP = { duration: 420, easing: Easing.bezier(0.2, 0.8, 0.2, 1) };

/** Desplazamiento por debajo del cual el gesto se lee como TOQUE (toggle) y no como arrastre. */
export const UMBRAL_TAP = 5;

/**
 * Física del soltar, compartida por TODA superficie de vidrio arrastrable (el panel del chat, el
 * marco de función, la capa de función).
 *
 * 🔴 Vivían duplicadas en `PanelDeslizable` y en `MarcoGlass` con los mismos valores, y al portar el
 * gesto a `CapaFuncion` iban camino de una tercera copia. Tres definiciones del mismo número es
 * cómo empiezan a divergir: alguien ajusta el flick del panel, el vidrio de función queda con otro
 * tacto, y nadie relaciona una cosa con la otra. Un solo lugar.
 */
export const CONFIG_SNAP_GESTO = { duration: 420, dampingRatio: 1, overshootClamping: true };

/** Velocidad (px/s) a partir de la cual el gesto se lee como LANZAMIENTO y decide por dirección. */
export const VELOCIDAD_FLICK = 500;

/** Sin flick, cuánto hay que haber arrastrado hacia abajo para que el vidrio cierre en vez de volver. */
export const UMBRAL_CIERRE = 140;

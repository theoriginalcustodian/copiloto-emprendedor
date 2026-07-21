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

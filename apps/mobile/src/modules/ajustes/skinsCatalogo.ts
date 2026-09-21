import { ETIQUETA_PREFERENCIA, PREFERENCIAS_TEMA, type PreferenciaTema } from '@copiloto/core';

import { SKINS, type NombreSkin } from '../../theme/tokens';

/**
 * Catálogo de presentación de las 2 pieles ODOBI -- extraído de `PantallaAjustes.tsx` para que
 * `PantallaSkins.tsx` lo consuma sin duplicar el mapeo nombre→etiqueta ni el orden de las cards.
 * Único dueño de "cómo se presenta un skin al emprendedor".
 */

/** Nombre visible de cada piel -- mismo nombre corto que la clave, capitalizado. */
export const ETIQUETA_SKIN: Record<NombreSkin, string> = {
  claro: 'Claro',
  oscuro: 'Oscuro',
};

/** Orden de las 2 pieles -- derivado de `SKINS` (mismo orden de declaración de `PALETAS` en
 * `tokens.ts`) en vez de repetir el array a mano: `Object.keys` sobre claves string preserva el orden
 * de inserción (garantizado por el spec de JS desde ES2015), así que no hay riesgo real de desorden. */
export const ORDEN_SKINS = Object.keys(SKINS) as NombreSkin[];

/** Las opciones que ve el usuario: las 2 pieles + «Como el teléfono» (BL-X4). El nombre visible sale
 * de core (`ETIQUETA_PREFERENCIA`) para que web y mobile lo digan igual. */
export const ORDEN_PREFERENCIAS: readonly PreferenciaTema[] = PREFERENCIAS_TEMA;
export const ETIQUETA_OPCION: Record<PreferenciaTema, string> = ETIQUETA_PREFERENCIA;

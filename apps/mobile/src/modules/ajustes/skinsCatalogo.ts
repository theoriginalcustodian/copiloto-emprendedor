import { SKINS, type NombreSkin } from '../../theme/tokens';

/**
 * Catálogo de presentación de las 3 pieles ODOBI -- extraído de `PantallaAjustes.tsx` para que
 * `PantallaSkins.tsx` lo consuma sin duplicar el mapeo nombre→etiqueta ni el orden de las cards.
 * Único dueño de "cómo se presenta un skin al emprendedor".
 */

/** Nombre visible de cada piel -- mismo nombre corto que la clave, capitalizado. */
export const ETIQUETA_SKIN: Record<NombreSkin, string> = {
  claro: 'Claro',
  oscuro: 'Oscuro',
  nocturno: 'Nocturno',
};

/** Orden de las 3 pieles -- derivado de `SKINS` (mismo orden de declaración de `PALETAS` en
 * `tokens.ts`) en vez de repetir el array a mano: `Object.keys` sobre claves string preserva el orden
 * de inserción (garantizado por el spec de JS desde ES2015), así que no hay riesgo real de desorden. */
export const ORDEN_SKINS = Object.keys(SKINS) as NombreSkin[];

import { SKINS, type NombreSkin } from '../../theme/tokens';

/**
 * Catálogo de presentación de los 5 skins -- extraído de `PantallaAjustes.tsx` para que
 * `PantallaSkins.tsx` lo consuma sin duplicar el mapeo nombre→etiqueta ni el orden de las cards.
 * Único dueño de "cómo se presenta un skin al emprendedor".
 */

/** Nombre visible de cada tema del rediseño de vidrio -- mismo nombre corto que la clave, capitalizado.
 * `medicalWhite` conserva ese identificador de tipo (`NombreSkin`, referenciado por tests) aunque su
 * etiqueta visible ("Blanco clínico") viene del diseño original; no se renombra acá -- ver reporte de
 * la tarea. */
export const ETIQUETA_SKIN: Record<NombreSkin, string> = {
  cian: 'Cian',
  violeta: 'Violeta',
  ambar: 'Ámbar',
  medicalWhite: 'Blanco clínico',
  black: 'Negro',
};

/** Orden de los 5 temas -- derivado de `SKINS` (mismo orden de declaración de `PALETAS` en
 * `tokens.ts`) en vez de repetir el array a mano: `Object.keys` sobre claves string preserva el orden
 * de inserción (garantizado por el spec de JS desde ES2015), así que no hay riesgo real de desorden. */
export const ORDEN_SKINS = Object.keys(SKINS) as NombreSkin[];

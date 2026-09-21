/**
 * Preferencia de tema, compartida por web y mobile (BL-X4, DA-5): dos pieles reales (`claro`,
 * `oscuro`) y «Como el teléfono», que no es una tercera piel sino una REGLA: sigue al sistema en vivo.
 *
 * 🔴 `PielEfectiva` es lo que se pinta; `PreferenciaTema` es lo que el usuario eligió y se persiste.
 * Confundirlas perdería la elección: si se guardara la piel resuelta, «Como el teléfono» dejaría de
 * seguir al sistema apenas se reabre la app.
 */
export type PielEfectiva = 'claro' | 'oscuro';
export type PreferenciaTema = PielEfectiva | 'sistema';

export const PREFERENCIAS_TEMA: readonly PreferenciaTema[] = ['claro', 'oscuro', 'sistema'];

export const ETIQUETA_PREFERENCIA: Record<PreferenciaTema, string> = {
  claro: 'Claro',
  oscuro: 'Oscuro',
  sistema: 'Como el teléfono',
};

/** Preferencia inicial de quien nunca eligió (acta DEC-2/DA-5: Claro es el default). */
export const PREFERENCIA_DEFAULT: PreferenciaTema = 'claro';

/**
 * Lee lo persistido tolerando lo viejo: `nocturno` (piel retirada en BL-X4) pasa a `oscuro`, que es su
 * familia; cualquier otro valor desconocido cae al default, nunca deja el estado imposible.
 */
export function leerPreferenciaTema(guardado: string | null | undefined): PreferenciaTema {
  if (guardado === 'nocturno') return 'oscuro';
  return (PREFERENCIAS_TEMA as readonly string[]).includes(guardado ?? '')
    ? (guardado as PreferenciaTema)
    : PREFERENCIA_DEFAULT;
}

/** La piel a pintar dado lo elegido y el esquema actual del sistema. */
export function resolverPiel(preferencia: PreferenciaTema, sistemaOscuro: boolean): PielEfectiva {
  if (preferencia === 'sistema') return sistemaOscuro ? 'oscuro' : 'claro';
  return preferencia;
}

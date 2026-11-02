import { deleteAsync } from 'expo-file-system/legacy';

import type { ArchivoSubida } from '@copiloto/core';

/** Best-effort, mismo criterio que `borrarArchivoLocal` de `useChat.ts` (política D6, cero
 * retención): nunca lanza, `datos` sólo se borra si es una URI de archivo (string) — en web sería un
 * `Blob` y esto ni se monta ahí. */
export async function borrarArchivoLocal(archivo: ArchivoSubida): Promise<void> {
  if (typeof archivo.datos !== 'string') return;
  try {
    await deleteAsync(archivo.datos, { idempotent: true });
  } catch {
    // best-effort — ver docstring.
  }
}

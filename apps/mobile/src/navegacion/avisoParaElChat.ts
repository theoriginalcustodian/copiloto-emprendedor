import type { AvisoAlChat } from '@copiloto/core';

/**
 * El puente de `hitl (a)` cuando la tarjeta se toca en Tu día. Tu día es una ruta y el chat vive en la
 * pantalla de atrás, sin props que los unan: el aviso se deja acá, Tu día vuelve, y el shell lo toma al
 * recuperar el foco (mismo mecanismo que `reabrirNavegacion`). Se consume una sola vez: volver a enfocar el
 * shell no lo siembra de nuevo.
 */
let pendiente: AvisoAlChat | null = null;

export function dejarAvisoParaElChat(aviso: AvisoAlChat): void {
  pendiente = aviso;
}

export function tomarAvisoParaElChat(): AvisoAlChat | null {
  const aviso = pendiente;
  pendiente = null;
  return aviso;
}

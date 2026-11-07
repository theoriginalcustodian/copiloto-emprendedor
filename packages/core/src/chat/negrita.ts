/**
 * Negrita en el texto del asistente — el modelo contesta con `**así**` y la burbuja pintaba los asteriscos
 * crudos (hallazgo de device 2026-11-07). Un solo parser en el core para que mobile y web no diverjan.
 *
 * Deliberadamente MÍNIMO: sólo `**negrita**`. No es un renderer de markdown (cursiva, listas, links
 * traerían ambigüedad y superficie de ataque sin que el producto lo pida). Un `**` sin cerrar queda literal:
 * mostrar lo que llegó es más honesto que adivinar.
 */
export interface SegmentoTexto {
  texto: string;
  negrita: boolean;
}

const PAR_NEGRITA = /\*\*([^*\n][^*\n]*?)\*\*/g;

export function segmentarNegrita(texto: string): SegmentoTexto[] {
  const segmentos: SegmentoTexto[] = [];
  let desde = 0;
  for (const m of texto.matchAll(PAR_NEGRITA)) {
    const ini = m.index ?? 0;
    if (ini > desde) segmentos.push({ texto: texto.slice(desde, ini), negrita: false });
    segmentos.push({ texto: m[1], negrita: true });
    desde = ini + m[0].length;
  }
  if (desde < texto.length) segmentos.push({ texto: texto.slice(desde), negrita: false });
  return segmentos.length > 0 ? segmentos : [{ texto, negrita: false }];
}

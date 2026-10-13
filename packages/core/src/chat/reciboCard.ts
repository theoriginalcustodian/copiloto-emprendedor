import type { ReplyCard } from '../api/types';

/**
 * `card.recibo` — el recibo de una acción confirmada y EJECUTADA OK (C-D3, piloto Gmail). Forma emitida
 * por el backend: `{titulo: 'Mandado a lucia@x.com', meta: '15:41', accion: null}`.
 *
 * 🔴 **La presencia de `card.recibo` ES la señal de que la acción se ejecutó.** Sin `recibo` la acción
 * falló o se canceló: no se pinta «Mandado a…» a partir de `confirmed_tool.status === 'ok'` ni del texto
 * (el backend sólo emite el recibo si la tool corrió bien; `confirmed_tool` conserva su forma de BL-B1).
 *
 * `meta` es `HH:MM` en la zona del negocio, o `null` (sin reloj / ISO que no parsea): el backend no
 * inventa la hora y la app tampoco. `accion` viaja `null` a propósito (adónde lleva el botón del recibo
 * es decisión de pantalla): no se expone hasta que una pantalla la defina.
 */
export interface ReciboCard {
  titulo: string;
  meta: string | null;
}

function texto(v: unknown): string | null {
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : null;
}

/** El recibo de la card, o `null` si no hay o no tiene título legible (una card sin título no dice qué pasó). */
export function leerRecibo(card: ReplyCard | null | undefined): ReciboCard | null {
  const r = card?.recibo;
  if (typeof r !== 'object' || r === null) return null;
  const o = r as Record<string, unknown>;
  const titulo = texto(o.titulo);
  if (titulo == null) return null;
  return { titulo, meta: texto(o.meta) };
}

import type { ReplyCard } from '../api/types';

/**
 * `payment_link` — el link de cobro de MercadoPago que el copiloto generó (`mp_charge`, ver
 * `apps/copiloto/tool_catalog.py`). Forma real del backend: `data = {url, amount, concept}`. Sólo
 * LECTURA: generar el link no cobra nada, y el gate HITL ya pasó antes de que exista la card.
 *
 * `amount` llega como número o string según cómo lo dictó el LLM: se pasa a texto con `String()`, sin
 * aritmética. **El backend NO manda vencimiento** — si algún día lo hace, se agrega acá; hasta entonces
 * la card no inventa uno.
 */
export interface LinkDeCobro {
  url: string;
  monto: string | null;
  concepto: string | null;
}

function texto(v: unknown): string | null {
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : null;
}

function monto(v: unknown): string | null {
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  return texto(v);
}

/** El link de cobro, o `null` si la card no es uno — incluido `url` ausente, sin lo cual no hay acción posible. */
export function leerLinkDeCobro(card: ReplyCard | undefined): LinkDeCobro | null {
  if (card?.kind !== 'payment_link') return null;
  const d = card.data;
  if (typeof d !== 'object' || d === null) return null;
  const r = d as Record<string, unknown>;
  const url = texto(r.url);
  if (url == null) return null;
  return { url, monto: monto(r.amount), concepto: texto(r.concept) };
}

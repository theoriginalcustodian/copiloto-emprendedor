import type { ReplyCard } from '../api/types';

/**
 * Artefactos terminales «con enlace» que el copiloto deja tras una acción confirmada (SM-D1, #1017):
 * un evento de Calendar y los cuatro de Google/Workspace que traen `data.url` (documento, planilla,
 * archivo, borrador de mail). Gemelo en el core de lo que `ArtifactView` (web) resolvía inline, para que
 * web y mobile lean el MISMO contrato y no vuelvan a divergir.
 *
 * Reglas heredadas de la web, sin cambios de comportamiento:
 *  - `calendar_event` se pinta aunque no traiga `url` (el título ya informa que quedó agendado); el
 *    enlace «Ver en Calendar» sólo aparece si hay `url`.
 *  - `doc` / `sheet` / `file` / `email_draft` SIN `url` no tienen acción posible → `null`.
 *  - Cualquier otro `kind` → `null`: lo resuelven sus parsers propios (`leerLinkDeCobro`, `leerRecibo`…).
 */
export type KindArtefactoEnlace = 'calendar_event' | 'doc' | 'sheet' | 'file' | 'email_draft';

export interface ArtefactoEnlace {
  kind: KindArtefactoEnlace;
  /** Sólo `calendar_event` (`data.fields.title`, o «Evento» si no viene). Los demás: `null`. */
  titulo: string | null;
  /** Obligatoria salvo en `calendar_event`. */
  url: string | null;
  /** El rótulo de la acción de abrir, ya en la voz de la app. */
  etiqueta: string;
}

const ETIQUETA: Record<KindArtefactoEnlace, string> = {
  calendar_event: 'Ver en Calendar',
  doc: 'Abrir documento',
  sheet: 'Abrir planilla',
  file: 'Abrir archivo',
  email_draft: 'Ver borrador',
};

const TITULO_EVENTO_DEFAULT = 'Evento';

function texto(v: unknown): string | null {
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : null;
}

function esKind(k: unknown): k is KindArtefactoEnlace {
  return typeof k === 'string' && Object.prototype.hasOwnProperty.call(ETIQUETA, k);
}

/** El artefacto con enlace de la card, o `null` si no es uno (o no tiene acción posible). */
export function leerArtefactoEnlace(card: ReplyCard | undefined): ArtefactoEnlace | null {
  const kind = card?.kind;
  if (!esKind(kind)) return null;
  const d = card?.data;
  const r = typeof d === 'object' && d !== null ? (d as Record<string, unknown>) : {};
  const url = texto(r.url);
  if (kind === 'calendar_event') {
    const fields = typeof r.fields === 'object' && r.fields !== null ? (r.fields as Record<string, unknown>) : {};
    return { kind, titulo: texto(fields.title) ?? TITULO_EVENTO_DEFAULT, url, etiqueta: ETIQUETA[kind] };
  }
  if (url == null) return null;
  return { kind, titulo: null, url, etiqueta: ETIQUETA[kind] };
}

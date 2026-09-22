import { apiClient } from './client';
import type { ConDisponibilidad } from './afip';
import { horaDeEvento } from './miDia';

/**
 * `GET /mi-dia/calendario?desde&hasta` (BL-J13, K-13, ADR-004) — la agenda de varios días. Web y mobile
 * comparten acá el cliente, el armado del rango y la lectura de la franja horaria.
 *
 * 🔴 **El rango lo arma el CLIENTE y nunca pasa de la ventana del backend** (≤ 14 días → 400 si no).
 * `rangoAgenda` clampa; un test fija que ningún `dias` lo saque de la ventana.
 *
 * `inicio`/`fin` siguen siendo `[ASSUMED_PENDING_VERIFY]` (Composio no verificado con Calendar
 * conectado): se transportan crudos y `franjaDeEvento` sólo muestra lo que reconoce.
 */
export const DIAS_MAX_AGENDA = 14;
export const DIAS_AGENDA_DEFAULT = 7;

/** Los 4 grupos, en el orden en que el backend los manda SIEMPRE (aunque vengan vacíos). */
export const ORDEN_GRUPOS_AGENDA = ['hoy', 'manana', 'semana', 'sin_hora'] as const;
export type IdGrupoAgenda = (typeof ORDEN_GRUPOS_AGENDA)[number];

const TITULO_POR_DEFECTO: Record<IdGrupoAgenda, string> = {
  hoy: 'Hoy',
  manana: 'Mañana',
  semana: 'Esta semana',
  sin_hora: 'Sin hora',
};

export interface EventoAgenda {
  id: string;
  titulo: string;
  inicioCrudo: unknown;
  finCrudo: unknown;
  diaCompleto: boolean;
}

export interface GrupoAgenda {
  id: IdGrupoAgenda;
  titulo: string;
  eventos: readonly EventoAgenda[];
}

export interface AgendaMiDia {
  conectado: boolean;
  /** SIEMPRE los 4 grupos, en `ORDEN_GRUPOS_AGENDA`. Con `conectado: false` vienen vacíos. */
  grupos: readonly GrupoAgenda[];
}

export interface RangoAgenda {
  desde: string;
  hasta: string;
}

function isoLocal(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Hoy → hoy + `dias`, en fecha LOCAL. `dias` se clampa a [0, DIAS_MAX_AGENDA − 1]: con inclusive o
 *  exclusive del lado del backend, la ventana nunca pasa de 14. */
export function rangoAgenda(hoy: Date = new Date(), dias: number = DIAS_AGENDA_DEFAULT): RangoAgenda {
  const n = Number.isFinite(dias) ? Math.min(Math.max(Math.trunc(dias), 0), DIAS_MAX_AGENDA - 1) : DIAS_AGENDA_DEFAULT;
  const fin = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + n);
  return { desde: isoLocal(hoy), hasta: isoLocal(fin) };
}

function eventoAgenda(v: unknown): EventoAgenda | null {
  if (typeof v !== 'object' || v === null) return null;
  const r = v as Record<string, unknown>;
  if (typeof r.id !== 'string' || r.id.trim() === '') return null;
  if (typeof r.titulo !== 'string' || r.titulo.trim() === '') return null;
  return {
    id: r.id,
    titulo: r.titulo.trim(),
    inicioCrudo: r.inicio ?? null,
    finCrudo: r.fin ?? null,
    diaCompleto: r.dia_completo === true,
  };
}

function grupoAgenda(id: IdGrupoAgenda, crudos: unknown[]): GrupoAgenda {
  const crudo = crudos.find(
    (g): g is Record<string, unknown> => typeof g === 'object' && g !== null && (g as { id?: unknown }).id === id,
  );
  const titulo = typeof crudo?.titulo === 'string' && crudo.titulo.trim() !== '' ? crudo.titulo : TITULO_POR_DEFECTO[id];
  const eventos = Array.isArray(crudo?.eventos) ? crudo.eventos : [];
  return { id, titulo, eventos: eventos.map(eventoAgenda).filter((e): e is EventoAgenda => e !== null) };
}

/** `no_disponible` si el endpoint falla (incluido el 400): la pantalla degrada, no se rompe. */
export async function leerAgenda(
  rango: RangoAgenda = rangoAgenda(),
): Promise<ConDisponibilidad<{ agenda: AgendaMiDia }>> {
  try {
    const q = new URLSearchParams({ desde: rango.desde, hasta: rango.hasta });
    const raw = await apiClient.get<{ conectado?: unknown; grupos?: unknown }>(`/mi-dia/calendario?${q.toString()}`);
    if (typeof raw !== 'object' || raw === null) return { status: 'no_disponible' };
    const crudos = Array.isArray(raw.grupos) ? raw.grupos : [];
    const conectado = raw.conectado === true;
    return {
      status: 'ok',
      agenda: {
        conectado,
        grupos: ORDEN_GRUPOS_AGENDA.map((id) => grupoAgenda(id, conectado ? crudos : [])),
      },
    };
  } catch {
    return { status: 'no_disponible' };
  }
}

/** «Todo el día», «10:00 – 11:00», «10:00», o `null` si no se puede afirmar nada (no se inventa). */
export function franjaDeEvento(ev: Pick<EventoAgenda, 'inicioCrudo' | 'finCrudo' | 'diaCompleto'>): string | null {
  if (ev.diaCompleto) return 'Todo el día';
  const ini = horaDeEvento(ev.inicioCrudo);
  if (ini == null) return null;
  const fin = horaDeEvento(ev.finCrudo);
  return fin != null && fin !== ini ? `${ini} – ${fin}` : ini;
}

/** Texto que «Nuevo evento» deja en el chat principal (`dejarPendiente`): el alta la hace el agente
 *  con `calendar_book` y confirm-gate HITL (ADR-004 §3), nunca un formulario que escriba en Calendar. */
export const TEXTO_NUEVO_EVENTO = 'Quiero agendar un evento';

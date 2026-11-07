import { apiClient } from './client';
import type { ConDisponibilidad } from './afip';
import { horaDeEvento, instanteDeEvento } from './miDia';

/**
 * `GET /mi-dia/calendario?desde&hasta` (BL-J13, K-13, ADR-004) — la agenda de varios días. Web y mobile
 * comparten acá el cliente, el armado del rango y la lectura de la franja horaria.
 *
 * 🔴 **El rango lo arma el CLIENTE y nunca pasa de la ventana del backend** (≤ 14 días → 400 si no).
 * `rangoAgenda` clampa; un test fija que ningún `dias` lo saque de la ventana.
 *
 * `inicio`/`fin` siguen siendo `[ASSUMED_PENDING_VERIFY @ 2026-11-03 vigente: canónica sin Calendar]` (Composio no verificado con Calendar
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
  /** SM-P20: el `location` del evento (backend `ubicacion`: str|null). Ausente/vacío ⇒ `null`: no se inventa. */
  ubicacion?: string | null;
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
    ubicacion: typeof r.ubicacion === 'string' && r.ubicacion.trim() !== '' ? r.ubicacion.trim() : null,
  };
}

/**
 * SM-P20 punto 2 — `GET /mi-dia/vencimientos?dias` (backend `mi_dia_vencimientos.py`, main @ 4c5ae5f0):
 * obligaciones del NEGOCIO que vencen (CAE de una factura, certificado de ARCA), NO eventos de Calendar.
 * Incluye lo YA vencido (es lo más urgente) y un certificado ilegible con `dias: null`.
 */
export type TipoVencimiento = 'cae' | 'certificado';

export interface Vencimiento {
  tipo: TipoVencimiento;
  id: string;
  titulo: string;
  /** `YYYY-MM-DD` o `null` (certificado ilegible). */
  fecha: string | null;
  /** Días hasta el vencimiento (negativo = vencido); `null` si no se pudo leer. */
  dias: number | null;
  vencido: boolean;
}

function vencimiento(v: unknown): Vencimiento | null {
  if (typeof v !== 'object' || v === null) return null;
  const r = v as Record<string, unknown>;
  if (r.tipo !== 'cae' && r.tipo !== 'certificado') return null;
  if (typeof r.id !== 'string' || typeof r.titulo !== 'string' || r.titulo.trim() === '') return null;
  return {
    tipo: r.tipo,
    id: r.id,
    titulo: r.titulo.trim(),
    fecha: typeof r.fecha === 'string' && r.fecha !== '' ? r.fecha : null,
    dias: typeof r.dias === 'number' && Number.isFinite(r.dias) ? r.dias : null,
    vencido: r.vencido === true,
  };
}

/** `no_disponible` si el endpoint falla: la sección se oculta/degrada, la Agenda no se rompe. */
export async function leerVencimientos(
  dias: number = DIAS_AGENDA_DEFAULT,
): Promise<ConDisponibilidad<{ vencimientos: readonly Vencimiento[] }>> {
  try {
    const n = Number.isFinite(dias) ? Math.min(Math.max(Math.trunc(dias), 0), DIAS_MAX_AGENDA) : DIAS_AGENDA_DEFAULT;
    const raw = await apiClient.get<{ vencimientos?: unknown }>(`/mi-dia/vencimientos?dias=${n}`);
    if (typeof raw !== 'object' || raw === null || !Array.isArray(raw.vencimientos)) return { status: 'no_disponible' };
    return { status: 'ok', vencimientos: raw.vencimientos.map(vencimiento).filter((x): x is Vencimiento => x !== null) };
  } catch {
    return { status: 'no_disponible' };
  }
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

/**
 * SM-N34 — dónde cae la «línea del ahora» dentro de los eventos de HOY (vista mixta D9: línea de tiempo
 * con línea del ahora para hoy; lista para Mañana y Esta semana). Devuelve el índice ANTES del cual se
 * dibuja la línea: el del primer evento con hora que todavía no empezó; `eventos.length` si todos con hora
 * ya empezaron. `null` si ningún evento tiene hora legible (todos «todo el día»/sin hora): sin ancla no se
 * dibuja la línea (ausente ≠ inventada). Los de día completo no cuentan: no ocupan un lugar en la hora.
 */
export function posicionLineaAhora(
  eventos: readonly Pick<EventoAgenda, 'inicioCrudo' | 'diaCompleto'>[],
  ahora: Date,
): number | null {
  let hayHora = false;
  for (let i = 0; i < eventos.length; i += 1) {
    const ev = eventos[i]!;
    if (ev.diaCompleto) continue;
    const t = instanteDeEvento(ev.inicioCrudo);
    if (t == null) continue;
    hayHora = true;
    if (t > ahora.getTime()) return i;
  }
  return hayHora ? eventos.length : null;
}

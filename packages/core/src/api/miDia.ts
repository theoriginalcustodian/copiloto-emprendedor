import { apiClient } from './client';
import type { ConDisponibilidad } from './afip';

/**
 * **`GET /mi-dia/tablero` — el tablero Kanban del día: presupuestos → facturado → por cobrar →
 * cobrado.**
 *
 * 🔴 **[CONNECT] — construido contra CONTRATO §3.2, el endpoint todavía NO está vivo.** Forma declarada
 * **real** por planificación (los estados que la alimentan —presupuesto/factura/cobro— ya existen). El
 * único punto que el connect toca es `leerTablero()`; degrada a `no_disponible` hasta entonces.
 *
 * 🔴 **El DRAG que mueve una tarjeta de columna dispara una tool que TODAVÍA NO está contratada** («las
 * bajo con backend», §3.2). Por eso este cliente cubre **sólo la lectura** del tablero. La acción de
 * mover —marcar un presupuesto aprobado, una factura cobrada— es una superficie aparte que se agrega
 * cuando exista su contrato; construirla ahora sería inventar la forma de esas tools.
 *
 * 🔴 **`estado` se normaliza contra un conjunto CERRADO, con fallback al más inocuo.** Un estado que no
 * reconozco no puede pintarse con el color/acción de otro (eso es «discriminar por ausencia de
 * estructura»): cae en `desconocido`, que la UI muestra neutro y sin acción. Mejor una tarjeta muda que
 * una que ofrece la acción equivocada.
 *
 * 🔴 **`ausente ≠ cero`.** Un monto que no vino vale `null`, jamás `0`.
 */

/** Un importe del wire como string, o `null`. Gemelo del de `conceptos.ts`/`inteligencia.ts`. */
function importe(v: unknown): string | null {
  if (typeof v === 'string' && v.trim() !== '') return v.trim();
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  return null;
}

/** Las columnas del tablero, en orden de flujo. Conjunto cerrado: el backend manda estos ids. */
export const IDS_COLUMNA = ['presupuesto', 'facturado', 'por_cobrar', 'cobrado'] as const;
export type IdColumna = (typeof IDS_COLUMNA)[number];

/** Los estados que una tarjeta puede tener, más `desconocido` para lo que no reconozco. */
export type EstadoTarjeta = 'borrador' | 'aprobado' | 'facturado' | 'por_cobrar' | 'cobrado' | 'desconocido';

const ESTADOS: readonly EstadoTarjeta[] = ['borrador', 'aprobado', 'facturado', 'por_cobrar', 'cobrado'];

export interface TarjetaTablero {
  id: string;
  titulo: string;
  cliente: string | null;
  monto: string | null;
  fecha: string | null;
  estado: EstadoTarjeta;
}

export interface ColumnaTablero {
  id: IdColumna;
  titulo: string;
  tarjetas: readonly TarjetaTablero[];
}

export interface Tablero {
  columnas: readonly ColumnaTablero[];
}

interface TableroRaw {
  columnas?: unknown;
}

function esRespuestaDelEndpoint(raw: unknown, clave: string): boolean {
  return typeof raw === 'object' && raw !== null && clave in raw;
}

function estadoDe(v: unknown): EstadoTarjeta {
  return typeof v === 'string' && (ESTADOS as readonly string[]).includes(v) ? (v as EstadoTarjeta) : 'desconocido';
}

function tarjeta(v: unknown): TarjetaTablero | null {
  if (typeof v !== 'object' || v === null) return null;
  const r = v as Record<string, unknown>;
  // Sin `id` no hay a qué aplicar la acción de mover, y una tarjeta sin identidad no se puede seguir
  // entre columnas: se descarta en vez de pintarse con un id inventado.
  if (typeof r.id !== 'string' || r.id.trim() === '') return null;
  return {
    id: r.id,
    titulo: typeof r.titulo === 'string' ? r.titulo : '',
    cliente: typeof r.cliente === 'string' && r.cliente.trim() !== '' ? r.cliente.trim() : null,
    monto: importe(r.monto),
    fecha: typeof r.fecha === 'string' && r.fecha.trim() !== '' ? r.fecha.trim() : null,
    estado: estadoDe(r.estado),
  };
}

function columna(v: unknown): ColumnaTablero | null {
  if (typeof v !== 'object' || v === null) return null;
  const r = v as { id?: unknown; titulo?: unknown; tarjetas?: unknown };
  if (typeof r.id !== 'string' || !(IDS_COLUMNA as readonly string[]).includes(r.id)) return null;
  const tarjetas = Array.isArray(r.tarjetas) ? r.tarjetas : [];
  return {
    id: r.id as IdColumna,
    titulo: typeof r.titulo === 'string' && r.titulo.trim() !== '' ? r.titulo : r.id,
    tarjetas: tarjetas.map(tarjeta).filter((t): t is TarjetaTablero => t !== null),
  };
}

export async function leerTablero(): Promise<ConDisponibilidad<{ tablero: Tablero }>> {
  try {
    const raw = await apiClient.get<TableroRaw>('/mi-dia/tablero');
    if (!esRespuestaDelEndpoint(raw, 'columnas')) return { status: 'no_disponible' };
    const columnas = Array.isArray(raw.columnas) ? raw.columnas : [];
    return {
      status: 'ok',
      tablero: { columnas: columnas.map(columna).filter((c): c is ColumnaTablero => c !== null) },
    };
  } catch {
    return { status: 'no_disponible' };
  }
}

import type { Presupuesto } from '@copiloto/core';

/**
 * Lo que el prototipo pone arriba de la lista de presupuestos (`presu`, mapeo 2026-10-12): «Esperando
 * respuesta $325.000 · 2 sin contestar · 1 aceptado». Se DERIVA del listado que la pantalla ya tiene,
 * sin endpoint nuevo.
 *
 * 🔴 **`estado: null` no es «pendiente»** (docstring de `Presupuesto.estado`): es «el backend todavía
 * no manda este campo». Si ninguno trae estado, no hay resumen — `$0` sería un dato afirmado sobre uno
 * inexistente. Los reemplazados no cuentan: ya los sustituyó otro.
 */
export interface ResumenEspera {
  /** Suma de los pendientes, en centavos enteros (sin aritmética de float sobre dinero). */
  centavosEsperando: number;
  sinContestar: number;
  aceptados: number;
}

/** `'325000.00'` → `32500000`. Tolera sin decimales; un valor no numérico cuenta 0, no NaN. */
export function aCentavos(monto: string): number {
  const m = /^(-?\d+)(?:\.(\d{1,2}))?/.exec(monto.trim());
  if (m == null) return 0;
  const entero = Number(m[1]);
  const dec = Number((m[2] ?? '').padEnd(2, '0'));
  return entero * 100 + (entero < 0 || m[1].startsWith('-') ? -dec : dec);
}

export function resumenEspera(presupuestos: readonly Presupuesto[]): ResumenEspera | null {
  const vigentes = presupuestos.filter((p) => p.reemplazadoPor == null);
  if (!vigentes.some((p) => p.estado != null)) return null;
  let centavosEsperando = 0;
  let sinContestar = 0;
  let aceptados = 0;
  for (const p of vigentes) {
    if (p.estado === 'pendiente') {
      centavosEsperando += aCentavos(p.total);
      if (p.sinRespuesta === true) sinContestar += 1;
    } else if (p.estado === 'aprobado') {
      aceptados += 1;
    }
  }
  return { centavosEsperando, sinContestar, aceptados };
}

/** `32500000` → `'325000.00'`, el formato de string decimal que espera `formatearImporte`. */
export function centavosADecimal(centavos: number): string {
  const signo = centavos < 0 ? '-' : '';
  const abs = Math.abs(centavos);
  return `${signo}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}

/** El chip bajo la cifra: sólo lo que no es cero. `undefined` si no hay nada que decir. */
export function chipResumenEspera(r: ResumenEspera): string | undefined {
  const partes: string[] = [];
  if (r.sinContestar > 0) partes.push(`${r.sinContestar} sin contestar`);
  if (r.aceptados > 0) partes.push(`${r.aceptados} ${r.aceptados === 1 ? 'aceptado' : 'aceptados'}`);
  return partes.length > 0 ? partes.join(' · ') : undefined;
}

/** Días enteros desde `fecha` (ISO) hasta `ahora`; `null` si la fecha falta, no parsea o es futura. */
function diasDesde(fecha: string | undefined, ahora: Date): number | null {
  if (!fecha) return null;
  const ms = Date.parse(fecha);
  if (Number.isNaN(ms)) return null;
  const dias = Math.floor((ahora.getTime() - ms) / 86_400_000);
  return dias < 0 ? null : dias;
}

function textoDias(dias: number): string {
  if (dias === 0) return 'hoy';
  return dias === 1 ? '1 día' : `${dias} días`;
}

/**
 * El estado de la FILA del listado (`presu`, mapeo 2026-10-12): el prototipo dice «Aceptado», «Se
 * enfría · 31 días», «Enviado · 5 días» (`prototipo/index.html:2083,2088,2093`). Los DÍAS salen de
 * `Presupuesto.fecha` (ISO UTC, la misma que el backend usa para `sinRespuesta`: `presupuesto_store.py:154`),
 * no de un campo nuevo. `Presupuesto` no distingue «enviado» de «pendiente», así que no se inventa un
 * «Enviado»: la fila dice «Esperando respuesta · N días». `sinRespuesta` (más de 30 días, lo calcula el
 * backend) sigue siendo lo único que dice que se enfría. SM-L4, entrada 41.
 *
 * Sin `fecha` parseable no se inventan días: queda el texto sin ellos (el binario de antes).
 * `ahora` se inyecta para que el cálculo sea determinista en test.
 *
 * `estado: null` → `null`: es «el backend no lo manda», no «pendiente» (docstring de `Presupuesto.estado`).
 * Un reemplazado no tiene estado propio que mostrar: ya lo sustituyó otro.
 */
export function etiquetaEstado(
  p: Presupuesto,
  ahora: Date = new Date(),
): { texto: string; tono: 'exito' | 'tenue' } | null {
  if (p.reemplazadoPor != null || p.estado == null) return null;
  if (p.estado === 'aprobado') return { texto: 'Aceptado', tono: 'exito' };
  if (p.estado === 'pendiente') {
    const dias = diasDesde(p.fecha, ahora);
    if (p.sinRespuesta === true) {
      return { texto: dias != null ? `Se enfría · ${textoDias(dias)}` : 'Sin respuesta hace más de un mes', tono: 'tenue' };
    }
    return { texto: dias != null ? `Esperando respuesta · ${textoDias(dias)}` : 'Esperando respuesta', tono: 'tenue' };
  }
  return { texto: 'Desestimado', tono: 'tenue' };
}

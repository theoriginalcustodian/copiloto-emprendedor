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

/**
 * El estado de la FILA del listado (`presu`, mapeo 2026-10-12): el prototipo dice «Aceptado», «Se
 * enfría · 31 días», «Enviado · 5 días». Acá sólo lo que el dato respalda: `Presupuesto` no distingue
 * «enviado» de «pendiente» ni trae los días, así que no se inventa un «Enviado · N días» — `sinRespuesta`
 * (más de 30 días sin contestación, calculado por el backend) es lo único que dice que se enfría.
 *
 * `estado: null` → `null`: es «el backend no lo manda», no «pendiente» (docstring de `Presupuesto.estado`).
 * Un reemplazado no tiene estado propio que mostrar: ya lo sustituyó otro.
 */
export function etiquetaEstado(p: Presupuesto): { texto: string; tono: 'exito' | 'tenue' } | null {
  if (p.reemplazadoPor != null || p.estado == null) return null;
  if (p.estado === 'aprobado') return { texto: 'Aceptado', tono: 'exito' };
  if (p.estado === 'pendiente') {
    return p.sinRespuesta === true
      ? { texto: 'Sin respuesta hace más de un mes', tono: 'tenue' }
      : { texto: 'Esperando respuesta', tono: 'tenue' };
  }
  return { texto: 'Desestimado', tono: 'tenue' };
}

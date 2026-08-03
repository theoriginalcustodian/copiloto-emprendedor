import { apiClient } from './client';
import { ApiError } from './errors';
import type { CategoriaGasto } from './gastos';
import { esCategoriaValida } from './gastos';
import type { ConDisponibilidad } from './afip';

/**
 * `GET /contabilidad/resumen` — caja y facturación, **dos preguntas separadas**.
 *
 * Contrato: `coordinacion/abierto/2026-07-21_contrato_planificacion-a-todos_contabilidad.md` §4.
 * ✅ **El endpoint ya está desplegado** (PR#211, 2026-08-03) — verificado vivo por HTTP (`401`
 * auth-gated, no el catch-all del SPA). Este módulo se escribió contra la FORMA declarada antes de
 * que existiera; la degradación a `no_disponible` (405/501/catch-all) queda como red por si algún
 * deploy futuro lo tumba, no como el camino esperado de hoy en más.
 *
 * 🔴 **Caja ≠ facturación, y por eso son dos secciones que nunca se mezclan.** `caja` sale de
 * ingresos−gastos; `facturado` sale de comprobantes AFIP. Sumarlas contaría la misma plata dos veces
 * (una factura emitida no es caja hasta que se cobra) — la separación la hace el backend, este cliente
 * sólo la transporta tal cual.
 */

export interface CategoriaResumenContabilidad {
  categoria: CategoriaGasto;
  /** String decimal. */
  total: string;
  /** Decimal con 1 posición — NO garantizado que sume 100 (mismo criterio que `gastos.ts`). */
  porcentaje: number;
}

/**
 * ✅ **CONFIRMADO 2026-08-03** contra `apps/copiloto/contabilidad_web.py` (PR#211, mergeado a
 * `origin/main`): el trío es exactamente éste — `mes_anterior: {"entro", "salio", "queda"} | null`,
 * `null` sólo si NINGÚN lado (cobros/gastos) tiene una fila el mes anterior. Era
 * `[ASSUMED_PENDING_VERIFY]` hasta acá; ya no. Endpoint verificado vivo por HTTP (`401` auth-gated,
 * no el catch-all del SPA — control negativo contra una ruta inexistente da `200` HTML, discrimina).
 */
export interface CajaMesAnterior {
  entro: string;
  salio: string;
  queda: string;
}

export interface ResumenCaja {
  /** String decimal. */
  entro: string;
  /** String decimal. */
  salio: string;
  /** String decimal — **puede ser negativo**, y la UI lo tiene que poder mostrar así (§4.1). */
  queda: string;
  mesAnterior: CajaMesAnterior | null;
}

export interface ResumenGastosContabilidad {
  porCategoria: CategoriaResumenContabilidad[];
}

/**
 * `[ASSUMED_PENDING_VERIFY]` — **sigue así, y no por falta de código: backend manda `tope: null`
 * SIEMPRE hoy, a propósito.** Confirmado 2026-08-03 leyendo `contabilidad_web.py` (PR#211): sin
 * escala de monotributo vigente configurada, es deuda declarada de BACKEND ("un tope viejo mostrado
 * como vigente es peor que no mostrar ninguno"), condición de pago = cada publicación oficial de
 * ARCA. La forma de acá abajo (`valor`/`porcentaje`/`semaforo`) sigue siendo la mejor lectura del
 * contrato §4.3 pero **no hay ningún caso real contra el cual confirmarla todavía** — no se puede
 * verificar lo que nunca se envía. `semaforo` es `string` abierto (como `EstadoComprobante` en
 * `afip.ts`) para que un valor no anticipado no rompa nada, sólo no matchee ningún caso de color.
 */
export interface TopeMonotributo {
  /** String decimal — el tope de la escala vigente. */
  valor: string;
  /** 0-100. */
  porcentaje: number;
  semaforo: 'verde' | 'amarillo' | 'rojo' | (string & {});
}

export interface ResumenFacturado {
  /** String decimal — facturado en el período consultado. */
  periodo: string;
  /** String decimal — acumulado de los últimos 12 meses. */
  doceMeses: string;
  /** `null` = sin escala vigente configurada (fail-soft del §4.3): se muestra `doceMeses` solo, sin tope. */
  tope: TopeMonotributo | null;
}

export interface ClienteRanking {
  clienteRef: number;
  nombre: string;
  /** String decimal. */
  total: string;
}

export interface ResumenContabilidad {
  /** `YYYY-MM`. */
  periodo: string;
  caja: ResumenCaja;
  gastos: ResumenGastosContabilidad;
  facturado: ResumenFacturado;
  /** `[]` si Clientes todavía no está desplegado (§4.4) — degradación declarada, no un error. */
  clientes: ClienteRanking[];
}

interface CajaCruda {
  entro?: string;
  salio?: string;
  queda?: string;
  mes_anterior?: { entro?: string; salio?: string; queda?: string } | null;
}

interface TopeCrudo {
  valor?: string;
  porcentaje?: number;
  semaforo?: string;
}

interface FacturadoCrudo {
  periodo?: string;
  doce_meses?: string;
  tope?: TopeCrudo | null;
}

interface ClienteRankingCrudo {
  cliente_ref?: number;
  nombre?: string;
  total?: string;
}

interface ResumenCrudo {
  periodo?: string;
  caja?: CajaCruda;
  gastos?: { por_categoria?: { categoria?: string; total?: string; porcentaje?: number }[] | null };
  facturado?: FacturadoCrudo;
  clientes?: ClienteRankingCrudo[] | null;
}

function noDesplegado(err: unknown): boolean {
  return err instanceof ApiError && (err.status === 405 || err.status === 501);
}

/** Mismo criterio que `gastos.ts`: el catch-all del SPA responde 200/HTML sobre rutas inexistentes, así
 *  que se valida por FORMA (una clave propia de este endpoint), no por status. */
function esRespuestaDelEndpoint(raw: unknown, clave: string): boolean {
  return typeof raw === 'object' && raw !== null && clave in raw;
}

function caja(c: CajaCruda | undefined): ResumenCaja {
  const ma = c?.mes_anterior;
  return {
    entro: c?.entro ?? '0.00',
    salio: c?.salio ?? '0.00',
    queda: c?.queda ?? '0.00',
    mesAnterior: ma == null ? null : { entro: ma.entro ?? '0.00', salio: ma.salio ?? '0.00', queda: ma.queda ?? '0.00' },
  };
}

function tope(t: TopeCrudo | null | undefined): TopeMonotributo | null {
  if (t == null) return null;
  return {
    valor: t.valor ?? '0.00',
    porcentaje: typeof t.porcentaje === 'number' ? t.porcentaje : 0,
    semaforo: t.semaforo ?? 'verde',
  };
}

/**
 * El resumen de contabilidad — caja, gastos, facturado y mejores clientes en una sola llamada
 * (§4 del contrato: "un endpoint, cuatro secciones", justamente para que sumar una tarjeta después no
 * cambie el contrato de nadie).
 *
 * `periodo` opcional, `YYYY-MM` — sin él el backend usa el mes en curso.
 */
export async function obtenerResumenContabilidad(
  periodo?: string,
): Promise<ConDisponibilidad<{ resumen: ResumenContabilidad }>> {
  const qs = periodo !== undefined ? `?periodo=${encodeURIComponent(periodo)}` : '';
  try {
    const raw = await apiClient.get<ResumenCrudo>(`/contabilidad/resumen${qs}`);
    if (!esRespuestaDelEndpoint(raw, 'caja')) return { status: 'no_disponible' };

    const porCategoria: CategoriaResumenContabilidad[] = (raw.gastos?.por_categoria ?? []).map((c) => ({
      categoria: esCategoriaValida(c.categoria ?? '') ? (c.categoria as CategoriaGasto) : 'otros',
      total: c.total ?? '0.00',
      porcentaje: typeof c.porcentaje === 'number' ? c.porcentaje : 0,
    }));

    const clientes: ClienteRanking[] = (raw.clientes ?? []).map((c) => ({
      clienteRef: typeof c.cliente_ref === 'number' ? c.cliente_ref : 0,
      nombre: c.nombre ?? '',
      total: c.total ?? '0.00',
    }));

    return {
      status: 'ok',
      resumen: {
        periodo: raw.periodo ?? '',
        caja: caja(raw.caja),
        gastos: { porCategoria },
        facturado: {
          periodo: raw.facturado?.periodo ?? '0.00',
          doceMeses: raw.facturado?.doce_meses ?? '0.00',
          tope: tope(raw.facturado?.tope),
        },
        clientes,
      },
    };
  } catch (err) {
    if (noDesplegado(err)) return { status: 'no_disponible' };
    // Un 200 con el HTML del SPA (catch-all `@app.get`) explota en `res.json()`, no en `mapearError`:
    // llega acá como error de parseo, no como `ApiError`. Mismo criterio que `gastos.ts`.
    if (!(err instanceof ApiError)) return { status: 'no_disponible' };
    throw err;
  }
}

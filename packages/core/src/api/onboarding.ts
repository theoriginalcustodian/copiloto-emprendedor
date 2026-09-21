import { formatearImporte } from '../dinero/formatoDinero';
import { apiClient } from './client';
import type { ServicioCatalogo } from './catalogo';
import type { Portada } from './inteligencia';
import type { MeResponse } from './types';

/**
 * Onboarding de dos permisos + primer insight (K-14 / BL-X8). La lógica que decide QUÉ mostrar vive
 * acá para que web y mobile no diverjan; cada app sólo dibuja.
 */

/**
 * ¿Hay que mostrar el hilo? Sólo cuando el backend dijo `false` de forma explícita. Un backend
 * anterior al campo (ausente) o un `/me` que no se pudo leer NO dispara el onboarding: mostrarle una
 * bienvenida a alguien que lleva meses usando la app es peor que no mostrársela a un usuario nuevo.
 */
export function debeMostrarOnboarding(me: Pick<MeResponse, 'onboarding_completado'> | null | undefined): boolean {
  return me?.onboarding_completado === false;
}

/**
 * `POST /me/onboarding/completar` — sin body (el tenant sale del token), idempotente. Devuelve `false`
 * si no se pudo marcar: el hilo se cierra igual (el usuario ya lo vio) y se vuelve a intentar en el
 * próximo arranque en vez de trabarlo acá.
 */
export async function completarOnboarding(): Promise<boolean> {
  try {
    await apiClient.post<unknown>('/me/onboarding/completar');
    return true;
  } catch {
    return false;
  }
}

/** Los dos permisos del hilo. Google es UN consentimiento aunque el catálogo lo parta en toolkits. */
export type PermisoOnboarding = 'mercadopago' | 'google';

export interface PermisoDelHilo {
  id: PermisoOnboarding;
  /** El servicio del catálogo cuyo `connectPath` inicia el OAuth; `null` si el catálogo no lo trae. */
  servicio: ServicioCatalogo | null;
  conectado: boolean;
}

const esGoogle = (s: ServicioCatalogo): boolean => s.kind !== 'payments' && /^(gmail|google)/.test(s.key);

/**
 * Reduce el catálogo (6 servicios) a los 2 permisos reales. `conectado` de Google es «alguno de sus
 * toolkits está activo» — el usuario autorizó Google, no «Gmail» por separado. El servicio a vincular
 * es `gmail` si existe (el primero que el usuario espera) o el primer toolkit de Google que no esté
 * conectado.
 */
export function permisosDelHilo(catalogo: readonly ServicioCatalogo[]): readonly [PermisoDelHilo, PermisoDelHilo] {
  const mp = catalogo.find((s) => s.kind === 'payments') ?? null;
  const google = catalogo.filter(esGoogle);
  const paraVincular = google.find((s) => s.key === 'gmail') ?? google.find((s) => !s.conectado) ?? google[0] ?? null;
  return [
    { id: 'mercadopago', servicio: mp, conectado: mp?.conectado === true },
    { id: 'google', servicio: paraVincular, conectado: google.some((s) => s.conectado) },
  ];
}

/** Ambos permisos dados: el hilo salta directo al recibo. */
export function permisosCompletos(permisos: readonly PermisoDelHilo[]): boolean {
  return permisos.every((p) => p.conectado);
}

export type PrimerInsight =
  | { tipo: 'dato'; porCobrar: string; vencido: string | null }
  | { tipo: 'sin_dato' };

const positivo = (v: string | null): v is string => v != null && Number(v) > 0;

/**
 * El recibo de «te digo algo que no sabés»: `por_cobrar.total` de la portada. Ausente, «0» o portada
 * que no llegó → `sin_dato`. Nunca se fabrica una cifra (mismo criterio que la portada: «—», jamás un
 * «$0» fantasma) — el texto de `sin_dato` lo pone la app y dice la verdad: no hay facturas pendientes.
 */
export function primerInsight(portada: Portada | null | undefined): PrimerInsight {
  const total = portada?.porCobrar.total ?? null;
  if (!positivo(total)) return { tipo: 'sin_dato' };
  const vencido = portada?.porCobrar.vencido ?? null;
  return { tipo: 'dato', porCobrar: total, vencido: positivo(vencido) ? vencido : null };
}

/** El texto del recibo, igual en web y mobile: «Tenés $147.000 facturados sin cobrar…» o la verdad. */
export function textoDelInsight(insight: PrimerInsight): string {
  if (insight.tipo === 'sin_dato') return 'Todavía no tenés facturas pendientes.';
  const base = `Tenés ${formatearImporte(insight.porCobrar)} facturados sin cobrar`;
  return insight.vencido != null ? `${base}, y ${formatearImporte(insight.vencido)} ya vencidos.` : `${base}.`;
}

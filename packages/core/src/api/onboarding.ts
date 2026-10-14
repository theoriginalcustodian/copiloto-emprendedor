import { formatearImporte } from '../dinero/formatoDinero';
import { apiClient } from './client';
import { ApiError, codigoDeConflicto } from './errors';
import type { ServicioCatalogo } from './catalogo';
import type { PerfilNegocio } from './perfilNegocio';
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
 * 🔴 **El perfil mínimo del primer ingreso (SM-C3) — UNA definición para las dos apps.**
 *
 * El backend es el que manda: `POST /me/onboarding/completar` devuelve **409**
 * `perfil_minimo_incompleto` con `faltantes` si alguno está vacío (`46cd8cc0`). Esto no
 * re-decide la regla — la refleja del lado del cliente para que el paso del onboarding sepa qué
 * pedir **antes** de llamar, en vez de descubrirlo por un error.
 *
 * Vive pegado a `debeMostrarOnboarding` y con **una sola** definición a propósito (DoD 1): el día
 * que `esAnulable` se definió dos veces, el fix llegó a una sola mitad.
 *
 * ⚠️ **`aQuien` NO entra, aunque sería el tercero natural** (decide A vs B): su default es
 * `"ambos"` y el `upsert` crea la fila con los defaults, así que un check de «no vacío» sobre él
 * **siempre pasa** — un gate hueco. Exigirlo necesita un tercer estado en el schema. Deuda
 * nombrada, no silenciada.
 */
export const CAMPOS_PERFIL_MINIMO = ['queVende', 'nombreComercial'] as const;

export type CampoPerfilMinimo = (typeof CAMPOS_PERFIL_MINIMO)[number];

/** Cómo viaja cada campo en el `faltantes` del 409 (el backend habla snake_case). */
export const CAMPO_PERFIL_MINIMO_BACKEND: Record<CampoPerfilMinimo, string> = {
  queVende: 'que_vende',
  nombreComercial: 'nombre_comercial',
};

type PerfilMinimo = Partial<Pick<PerfilNegocio, CampoPerfilMinimo>>;

/**
 * Qué falta del perfil mínimo. **Vacío o sólo espacios cuenta como vacío**, igual que el backend
 * (`.strip()` allá, `.trim()` acá: si los dos lados no coinciden, la app deja pasar algo que el
 * server rechaza y el usuario ve un 409 que la pantalla ya podía evitar).
 *
 * Un perfil ausente (`null`/`undefined`) devuelve **los dos**: fail-closed. No haber podido leer el
 * perfil no es «está completo» — ese degradado hacia el caso benigno es exactamente el que
 * convierte un gate en decoración.
 */
export function faltantesDelPerfilMinimo(
  perfil: PerfilMinimo | null | undefined,
): readonly CampoPerfilMinimo[] {
  return CAMPOS_PERFIL_MINIMO.filter((campo) => (perfil?.[campo] ?? '').trim() === '');
}

/** `true` sólo si los dos campos tienen contenido real. Lo que las dos apps consultan. */
export function perfilMinimoCompleto(perfil: PerfilMinimo | null | undefined): boolean {
  return faltantesDelPerfilMinimo(perfil).length === 0;
}

/**
 * Qué pasó al cerrar el hilo. **Reemplaza el `boolean`**, que colapsaba dos cosas distintas:
 * «no se pudo marcar, se reintenta solo» y «el backend RECHAZÓ porque falta el perfil mínimo».
 * Con el 409 de SM-C3 esa diferencia dejó de ser cosmética: en el primer caso cerrar el hilo es
 * correcto, en el segundo cerrarlo manda a la persona a un shell al que el server no la va a
 * dejar entrar, **sin decirle qué le falta**.
 */
export type ResultadoCompletarOnboarding =
  | { ok: true }
  /** 409 `perfil_minimo_incompleto`: el hilo NO se cierra, se pide lo que falta. */
  | { ok: false; perfilIncompleto: true; faltantes: readonly CampoPerfilMinimo[] }
  /** Cualquier otro fallo (red, 500, token): el hilo se cierra igual y se reintenta al próximo arranque. */
  | { ok: false; perfilIncompleto: false };

/**
 * Lee `faltantes` del 409. Si no viene, o no se reconoce ninguno, devuelve **los dos**: no saber
 * cuál falta no habilita a adivinar que falta uno solo — pedir los dos cuesta dos campos, dejar
 * pasar al que faltaba cuesta el deadlock que esta ficha vino a cerrar.
 */
function faltantesDelBody(body: unknown): readonly CampoPerfilMinimo[] {
  const detalle = typeof body === 'object' && body !== null ? (body as { detail?: unknown }).detail : undefined;
  const nivel = typeof detalle === 'object' && detalle !== null ? (detalle as Record<string, unknown>) : (body as Record<string, unknown> | undefined);
  const crudos = nivel?.faltantes;
  if (!Array.isArray(crudos)) return CAMPOS_PERFIL_MINIMO;
  const reconocidos = CAMPOS_PERFIL_MINIMO.filter((campo) => crudos.includes(CAMPO_PERFIL_MINIMO_BACKEND[campo]));
  return reconocidos.length > 0 ? reconocidos : CAMPOS_PERFIL_MINIMO;
}

/**
 * `POST /me/onboarding/completar` — sin body (el tenant sale del token), idempotente.
 *
 * 🔴 **Antes devolvía `boolean` y los dos call-sites lo descartaban** con el comentario «false = no
 * se pudo marcar: se cierra igual y se reintenta al próximo arranque». Eso era cierto mientras el
 * endpoint no pudiera RECHAZAR. Desde `46cd8cc0` puede: devuelve **409**
 * `perfil_minimo_incompleto`, y tragárselo dejaba el peor de los dos mundos — el hilo se cerraba
 * «bien», la app no sabía por qué, y la persona quedaba contra un gate que no explica nada.
 *
 * El código se lee con `codigoDeConflicto(err.body)`, **no** por el texto del `detail`: discriminar
 * por redacción es atarse a algo que el backend cambia sin avisar (lo dice el docstring de
 * `ApiError.body`, que existe justamente para esto).
 */
export async function completarOnboarding(): Promise<ResultadoCompletarOnboarding> {
  try {
    await apiClient.post<unknown>('/me/onboarding/completar');
    return { ok: true };
  } catch (err) {
    if (err instanceof ApiError && codigoDeConflicto(err.body) === 'perfil_minimo_incompleto') {
      return { ok: false, perfilIncompleto: true, faltantes: faltantesDelBody(err.body) };
    }
    return { ok: false, perfilIncompleto: false };
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

/**
 * Lo que el chip «Armame el detalle» del recibo le dice al chat principal (fila `onb-cumplida`,
 * divergencia #5 del mapeo). Es **un pedido autocontenido**: el hilo al que entra el emprendedor no
 * vio el recibo, así que el texto no puede depender de «lo de recién». Lo manda el emprendedor por el
 * puente de `mensajePendiente` — el detalle lo arma el agente con sus herramientas, NO la portada
 * (`porCobrar` sólo trae total + vencido, sin desglose por cliente).
 */
export const PEDIDO_DETALLE_POR_COBRAR =
  'Armame el detalle de quiénes son los clientes con facturas sin cobrar y cuáles están vencidas.';

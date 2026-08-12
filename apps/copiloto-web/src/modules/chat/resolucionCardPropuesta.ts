/**
 * Guard cross-reload de las cards `*_propuesto` (contrato
 * `planificacion-a-frontend_guard-cross-reload-de-cards-propuesto`, 2026-08-12, cerrado en #419 para
 * `presupuesto_propuesto`). Acá se extrae la parte genérica —lectura/escritura best-effort en
 * `localStorage`, por mensaje— para que `gasto_propuesto`/`cliente_propuesto`/`ingreso_propuesto` no
 * repitan la misma función 3 veces más; la validación del shape de cada `T` sigue siendo de cada
 * card, igual que documenta `TarjetaPropuestaShell` de mobile: "los estados terminales son de cada
 * Tarjeta, no del shell".
 *
 * Clave: `${prefix}:${mensajeId}` — el `prefix` es el mismo que ya usaba `presupuesto_propuesto`
 * (`copiloto-presupuesto-propuesto-resuelto`) para no invalidar lo ya guardado en browsers reales.
 *
 * Best-effort: si `localStorage` falla (privado/cuota/SSR), se degrada a `null`/no-op — la card
 * vuelve a mostrarse editable, que es el comportamiento de ANTES del guard, nunca un crash.
 */

export function claveResolucionCard(prefix: string, mensajeId: string): string {
  return `${prefix}:${mensajeId}`;
}

/** Devuelve el valor crudo parseado, o `null` si no hay nada o `localStorage`/JSON fallan. Cada
 *  card valida el shape de lo que recibe — acá no se asume nada sobre `T`. */
export function leerResolucionCardCruda(storageKey: string): unknown | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(storageKey);
    return raw ? (JSON.parse(raw) as unknown) : null;
  } catch {
    return null;
  }
}

export function guardarResolucionCard(storageKey: string, resolucion: unknown): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(resolucion));
  } catch {
    // best-effort — que falle la marca local no puede tumbar un guardado que sí ocurrió en el backend.
  }
}

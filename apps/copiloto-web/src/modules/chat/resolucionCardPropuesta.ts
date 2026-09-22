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

/**
 * Prefijos de las 4 tarjetas `*_propuesto` que usan este guard (A) — centralizados acá (en vez de
 * repetidos en cada `Tarjeta*.tsx`) para que `podarResolucionesCard` no pueda desalinearse de la
 * lista real de prefijos que existen.
 */
export const PREFIJO_RESOLUCION_PRESUPUESTO = 'copiloto-presupuesto-propuesto-resuelto';
export const PREFIJO_RESOLUCION_GASTO = 'copiloto-gasto-propuesto-resuelto';
export const PREFIJO_RESOLUCION_CLIENTE = 'copiloto-cliente-propuesto-resuelto';
export const PREFIJO_RESOLUCION_INGRESO = 'copiloto-ingreso-propuesto-resuelto';

const PREFIJOS_RESOLUCION_CARD = [
  PREFIJO_RESOLUCION_PRESUPUESTO,
  PREFIJO_RESOLUCION_GASTO,
  PREFIJO_RESOLUCION_CLIENTE,
  PREFIJO_RESOLUCION_INGRESO,
] as const;

/**
 * PODA (BL-V32) — el guard A nunca borraba (`claveResolucionCard`/`guardarResolucionCard` no tienen
 * contraparte de limpieza): al arrancar una sesión nueva, `useChat.ts` borra los MENSAJES de la
 * sesión previa pero dejaba las marcas de resolución de esos mensajes huérfanas para siempre (medido
 * en prod: ~20 claves acumuladas en un solo tenant de prueba). Llamar con los `id` de los mensajes
 * que se están descartando; best-effort, igual que el resto del módulo.
 */
export function podarResolucionesCard(mensajeIds: readonly string[]): void {
  if (typeof window === 'undefined') return;
  for (const mensajeId of mensajeIds) {
    for (const prefix of PREFIJOS_RESOLUCION_CARD) {
      try {
        window.localStorage.removeItem(claveResolucionCard(prefix, mensajeId));
      } catch {
        // best-effort — no bloquea el reset de sesión si localStorage falla.
      }
    }
  }
}

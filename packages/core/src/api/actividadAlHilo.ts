/**
 * SM-P19 mitad B (lado app) — «lo que GUARDAS en una función aparece como turno en el chat».
 *
 * El backend (`apps/copiloto/actividad_al_hilo.py`, #1785) inserta el turno `actividad_registrada` en el hilo
 * SÓLO si el guardado trae `session_id` en el body; sin él es un no-op (la app vieja, o un guardado hecho
 * fuera del chat). El `cliente_id` sale siempre del token, nunca del body.
 *
 * Un solo punto de verdad: el chat principal publica acá su `session_id` activo (`fijarSessionIdActividad`) y
 * cada guardado lo agrega con `conSessionIdActividad`. Así las 5 funciones no necesitan conocer el hilo, y no
 * hay cinco copias del cableado que diverjan. `null` (aún sin hilo, o sesión cerrada) ⇒ el body queda igual.
 */
let sessionIdActual: string | null = null;

/** El chat principal lo llama al resolver/rotar su `session_id`; `null` al cerrar sesión. */
export function fijarSessionIdActividad(id: string | null): void {
  sessionIdActual = id != null && id !== '' ? id : null;
}

/**
 * El chat principal se suscribe para «ponerse al día» tras un guardado. Medido en device (2026-11-07): el turno
 * `actividad_registrada` llegaba al hilo en el servidor, pero el polling de `useChat` sólo corre mientras se
 * espera la respuesta de un mensaje ENVIADO — el turno de un guardado aparecía recién al reiniciar la app.
 */
type Oyente = () => void;
const oyentes = new Set<Oyente>();

/** Devuelve la función que cancela la suscripción. */
export function alGuardarActividad(oyente: Oyente): () => void {
  oyentes.add(oyente);
  return () => {
    oyentes.delete(oyente);
  };
}

/**
 * Devuelve el body con `session_id` si hay hilo activo; si no, el MISMO body (no se inventa un hilo).
 * Con hilo activo avisa a los oyentes: hay un guardado en vuelo que va a dejar un turno en ese hilo.
 */
export function conSessionIdActividad<T extends object>(body: T): T {
  if (sessionIdActual == null) return body;
  oyentes.forEach((o) => {
    try {
      o();
    } catch {
      /* un oyente roto no puede romper el guardado. */
    }
  });
  return { ...body, session_id: sessionIdActual } as T;
}

/**
 * Aviso de «la sesión murió», para que la app pueda reaccionar (CTA5).
 *
 * Hoy, cuando una sesión muere de verdad, el core limpia los tokens y lanza `UnauthorizedError`.
 * La pantalla que hizo la request muestra ese error —en inglés, crudo, el `detail` del backend— y el
 * usuario se queda ahí sin entender qué pasó. Lo que falta no es el dato: es que **alguien se entere
 * a tiempo** para llevarlo al login con un mensaje en castellano.
 *
 * Por qué una suscripción y no un callback en `ConfigApi`: `configurarApi()` se llama en el arranque
 * del módulo —`apps/copiloto-web/src/adapters/plataforma.ts:16`, `apps/mobile/.../plataforma.ts:12`—
 * **antes** de que React monte, así que el adapter no tiene ningún `setState` que pasar. Meterle uno
 * obligaría al adapter de transporte a conocer el estado de sesión de la UI: dos capas que hoy están
 * separadas a propósito (ADR-010).
 *
 * El core no sabe de React ni de plataformas: una implementación, dos consumidores.
 */

type Escucha = () => void;

const escuchas = new Set<Escucha>();

/**
 * El texto que ve el emprendedor cuando su sesión murió. Vive acá —y no en cada pantalla de login—
 * porque el contrato de CTA5 pide **el mismo comportamiento en mobile y web**, y dos literales
 * separados divergen en silencio: el día que alguien mejore la redacción va a mejorarla en una sola
 * plataforma y nadie se va a enterar.
 *
 * Es lo único de este módulo que es copy de UI. Va junto al aviso, no en el design-system, porque su
 * razón de existir es este evento y no un estilo compartido.
 */
export const MENSAJE_SESION_EXPIRADA = 'Tu sesión expiró. Entrá de nuevo.';

/**
 * Suscribe un aviso de «la sesión murió». Devuelve la función para desuscribir —pensada para
 * devolverla tal cual desde un `useEffect`, que es como la consumen los dos `SessionProvider`.
 */
export function alExpirarSesion(cb: Escucha): () => void {
  escuchas.add(cb);
  return () => {
    escuchas.delete(cb);
  };
}

/**
 * Lo llama **sólo el core**, en el punto donde ya se limpió la sesión por un 401 que la mató de
 * verdad (no en cualquier 401: ver `sesionMuerta` en `client.ts`).
 *
 * Se itera sobre una copia y cada suscriptor va en su propio `try`: un listener que tira no puede
 * romper el manejo del error que lo disparó, ni impedir que los demás se enteren. Sin esto, el
 * aviso quedaría a merced del primer consumidor con un bug.
 */
export function notificarSesionExpirada(): void {
  for (const cb of [...escuchas]) {
    try {
      cb();
    } catch {
      /* aislado a propósito: el fallo de un suscriptor no se propaga */
    }
  }
}

/**
 * Captura global del runtime de la PWA — item 0.5b del frente de manejo de errores.
 *
 * Medido antes de escribir esto: **0** `window.onerror` y **0** `unhandledrejection` en toda la PWA,
 * y de sus 27 `catch`, **ninguno** deja rastro. Un fallo fuera de un `catch` desaparecía sin dejar
 * nada: ni en pantalla, ni en consola con contexto, ni en ningún lado consultable después.
 *
 * **Por qué esto NO lo cubre un `ErrorBoundary`.** React sólo atrapa errores lanzados durante el
 * *render* de sus hijos. Quedan afuera —y son la mayoría en una app que habla con una API— los
 * handlers de eventos, los `setTimeout`, y sobre todo las **promesas rechazadas sin `catch`**, que
 * es el modo de fallo natural de cada `fetch` que nadie envolvió. Los dos mecanismos son
 * complementarios: el boundary salva la pantalla, esto salva la *información*.
 *
 * **Qué NO hace, a propósito:**
 *   - No muestra nada al usuario. Interrumpir por un rechazo asíncrono que quizá era inocuo molesta
 *     más de lo que ayuda; lo que se ve es tarea del boundary.
 *   - No manda nada a ningún servidor. Todavía no existe el endpoint de captura (Fase 1). Cuando
 *     exista, este es el único lugar a tocar: `alError` es el gancho.
 *
 * Idempotente: llamarlo dos veces no duplica listeners (el flag `instalado`).
 */

type Reporte = {
  origen: 'window.onerror' | 'unhandledrejection';
  mensaje: string;
  error?: unknown;
};

let instalado = false;

/** Deja el rastro. Hoy consola con prefijo estable (grepeable); en Fase 1 se cablea a la captura. */
function porDefecto(r: Reporte): void {
  // `console.error` y no `.warn`: es el nivel que las herramientas de la plataforma retienen.
  console.error(`[copiloto:${r.origen}] ${r.mensaje}`, r.error ?? '');
}

export function instalarCapturaGlobal(alError: (r: Reporte) => void = porDefecto): () => void {
  if (instalado) return () => {};
  instalado = true;

  const onError = (ev: ErrorEvent): void => {
    // Nunca dejar que registrar un error genere otro: si el reporter falla, se traga en silencio
    // — es la única vez que tragar es correcto, porque la alternativa es un loop de errores.
    try {
      alError({ origen: 'window.onerror', mensaje: ev.message, error: ev.error });
    } catch {
      /* noop deliberado */
    }
  };

  const onRejection = (ev: PromiseRejectionEvent): void => {
    try {
      const razon = ev.reason;
      const mensaje = razon instanceof Error ? razon.message : String(razon);
      alError({ origen: 'unhandledrejection', mensaje, error: razon });
    } catch {
      /* noop deliberado */
    }
  };

  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onRejection);

  return () => {
    window.removeEventListener('error', onError);
    window.removeEventListener('unhandledrejection', onRejection);
    instalado = false;
  };
}

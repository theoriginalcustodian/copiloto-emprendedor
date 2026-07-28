/**
 * El puerto de red (ADR-010) — el ÚNICO lugar por donde una plataforma toca la red. **Cero DOM**:
 * nada acá adentro importa `fetch`/`Blob`/`FormData`/`Response` — esos tipos viven del lado del
 * adaptador de cada plataforma (`http.web.ts` en web, su equivalente en React Native).
 */

export interface RespuestaHttp {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}

/**
 * Un archivo a subir. `datos` es OPACO a propósito: es un `Blob` en web y un `{uri, ...}` en React
 * Native. El core NUNCA lo inspecciona — sólo lo transporta hasta el adaptador, que es el único que
 * sabe qué es y cómo adjuntarlo al multipart real de su plataforma.
 */
export interface ArchivoSubida {
  /** filename, ej. `'voz.webm'`. */
  nombre: string;
  mime: string;
  datos: unknown;
}

/**
 * Cuánto se espera una respuesta antes de cortar. **Un `fetch` sin timeout no falla: cuelga.** Si la
 * red se muere a mitad de una request —el caso típico del celular que cambia de wifi a datos— la
 * promesa nunca resuelve ni rechaza, y la pantalla queda con el spinner puesto para siempre: sin
 * error, sin reintento, sin nada que tocar salvo matar la app.
 *
 * 20 s es holgado para todo lo que este cliente pide (el endpoint más lento es la emisión, y esa la
 * arranca el backend en un workflow y se sigue poleando, no se espera en la request).
 */
export const TIMEOUT_HTTP_MS = 20_000;

export interface PeticionHttp {
  /** `PATCH` lo usa `actualizarCliente` (edición parcial del cliente); `DELETE`, `quitarItem` de
   * facturación (`DELETE /afip/facturas/{id}/items/{indice}`). Los adaptadores pasan este valor tal
   * cual a `fetch()` (`RequestInit.method`), sin ramificar por método — re-verificado el 2026-07-21
   * contra `http.native.ts:55` y `http.web.ts:41`, así que sumar un método a esta unión no les pide
   * ningún cambio. */
  metodo: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  /** Path relativo, ej. `'/chat'`. El adaptador le antepone el `apiBase` de su plataforma. */
  path: string;
  headers: Record<string, string>;
  /** Cuerpo JSON. Excluyente con `multipart`. */
  cuerpoJson?: unknown;
  /** Cuerpo `multipart/form-data`. Excluyente con `cuerpoJson`. */
  multipart?: { campos: Record<string, string>; campoArchivo: string; archivo: ArchivoSubida };
  /**
   * Corte por tiempo, en ms. El adaptador aborta la request al vencer y el core lo traduce a un
   * `ApiError` 408. Ausente → el adaptador aplica `TIMEOUT_HTTP_MS`.
   *
   * Un `0` DESACTIVA el corte, y es deliberado que haya que escribirlo: subir audio por una red
   * lenta puede tardar mucho más que cualquier request JSON, y matarlo a los 20 s perdería una
   * grabación que el usuario ya hizo.
   */
  timeoutMs?: number;
}

export interface HttpPort {
  enviar(peticion: PeticionHttp): Promise<RespuestaHttp>;
}

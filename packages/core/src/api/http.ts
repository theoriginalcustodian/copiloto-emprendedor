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
}

export interface HttpPort {
  enviar(peticion: PeticionHttp): Promise<RespuestaHttp>;
}

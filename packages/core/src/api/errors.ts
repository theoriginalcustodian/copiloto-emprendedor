import type { OpcionGenero, Cliente } from './types';

/** Error base de la API — siempre trae el status HTTP para que el caller pueda ramificar. */
export class ApiError extends Error {
  readonly status: number;
  readonly detail?: string;
  /**
   * El body ya parseado de la respuesta que falló, cuando era JSON (`undefined` si no lo era o vino
   * vacío).
   *
   * 🔴 **Existe porque el `detail` string no alcanza para ramificar, y su ausencia ya costó una
   * degradación.** Un mismo status puede tener dos causas distinguibles sólo por lo que el backend
   * adjunta: `409` de `POST /presupuestos/{id}/facturar` es "ya fue facturado" **con `factura_id`**, o
   * "falta el perfil fiscal" **sin él**. Discriminar por el texto del `detail` sería atarse a una
   * redacción que el backend puede cambiar sin avisar; la presencia de un campo es estructura.
   *
   * Sin esto, el único camino era bajar a `http.enviar` crudo para leer el body uno mismo — que es
   * exactamente lo que hizo `crearCliente` (`clientes.ts`) y por eso ese endpoint **no tiene
   * refresh-on-401**: un token vencido justo ahí desloguea al usuario en vez de renovarse en
   * silencio. Se expone acá para que nadie más pague ese precio.
   */
  readonly body?: unknown;

  constructor(status: number, message: string, detail?: string, body?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
    this.body = body;
  }
}

/** 401 — token ausente/inválido/expirado. El caller debe volver a login. */
export class UnauthorizedError extends ApiError {
  constructor(detail?: string, body?: unknown) {
    super(401, detail ?? 'No autorizado', detail, body);
    this.name = 'UnauthorizedError';
  }
}

/** 403 — token válido pero sin tenant habilitado. */
export class ForbiddenError extends ApiError {
  constructor(detail?: string, body?: unknown) {
    super(403, detail ?? 'Cuenta no habilitada', detail, body);
    this.name = 'ForbiddenError';
  }
}

/**
 * Motivo del 409 de `POST /clientes` (lo declara el backend, adaptado de ADR-004 §5 /
 * `web_documed.py::crear_paciente_route` en el origen de este código):
 * - `similitud`: hay un cliente PARECIDO (nombre + fecha de nacimiento). Es FORZABLE: si de verdad
 *   es otra persona, `forzar:true` lo crea igual.
 * - `dni_duplicado`: el DNI ya existe en este tenant. NO es forzable — el `UNIQUE (cliente_id, dni)`
 *   lo rechaza aunque se reintente con `forzar:true`. La UI ofrece sólo "usar el existente".
 */
export type MotivoDuplicado = 'similitud' | 'dni_duplicado';

/**
 * 409 de `POST /clientes` — hay un candidato de duplicado probable (`similitud`) o el DNI ya existe
 * en este tenant (`dni_duplicado`). Se tipa aparte de `ApiError` genérico (misma familia que
 * `UnauthorizedError`/`ForbiddenError`) para que el caller (`AltaClienteForm`) pueda mostrar
 * "¿es alguno de estos?" en vez de un error genérico — decide: usar un candidato existente, o (sólo
 * si `motivo === 'similitud'`) reintentar con `forzar:true`.
 *
 * `candidatos` puede venir VACÍO cuando el 409 es por DNI duplicado y el lookup best-effort del
 * cliente existente falló; el camino de similitud siempre trae candidatos no-vacíos.
 */
export class DuplicadoProbableError extends ApiError {
  readonly candidatos: Cliente[];
  readonly motivo: MotivoDuplicado;

  constructor(candidatos: Cliente[], motivo: MotivoDuplicado) {
    super(409, 'ya existe un cliente parecido');
    this.name = 'DuplicadoProbableError';
    this.candidatos = candidatos;
    this.motivo = motivo;
  }
}

/**
 * 400 de `POST /clientes` y `PATCH /clientes/{id}` — el `genero` mandado no está en el catálogo
 * vivo (adaptado de `documed_generos`; ver el equivalente de `patients_store.GeneroInvalidoError`
 * en el backend de origen). Se tipa aparte de `ApiError` genérico (mismo criterio que
 * `DuplicadoProbableError`) para que el caller pueda RE-OFRECER de inmediato las opciones válidas que
 * el backend adjunta en el propio error, sin tener que volver a pedir `GET /clientes/opciones` para
 * reparar el desincronismo.
 */
export class GeneroInvalidoError extends ApiError {
  readonly genero: string | null;
  readonly generos: OpcionGenero[];

  constructor(genero: string | null, generos: OpcionGenero[]) {
    super(400, `género "${genero ?? ''}" no está en el catálogo`);
    this.name = 'GeneroInvalidoError';
    this.genero = genero;
    this.generos = generos;
  }
}

import type { OpcionGenero, Cliente } from './types';

/** Error base de la API — siempre trae el status HTTP para que el caller pueda ramificar. */
export class ApiError extends Error {
  readonly status: number;
  readonly detail?: string;

  constructor(status: number, message: string, detail?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
  }
}

/** 401 — token ausente/inválido/expirado. El caller debe volver a login. */
export class UnauthorizedError extends ApiError {
  constructor(detail?: string) {
    super(401, detail ?? 'No autorizado', detail);
    this.name = 'UnauthorizedError';
  }
}

/** 403 — token válido pero sin tenant habilitado. */
export class ForbiddenError extends ApiError {
  constructor(detail?: string) {
    super(403, detail ?? 'Cuenta no habilitada', detail);
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

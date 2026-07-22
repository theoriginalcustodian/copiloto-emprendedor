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

/*
 * 🪦 **Acá vivían `MotivoDuplicado`, `DuplicadoProbableError` y `GeneroInvalidoError`, de la app
 * CLÍNICA. Borrados el 2026-07-22** junto con los tipos que consumían (`api/types.ts`).
 *
 * 🔴 **Eran la trampa mejor puesta del repo, y apuntaban justo al trabajo del hito 7.**
 * `DuplicadoProbableError` decía en su docstring ser el `409` de `POST /clientes` — el mismo status
 * del mismo endpoint que el contrato §3.4 define — con OTRO significado: `similitud`/`dni_duplicado`
 * y una lista de `candidatos` forzable con `forzar:true`. El contrato de este producto dice otra
 * cosa: el documento ya es de otro cliente, y viene **el id del dueño** para llevar al usuario a su
 * ficha. Sin fusión y sin forzar.
 *
 * Quien implementara el 409 iba a encontrar en el barril una clase con el nombre exacto de lo que
 * necesitaba, importarla, y ramificar por `motivo` — un campo que este backend nunca manda. La rama
 * "es un duplicado" no se habría ejecutado jamás, sin error y sin test en rojo.
 *
 * `ApiError.body` es lo que resuelve este caso hoy (ver su docstring). No revivir esto.
 */


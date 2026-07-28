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
 * Los códigos de conflicto que el backend adjunta a **todo `409`** desde el 2026-07-22.
 *
 * 🔴 **Antes de esto, cada `409` se reconocía por su ESTRUCTURA — y uno se reconocía por no tener
 * ninguna.** Eso funciona hasta que aparece un caso nuevo: el nuevo cae en la rama del que se
 * identificaba por descarte y se muestra con **su** mensaje. No falla: acusa a otro. Ya pasó dos veces
 * el mismo día en `POST /presupuestos/{id}/facturar` — «ya se facturó» salía como *«falta tu CUIT»*, y
 * después «está desestimado» cayó en la misma rama. Ver [[discriminar-por-ausencia-de-estructura]].
 *
 * Ahora cada caso se reconoce **por algo que TRAE**. La lista está cerrada del lado del backend
 * (`errores_web.CODIGOS`), que valida el código al construir el error: uno inventado revienta ahí, no
 * en silencio acá.
 */
export type CodigoConflicto =
  | 'presupuesto_ya_facturado'
  | 'falta_cuit'
  | 'presupuesto_no_facturable'
  | 'transicion_invalida'
  | 'concepto_duplicado'
  | 'ingreso_duplicado_probable'
  | 'documento_de_otro_cliente'
  | 'sin_certificado_afip'
  | 'ambiente_no_vinculado'
  | 'sin_perfil_fiscal'
  | 'modo_automatico_no_disponible'
  /** El gate HITL no tomó la confirmación (factura o anulación). El porqué puntual viaja aparte, en
   *  `motivo_codigo`: `token_desactualizado` · `faltan_datos` · `fuera_de_gate`. */
  | 'confirmacion_no_tomada';

/**
 * El `codigo` de un `409`, o `null` si el body no lo trae.
 *
 * ⚠️ **`null` NO significa "no es un conflicto conocido": significa que ESTE deploy todavía no manda
 * el código.** Por eso los lectores que lo usan conservan su discriminación por estructura como
 * fallback — si la tiraran, un rollback del backend convertiría cada 409 en genérico. El código es
 * mejor camino, no el único.
 */
export function codigoDeConflicto(body: unknown): CodigoConflicto | null {
  if (typeof body !== 'object' || body === null) return null;
  const detalle = (body as { detail?: unknown }).detail;
  const nivel = typeof detalle === 'object' && detalle !== null ? (detalle as Record<string, unknown>) : (body as Record<string, unknown>);
  const c = nivel.codigo;
  return typeof c === 'string' && c !== '' ? (c as CodigoConflicto) : null;
}

/** El `mensaje` legible que acompaña al código. Es el texto que el emprendedor puede leer — el código
 *  es para la app, no para la persona. */
export function mensajeDeConflicto(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) return null;
  const detalle = (body as { detail?: unknown }).detail;
  if (typeof detalle === 'string' && detalle.trim() !== '') return detalle;
  if (typeof detalle === 'object' && detalle !== null) {
    const m = (detalle as { mensaje?: unknown }).mensaje;
    if (typeof m === 'string' && m.trim() !== '') return m;
  }
  return null;
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


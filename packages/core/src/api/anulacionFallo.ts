import { ApiError } from './errors';

/** El texto que ve el emprendedor cuando anular un comprobante no pudo llevarse a cabo. */
export const TEXTO_ANULACION_FALLO = 'No pudimos completar la anulación. Probá de nuevo.';

/** `anularComprobante` devolvió `no_disponible` (503 / app de AFIP no montada): no es un error de red. */
export const TEXTO_ANULACION_NO_DISPONIBLE =
  'La anulación todavía no está disponible. Probá de nuevo en un rato.';

/**
 * Por qué falló anular o confirmar la nota de crédito, en palabras de la persona (SM-D7, #1009).
 *
 * Los dos pasos del flujo (`anularComprobante` → `confirmarAnulacion`) lanzan `ApiError` cuando el backend
 * contesta con error, y el 409 de confirmar trae `{motivo, motivo_codigo}` (la confirmación no se tomó,
 * p. ej. la anulación ya quedó `fallida`). Se prefiere el `motivo` que el backend ya redactó; sin él, el
 * `detail`; sin ninguno de los dos, un texto genérico — **nunca** silencio: que la persona crea que se
 * anuló una factura fiscal que sigue vigente es peor que un mensaje torpe.
 */
export function textoDeFalloDeAnulacion(err: unknown): string {
  if (err instanceof ApiError) {
    const body = err.body;
    if (typeof body === 'object' && body !== null) {
      const motivo = (body as { motivo?: unknown }).motivo;
      if (typeof motivo === 'string' && motivo.trim() !== '') return motivo.trim();
    }
    if (typeof err.detail === 'string' && err.detail.trim() !== '') return err.detail.trim();
  }
  return TEXTO_ANULACION_FALLO;
}

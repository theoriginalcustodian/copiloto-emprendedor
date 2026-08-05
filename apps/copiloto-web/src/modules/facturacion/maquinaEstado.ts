import type { EstadoFacturaResp } from '@copiloto/core';

/**
 * `derivarPasoVisible` — el ÚNICO lugar que traduce `EstadoFacturaResp.estado` (+ `motivoCodigo` para
 * el caso especial de `rechazada`) a qué pantalla mostrar.
 *
 * 🔴 **Por qué es una función pura y no un `useState` de "paso actual".** El plan de UI (§6) lo pide
 * explícito: *"el paso visible se DERIVA de `estado` + `faltantes`, nunca de un `useState` local
 * paralelo… un contador de paso propio se desincronizaría en el primer borrado de ítem"*. El backend
 * recalcula `estado` a partir de los DATOS presentes en cada query (`FacturaWorkflow.estado()`), así que
 * si el usuario borra el único ítem estando en el resumen, la próxima lectura de `estadoFactura()` ya
 * vuelve a `datos_venta_ok` sola — sin que esta función ni `PantallaFacturacion` tengan que "saber" que
 * retrocedió. Una función pura de `estado → paso` hereda esa propiedad gratis; un contador propio la
 * rompería (tendría que decidir, sin que nadie se lo pida, "ah, esto es un retroceso").
 *
 * Mapeo (tabla del plan §6):
 * ```
 * sin perfil / gate bloqueado        → lo resuelve PantallaFacturacion ANTES de crear el borrador, no acá.
 * borrador                           → 'datos_venta'
 * datos_venta_ok                     → 'items'
 * items_ok | cliente_ok              → 'cliente'   (ambos muestran la MISMA pantalla — ver abajo)
 * esperando_confirmacion             → 'resumen'
 * emitiendo                          → 'emitiendo'
 * emitida | entregada                → 'comprobante'
 * rechazada + motivoCodigo=sin_certificado_afip → 'configurar_rechazo' (red de seguridad, ver el hallazgo)
 * rechazada (cualquier otro motivoCodigo)       → 'rechazada'
 * cancelada                          → 'cancelada'
 * (estado desconocido — unión abierta) → 'desconocido'
 * ```
 *
 * 🔴 **Por qué `items_ok` Y `cliente_ok` mapean a la MISMA pantalla ('cliente').** `items_ok` significa
 * "ya hay al menos un ítem válido" — una condición que el backend puede satisfacer apenas se agrega el
 * primer ítem, no una señal de "el usuario terminó de cargar ítems". La tabla del plan lista
 * `items_ok → Paso 3 · Cliente`, así que la pantalla de Cliente es la que se muestra desde que el
 * primer ítem quedó cargado hasta que el cliente también quedó cargado (`cliente_ok`, que el plan llama
 * "transitorio" porque normalmente converge solo, en la siguiente lectura, a `esperando_confirmacion`).
 * Si `cargar_cliente` deja un `motivo` sin tirar 4xx (documentado en `afip.ts::ReceptorInput`), el
 * estado se queda en `cliente_ok` con ese motivo — la MISMA pantalla de Cliente lo muestra inline, sin
 * necesitar una quinta pantalla para ese caso.
 *
 * 🔴 **Ramifica por `motivoCodigo`, no por `motivo`.** El backend sumó `motivoCodigo` el 2026-07-21 a
 * pedido de esta misma sesión (`coordinacion/2026-07-21_hallazgo_frontend-estado-rechazada-sin-
 * certificado.md`, punto 1: "motivo mezcla dos vocabularios"). El docstring de `EstadoFacturaResp` en
 * `afip.ts` es explícito: *"`motivoCodigo` es para RAMIFICAR, `motivo` es para MOSTRAR. No al revés:
 * comparar contra la frase la ata al copy del backend, y el copy cambia."* Esta función sigue esa regla
 * -- antes de que `motivoCodigo` existiera, comparaba contra el string `motivo`, que era exactamente el
 * acoplamiento que el hallazgo señaló como frágil.
 */
export type PasoVisible =
  | 'datos_venta'
  | 'items'
  | 'cliente'
  | 'resumen'
  | 'emitiendo'
  | 'comprobante'
  | 'rechazada'
  | 'configurar_rechazo'
  | 'cancelada'
  | 'desconocido';

/** El código ESTABLE (`MotivoCodigo` en `afip.ts`) que marca el caso "nace rechazada porque el emisor
 *  todavía no tiene certificado" — ver `coordinacion/2026-07-21_hallazgo_frontend-estado-rechazada-sin-
 *  certificado.md`. */
export const MOTIVO_SIN_CERTIFICADO = 'sin_certificado_afip';

export function derivarPasoVisible(estado: EstadoFacturaResp): PasoVisible {
  switch (estado.estado) {
    case 'borrador':
      return 'datos_venta';
    case 'datos_venta_ok':
      return 'items';
    case 'items_ok':
    case 'cliente_ok':
      return 'cliente';
    case 'esperando_confirmacion':
      return 'resumen';
    case 'emitiendo':
      return 'emitiendo';
    case 'emitida':
    case 'entregada':
      return 'comprobante';
    case 'rechazada':
      return estado.motivoCodigo === MOTIVO_SIN_CERTIFICADO ? 'configurar_rechazo' : 'rechazada';
    case 'cancelada':
      return 'cancelada';
    default:
      // Unión ABIERTA (`EstadoFactura = EstadoFacturaConocido | (string & {})`, ver `afip.ts`): un
      // estado nuevo del backend no debe romper el bundle -- se muestra un paso "desconocido" honesto
      // en vez de crashear o de mentir mostrando cualquiera de los pasos conocidos.
      return 'desconocido';
  }
}

/** `true` si la factura nació terminal por falta de certificado — la red de seguridad del hallazgo:
 *  incluso si `PantallaFacturacion` verificara mal el gate `puedeFacturar` antes de crear el borrador,
 *  este caso NUNCA se renderiza como "AFIP rechazó tu factura". */
export function esRechazoPorFaltaDeCertificado(estado: EstadoFacturaResp): boolean {
  return estado.estado === 'rechazada' && estado.motivoCodigo === MOTIVO_SIN_CERTIFICADO;
}

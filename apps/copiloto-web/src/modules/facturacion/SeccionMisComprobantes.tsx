import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';

import {
  anularComprobante,
  confirmarAnulacion,
  estadoAnulacion,
  formatearFechaCorta,
  formatearImporte,
  listarComprobantes,
  listarImpagos,
  type Comprobante,
  type EstadoAnulacion,
} from '@copiloto/core';

import { Button, Skeleton, Surface } from '../../design-system';
import { tituloComprobante } from './etiquetasComprobante';

const INTERVALO_POLL_ANULACION_MS = 1500;

type EstadoLista = 'cargando' | 'ok' | 'error' | 'no_disponible';

/** Un comprobante `estado==='emitida'` puede anularse; los demás (`anulada`/`nota_credito`) no vuelven
 *  a ofrecer la acción -- ya son el resultado de una anulación o la anulan a otro. */
function esAnulable(c: Comprobante): boolean {
  return c.estado === 'emitida';
}

function claveDe(c: Comprobante): string {
  return `${c.tipoCbte}-${c.puntoVenta}-${c.nro}`;
}

/**
 * "Impaga · N días" (CLAUDE.md §5, mockup `.estado.pend`) -- SÓLO si el comprobante reclama algo.
 * `null` si el backend no trajo `dias` para esta fila: "0 días" fabricado sería peor que omitirlo
 * (mismo criterio que `antiguedad()` en `SeccionMeDeben`).
 */
function chipImpaga(dias: number | null): string {
  if (dias == null) return 'Impaga';
  return `Impaga · ${dias} ${dias === 1 ? 'día' : 'días'}`;
}

/** Ícono de fila (mockup: `.fact .tile`, un genérico de comprobante -- no hay ícono por categoría
 *  como en Gastos). Path de Phosphor "file-text", calcado del mockup fuente. */
function IconoComprobante() {
  return (
    <svg width="18" height="18" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true">
      <path d="M213.66,82.34l-56-56A8,8,0,0,0,152,24H56A16,16,0,0,0,40,40V216a16,16,0,0,0,16,16H200a16,16,0,0,0,16-16V88A8,8,0,0,0,213.66,82.34ZM160,51.31,188.69,80H160ZM200,216H56V40h88V88a8,8,0,0,0,8,8h48V216Zm-32-80a8,8,0,0,1-8,8H96a8,8,0,0,1,0-16h64A8,8,0,0,1,168,136Zm0,32a8,8,0,0,1-8,8H96a8,8,0,0,1,0-16h64A8,8,0,0,1,168,168Z" />
    </svg>
  );
}

/**
 * "Mis comprobantes" — port de `apps/mobile/src/modules/facturacion/SeccionMisComprobantes.tsx`.
 * Lista + anulación con su propia máquina de estados, independiente de la del wizard de emisión
 * (`maquinaEstado.ts`): es un recurso distinto (`AnulacionWorkflow`, no `FacturaWorkflow`), así que
 * vive en su propio componente.
 *
 * 🔴 **La confirmación de anular NOMBRA lo que realmente pasa** — anular emite una nota de crédito, no
 * borra. Decir sólo "¿anular?" dejaría creer que el comprobante desaparece, y un comprobante fiscal
 * emitido NUNCA desaparece — se neutraliza con otro.
 */
export interface SeccionMisComprobantesProps {
  cuit: string;
  onVerDetalle: (comprobante: Comprobante) => void;
  testID?: string;
}

/** Lo que la PANTALLA puede pedirle a esta sección. */
export interface SeccionMisComprobantesHandle {
  /** Relee la lista contra el backend. Resuelve cuando la respuesta llegó (o falló). */
  recargar: () => Promise<void>;
}

export const SeccionMisComprobantes = forwardRef<SeccionMisComprobantesHandle, SeccionMisComprobantesProps>(
function SeccionMisComprobantes({ cuit, onVerDetalle, testID = 'facturacion-mis-comprobantes' }, ref) {
  const [estadoLista, setEstadoLista] = useState<EstadoLista>('cargando');
  const [comprobantes, setComprobantes] = useState<Comprobante[]>([]);
  // `id` -> días de antigüedad de la deuda (CLAUDE.md §5, chip "Impaga · N días"). Viene de
  // `listarImpagos()`, un endpoint DISTINTO de `listarComprobantes` (ver docstring de
  // `cobros.ts::ComprobanteImpago`) -- se cruza acá por `id` de fila, no se inventa un campo nuevo.
  // Un id ausente del mapa significa "no está impago" (cobrada, o el endpoint no está disponible).
  const [diasImpagoPorId, setDiasImpagoPorId] = useState<Map<number, number | null>>(new Map());
  const [objetivoAnulacion, setObjetivoAnulacion] = useState<Comprobante | null>(null);
  const [anulacionId, setAnulacionId] = useState<string | null>(null);
  const [estadoAnulacionActual, setEstadoAnulacionActual] = useState<EstadoAnulacion | null>(null);
  const [enviandoAnulacion, setEnviandoAnulacion] = useState(false);
  // Sube en cada intento de polling que hay que REARRANCAR sin que `anulacionId` haya cambiado (el
  // caso de `confirmarNotaCredito`: la anulación sigue siendo la misma, pero el poll ya se había
  // detenido al llegar a `esperando_confirmacion` y necesita retomar hasta el próximo terminal).
  const [pollTick, setPollTick] = useState(0);
  const vivo = useRef(true);
  useEffect(() => {
    vivo.current = true;
    return () => { vivo.current = false; };
  }, []);

  /**
   * `silencioso` = no pasar por `cargando`. Una RE-carga (el tirón, o el refresco de después de
   * emitir) ocurre sobre una lista que el usuario está mirando: mandarla al spinner la haría
   * desaparecer y volver, un parpadeo que sugiere que algo se perdió. La carga inicial sí lo pasa,
   * porque ahí no hay nada que preservar.
   */
  const cargar = useCallback((silencioso = false): Promise<void> => {
    if (!silencioso) setEstadoLista('cargando');
    // `listarImpagos()` en paralelo, NO en cascada -- son dos preguntas independientes al backend
    // y una no debería esperar a la otra. Si falla o `no_disponible`, el mapa queda vacío: la lista
    // simplemente no muestra chips de "Impaga", nunca inventa uno.
    return Promise.all([listarComprobantes(cuit), listarImpagos().catch(() => ({ status: 'no_disponible' as const }))])
      .then(([res, resImpagos]) => {
        if (!vivo.current) return;
        if (res.status === 'no_disponible') {
          setEstadoLista('no_disponible');
          setComprobantes([]);
          setDiasImpagoPorId(new Map());
          return;
        }
        setComprobantes(res.comprobantes);
        setDiasImpagoPorId(
          new Map(
            resImpagos.status === 'ok' ? resImpagos.comprobantes.map((f) => [f.id, f.dias] as const) : [],
          ),
        );
        setEstadoLista('ok');
      })
      .catch(() => {
        if (vivo.current) setEstadoLista('error');
      });
  }, [cuit]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  useImperativeHandle(ref, () => ({ recargar: () => cargar(true) }), [cargar]);

  // Poll de la anulación en curso -- se detiene solo cuando la respuesta FRESCA (no un valor de estado
  // capturado por el closure, que quedaría stale dentro del `setInterval`) llega terminal o a
  // `esperando_confirmacion` (necesita el HITL de `confirmarAnulacion`). `pollTick` fuerza un rearranque
  // cuando `confirmarNotaCredito` avanza la MISMA anulación más allá de `esperando_confirmacion`, caso en
  // el que `anulacionId` no cambia pero el poll sí tiene que retomar.
  useEffect(() => {
    if (!anulacionId) return;
    let detenido = false;
    let intervalo: ReturnType<typeof setInterval> | null = null;
    const consultar = () => {
      estadoAnulacion(anulacionId)
        .then((res) => {
          if (detenido || !vivo.current) return;
          setEstadoAnulacionActual(res);
          if ((res.terminado || res.paso === 'esperando_confirmacion') && intervalo) {
            clearInterval(intervalo);
          }
        })
        .catch(() => {
          // Un fallo de red puntual no aborta el polling -- el próximo tick reintenta.
        });
    };
    consultar();
    intervalo = setInterval(consultar, INTERVALO_POLL_ANULACION_MS);
    return () => {
      detenido = true;
      if (intervalo) clearInterval(intervalo);
    };
  }, [anulacionId, pollTick]);

  function pedirAnulacion(c: Comprobante) {
    setObjetivoAnulacion(c);
    setAnulacionId(null);
    setEstadoAnulacionActual(null);
  }

  function cancelarPedido() {
    setObjetivoAnulacion(null);
    setAnulacionId(null);
    setEstadoAnulacionActual(null);
  }

  async function confirmarPedido() {
    if (!objetivoAnulacion) return;
    setEnviandoAnulacion(true);
    try {
      const res = await anularComprobante({
        cuit,
        tipoCbte: objetivoAnulacion.tipoCbte,
        puntoVenta: objetivoAnulacion.puntoVenta,
        nro: objetivoAnulacion.nro,
      });
      if (res.status === 'ok' && vivo.current) setAnulacionId(res.anulacionId);
    } finally {
      if (vivo.current) setEnviandoAnulacion(false);
    }
  }

  async function confirmarNotaCredito() {
    if (!anulacionId) return;
    setEnviandoAnulacion(true);
    try {
      await confirmarAnulacion(anulacionId);
      if (vivo.current) setPollTick((t) => t + 1);
    } finally {
      if (vivo.current) setEnviandoAnulacion(false);
    }
  }

  function cerrarYRefrescar() {
    setObjetivoAnulacion(null);
    setAnulacionId(null);
    setEstadoAnulacionActual(null);
    void cargar(true);
  }

  return (
    // Sin `<h2>` propio (Tarea 3, CLAUDE.md §5): el rótulo "Últimas emitidas" + pill "Nueva factura"
    // que antes vivía sólo en el mockup ahora lo renderiza `PantallaFacturacion`, inmediatamente
    // arriba de esta sección -- duplicar el encabezado acá repetiría la misma etiqueta dos veces.
    <section className="mis-comprobantes" data-testid={testID}>
      {estadoLista === 'cargando' && (
        <div className="facturacion-screen__loading" data-testid={`${testID}-cargando`}>
          <Skeleton height={56} radius={12} />
          <Skeleton height={56} radius={12} />
        </div>
      )}

      {estadoLista === 'error' && (
        <p className="mis-comprobantes__aviso mis-comprobantes__aviso--error" data-testid={`${testID}-error`}>
          No pudimos cargar tus comprobantes. Probá de nuevo.
        </p>
      )}

      {estadoLista === 'no_disponible' && (
        <p className="mis-comprobantes__aviso" data-testid={`${testID}-no-disponible`}>
          Todavía no hay comprobantes para mostrar.
        </p>
      )}

      {estadoLista === 'ok' && comprobantes.length === 0 && (
        <p className="mis-comprobantes__aviso" data-testid={`${testID}-vacio`}>
          Todavía no emitiste ningún comprobante.
        </p>
      )}

      {estadoLista === 'ok' &&
        comprobantes.map((c) => {
          const clave = claveDe(c);
          const esteEsElObjetivo = objetivoAnulacion != null && claveDe(objetivoAnulacion) === clave;
          // `id` es lo que cruza con `listarImpagos()` (ver el docstring de `diasImpagoPorId`);
          // sin `id` (activities de Temporal, ver `Comprobante.id`) no hay forma de saber si está
          // impago -- se trata como "no impago" en vez de arriesgar un chip inventado.
          const impaga = c.id != null && diasImpagoPorId.has(c.id);
          const titulo = c.receptorNombre != null && c.receptorNombre !== '' ? c.receptorNombre : tituloComprobante(c);
          const fecha = c.fechaEmision != null ? formatearFechaCorta(c.fechaEmision) : '';
          const subtitulo = [tituloComprobante(c), fecha].filter((s) => s !== '').join(' · ');
          return (
            <div className="mis-comprobantes__grupo" key={clave}>
              {/* Anatomía de la lista (CLAUDE.md §5, mockup `.fact`): tile-ícono + título (cliente)
                  + subtítulo (tipo+número · fecha) + monto a la derecha + chip de estado SÓLO si
                  reclama algo -- "lo que reclama en negro, lo terminado en arena": una "Cobrada" no
                  lleva chip (nada gasta más atención que la que ya tiene el ojo del pendiente). */}
              <Surface variant="tile" className="mis-comprobantes__fila" data-testid={`${testID}-fila-${clave}`}>
                <button
                  type="button"
                  className="mis-comprobantes__fila-textos"
                  data-testid={`${testID}-detalle-${clave}`}
                  onClick={() => onVerDetalle(c)}
                  aria-label={`Ver el detalle del comprobante N° ${c.nro}`}
                >
                  <span className="mis-comprobantes__fila-tile" aria-hidden="true">
                    <IconoComprobante />
                  </span>
                  <span className="mis-comprobantes__fila-cuerpo">
                    <p className="mis-comprobantes__fila-titulo">{titulo}</p>
                    <p className="mis-comprobantes__fila-detalle" data-testid={`${testID}-sub-${clave}`}>
                      {subtitulo}
                    </p>
                  </span>
                </button>
                <div className="mis-comprobantes__fila-der">
                  {/* Nunca "$0" cuando falta el dato: `formatearImporte` devuelve el string crudo si
                      no matchea el patrón numérico, nunca inventa un importe. */}
                  <span className="mis-comprobantes__fila-monto" data-testid={`${testID}-monto-${clave}`}>
                    {formatearImporte(c.total)}
                  </span>
                  {impaga && (
                    <span className="mis-comprobantes__fila-estado mis-comprobantes__fila-estado--pend" data-testid={`${testID}-estado-${clave}`}>
                      {chipImpaga(c.id != null ? (diasImpagoPorId.get(c.id) ?? null) : null)}
                    </span>
                  )}
                </div>
                {esAnulable(c) && !esteEsElObjetivo && (
                  <Button
                    variant="danger"
                    onClick={() => pedirAnulacion(c)}
                    data-testid={`${testID}-anular-${clave}`}
                  >
                    Anular
                  </Button>
                )}
              </Surface>

              {esteEsElObjetivo && (
                <div className="mis-comprobantes__panel-anulacion" data-testid={`${testID}-anulacion-${clave}`}>
                  {anulacionId == null && (
                    <>
                      <p data-testid={`${testID}-anulacion-${clave}-aviso`}>
                        Anular emite una nota de crédito -- otro comprobante fiscal que neutraliza esta
                        factura. No se borra.
                      </p>
                      <div className="mis-comprobantes__acciones">
                        <Button
                          variant="danger"
                          onClick={() => void confirmarPedido()}
                          disabled={enviandoAnulacion}
                          data-testid={`${testID}-anulacion-${clave}-si`}
                        >
                          {enviandoAnulacion ? 'Enviando…' : 'Sí, anular'}
                        </Button>
                        <Button variant="cancel" onClick={cancelarPedido} data-testid={`${testID}-anulacion-${clave}-no`}>
                          No
                        </Button>
                      </div>
                    </>
                  )}

                  {anulacionId != null && estadoAnulacionActual == null && (
                    <div className="facturacion-screen__loading" data-testid={`${testID}-anulacion-${clave}-cargando`}>
                      <Skeleton height={40} radius={12} />
                    </div>
                  )}

                  {anulacionId != null && estadoAnulacionActual?.paso === 'esperando_confirmacion' && (
                    <>
                      <p>
                        Se generó la nota de crédito. Confirmá para completar la anulación -- es tan
                        irreversible como emitir una factura.
                      </p>
                      <div className="mis-comprobantes__acciones">
                        <Button
                          onClick={() => void confirmarNotaCredito()}
                          disabled={enviandoAnulacion}
                          data-testid={`${testID}-anulacion-${clave}-confirmar`}
                        >
                          {enviandoAnulacion ? 'Confirmando…' : 'Confirmar anulación'}
                        </Button>
                      </div>
                    </>
                  )}

                  {anulacionId != null && estadoAnulacionActual?.terminado === true && (
                    <>
                      <p
                        className={
                          estadoAnulacionActual.paso === 'anulada'
                            ? 'mis-comprobantes__aviso--exito'
                            : 'mis-comprobantes__aviso--error'
                        }
                        data-testid={`${testID}-anulacion-${clave}-resultado`}
                      >
                        {estadoAnulacionActual.paso === 'anulada'
                          ? 'Nota de crédito emitida. El comprobante quedó anulado.'
                          : (estadoAnulacionActual.motivo ?? 'No se pudo completar la anulación.')}
                      </p>
                      <div className="mis-comprobantes__acciones">
                        <Button variant="cancel" onClick={cerrarYRefrescar} data-testid={`${testID}-anulacion-${clave}-cerrar`}>
                          Listo
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
    </section>
  );
});

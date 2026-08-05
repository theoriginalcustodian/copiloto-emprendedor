import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';

import {
  anularComprobante,
  confirmarAnulacion,
  estadoAnulacion,
  listarComprobantes,
  type Comprobante,
  type EstadoAnulacion,
} from '@copiloto/core';

import { Button, Skeleton } from '../../design-system';
import { tituloComprobanteConTotal } from './etiquetasComprobante';

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
    return listarComprobantes(cuit)
      .then((res) => {
        if (!vivo.current) return;
        if (res.status === 'no_disponible') {
          setEstadoLista('no_disponible');
          setComprobantes([]);
          return;
        }
        setComprobantes(res.comprobantes);
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
    <section className="mis-comprobantes" data-testid={testID}>
      <h2 className="mis-comprobantes__titulo">Mis comprobantes</h2>

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
          return (
            <div className="mis-comprobantes__grupo" key={clave}>
              <div className="mis-comprobantes__fila" data-testid={`${testID}-fila-${clave}`}>
                <button
                  type="button"
                  className="mis-comprobantes__fila-textos"
                  data-testid={`${testID}-detalle-${clave}`}
                  onClick={() => onVerDetalle(c)}
                  aria-label={`Ver el detalle del comprobante N° ${c.nro}`}
                >
                  <p className="mis-comprobantes__fila-titulo">{tituloComprobanteConTotal(c)}</p>
                  <p className="mis-comprobantes__fila-detalle">
                    CAE {c.cae} · {c.estado}
                  </p>
                  {c.receptorNombre != null && c.receptorNombre !== '' && (
                    <p className="mis-comprobantes__fila-detalle" data-testid={`${testID}-receptor-${clave}`}>
                      {c.receptorNombre}
                    </p>
                  )}
                </button>
                {esAnulable(c) && !esteEsElObjetivo && (
                  <Button
                    variant="danger"
                    onClick={() => pedirAnulacion(c)}
                    data-testid={`${testID}-anular-${clave}`}
                  >
                    Anular
                  </Button>
                )}
              </div>

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

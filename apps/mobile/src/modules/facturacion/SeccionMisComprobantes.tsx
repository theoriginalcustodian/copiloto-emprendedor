import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import {
  anularComprobante,
  confirmarAnulacion,
  estadoAnulacion,
  listarComprobantes,
  type Comprobante,
  type EstadoAnulacion,
} from '@copiloto/core';

import { useTema } from '../../theme/ThemeProvider';
import { FilaBotones } from '../../theme/glass/campos';
import { Row } from '../../theme/glass/Row';

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
 * "Mis comprobantes" -- segunda sección de la MISMA pantalla de Facturación (decisión del plan §0: "no
 * pantalla aparte"). Lista + anulación con su propia máquina de estados, independiente de la del
 * wizard de emisión (`maquinaEstado.ts`): es un recurso distinto (`AnulacionWorkflow`, no
 * `FacturaWorkflow`), así que vive en su propio componente en vez de sumar ramas a
 * `PantallaFacturacion`.
 *
 * 🔴 **La confirmación de anular NOMBRA lo que realmente pasa** -- pedido explícito del plan §6: "anular
 * emite una nota de crédito, no borra". Decir sólo "¿anular?" dejaría creer que el comprobante
 * desaparece, y un comprobante fiscal emitido NUNCA desaparece -- se neutraliza con otro.
 */
export interface SeccionMisComprobantesProps {
  cuit: string;
  testID?: string;
}

export function SeccionMisComprobantes({ cuit, testID = 'facturacion-mis-comprobantes' }: SeccionMisComprobantesProps) {
  const tema = useTema();
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
  useEffect(() => () => { vivo.current = false; }, []);

  const cargar = useCallback(() => {
    setEstadoLista('cargando');
    listarComprobantes(cuit)
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
    cargar();
  }, [cargar]);

  // Poll de la anulación en curso -- se detiene solo cuando la respuesta FRESCA (no un valor de estado
  // capturado por el closure, que quedaría stale dentro del `setInterval`) llega terminal o a
  // `esperando_confirmacion` (necesita el HITL de `confirmarAnulacion`). `pollTick` fuerza un rearranque
  // cuando `confirmarNotaCredito` avanza la MISMA anulación más allá de `esperando_confirmacion`, caso en
  // el que `anulacionId` no cambia pero el poll sí tiene que retomar. Limpieza garantizada en el
  // unmount y en cada cambio de dependencias (regla dura del prompt).
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
    cargar();
  }

  return (
    <View testID={testID} style={[styles.contenedor, { gap: tema.espacio.md }]}>
      <Text style={{ color: tema.color.texto, fontFamily: tema.fuente.uiSemibold, fontSize: tema.tipo.grande }}>
        Mis comprobantes
      </Text>

      {estadoLista === 'cargando' && <ActivityIndicator testID={`${testID}-cargando`} color={tema.color.acento} />}

      {estadoLista === 'error' && (
        <Text testID={`${testID}-error`} style={{ color: tema.color.peligro, fontSize: tema.tipo.base }}>
          No pudimos cargar tus comprobantes. Probá de nuevo.
        </Text>
      )}

      {estadoLista === 'no_disponible' && (
        <Text testID={`${testID}-no-disponible`} style={{ color: tema.color.textoTenue, fontSize: tema.tipo.base }}>
          Todavía no hay comprobantes para mostrar.
        </Text>
      )}

      {estadoLista === 'ok' && comprobantes.length === 0 && (
        <Text testID={`${testID}-vacio`} style={{ color: tema.color.textoTenue, fontSize: tema.tipo.base }}>
          Todavía no emitiste ningún comprobante.
        </Text>
      )}

      {estadoLista === 'ok' &&
        comprobantes.map((c) => {
          const clave = claveDe(c);
          const esteEsElObjetivo = objetivoAnulacion != null && claveDe(objetivoAnulacion) === clave;
          return (
            <View key={clave} style={{ gap: tema.espacio.sm }}>
              <Row testID={`${testID}-fila-${clave}`}>
                <View style={styles.filaComprobante}>
                  <View style={styles.filaTextos}>
                    <Text style={{ color: tema.color.texto, fontFamily: tema.fuente.uiMedium, fontSize: tema.tipo.base }}>
                      Tipo {c.tipoCbte} · N° {c.nro} · {c.total}
                    </Text>
                    <Text style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico }}>
                      CAE {c.cae} · {c.estado}
                    </Text>
                  </View>
                  {esAnulable(c) && !esteEsElObjetivo && (
                    <FilaBotones
                      // Compacto: si el botón se estira, se come los datos del comprobante y queda un
                      // "Anular" sin sujeto. Visto en device el 2026-07-21.
                      compacto
                      testID={`${testID}-anular-${clave}-botones`}
                      botones={[
                        { etiqueta: 'Anular', onPress: () => pedirAnulacion(c), variante: 'peligro', testID: `${testID}-anular-${clave}` },
                      ]}
                    />
                  )}
                </View>
              </Row>

              {esteEsElObjetivo && (
                <View
                  testID={`${testID}-anulacion-${clave}`}
                  style={[styles.panelAnulacion, { backgroundColor: tema.color.superficieAlta, borderRadius: tema.radio.md, padding: tema.espacio.sm, gap: tema.espacio.sm }]}
                >
                  {anulacionId == null && (
                    <>
                      <Text testID={`${testID}-anulacion-${clave}-aviso`} style={{ color: tema.color.texto, fontSize: tema.tipo.base }}>
                        Anular emite una nota de crédito -- otro comprobante fiscal que neutraliza esta
                        factura. No se borra.
                      </Text>
                      <FilaBotones
                        testID={`${testID}-anulacion-${clave}-botones`}
                        botones={[
                          {
                            etiqueta: enviandoAnulacion ? 'Enviando…' : 'Sí, anular',
                            onPress: confirmarPedido,
                            variante: 'peligro',
                            deshabilitado: enviandoAnulacion,
                            testID: `${testID}-anulacion-${clave}-si`,
                          },
                          { etiqueta: 'No', onPress: cancelarPedido, testID: `${testID}-anulacion-${clave}-no` },
                        ]}
                      />
                    </>
                  )}

                  {anulacionId != null && estadoAnulacionActual == null && (
                    <ActivityIndicator testID={`${testID}-anulacion-${clave}-cargando`} color={tema.color.acento} />
                  )}

                  {anulacionId != null && estadoAnulacionActual?.paso === 'esperando_confirmacion' && (
                    <>
                      <Text style={{ color: tema.color.texto, fontSize: tema.tipo.base }}>
                        Se generó la nota de crédito. Confirmá para completar la anulación -- es tan
                        irreversible como emitir una factura.
                      </Text>
                      <FilaBotones
                        testID={`${testID}-anulacion-${clave}-confirmar-botones`}
                        botones={[
                          {
                            etiqueta: enviandoAnulacion ? 'Confirmando…' : 'Confirmar anulación',
                            onPress: confirmarNotaCredito,
                            variante: 'primario',
                            deshabilitado: enviandoAnulacion,
                            testID: `${testID}-anulacion-${clave}-confirmar`,
                          },
                        ]}
                      />
                    </>
                  )}

                  {anulacionId != null && estadoAnulacionActual?.terminado === true && (
                    <>
                      <Text
                        testID={`${testID}-anulacion-${clave}-resultado`}
                        style={{
                          color: estadoAnulacionActual.paso === 'anulada' ? tema.color.exito : tema.color.peligro,
                          fontSize: tema.tipo.base,
                        }}
                      >
                        {estadoAnulacionActual.paso === 'anulada'
                          ? 'Nota de crédito emitida. El comprobante quedó anulado.'
                          : (estadoAnulacionActual.motivo ?? 'No se pudo completar la anulación.')}
                      </Text>
                      <FilaBotones
                        testID={`${testID}-anulacion-${clave}-cerrar-botones`}
                        botones={[{ etiqueta: 'Listo', onPress: cerrarYRefrescar, testID: `${testID}-anulacion-${clave}-cerrar` }]}
                      />
                    </>
                  )}
                </View>
              )}
            </View>
          );
        })}
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: {},
  filaComprobante: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flex: 1, gap: 8 },
  filaTextos: { flexShrink: 1, gap: 2 },
  panelAnulacion: {},
});

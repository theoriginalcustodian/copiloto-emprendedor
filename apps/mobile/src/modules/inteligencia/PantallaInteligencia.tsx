import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
// 🔴 `RefreshControl` de RNGH, NO el de `react-native`: el `ScrollView` de RNGH hace `waitFor` sobre el handler
// del refresh control (le inyecta un `ref` para eso). Con el de RN ese `waitFor` apunta a nada y los dos
// árbitros se disputan el dedo: `onRefresh` se disparaba a los 0,3 s del DOWN, 6 s antes del UP (DEVICE15 H4).
import { RefreshControl } from 'react-native-gesture-handler';

import {
  chipDeCaja,
  faseRefresco,
  formatearImporte,
  formatearMesDePeriodo,
  leerPortada,
  MS_AL_DIA,
  TEXTO_REFRESCO,
  type Portada,
} from '@copiloto/core';

import { LineaGanancia } from './graficos/LineaGanancia';
import { AcumuladoAnual } from './AcumuladoAnual';
import { GraficosInteligencia } from './graficos/GraficosInteligencia';
import { ScrollFormulario } from '../../theme/glass/campos';
import { MarcoGlass } from '../../theme/glass/MarcoGlass';
import { DockAlChat } from '../voz';
import { BloqueCifra } from '../../theme/BloqueCifra';
import { conAlfa } from '../../theme/glass/conAlfa';
import { inicialesDe } from '../clientes/TarjetaCliente';
import { Tarjeta } from '../../theme/Tarjeta';
import { useTema } from '../../theme/ThemeProvider';
import { VacioFuncion } from '../../theme/VacioFuncion';
import { DIBUJO_LUPA } from './dibujoLupa';

/**
 * `PantallaInteligencia` — la **portada de Inteligencia de Negocio** (hito 6): caja, el mes en curso,
 * la serie mensual, los mejores clientes y lo por cobrar.
 *
 * 🔴 **[CONNECT] — construida contra CONTRATO (§3.1 del `contrato_ADELANTAR`), el endpoint todavía NO
 * está vivo.** Toda la pantalla habla con `leerPortada()`, que es el único punto que el connect toca:
 * el día que backend publique `GET /inteligencia/portada`, se confirma la forma ahí y esta pantalla no
 * se toca. Mientras tanto degrada a `no_disponible` y lo DICE — no simula números.
 *
 * 🔴 **`null` no es `0`, y acá se ve.** Un KPI que no vino se muestra como «—», nunca como «$0»: en
 * plata, *«no sé»* y *«cero»* son la diferencia entre un dato faltante y una afirmación falsa. El
 * helper `kpi()` centraliza esa regla para que ningún número la saltee.
 *
 * 🔴 **Cascarón NO: si el endpoint no está, se dice.** El «PRÓXIMAMENTE» anterior era honesto cuando
 * no había contrato; ahora que la forma existe, la pantalla se construye de verdad y el único estado
 * que falta es el connect.
 *
 * 🔴 **La decisión de placement (`dato_planificacion-a-frontend_IN-vacio-...`) — una sola pantalla.**
 * Los 4 gráficos (`GraficosInteligencia`) entran DEBAJO de la portada, dentro del mismo scroll — leen
 * de un vistazo, no multiplican rutas para algo chico.
 *
 * 🔴 **SM-N32 — sin selector «Resumen»/«Preguntar».** El mapa los sacó («la misma duplicación que sacamos con la solapa
 * "Preguntar" de Inteligencia», `mapa-pantallas/index.html:240`) y el operador lo reclamó el 2026-11-03. La pregunta se
 * escribe en el chat (o en el dock de la función, SM-J1); esta pantalla es sólo lectura.
 */

type EstadoLista = 'cargando' | 'ok' | 'no_disponible';

/** dp por encima de la pantalla donde Android ubica el círculo del pull-to-refresh: afuera de cuadro, recortado. */
const OFFSET_REFRESH_FUERA_DE_CUADRO = -1000;

/**
 * SM-J3 — ¿el negocio todavía no vendió nada? Sólo con CERO medido: un `null` es «no se puede calcular»,
 * no «cero», y decir «Sin ventas todavía» sobre un dato ausente sería afirmar lo que no se sabe. Los tres
 * del mes tienen que ser exactamente 0, sin clientes en el ranking y sin ingresos en la serie.
 */
export function sinVentasTodavia(p: Portada): boolean {
  const cero = (v: string | null) => v != null && Number(v) === 0;
  return (
    cero(p.mes.ingresos) &&
    cero(p.mes.facturado) &&
    cero(p.mes.cobrado) &&
    p.mejoresClientes.length === 0 &&
    p.serieMensual.every((m) => m.ingresos == null || Number(m.ingresos) === 0)
  );
}

export function PantallaInteligencia() {
  const tema = useTema();
  const [estado, setEstado] = useState<EstadoLista>('cargando');
  const [portada, setPortada] = useState<Portada | null>(null);
  const [refrescando, setRefrescando] = useState(false);
  const [alDia, setAlDia] = useState(false);
  const [arrastrePx, setArrastrePx] = useState(0);
  const timerAlDia = useRef<ReturnType<typeof setTimeout> | null>(null);
  const vivo = useRef(true);

  const cargar = useCallback(async () => {
    const res = await leerPortada();
    if (!vivo.current) return;
    if (res.status === 'ok') {
      setPortada(res.portada);
      setEstado('ok');
      return;
    }
    setEstado('no_disponible');
  }, []);

  useEffect(() => {
    vivo.current = true;
    void cargar();
    return () => {
      vivo.current = false;
      if (timerAlDia.current != null) clearTimeout(timerAlDia.current);
    };
  }, [cargar]);

  async function tirarParaRefrescar() {
    setRefrescando(true);
    try {
      await cargar();
    } finally {
      if (vivo.current) {
        setRefrescando(false);
        // «Al día · recién» es la confirmación textual de que terminó (WCAG 1.4.1: no sólo el spinner).
        setAlDia(true);
        if (timerAlDia.current != null) clearTimeout(timerAlDia.current);
        timerAlDia.current = setTimeout(() => {
          if (vivo.current) setAlDia(false);
        }, MS_AL_DIA);
      }
    }
  }

  /** Un importe para un KPI: «—» si no vino, nunca «$0». */
  const kpi = (v: string | null) => (v != null ? formatearImporte(v) : '—');
  const linea = conAlfa(tema.color.texto, 0.12);
  const tenue = { color: tema.color.textoTenue, fontSize: tema.tipo.chico, lineHeight: 18 };

  return (
    // `etiqueta` = el mes del corte de caja («Agosto»), como `.per` del prototipo. Sin fecha de corte no hay
    // mes que decir, y no se inventa uno con la fecha del teléfono.
    <MarcoGlass
      titulo="Inteligencia de Negocio"
      icono="inteligencia"
      sinIcono
      etiqueta={portada?.caja.fechaCorte != null ? formatearMesDePeriodo(portada.caja.fechaCorte) : undefined}
      testID="pantalla-inteligencia"
    >
      <View style={styles.raiz}>
          {estado === 'cargando' && (
            <View style={styles.centro}>
              <ActivityIndicator testID="inteligencia-cargando" color={tema.color.acento} />
            </View>
          )}

          {estado === 'no_disponible' && (
            <View style={styles.centro}>
              <Text
                testID="inteligencia-no-disponible"
                style={{ color: tema.color.textoTenue, fontSize: tema.tipo.base, textAlign: 'center' }}
              >
                El resumen de tu negocio todavía no está disponible en tu copiloto.
              </Text>
            </View>
          )}

      {estado === 'ok' && portada != null && (
        <>
        {/* El indicador sólo existe DURANTE el gesto o la confirmación: en reposo mide 0 (prototipo,
            `index.html:3526` — `#bi-refresh` crece 0→64 con el arrastre y cierra a los 700 ms). Antes era
            una línea permanente «Tirá para actualizar» sobre el scroll (DEVICE15, fila `bi-refresh`). */}
        {(refrescando || alDia || -arrastrePx > 0) && (
        <Text
          testID="inteligencia-refresco-estado"
          accessibilityRole="text"
          accessibilityLiveRegion="polite"
          style={{
            color: tema.color.textoTenue,
            fontSize: tema.tipo.chico,
            textAlign: 'center',
            paddingTop: tema.espacio.xs,
          }}
        >
          {TEXTO_REFRESCO[faseRefresco({ actualizando: refrescando, alDia, arrastrePx: -arrastrePx })]}
        </Text>
        )}
        <ScrollFormulario
          onOffsetY={setArrastrePx}
          testID="inteligencia-portada"
          contentContainerStyle={{ padding: tema.espacio.md, gap: 24, paddingBottom: 120 }}
          refreshControl={
            // 🔴 Indicador nativo FUERA DE CUADRO (N2, relevamiento 2026-10-16): el círculo con flecha de Android se
            // dibujaba ENCIMA del saldo al tirar, y el prototipo no lo tiene — dice sólo «Actualizando…»
            // (`inteligencia-refresco-estado`, arriba). El gesto sigue siendo el nativo (`onRefresh` y `refreshing`
            // no cambian); lo que se saca es lo que se DIBUJA.
            // OJO: `colors={['transparent']}` NO sirve en Android — `CircularProgressDrawable` pisa el canal alfa del
            // color, así que el arco sale NEGRO opaco (medido en device: un arco oscuro sobre el saldo, con
            // `progressBackgroundColor` transparente y todo). Lo que funciona es sacarlo de pantalla:
            // `progressViewOffset` negativo lo ubica por encima del área visible y lo recorta. `tintColor` es la
            // flecha de iOS, donde el alfa sí se respeta.
            <RefreshControl
              refreshing={refrescando}
              onRefresh={() => void tirarParaRefrescar()}
              tintColor="transparent"
              progressViewOffset={OFFSET_REFRESH_FUERA_DE_CUADRO}
              testID="inteligencia-refresh"
            />
          }
        >
          {/* CAJA — LA cifra de esta pantalla, en el bloque de máximo contraste.
              El rótulo es «Saldo en caja», tal como lo dice el prototipo: no se inventa un nombre.
              Entró/Salió viven ADENTRO del bloque, también como en el prototipo — son la lectura
              del saldo, no dos KPIs más de la grilla de abajo. */}
          <BloqueCifra
            testID="inteligencia-caja"
            rotulo="Saldo en caja"
            cifra={kpi(portada.caja.saldo)}
            // El chip «Al 19 de agosto · −18% vs mes anterior» del prototipo (index.html:1934): sale del
            // mismo `chipDeCaja` del core que usa la portada de Mi día, así web y mobile dicen lo mismo.
            // `CajaPortada` trae `fechaCorte`/`variacionPct`/`incompleta` (core api/inteligencia.ts:41);
            // sin dato el chip no se dibuja — nunca una fecha fabricada.
            chip={chipDeCaja(portada.caja) ?? undefined}
          >
            <View style={styles.filaEntre}>
              {(
                [
                  ['Entró', portada.mes.ingresos],
                  ['Salió', portada.mes.gastos],
                ] as const
              ).map(([etiqueta, valor]) => (
                <View key={etiqueta} style={styles.bloqueCelda} testID={`inteligencia-caja-${etiqueta.toLowerCase()}`}>
                  <Text style={{ color: tema.color.bloqueApoyo, fontSize: tema.tipo.chico }}>{etiqueta}</Text>
                  <Text
                    style={{ color: tema.color.bloqueTexto, fontFamily: tema.fuente.uiMedium, fontSize: tema.tipo.grande }}
                  >
                    {kpi(valor)}
                  </Text>
                </View>
              ))}
            </View>
          </BloqueCifra>

          {/* LO QUE TE QUEDÓ (Martin 15/11) — lo primero después de la caja: contesta «¿gano o pierdo?» sin leer
              números. Reemplaza a las barras de «Mes a mes» y de «Entró vs. salió». Ver `LineaGanancia`. */}
          {portada.serieMensual.length > 0 && (
            <Tarjeta testID="inteligencia-serie" rotulo="Lo que te quedó">
              <LineaGanancia
                testID="inteligencia-ganancia"
                puntos={portada.serieMensual.map((p) => ({ mes: p.mes, entro: p.ingresos, salio: p.gastos }))}
              />
            </Tarjeta>
          )}

          {sinVentasTodavia(portada) && (
            <VacioFuncion
              testID="inteligencia-sin-ventas"
              dibujo={DIBUJO_LUPA}
              titulo="Todavía no hay ventas"
              cuerpo="Cuando factures o anotes un cobro, acá vas a ver cómo viene tu negocio."
            />
          )}

          {/* SM-N32: los cuatro del mes en NEGRO. El mockup 12 derogó la paleta verde/rojo («competiría con el único acento»). */}
          {/* EL MES — cuatro números en grilla de dos columnas + Rentabilidad en fila completa con
              su nota cuando falta el dato (mismo patrón que web `.kpi.sindato`: «no es cero, es que
              todavía no se puede calcular» — H-A4-3). */}
          <Tarjeta testID="inteligencia-mes" rotulo="Este mes" style={styles.tarjetaFilas}>
            {(
              [
                [
                  ['Ingresos', portada.mes.ingresos],
                  ['Gastos', portada.mes.gastos],
                ],
                [
                  ['Facturado', portada.mes.facturado],
                  ['Cobrado', portada.mes.cobrado],
                ],
              ] as const
            ).map((par, n) => (
              <View key={par[0][0]} style={[styles.filaKpis, n > 0 && { borderTopWidth: 1, borderTopColor: linea }]}>
                {par.map(([etiqueta, valor], k) => (
                  <View
                    key={etiqueta}
                    testID={`inteligencia-mes-${etiqueta.toLowerCase()}`}
                    style={[styles.kpiCelda, k > 0 && { borderLeftWidth: 1, borderLeftColor: linea, paddingLeft: 16 }]}
                  >
                    <Text style={tenue}>{etiqueta}</Text>
                    <Text
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      style={{ color: tema.color.texto, fontFamily: tema.fuente.display, fontSize: tema.tipo.grande, lineHeight: 26 }}
                    >
                      {kpi(valor)}
                    </Text>
                  </View>
                ))}
              </View>
            ))}
            <View
              testID="inteligencia-mes-rentabilidad"
              style={[styles.filaKpis, styles.kpiRentabilidad, { borderTopWidth: 1, borderTopColor: linea }]}
            >
              <Text style={tenue}>Rentabilidad</Text>
              <Text style={{ color: tema.color.texto, fontFamily: tema.fuente.display, fontSize: tema.tipo.grande, lineHeight: 26 }}>
                {kpi(portada.mes.rentabilidad)}
              </Text>
              {portada.mes.rentabilidad == null && (
                <Text testID="inteligencia-rentabilidad-nota" style={tenue}>
                  Falta asignar gastos a trabajos. No es cero: es que todavía no se puede calcular.
                </Text>
              )}
            </View>
          </Tarjeta>

          {/* ACUMULADO DEL AÑO + tope de monotributo — llegó de Contabilidad al fundirse las dos
              pantallas (Ola 4). Va DESPUÉS del mes y antes de lo por cobrar: es la lectura larga del
              mismo eje (cuánto facturaste), y lo por cobrar ya es otra pregunta. */}
          <AcumuladoAnual />

          {/* POR COBRAR — con lo vencido resaltado, que es lo accionable. */}
          <Tarjeta testID="inteligencia-por-cobrar" rotulo="Por cobrar">
            <Text style={{ color: tema.color.texto, fontFamily: tema.fuente.display, fontSize: 28, lineHeight: 34 }}>
              {kpi(portada.porCobrar.total)}
            </Text>
            {portada.porCobrar.vencido != null && (
              <Text testID="inteligencia-vencido" style={{ color: tema.color.peligro, fontSize: tema.tipo.chico }}>
                {formatearImporte(portada.porCobrar.vencido)} vencido
              </Text>
            )}
          </Tarjeta>

          {/* MEJORES CLIENTES — degrada a vacío si Clientes no está (contrato §3.1). */}
          <Tarjeta testID="inteligencia-clientes" rotulo="Mejores clientes" style={portada.mejoresClientes.length > 0 ? styles.tarjetaFilas : undefined}>
          {portada.mejoresClientes.length === 0 ? (
            <Text testID="inteligencia-clientes-vacio" style={tenue}>
              Todavía no registraste ventas a ningún cliente. Cuando factures o anotes un cobro con nombre, el ranking se arma solo.
            </Text>
          ) : (
            portada.mejoresClientes.map((c, i) => (
              <View
                key={c.cliente}
                testID={`inteligencia-cliente-${c.cliente}`}
                style={[styles.filaCliente, i > 0 && { borderTopWidth: 1, borderTopColor: linea }]}
              >
                <View accessible={false} style={[styles.casilla, { backgroundColor: tema.color.tileFuncion.arena }]}>
                  <Text style={{ color: tema.color.tileFuncion.tinta, fontFamily: tema.fuente.display, fontSize: tema.tipo.chico }}>
                    {inicialesDe(c.cliente)}
                  </Text>
                </View>
                <View style={styles.clienteTextos}>
                  <Text numberOfLines={1} style={{ color: tema.color.texto, fontFamily: tema.fuente.uiSemibold, fontSize: tema.tipo.base, lineHeight: 21 }}>
                    {c.cliente}
                  </Text>
                  {/* SM-N32: `null` = no se puede saber → se oculta; jamás «0 comprobantes». */}
                  {c.comprobantes != null && (
                    <Text testID={`inteligencia-cliente-${c.cliente}-comprobantes`} style={tenue}>
                      {c.comprobantes} comprobante{c.comprobantes === 1 ? '' : 's'}
                    </Text>
                  )}
                </View>
                <Text style={{ color: tema.color.texto, fontFamily: tema.fuente.display, fontSize: tema.tipo.base, lineHeight: 21 }}>
                  {kpi(c.total)}
                </Text>
              </View>
            ))
          )}
          </Tarjeta>

          {/* LOS 4 GRÁFICOS — cada uno con su propia carga, endpoints independientes de la portada. */}
          <View testID="inteligencia-graficos-seccion" style={{ marginTop: tema.espacio.md }}>
            <GraficosInteligencia />
          </View>
        </ScrollFormulario>
        </>
            )}
        {/* SM-J1: el dock al pie, fuera del scroll. El texto es una pregunta sobre los datos: va al chat. */}
        <DockAlChat contexto="bi" origen="Inteligencia" placeholder="Preguntame lo que quieras…" />
      </View>
    </MarcoGlass>
  );
}

const styles = StyleSheet.create({
  raiz: { flex: 1 },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  tarjetaFilas: { paddingVertical: 4, gap: 0 },
  filaKpis: { flexDirection: 'row', paddingVertical: 16 },
  kpiCelda: { flex: 1, gap: 2 },
  kpiRentabilidad: { flexDirection: 'column', gap: 2 },
  filaCliente: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14 },
  casilla: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  clienteTextos: { flex: 1, gap: 2 },
  filaEntre: { flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  bloqueCelda: { flex: 1, gap: 2 },
});

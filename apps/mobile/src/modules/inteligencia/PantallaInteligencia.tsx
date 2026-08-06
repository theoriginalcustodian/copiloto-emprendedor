import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';

import { formatearImporte, leerPortada, type Portada } from '@copiloto/core';

import { ChatInteligencia } from './ChatInteligencia';
import { GraficosInteligencia } from './graficos/GraficosInteligencia';
import { ScrollFormulario } from '../../theme/glass/campos';
import { MarcoGlass } from '../../theme/glass/MarcoGlass';
import { pressableStyle } from '../../theme/glass/presion';
import { Row } from '../../theme/glass/Row';
import { useTema } from '../../theme/ThemeProvider';

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
 * 🔴 **La decisión de placement (`dato_planificacion-a-frontend_IN-vacio-...`) — una sola pantalla,
 * dos solapas.** Los 4 gráficos (`GraficosInteligencia`) entran DEBAJO de la portada, dentro del mismo
 * scroll — leen de un vistazo, no multiplican rutas para algo chico. El chat (`ChatInteligencia`) NO
 * entra al mismo scroll: es un `flex:1` con su propio teclado/scroll interno, anidarlo abajo de los
 * gráficos lo dejaría compitiendo por alto con contenido que no es suyo. Por eso "Preguntar" es una
 * solapa aparte, no una sección más — mismo `MarcoGlass`, dos cuerpos que se turnan.
 */

type EstadoLista = 'cargando' | 'ok' | 'no_disponible';
type Vista = 'resumen' | 'preguntar';

const OPCIONES_VISTA: readonly { valor: Vista; etiqueta: string }[] = [
  { valor: 'resumen', etiqueta: 'Resumen' },
  { valor: 'preguntar', etiqueta: 'Preguntar' },
];

function Solapas({ vista, onChange }: { vista: Vista; onChange: (v: Vista) => void }) {
  const tema = useTema();
  return (
    <View style={styles.solapas} testID="inteligencia-solapas">
      {OPCIONES_VISTA.map((o) => {
        const activa = o.valor === vista;
        return (
          <Pressable
            key={o.valor}
            testID={`inteligencia-solapa-${o.valor}`}
            accessibilityRole="button"
            accessibilityState={{ selected: activa }}
            onPress={() => onChange(o.valor)}
            style={pressableStyle(styles.solapaPresionable)}
          >
            <View style={[styles.solapa, { borderColor: activa ? tema.color.acento : tema.color.borde }]}>
              <Text
                style={{
                  color: activa ? tema.color.acento : tema.color.textoTenue,
                  fontFamily: tema.fuente.uiMedium,
                  fontSize: tema.tipo.base,
                }}
              >
                {o.etiqueta}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

export function PantallaInteligencia() {
  const tema = useTema();
  const [estado, setEstado] = useState<EstadoLista>('cargando');
  const [portada, setPortada] = useState<Portada | null>(null);
  const [refrescando, setRefrescando] = useState(false);
  const [vista, setVista] = useState<Vista>('resumen');
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
    };
  }, [cargar]);

  async function tirarParaRefrescar() {
    setRefrescando(true);
    try {
      await cargar();
    } finally {
      if (vivo.current) setRefrescando(false);
    }
  }

  /** Un importe para un KPI: «—» si no vino, nunca «$0». */
  const kpi = (v: string | null) => (v != null ? formatearImporte(v) : '—');

  return (
    <MarcoGlass titulo="Inteligencia de Negocio" icono="inteligencia" testID="pantalla-inteligencia">
      <View style={styles.raiz}>
        <Solapas vista={vista} onChange={setVista} />

        {vista === 'preguntar' ? (
          <ChatInteligencia />
        ) : (
          <>
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
        <ScrollFormulario
          testID="inteligencia-portada"
          contentContainerStyle={{ padding: tema.espacio.md, gap: tema.espacio.md, paddingBottom: 120 }}
          refreshControl={
            <RefreshControl
              refreshing={refrescando}
              onRefresh={() => void tirarParaRefrescar()}
              tintColor={tema.color.acento}
              colors={[tema.color.acento]}
              testID="inteligencia-refresh"
            />
          }
        >
          {/* CAJA — el número grande, lo primero que se mira. */}
          <View testID="inteligencia-caja">
            <Text style={{ color: tema.color.textoTenue, fontFamily: tema.fuente.mono, fontSize: tema.tipo.chico, letterSpacing: 1.2 }}>
              EN CAJA
            </Text>
            <Text style={{ color: tema.color.acento, fontFamily: tema.fuente.uiBold, fontSize: 34 }}>
              {kpi(portada.caja.saldo)}
            </Text>
          </View>

          {/* EL MES — cinco números, en una grilla de dos columnas. */}
          <Text style={rotulo(tema)}>ESTE MES</Text>
          <View style={styles.grillaKpis}>
            {(
              [
                ['Ingresos', portada.mes.ingresos, tema.color.exito],
                ['Gastos', portada.mes.gastos, tema.color.peligro],
                ['Rentabilidad', portada.mes.rentabilidad, tema.color.acento],
                ['Facturado', portada.mes.facturado, tema.color.texto],
                ['Cobrado', portada.mes.cobrado, tema.color.texto],
              ] as const
            ).map(([etiqueta, valor, color]) => (
              <View key={etiqueta} style={styles.kpiCelda} testID={`inteligencia-mes-${etiqueta.toLowerCase()}`}>
                <Text style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico }}>{etiqueta}</Text>
                <Text style={{ color, fontFamily: tema.fuente.uiSemibold, fontSize: tema.tipo.titulo }}>
                  {kpi(valor)}
                </Text>
              </View>
            ))}
          </View>

          {/* POR COBRAR — con lo vencido resaltado, que es lo accionable. */}
          <Row testID="inteligencia-por-cobrar">
            <View style={styles.filaEntre}>
              <Text style={{ color: tema.color.texto, fontFamily: tema.fuente.uiMedium, fontSize: tema.tipo.base }}>
                Por cobrar
              </Text>
              <Text style={{ color: tema.color.texto, fontFamily: tema.fuente.uiSemibold, fontSize: tema.tipo.base }}>
                {kpi(portada.porCobrar.total)}
              </Text>
            </View>
          </Row>
          {portada.porCobrar.vencido != null && (
            <Text testID="inteligencia-vencido" style={{ color: tema.color.peligro, fontSize: tema.tipo.chico, marginTop: -8 }}>
              {formatearImporte(portada.porCobrar.vencido)} vencido
            </Text>
          )}

          {/* SERIE MENSUAL — barras proporcionales, sin librería: ingresos vs gastos por mes. */}
          {portada.serieMensual.length > 0 && (
            <View testID="inteligencia-serie">
              <Text style={rotulo(tema)}>MES A MES</Text>
              <SerieBarras portada={portada} />
            </View>
          )}

          {/* MEJORES CLIENTES — degrada a vacío si Clientes no está (contrato §3.1). */}
          <Text style={rotulo(tema)}>MEJORES CLIENTES</Text>
          {portada.mejoresClientes.length === 0 ? (
            <Text testID="inteligencia-clientes-vacio" style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico }}>
              Todavía no hay clientes con ventas registradas.
            </Text>
          ) : (
            portada.mejoresClientes.map((c) => (
              <Row key={c.cliente} testID={`inteligencia-cliente-${c.cliente}`}>
                <View style={styles.filaEntre}>
                  <Text style={{ color: tema.color.texto, fontSize: tema.tipo.base }}>{c.cliente}</Text>
                  <Text style={{ color: tema.color.acento, fontFamily: tema.fuente.uiSemibold, fontSize: tema.tipo.base }}>
                    {kpi(c.total)}
                  </Text>
                </View>
              </Row>
            ))
          )}

          {/* LOS 4 GRÁFICOS — cada uno con su propia carga, endpoints independientes de la portada. */}
          <View testID="inteligencia-graficos-seccion" style={{ marginTop: tema.espacio.md }}>
            <GraficosInteligencia />
          </View>
        </ScrollFormulario>
            )}
          </>
        )}
      </View>
    </MarcoGlass>
  );
}

/**
 * Barras de la serie mensual, dibujadas con `View`s de alto proporcional — sin librería de gráficos
 * (una dependencia nueva para dos barras por mes sería sobreingeniería). La altura se normaliza contra
 * el máximo de la serie; un mes sin dato (`null`) no dibuja barra, no dibuja una de alto cero que se
 * leería como «cero».
 */
function SerieBarras({ portada }: { portada: Portada }) {
  const tema = useTema();
  const nums = portada.serieMensual.flatMap((p) =>
    [p.ingresos, p.gastos].filter((v): v is string => v != null).map(Number),
  );
  const max = nums.length > 0 ? Math.max(...nums, 1) : 1;
  const ALTO = 80;

  return (
    <View style={styles.serieFila}>
      {portada.serieMensual.map((p) => {
        const barra = (valor: string | null, color: string) => {
          if (valor == null) return <View style={[styles.barra, { height: 1, backgroundColor: tema.color.borde }]} />;
          const h = Math.max(2, (Number(valor) / max) * ALTO);
          return <View style={[styles.barra, { height: h, backgroundColor: color }]} />;
        };
        return (
          <View key={p.mes} style={styles.serieCol} testID={`inteligencia-barra-${p.mes}`}>
            <View style={styles.serieBarras}>
              {barra(p.ingresos, tema.color.exito)}
              {barra(p.gastos, tema.color.peligro)}
            </View>
            {/* `2026-04` → `04`: la etiqueta corta cabe; el año se repite y no aporta acá. */}
            <Text style={{ color: tema.color.textoTenue, fontSize: 10 }}>{p.mes.slice(5)}</Text>
          </View>
        );
      })}
    </View>
  );
}

/** El rótulo de sección — depende del tema, así que es una función, no una entrada de `StyleSheet`. */
const rotulo = (tema: ReturnType<typeof useTema>) => ({
  color: tema.color.acento,
  fontFamily: tema.fuente.mono,
  fontSize: 11,
  letterSpacing: 1.2,
  opacity: 0.7,
});

const styles = StyleSheet.create({
  raiz: { flex: 1 },
  solapas: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  solapaPresionable: { flexGrow: 1 },
  solapa: {
    minHeight: 0,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 10,
  },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  grillaKpis: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  kpiCelda: { flexGrow: 1, flexBasis: '44%', gap: 2 },
  filaEntre: { flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  serieFila: { flexDirection: 'row', gap: 12, alignItems: 'flex-end', marginTop: 8 },
  serieCol: { alignItems: 'center', gap: 4 },
  serieBarras: { flexDirection: 'row', gap: 3, alignItems: 'flex-end' },
  barra: { width: 12, borderRadius: 3 },
});

import { useCallback, useEffect, useState } from 'react';
import { router } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import {
  ETIQUETA_CATEGORIA,
  esCategoriaValida,
  formatearFechaCorta,
  formatearImporte,
  imputacionDeTrabajos,
  leerGraficoCategorias,
  leerGraficoMargenTrabajo,
  margenPonderado,
} from '@copiloto/core';

import { Tarjeta } from '../../../theme/Tarjeta';
import { useTema } from '../../../theme/ThemeProvider';
import { conAlfa } from '../../../theme/glass/conAlfa';
import { PRESS_FADE, pressableStyle } from '../../../theme/glass/presion';
import { AnilloCategorias } from './AnilloCategorias';

/**
 * `GraficosInteligencia` — los 4 gráficos del contrato de IN (§2), montados dentro de la portada
 * (`PantallaInteligencia`). Item pendiente que quedó anotado tres veces en los `avance_` del sprint —
 * la decisión de placement era mía y no había aparecido; la tomo acá: los 4 en la MISMA pantalla que
 * la portada, cada uno con su propia carga (no comparten el `estado` de `leerPortada`, son endpoints
 * independientes que pueden estar disponibles en momentos distintos).
 *
 * 🔴 **Sin drill-down en esta pasada.** Los 3 primitivos (`GraficoBarras`/`GraficoTorta`) ya exponen
 * `onSegmentoPress` (contrato §2: "tocar abre el detalle"), pero wirear las 3 formas de `?detalle=`
 * (mes, mes:entro/salio, categoría, eslabón:ref) es la PRÓXIMA pieza, no ésta — el pedido que destrabó
 * esto fue "que aparezcan y carguen, no vacías". Deuda visible, no invisible: queda sin tocar
 * `onSegmentoPress`, no se simula un handler que no hace nada.
 */

/**
 * H-A4-6: `res.periodo` llega ISO crudo — `"2026-07"` (período simple) o `"2026-02..2026-07"` (rango,
 * el que devuelven los 4 gráficos con ventana móvil). No es "otro formateador": reusa
 * `formatearFechaCorta` para cada lado del rango — sólo agrega el `split('..')` que ninguna función
 * de `@copiloto/core` resuelve porque el rango es específico de estos gráficos.
 */
function formatearPeriodo(periodo: string): string {
  const partes = periodo.split('..');
  if (partes.length === 2) return `${formatearFechaCorta(partes[0])} – ${formatearFechaCorta(partes[1])}`;
  return formatearFechaCorta(periodo);
}

function useGrafico<R>(leer: () => Promise<R>): R | null {
  const [resultado, setResultado] = useState<R | null>(null);
  useEffect(() => {
    let vivo = true;
    void (async () => {
      const res = await leer();
      if (vivo) setResultado(res);
    })();
    return () => {
      vivo = false;
    };
  }, [leer]);
  return resultado;
}

function Cargando({ testID }: { testID: string }) {
  const tema = useTema();
  return (
    <View style={styles.centro} testID={testID}>
      <ActivityIndicator color={tema.color.acento} />
    </View>
  );
}

function TarjetaCategorias() {
  const leer = useCallback(() => leerGraficoCategorias(), []);
  const res = useGrafico(leer);

  if (res == null) return <Cargando testID="inteligencia-grafico-categorias-cargando" />;
  if (res.status !== 'ok' || res.modo !== 'serie') return null;

  const porciones = res.serie.map((p) => ({
    categoria: esCategoriaValida(p.categoria) ? ETIQUETA_CATEGORIA[p.categoria] : p.categoria,
    valor: p.total,
  }));

  return (
    <Tarjeta testID="inteligencia-grafico-categorias" rotulo="En qué se me va">
      <AnilloCategorias
        testID="grafico-categorias"
        porciones={porciones}
        epigrafe={res.periodo !== '' ? formatearPeriodo(res.periodo) : undefined}
      />
    </Tarjeta>
  );
}

const TITULO_MARGEN = 'Cuánto te deja cada trabajo';
const LADO_ANILLO = 92;
const GROSOR_ANILLO = 10;
const RADIO_ANILLO = (LADO_ANILLO - GROSOR_ANILLO) / 2;
const VUELTA = 2 * Math.PI * RADIO_ANILLO;

/** El margen general como anillo: la parte en tinta es lo que queda de cada peso cobrado. */
function AnilloMargen({ pct }: { pct: number }) {
  const tema = useTema();
  const avance = Math.max(0, Math.min(pct, 100)) / 100;
  return (
    <View style={styles.anilloMargen}>
      <Svg width={LADO_ANILLO} height={LADO_ANILLO}>
        <Circle cx={LADO_ANILLO / 2} cy={LADO_ANILLO / 2} r={RADIO_ANILLO} fill="none" stroke={conAlfa(tema.color.texto, 0.1)} strokeWidth={GROSOR_ANILLO} />
        {avance > 0 && (
          <Circle
            cx={LADO_ANILLO / 2}
            cy={LADO_ANILLO / 2}
            r={RADIO_ANILLO}
            fill="none"
            stroke={tema.color.texto}
            strokeWidth={GROSOR_ANILLO}
            strokeLinecap="round"
            strokeDasharray={`${avance * VUELTA} ${VUELTA}`}
            // Arranca arriba, como un reloj.
            transform={`rotate(-90 ${LADO_ANILLO / 2} ${LADO_ANILLO / 2})`}
          />
        )}
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.anilloCentro]} pointerEvents="none">
        <Text style={{ color: tema.color.texto, fontFamily: tema.fuente.display, fontSize: 22 }}>{Math.round(pct)}%</Text>
      </View>
    </View>
  );
}

/**
 * «Cuánto te deja cada trabajo» (Martin 15/11, segunda vuelta). La versión anterior mostraba el margen general,
 * un renglón con regla por CADA trabajo y tres notas: «mucha información y muy dispersa». Ahora hay UNA lectura
 * a la vista —el anillo con lo que queda de cada $100— y dos trabajos: el que más dejó y el que menos. La lista
 * entera ya no se muestra; cómo se hizo la cuenta va en un pie chico.
 */
function TarjetaMargenTrabajo() {
  const tema = useTema();
  const leer = useCallback(() => leerGraficoMargenTrabajo(), []);
  const res = useGrafico(leer);

  if (res == null) return <Cargando testID="inteligencia-grafico-margen-trabajo-cargando" />;
  if (res.status !== 'ok' || res.modo !== 'lista') return null;

  if (res.trabajos.length === 0 && res.sinIngreso.length === 0) {
    return (
      <Tarjeta testID="inteligencia-grafico-margen-trabajo" rotulo={TITULO_MARGEN}>
        <Text
          testID="inteligencia-grafico-margen-trabajo-vacio"
          style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico }}
        >
          Todavía no hay trabajos con presupuesto o factura para medir cuánto te dejan.
        </Text>
      </Tarjeta>
    );
  }

  const resumen = margenPonderado(res.trabajos);
  // Del que más deja al que menos. Un trabajo sin cobrado o sin margen legible va al final.
  const filas = res.trabajos
    .map((t) => {
      const cobrado = t.cobrado != null ? Number(t.cobrado) : NaN;
      const margen = t.margen != null ? Number(t.margen) : NaN;
      const pct = cobrado > 0 && Number.isFinite(margen) ? (margen / cobrado) * 100 : null;
      return { t, pct };
    })
    .sort((a, b) => (b.pct ?? -Infinity) - (a.pct ?? -Infinity));
  const imputacion = imputacionDeTrabajos(res.trabajos);
  const medibles = filas.filter((f) => f.pct != null);
  const mejor = medibles[0] ?? null;
  const peor = medibles.length > 1 ? medibles[medibles.length - 1] : null;
  const linea = { borderTopWidth: 1, borderTopColor: conAlfa(tema.color.texto, 0.12) };
  const tenue = { color: tema.color.textoTenue, fontSize: tema.tipo.chico, lineHeight: 18 };

  const renglon = (f: (typeof filas)[number], rotulo: string | null, testID: string) => (
    <View key={testID} testID={testID} style={[styles.filaTrabajo, linea]}>
      <View style={styles.filaTrabajoTextos}>
        {rotulo != null && <Text style={tenue}>{rotulo}</Text>}
        <Text numberOfLines={1} style={{ color: tema.color.texto, fontFamily: tema.fuente.uiSemibold, fontSize: tema.tipo.base }}>
          {f.t.etiqueta}
        </Text>
        {f.t.margen != null && <Text style={tenue}>Te quedaron {formatearImporte(f.t.margen)}</Text>}
      </View>
      <Text style={{ color: tema.color.texto, fontFamily: tema.fuente.display, fontSize: tema.tipo.grande }}>
        {f.pct != null ? `${Math.round(f.pct)}%` : '—'}
      </Text>
    </View>
  );

  return (
    <Tarjeta testID="inteligencia-grafico-margen-trabajo" rotulo={TITULO_MARGEN} style={styles.tarjetaMargen}>
      {/* SM-N32: margen del conjunto, PONDERADO (Σmargen/Σcobrado) — por eso «sobre N», no «promedio de N». */}
      {resumen.pct !== null && (
        <View testID="inteligencia-grafico-margen-trabajo-resumen" style={styles.cabeceraMargen}>
          <AnilloMargen pct={resumen.pct} />
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={{ color: tema.color.texto, fontFamily: tema.fuente.display, fontSize: tema.tipo.grande, lineHeight: 24 }}>
              De cada $100 que cobrás, te quedan ${Math.round(resumen.pct)}.
            </Text>
            <Text style={tenue}>
              Sobre {resumen.n} trabajo{resumen.n === 1 ? '' : 's'} cerrado{resumen.n === 1 ? '' : 's'}.
            </Text>
          </View>
        </View>
      )}

      {mejor != null && renglon(mejor, peor != null ? 'El que más dejó' : null, 'inteligencia-grafico-margen-trabajo-mejor')}
      {peor != null && renglon(peor, 'El que menos dejó', 'inteligencia-grafico-margen-trabajo-peor')}

      {/* La lista entera va en su propia pantalla (Martin 15/11): acá sólo la puerta. */}
      {filas.length > 2 && (
        <Pressable
          testID="inteligencia-grafico-margen-trabajo-ver-todos"
          accessibilityRole="button"
          onPress={() => router.push('/inteligencia-trabajos')}
          style={pressableStyle([styles.puertaTrabajos, linea], PRESS_FADE)}
        >
          <Text style={{ flex: 1, color: tema.color.acentoTinta, fontFamily: tema.fuente.uiMedium, fontSize: tema.tipo.base }}>
            Ver los {filas.length} trabajos
          </Text>
          <Text style={{ color: tema.color.textoTenue, fontSize: tema.tipo.grande }}>›</Text>
        </Pressable>
      )}

      {/* El pie: cómo se hizo la cuenta, siempre a la vista y sin desplegar nada (Martin 15/11: los desplegables
          no convencían). SM-E3 sigue en pie: el conteo de gastos imputados acompaña al margen. Si hay trabajos
          sin ningún gasto anotado el porcentaje se ve mejor de lo que es, y ese aviso va en tinta, no en gris. */}
      {(res.trabajos.length > 0 || res.sinIngreso.length > 0) && (
        <View style={[styles.notasMargen, linea]}>
          {res.trabajos.length > 0 && (
            <Text
              testID="inteligencia-grafico-margen-trabajo-imputacion"
              style={[tenue, imputacion.sinNingunGasto > 0 && { color: tema.color.texto }]}
            >
              {imputacion.texto}
            </Text>
          )}
          {res.sinIngreso.length > 0 && (
            <Text testID="inteligencia-grafico-margen-trabajo-sin-ingreso" style={tenue}>
              {res.sinIngreso.length} trabajo{res.sinIngreso.length === 1 ? '' : 's'} sin cobro registrado
              todavía — no entra{res.sinIngreso.length === 1 ? '' : 'n'} en la cuenta.
            </Text>
          )}
        </View>
      )}
    </Tarjeta>
  );
}

export function GraficosInteligencia() {
  return (
    <View style={styles.contenedor} testID="inteligencia-graficos">
      {/* SM-N32 (decisión del operador, 2026-11-04): la tarjeta «Facturación» se RETIRA — el mapa no la
          dibuja. El gráfico de facturación sigue en core (`leerGraficoFacturacion`) por si vuelve. */}
      {/* «Entró vs. salió» dejó de ser tarjeta (Martin 15/11): lo dice «Lo que te quedó», arriba de la pantalla. */}
      <TarjetaCategorias />
      <TarjetaMargenTrabajo />
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { gap: 24 },
  centro: { minHeight: 60, alignItems: 'center', justifyContent: 'center' },
  tarjetaMargen: { gap: 0, paddingBottom: 6 },
  cabeceraMargen: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingBottom: 18 },
  anilloMargen: { width: LADO_ANILLO, height: LADO_ANILLO },
  anilloCentro: { alignItems: 'center', justifyContent: 'center' },
  filaTrabajo: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  filaTrabajoTextos: { flex: 1, gap: 2 },
  puertaTrabajos: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, paddingVertical: 12 },
  notasMargen: { gap: 4, paddingVertical: 14 },
});

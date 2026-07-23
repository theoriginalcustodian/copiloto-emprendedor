import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';

import {
  CATEGORIAS_GASTO,
  ETIQUETA_CATEGORIA,
  esCategoriaValida,
  leerGraficoCategorias,
  leerGraficoEntroVsSalio,
  leerGraficoFacturacion,
  leerGraficoMargenTrabajo,
} from '@copiloto/core';

import { useTema } from '../../../theme/ThemeProvider';
import { GraficoBarras } from './GraficoBarras';
import { GraficoTorta } from './GraficoTorta';

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

const rotulo = (tema: ReturnType<typeof useTema>) => ({
  color: tema.color.acento,
  fontFamily: tema.fuente.mono,
  fontSize: 11,
  letterSpacing: 1.2,
  opacity: 0.7,
});

function TarjetaFacturacion() {
  const tema = useTema();
  const leer = useCallback(() => leerGraficoFacturacion(), []);
  const res = useGrafico(leer);

  if (res == null) return <Cargando testID="inteligencia-grafico-facturacion-cargando" />;
  if (res.status !== 'ok' || res.modo !== 'serie') return null;

  return (
    <View testID="inteligencia-grafico-facturacion">
      <Text style={rotulo(tema)}>FACTURACIÓN</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <GraficoBarras
          testID="grafico-facturacion"
          puntos={res.serie.map((p) => p.mes)}
          series={[
            {
              id: 'total',
              etiqueta: 'Facturado',
              color: tema.color.acento,
              valores: res.serie.map((p) => p.total),
            },
          ]}
          epigrafe={res.periodo !== '' ? res.periodo : undefined}
        />
      </ScrollView>
    </View>
  );
}

function TarjetaEntroVsSalio() {
  const tema = useTema();
  const leer = useCallback(() => leerGraficoEntroVsSalio(), []);
  const res = useGrafico(leer);

  if (res == null) return <Cargando testID="inteligencia-grafico-entro-vs-salio-cargando" />;
  if (res.status !== 'ok' || res.modo !== 'serie') return null;

  return (
    <View testID="inteligencia-grafico-entro-vs-salio">
      <Text style={rotulo(tema)}>ENTRÓ VS SALIÓ</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <GraficoBarras
          testID="grafico-entro-vs-salio"
          puntos={res.serie.map((p) => p.mes)}
          series={[
            { id: 'entro', etiqueta: 'Entró', color: tema.color.exito, valores: res.serie.map((p) => p.entro) },
            { id: 'salio', etiqueta: 'Salió', color: tema.color.peligro, valores: res.serie.map((p) => p.salio) },
          ]}
          epigrafe={res.periodo !== '' ? res.periodo : undefined}
        />
      </ScrollView>
    </View>
  );
}

function TarjetaCategorias() {
  const tema = useTema();
  const leer = useCallback(() => leerGraficoCategorias(), []);
  const res = useGrafico(leer);

  if (res == null) return <Cargando testID="inteligencia-grafico-categorias-cargando" />;
  if (res.status !== 'ok' || res.modo !== 'serie') return null;

  // `orden` colorea por ÍNDICE — se construye con las mismas etiquetas que se muestran, para que el
  // color de cada porción quede atado a la categoría (contrato: nunca a la posición en la respuesta).
  const ordenEtiquetas = CATEGORIAS_GASTO.map((c) => ETIQUETA_CATEGORIA[c]);
  const porciones = res.serie.map((p) => ({
    categoria: esCategoriaValida(p.categoria) ? ETIQUETA_CATEGORIA[p.categoria] : p.categoria,
    valor: p.total,
  }));

  return (
    <View testID="inteligencia-grafico-categorias">
      <Text style={rotulo(tema)}>EN QUÉ SE ME VA</Text>
      <GraficoTorta
        testID="grafico-categorias"
        porciones={porciones}
        orden={ordenEtiquetas}
        epigrafe={res.periodo !== '' ? res.periodo : undefined}
      />
    </View>
  );
}

function TarjetaMargenTrabajo() {
  const tema = useTema();
  const leer = useCallback(() => leerGraficoMargenTrabajo(), []);
  const res = useGrafico(leer);

  if (res == null) return <Cargando testID="inteligencia-grafico-margen-trabajo-cargando" />;
  if (res.status !== 'ok' || res.modo !== 'lista') return null;

  if (res.trabajos.length === 0 && res.sinIngreso.length === 0) {
    return (
      <View testID="inteligencia-grafico-margen-trabajo">
        <Text style={rotulo(tema)}>MARGEN POR TRABAJO</Text>
        <Text
          testID="inteligencia-grafico-margen-trabajo-vacio"
          style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico }}
        >
          Todavía no hay trabajos con presupuesto o factura para medir margen.
        </Text>
      </View>
    );
  }

  return (
    <View testID="inteligencia-grafico-margen-trabajo">
      <Text style={rotulo(tema)}>MARGEN POR TRABAJO</Text>
      {res.trabajos.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <GraficoBarras
            testID="grafico-margen-trabajo"
            puntos={res.trabajos.map((t) => t.etiqueta)}
            series={[
              {
                id: 'margen',
                etiqueta: 'Margen',
                color: tema.color.acento,
                valores: res.trabajos.map((t) => t.margen),
              },
            ]}
          />
        </ScrollView>
      )}
      {res.sinIngreso.length > 0 && (
        <Text
          testID="inteligencia-grafico-margen-trabajo-sin-ingreso"
          style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico, marginTop: 4 }}
        >
          {res.sinIngreso.length} trabajo{res.sinIngreso.length === 1 ? '' : 's'} sin cobro registrado
          todavía — no entra{res.sinIngreso.length === 1 ? '' : 'n'} al margen.
        </Text>
      )}
    </View>
  );
}

export function GraficosInteligencia() {
  return (
    <View style={styles.contenedor} testID="inteligencia-graficos">
      <TarjetaFacturacion />
      <TarjetaEntroVsSalio />
      <TarjetaCategorias />
      <TarjetaMargenTrabajo />
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { gap: 20 },
  centro: { minHeight: 60, alignItems: 'center', justifyContent: 'center' },
});

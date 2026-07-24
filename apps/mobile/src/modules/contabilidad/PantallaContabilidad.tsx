import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { ETIQUETA_CATEGORIA, formatearImporte, obtenerResumenContabilidad, type ResumenContabilidad } from '@copiloto/core';

import { ScrollFormulario } from '../../theme/glass/campos';
import { MarcoGlass } from '../../theme/glass/MarcoGlass';
import { Tile } from '../../theme/glass/Tile';
import { useTema } from '../../theme/ThemeProvider';

/**
 * `PantallaContabilidad` — caja y facturación, **dos preguntas separadas** (contrato §2). Reemplaza el
 * cascarón "PRÓXIMAMENTE" (`hallazgo_..._hito-C-recon-SS0`): el tile y la ruta ya estaban decididos,
 * esto llena el contenido.
 *
 * 🔴 **El endpoint todavía no existe** (`dato_planificacion-a-frontend_ARRANCA-la-mitad-app-de-hito-C`,
 * 2026-07-24) — se construyó contra la FORMA declarada del contrato §4, con `no_disponible` como
 * degradación explícita mientras backend lo despliega. Mismo patrón que `PantallaGastos`.
 *
 * 🔴 **Nunca suma `caja` y `facturado`.** Son dos números que el contrato separa a propósito (§2): una
 * factura emitida no es caja hasta que se cobra. Esta pantalla los muestra en tiles distintos y no
 * calcula nada entre ellos — el backend ya hizo esa cuenta.
 */

type Estado = 'cargando' | 'ok' | 'error' | 'no_disponible';

export function PantallaContabilidad() {
  const tema = useTema();
  const [estado, setEstado] = useState<Estado>('cargando');
  const [resumen, setResumen] = useState<ResumenContabilidad | null>(null);
  const [refrescando, setRefrescando] = useState(false);
  const vivo = useRef(true);
  useEffect(() => () => { vivo.current = false; }, []);

  const cargar = useCallback((silencioso = false): Promise<void> => {
    if (!silencioso) setEstado('cargando');
    return obtenerResumenContabilidad()
      .then((res) => {
        if (!vivo.current) return;
        if (res.status === 'no_disponible') {
          setEstado('no_disponible');
          setResumen(null);
          return;
        }
        setResumen(res.resumen);
        setEstado('ok');
      })
      .catch(() => {
        if (vivo.current) setEstado('error');
      });
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  async function tirarParaRefrescar() {
    setRefrescando(true);
    await cargar(true);
    if (vivo.current) setRefrescando(false);
  }

  return (
    <MarcoGlass titulo="Contabilidad" icono="folder" testID="pantalla-contabilidad">
      {estado === 'cargando' && (
        <View style={styles.centro}>
          <ActivityIndicator testID="contabilidad-cargando" color={tema.color.acento} />
        </View>
      )}

      {estado === 'error' && (
        <View style={styles.centro}>
          <Text testID="contabilidad-error" style={{ color: tema.color.peligro, fontSize: tema.tipo.base }}>
            No pudimos cargar tu contabilidad. Tirá hacia abajo para reintentar.
          </Text>
        </View>
      )}

      {estado === 'no_disponible' && (
        <View style={styles.centro}>
          <Text
            testID="contabilidad-no-disponible"
            style={{ color: tema.color.textoTenue, fontSize: tema.tipo.base, textAlign: 'center' }}
          >
            La contabilidad todavía no está disponible en tu copiloto.
          </Text>
        </View>
      )}

      {estado === 'ok' && resumen != null && (
        <ScrollFormulario
          testID="contabilidad-contenido"
          contentContainerStyle={{ padding: tema.espacio.lg, gap: tema.espacio.md, paddingBottom: 120 }}
          refreshControl={
            <RefreshControl
              refreshing={refrescando}
              onRefresh={() => void tirarParaRefrescar()}
              tintColor={tema.color.acento}
              colors={[tema.color.acento]}
              testID="contabilidad-refresh"
            />
          }
        >
          <SeccionCaja caja={resumen.caja} />
          {resumen.gastos.porCategoria.length > 0 && <SeccionGastos porCategoria={resumen.gastos.porCategoria} />}
          <SeccionFacturado facturado={resumen.facturado} />
          {resumen.clientes.length > 0 && <SeccionClientes clientes={resumen.clientes} />}
        </ScrollFormulario>
      )}
    </MarcoGlass>
  );
}

function SeccionCaja({ caja }: { caja: ResumenContabilidad['caja'] }) {
  const tema = useTema();
  // `queda` puede ser negativo (§4.1) — un mes en rojo es información, no un bug, y se muestra así.
  const negativo = caja.queda.trim().startsWith('-');

  return (
    <Tile testID="contabilidad-caja">
      <Text style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico }}>Caja</Text>
      <Text
        testID="contabilidad-caja-queda"
        style={{ color: negativo ? tema.color.peligro : tema.color.texto, fontSize: tema.tipo.titulo, fontWeight: '700' }}
      >
        {formatearImporte(caja.queda)}
      </Text>
      <View style={styles.filaCaja}>
        <Text testID="contabilidad-caja-entro" style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico }}>
          Entró {formatearImporte(caja.entro)}
        </Text>
        <Text testID="contabilidad-caja-salio" style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico }}>
          Salió {formatearImporte(caja.salio)}
        </Text>
      </View>
      {caja.mesAnterior != null && (
        <Text testID="contabilidad-caja-mes-anterior" style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico }}>
          Mes anterior: {formatearImporte(caja.mesAnterior.queda)}
        </Text>
      )}
    </Tile>
  );
}

function SeccionGastos({ porCategoria }: { porCategoria: ResumenContabilidad['gastos']['porCategoria'] }) {
  const tema = useTema();
  // Sobre la suma REAL, no 100 — el contrato avisa que los porcentajes no están garantizados a cerrar.
  const suma = porCategoria.reduce((a, c) => a + c.porcentaje, 0);

  return (
    <Tile testID="contabilidad-gastos">
      <Text style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico }}>En qué se te va la plata</Text>
      <View style={styles.categorias}>
        {porCategoria.map((c) => (
          <View key={c.categoria} style={styles.filaCategoria} testID={`contabilidad-gastos-cat-${c.categoria}`}>
            <View style={styles.encabezadoCategoria}>
              <Text style={{ color: tema.color.texto, fontSize: tema.tipo.chico, flex: 1 }}>
                {ETIQUETA_CATEGORIA[c.categoria]}
              </Text>
              <Text style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico }}>{formatearImporte(c.total)}</Text>
            </View>
            <View style={[styles.barraFondo, { backgroundColor: tema.color.textoTenue + '22' }]}>
              <View
                style={[
                  styles.barra,
                  { backgroundColor: tema.color.acento, width: suma > 0 ? `${(c.porcentaje / suma) * 100}%` : '0%' },
                ]}
              />
            </View>
          </View>
        ))}
      </View>
    </Tile>
  );
}

function SeccionFacturado({ facturado }: { facturado: ResumenContabilidad['facturado'] }) {
  const tema = useTema();
  // Sin token de "advertencia" en la paleta (sólo `exito`/`peligro`): `amarillo` cae en `acento`, el
  // único color que llama la atención sin afirmar ni éxito ni peligro que no le constan a este tile.
  const colorSemaforo: Record<string, string> = {
    verde: tema.color.exito,
    amarillo: tema.color.acento,
    rojo: tema.color.peligro,
  };

  return (
    <Tile testID="contabilidad-facturado">
      <Text style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico }}>Facturado</Text>
      <Text testID="contabilidad-facturado-periodo" style={{ color: tema.color.texto, fontSize: tema.tipo.titulo, fontWeight: '700' }}>
        {formatearImporte(facturado.periodo)}
      </Text>
      <Text testID="contabilidad-facturado-doce-meses" style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico }}>
        Últimos 12 meses: {formatearImporte(facturado.doceMeses)}
      </Text>

      {/* Fail-soft del §4.3: sin escala vigente, `tope` viene `null` y se muestra SOLO el acumulado —
          nunca un tope viejo presentado como vigente. */}
      {facturado.tope != null && (
        <Text
          testID="contabilidad-facturado-tope"
          style={{ color: colorSemaforo[facturado.tope.semaforo] ?? tema.color.textoTenue, fontSize: tema.tipo.chico }}
        >
          {facturado.tope.porcentaje}% del tope monotributo
        </Text>
      )}
    </Tile>
  );
}

function SeccionClientes({ clientes }: { clientes: ResumenContabilidad['clientes'] }) {
  const tema = useTema();
  return (
    <Tile testID="contabilidad-clientes">
      <Text style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico }}>Mejores clientes</Text>
      <View style={styles.categorias}>
        {clientes.map((c) => (
          <View key={c.clienteRef} style={styles.filaCliente} testID={`contabilidad-cliente-${c.clienteRef}`}>
            <Text style={{ color: tema.color.texto, fontSize: tema.tipo.chico, flex: 1 }}>{c.nombre}</Text>
            <Text style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico }}>{formatearImporte(c.total)}</Text>
          </View>
        ))}
      </View>
    </Tile>
  );
}

const styles = StyleSheet.create({
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  filaCaja: { flexDirection: 'row', gap: 16, marginTop: 4 },
  categorias: { gap: 8, marginTop: 12 },
  filaCategoria: { gap: 4 },
  encabezadoCategoria: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  barraFondo: { height: 6, borderRadius: 3, overflow: 'hidden' },
  barra: { height: 6, borderRadius: 3 },
  filaCliente: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});

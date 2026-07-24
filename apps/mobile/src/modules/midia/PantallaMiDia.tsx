import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Pressable, ScrollView } from 'react-native-gesture-handler';

import { formatearImporte, leerTablero, type IdSolapa, type TarjetaMiDia, type TableroMiDia } from '@copiloto/core';

import { MarcoGlass } from '../../theme/glass/MarcoGlass';
import { pressableStyle } from '../../theme/glass/presion';
import { Row } from '../../theme/glass/Row';
import { useTema } from '../../theme/ThemeProvider';

/**
 * `PantallaMiDia` — el tablero del detector proactivo (hito 7): 3 solapas (Para hoy · Haciendo ·
 * Hechas), pobladas por las tarjetas que las 8 reglas determinísticas del `contrato_mi-dia-y-el-
 * detector-proactivo` van generando.
 *
 * 🔴 **Reemplaza al Kanban de 4 columnas retirado el 2026-07-23.** Ver `respuesta_planificacion-a-
 * frontend-backend_mi-dia-es-el-detector-3-solapas...`: el pipeline de facturación NO es Mi Día — son
 * conceptos distintos que compartían por error la misma URL.
 *
 * 🔴 **`GET /mi-dia/tablero` está VIVO** (backend PR#96, desplegado y verificado por HTTP —401 sin
 * token, no 404/500). La verificación funcional con tenant real queda para el E2E de device (contrato
 * §6). Toda la pantalla habla con `leerTablero()`; si algo falla igual degrada a `no_disponible` y lo
 * DICE — no simula tarjetas.
 *
 * 🔴 **Lista vertical con solapas arriba, NUNCA columnas ni drag** (contrato §2.3): el arrastre lateral
 * con el pulgar compite con el Pan del panel glass — ya pagado dos veces en este repo (scroll de Apps,
 * glass apilado). El cambio de solapa es un tap sobre la pestaña, no un gesto.
 *
 * 🔴 **Tap → expande (contrato addendum §2).** Colapsada muestra el texto ya redactado (2 líneas);
 * expandida agrega el detalle crudo (cliente/monto/fecha, si la regla los trajo en `datos`) debajo. Es
 * estado local puro, sin red.
 *
 * 🔴 **Sin swipe-para-mutar todavía — incremento aparte, a propósito.** El contrato (§2.3) pide "swipe
 * corto o toque largo" para cambiar de estado, y backend YA contrató las 3 mutaciones
 * (`crearTarjetaMiDia`/`cambiarEstadoTarjetaMiDia`/`borrarTarjetaMiDia`, PR#96) — el cliente ya las
 * expone. Lo que falta acá es el GESTO en sí: RNGH (`swmansion-rn-gestures`) + verificación en device
 * (aparato de backend). No se mezcla con este commit para no represar el cliente+pantalla ya verdes;
 * queda como el próximo `avance_` explícito, no una promesa silenciosa.
 *
 * 🔴 **Se relee al recuperar el FOCO, no sólo al montar** (mi propio pedido sobre el contrato original):
 * una tarjeta puede morir por una acción hecha en OTRA pantalla (cobrar una factura en Facturación), y
 * si esta pantalla sólo cargara al montar, el emprendedor volvería a ver una tarjeta que ya resolvió.
 *
 * 🔴 **`ScrollView`/`Pressable` de gesture-handler, no de react-native** — convención del repo (ver
 * `Tile.tsx`): la app cuelga de un `GestureHandlerRootView` y mezclar el responder system de RN con
 * RNGH hace que un tap corto quede sin dueño.
 */

type EstadoLista = 'cargando' | 'ok' | 'no_disponible';

const OPCIONES_SOLAPA: readonly { valor: IdSolapa; etiqueta: string }[] = [
  { valor: 'para_hoy', etiqueta: 'Para hoy' },
  { valor: 'haciendo', etiqueta: 'Haciendo' },
  // `id` es `hecha` (singular, confirmado backend PR#96); el TÍTULO visible sí es plural.
  { valor: 'hecha', etiqueta: 'Hechas' },
];

function Solapas({ activa, onCambiar }: { activa: IdSolapa; onCambiar: (id: IdSolapa) => void }) {
  const tema = useTema();
  return (
    <View style={styles.solapas} testID="midia-solapas">
      {OPCIONES_SOLAPA.map((o) => {
        const seleccionada = o.valor === activa;
        return (
          <Pressable
            key={o.valor}
            testID={`midia-solapa-${o.valor}`}
            accessibilityRole="button"
            accessibilityState={{ selected: seleccionada }}
            onPress={() => onCambiar(o.valor)}
            style={pressableStyle(styles.solapaPresionable)}
          >
            <View style={[styles.solapa, { borderColor: seleccionada ? tema.color.acento : tema.color.borde }]}>
              <Text
                style={{
                  color: seleccionada ? tema.color.acento : tema.color.textoTenue,
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

export function PantallaMiDia() {
  const tema = useTema();
  const [estado, setEstado] = useState<EstadoLista>('cargando');
  const [tablero, setTablero] = useState<TableroMiDia | null>(null);
  const [solapaActiva, setSolapaActiva] = useState<IdSolapa>('para_hoy');
  const [expandida, setExpandida] = useState<string | null>(null);
  const vivo = useRef(true);

  useFocusEffect(
    useCallback(() => {
      vivo.current = true;
      leerTablero()
        .then((res) => {
          if (!vivo.current) return;
          if (res.status === 'ok') {
            setTablero(res.tablero);
            setEstado('ok');
            return;
          }
          setEstado('no_disponible');
        })
        .catch(() => {
          if (vivo.current) setEstado('no_disponible');
        });
      return () => {
        vivo.current = false;
      };
    }, []),
  );

  const solapa = tablero?.solapas.find((s) => s.id === solapaActiva) ?? null;

  return (
    <MarcoGlass titulo="Mi día" icono="clock" testID="pantalla-midia">
      <View style={styles.raiz}>
        <Solapas activa={solapaActiva} onCambiar={setSolapaActiva} />

        {estado === 'cargando' && (
          <View style={styles.centro}>
            <ActivityIndicator testID="midia-cargando" color={tema.color.acento} />
          </View>
        )}

        {estado === 'no_disponible' && (
          <View style={styles.centro}>
            <Text
              testID="midia-no-disponible"
              style={{ color: tema.color.textoTenue, fontSize: tema.tipo.base, textAlign: 'center' }}
            >
              Tu día todavía no está disponible en tu copiloto.
            </Text>
          </View>
        )}

        {estado === 'ok' && (
          <>
            {(solapa == null || solapa.tarjetas.length === 0) && (
              <View style={styles.centro}>
                <Text testID="midia-vacio" style={{ color: tema.color.textoTenue, fontSize: tema.tipo.base, textAlign: 'center' }}>
                  {solapaActiva === 'para_hoy'
                    ? 'Hoy no tenés nada pendiente. Cuando el copiloto detecte algo, aparece acá.'
                    : 'No hay tarjetas acá todavía.'}
                </Text>
              </View>
            )}

            {solapa != null && solapa.tarjetas.length > 0 && (
              <ScrollView contentContainerStyle={styles.lista} testID="midia-lista">
                {solapa.tarjetas.map((t) => (
                  <TarjetaMiDiaRow
                    key={t.id}
                    tarjeta={t}
                    expandida={expandida === t.id}
                    onPress={() => setExpandida((prev) => (prev === t.id ? null : t.id))}
                  />
                ))}
              </ScrollView>
            )}
          </>
        )}
      </View>
    </MarcoGlass>
  );
}

function TarjetaMiDiaRow({
  tarjeta,
  expandida,
  onPress,
}: {
  tarjeta: TarjetaMiDia;
  expandida: boolean;
  onPress: () => void;
}) {
  const tema = useTema();
  const detalle = [tarjeta.cliente, tarjeta.monto != null ? formatearImporte(tarjeta.monto) : null, tarjeta.fecha]
    .filter((x): x is string => x != null && x !== '')
    .join(' · ');

  return (
    <Row
      onPress={onPress}
      testID={`midia-tarjeta-${tarjeta.id}`}
      accessibilityLabel={expandida ? `${tarjeta.texto}, contraer` : `${tarjeta.texto}, expandir`}
    >
      <View style={styles.tarjeta}>
        <Text
          numberOfLines={expandida ? undefined : 2}
          style={{ color: tema.color.texto, fontFamily: tema.fuente.uiMedium, fontSize: tema.tipo.base }}
        >
          {tarjeta.texto}
        </Text>
        {expandida && detalle !== '' && (
          <Text testID={`midia-tarjeta-${tarjeta.id}-detalle`} style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico }}>
            {detalle}
          </Text>
        )}
      </View>
    </Row>
  );
}

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
  lista: { gap: 8, padding: 16, paddingBottom: 120 },
  tarjeta: { flex: 1, gap: 4 },
});

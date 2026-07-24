import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import { Pressable, ScrollView } from 'react-native-gesture-handler';
import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import type { SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, { type SharedValue } from 'react-native-reanimated';

import {
  borrarTarjetaMiDia,
  cambiarEstadoTarjetaMiDia,
  formatearImporte,
  leerTablero,
  type IdSolapa,
  type TarjetaMiDia,
  type TableroMiDia,
} from '@copiloto/core';

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
 * 🔴 **Swipe con `ReanimatedSwipeable`, no un `Gesture.Pan` a mano** (contrato §2.3 pide "swipe corto...
 * nunca arrastre libre" — el componente YA fija acciones a un ancho reservado, no drag libre). Revela
 * "Empezar"/"Terminé" (avanzar de solapa) + "Borrar" a la derecha; en `hecha` sólo queda "Borrar" — no
 * hay solapa siguiente. Después de una mutación se **relee el tablero entero**, nunca se edita el
 * estado local a mano: la tarjeta se va de la lista porque el backend confirmó que se movió, no porque
 * la UI lo asumió (mismo criterio que §2.1 — la tarjeta muere por el HECHO).
 *
 * 🔴 **`estado` que se manda es una ASUNCIÓN razonada, no confirmada literal.** Backend documentó los
 * CAMPOS de la tarjeta pero no el conjunto de valores válidos de `estado`; asumo que coincide con los
 * `id` de solapa (mismo vocabulario ya confirmado: `para_hoy`/`haciendo`/`hecha`) — preguntado en
 * `pedido_frontend-a-backend_valores-reales-de-estado...`. Si la asunción es incorrecta, el 400 trae
 * el `detail` real de backend y se lo muestra tal cual al emprendedor (`estado_invalido` en
 * `cambiarEstadoTarjetaMiDia`) — no falla en silencio ni inventa un mensaje genérico.
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

/** A qué solapa avanza cada una, y cómo se llama la acción. `hecha` no tiene entrada: es terminal, no
 *  hay "siguiente" — sólo queda la acción de borrar. */
const SIGUIENTE: Partial<Record<IdSolapa, { estado: IdSolapa; etiqueta: string }>> = {
  para_hoy: { estado: 'haciendo', etiqueta: 'Empezar' },
  haciendo: { estado: 'hecha', etiqueta: 'Terminé' },
};

export function PantallaMiDia() {
  const tema = useTema();
  const [estado, setEstado] = useState<EstadoLista>('cargando');
  const [tablero, setTablero] = useState<TableroMiDia | null>(null);
  const [solapaActiva, setSolapaActiva] = useState<IdSolapa>('para_hoy');
  const [expandida, setExpandida] = useState<string | null>(null);
  const vivo = useRef(true);

  const cargar = useCallback(async () => {
    try {
      const res = await leerTablero();
      if (!vivo.current) return;
      if (res.status === 'ok') {
        setTablero(res.tablero);
        setEstado('ok');
        return;
      }
      setEstado('no_disponible');
    } catch {
      if (vivo.current) setEstado('no_disponible');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      vivo.current = true;
      void cargar();
      return () => {
        vivo.current = false;
      };
    }, [cargar]),
  );

  async function avanzar(t: TarjetaMiDia) {
    const siguiente = SIGUIENTE[solapaActiva];
    if (siguiente == null) return;
    const res = await cambiarEstadoTarjetaMiDia(t.id, siguiente.estado);
    if (res.status === 'ok') {
      void cargar();
      return;
    }
    if (res.status === 'estado_invalido') {
      Alert.alert('No se pudo mover la tarjeta', res.motivo);
      return;
    }
    Alert.alert('No se pudo mover la tarjeta', 'Probá de nuevo en un momento.');
  }

  async function borrar(t: TarjetaMiDia) {
    const res = await borrarTarjetaMiDia(t.id);
    if (res.status === 'ok') {
      void cargar();
      return;
    }
    Alert.alert('No se pudo borrar la tarjeta', 'Probá de nuevo en un momento.');
  }

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
                    etiquetaAvanzar={SIGUIENTE[solapaActiva]?.etiqueta ?? null}
                    onPress={() => setExpandida((prev) => (prev === t.id ? null : t.id))}
                    onAvanzar={() => void avanzar(t)}
                    onBorrar={() => void borrar(t)}
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
  etiquetaAvanzar,
  onPress,
  onAvanzar,
  onBorrar,
}: {
  tarjeta: TarjetaMiDia;
  expandida: boolean;
  /** `null` en la solapa "hecha": no hay siguiente, sólo se puede borrar. */
  etiquetaAvanzar: string | null;
  onPress: () => void;
  onAvanzar: () => void;
  onBorrar: () => void;
}) {
  const tema = useTema();
  const swipeableRef = useRef<SwipeableMethods>(null);
  const detalle = [tarjeta.cliente, tarjeta.monto != null ? formatearImporte(tarjeta.monto) : null, tarjeta.fecha]
    .filter((x): x is string => x != null && x !== '')
    .join(' · ');

  // `opacity: progress` — Reanimated acepta un `SharedValue` directo en el style de `Animated.View`
  // (no hace falta `useAnimatedStyle` para un caso de un solo campo). Mismo patrón que la referencia
  // de la skill `swmansion-rn-gestures` (`swipeable-and-drawer.md`).
  const acciones = (progress: SharedValue<number>) => (
    <Animated.View style={[styles.accionesSwipe, { opacity: progress }]}>
      {etiquetaAvanzar != null && (
        <Pressable
          testID={`midia-tarjeta-${tarjeta.id}-avanzar`}
          accessibilityRole="button"
          accessibilityLabel={etiquetaAvanzar}
          onPress={() => {
            swipeableRef.current?.close();
            onAvanzar();
          }}
          style={[styles.botonSwipe, { backgroundColor: tema.color.acento }]}
        >
          <Text style={{ color: tema.color.fondo, fontFamily: tema.fuente.uiSemibold, fontSize: tema.tipo.chico }}>
            {etiquetaAvanzar}
          </Text>
        </Pressable>
      )}
      <Pressable
        testID={`midia-tarjeta-${tarjeta.id}-borrar`}
        accessibilityRole="button"
        accessibilityLabel="Borrar"
        onPress={() => {
          swipeableRef.current?.close();
          onBorrar();
        }}
        style={[styles.botonSwipe, { backgroundColor: tema.color.peligro }]}
      >
        <Text style={{ color: tema.color.fondo, fontFamily: tema.fuente.uiSemibold, fontSize: tema.tipo.chico }}>
          Borrar
        </Text>
      </Pressable>
    </Animated.View>
  );

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={acciones}
      rightThreshold={40}
      overshootFriction={8}
      // 🔴 SIN wiring explícito contra el `Gesture.Pan()` de `MarcoGlass` (drag-down-para-cerrar): ese
      // gesto vive DENTRO de `MarcoGlass` y no se expone como prop, así que no hay forma de pasárselo acá.
      // Confío en la resolución de arena por defecto de RNGH (el hijo más profundo prueba primero; si el
      // gesto no activa por dirección — el Pan del marco es vertical, este swipe es horizontal — cede al
      // padre), el mismo patrón que ya funciona con el `ScrollView` vertical de esta lista. **NO
      // verificado — es justo el ítem del DoD "el swipe no rompe el panel deslizable, en device".**
    >
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
    </Swipeable>
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
  accionesSwipe: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingRight: 4 },
  botonSwipe: {
    height: '100%',
    minWidth: 76,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
});

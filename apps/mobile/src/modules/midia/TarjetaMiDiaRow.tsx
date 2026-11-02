import { useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import type { SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, { type SharedValue } from 'react-native-reanimated';

import { avisoAlChat, type AvisoAlChat, type TarjetaMiDia } from '@copiloto/core';

import { llevaAlChat, rutaDeDestino, type RutaDestino } from './destinoTarjeta';
import { TileCategoria } from './TileCategoria';
import { Row } from '../../theme/glass/Row';
import { pressableStyle } from '../../theme/glass/presion';
import { useTema } from '../../theme/ThemeProvider';

/**
 * Una tarjeta del detector: tile, texto y, expandida, prosa, chip, acción y filas clave/valor. La usan las
 * dos pantallas, Mi día y Tu día: una sola copia, para que un arreglo no haya que hacerlo dos veces.
 *
 * 🔴 **Tap → expande (contrato addendum §2).** Colapsada muestra el texto ya redactado (2 líneas);
 * expandida agrega el detalle crudo. Es estado del padre, sin red.
 *
 * 🔴 **Swipe con `ReanimatedSwipeable`, no un `Gesture.Pan` a mano** (contrato §2.3 pide "swipe corto...
 * nunca arrastre libre" — el componente YA fija acciones a un ancho reservado, no drag libre). Revela
 * "Empezar"/"Terminé" (avanzar de solapa) + "Borrar" a la derecha; en `hecha` sólo queda "Borrar" — no
 * hay solapa siguiente. Después de una mutación se **relee el tablero entero**, nunca se edita el
 * estado local a mano: la tarjeta se va de la lista porque el backend confirmó que se movió, no porque
 * la UI lo asumió (mismo criterio que §2.1 — la tarjeta muere por el HECHO).
 * Sólo con `gestion`: Mi día resume y el swipe se mudó al tablero (`index.html:3097`).
 */
export interface GestionTarjeta {
  /** `null` en la solapa "hecha": no hay siguiente, sólo se puede borrar. */
  etiquetaAvanzar: string | null;
  onAvanzar: () => void;
  onBorrar: () => void;
}

export function TarjetaMiDiaRow({
  tarjeta,
  expandida,
  onPress,
  gestion,
  onBorrar,
  onAccion,
  onAviso,
}: {
  tarjeta: TarjetaMiDia;
  expandida: boolean;
  onPress: () => void;
  /** Avanzar y borrar por swipe. Sin ella la tarjeta no se desliza. */
  gestion?: GestionTarjeta;
  /**
   * La tarjeta que anotó el emprendedor no tiene puente al chat: su verbo es borrarla, y se ofrece también sin
   * swipe porque un gesto solo no alcanza (WCAG 2.5.1, `index.html:3861`).
   */
  onBorrar?: () => void;
  /** A dónde lleva la acción de `presentacion`, ya resuelta por `rutaDeDestino`. Sin ella, rótulo. */
  onAccion?: (ruta: RutaDestino) => void;
  /** El puente al chat (`hitl a`). Sin él, o en una tarjeta sin puente (manual), el verbo es rótulo. */
  onAviso?: (aviso: AvisoAlChat) => void;
}) {
  const tema = useTema();
  const swipeableRef = useRef<SwipeableMethods>(null);
  // Filas clave/valor como los `.kv` del prototipo (pantalla `#tablero`, `index.html:2493-2495`: «Monto ·
  // $180.000», «Enviado · 18 de julio»). El rótulo y el valor los decide la REGLA y llegan ya formateados en
  // `presentacion.kv`: la app no arma la tabla regla→campo (contrato H12/DETALLEKV §2; era la tabla fija
  // `Monto`/`Fecha` leyendo `datos.monto`/`datos.fecha`, que ninguna regla escribe — H12). Por eso la tarjeta
  // ya NO lee `monto`/`fecha`: el campo no existe en `TarjetaMiDia` y un test lo cuida.
  // Sin `presentacion` (producción hoy) sólo queda la fila «Cliente».
  const presentacion = tarjeta.presentacion ?? null;
  const prosa = presentacion?.prosa ?? null;
  const kvBackend = presentacion?.kv.map((f) => ({ clave: f.k, valor: f.v })) ?? [];
  // «Cliente» se queda mientras `texto` no nombre la entidad (H12 §5: si se saca con el `texto` genérico, el
  // nombre del cliente desaparece de la tarjeta). Sale en el PR en que el titular lo diga, no antes. Si el
  // backend ya mandó una kv «Cliente», no se duplica.
  const hayClienteEnKv = kvBackend.some((f) => f.clave.trim().toLowerCase() === 'cliente');
  const conCliente: { clave: string; valor: string }[] =
    tarjeta.cliente != null && !hayClienteEnKv
      ? [{ clave: 'Cliente', valor: tarjeta.cliente }, ...kvBackend]
      : kvBackend;
  // `caida`: el kv «Se cayó · hora» del prototipo (`index.html:3658`) lo emite el BACKEND en `presentacion.kv`
  // (`mi_dia_presentacion.py`) y se pinta como cualquier otra fila. La app NO lo arma: leer `datos.desde` acá
  // era la tabla regla→campo que DETALLEKV §2 prohíbe, y post-deploy quedaba inalcanzable y verde
  // (KVCAIDASALE, retirado 2026-10-14). Un test lo fija: `PantallaMiDia.test.tsx`, bloque «caida».
  const detalle = conCliente;
  const accion = presentacion?.accion ?? null;
  const rutaAccion = accion != null ? rutaDeDestino(accion.destino) : null;
  // `presupuesto` no abre una pantalla: la píldora lleva el aviso al chat (a.1). El verbo de la acción es lo
  // que el emprendedor tocó, así que es el que se siembra («Acción: …»). Sin puente (manual, sin handler)
  // la píldora queda como rótulo, igual que cualquier destino sin a dónde ir.
  const accionAlChat = accion != null && llevaAlChat(accion.destino);
  const avisoDeAccion =
    accionAlChat && onAviso != null ? avisoAlChat({ ...tarjeta, verbo: accion.texto }) : null;
  // El verbo se vuelve botón SÓLO cuando hay a dónde llevarlo: la `accion` de `presentacion` manda (ya
  // tiene su destino); sin ella, el verbo lleva el aviso al chat. La tarjeta manual no tiene puente.
  const aviso = accion == null && onAviso != null ? avisoAlChat(tarjeta) : null;
  const chip = presentacion?.chip ?? null;
  // `tono` reusa la escala de `criticidad`. Uno desconocido NO tiene color propio: se pinta neutro.
  const colorChip =
    chip?.tono === 'critico' ? tema.color.peligro : chip?.tono === 'pronto' ? tema.color.acentoTinta : tema.color.textoTenue;

  // `opacity: progress` — Reanimated acepta un `SharedValue` directo en el style de `Animated.View`
  // (no hace falta `useAnimatedStyle` para un caso de un solo campo). Mismo patrón que la referencia
  // de la skill `swmansion-rn-gestures` (`swipeable-and-drawer.md`).
  const acciones = (progress: SharedValue<number>) => (
    <Animated.View style={[styles.accionesSwipe, { opacity: progress }]}>
      {gestion?.etiquetaAvanzar != null && (
        <Pressable
          testID={`midia-tarjeta-${tarjeta.id}-avanzar`}
          accessibilityRole="button"
          accessibilityLabel={gestion.etiquetaAvanzar}
          onPress={() => {
            swipeableRef.current?.close();
            gestion.onAvanzar();
          }}
          style={pressableStyle([styles.botonSwipe, { backgroundColor: tema.color.acentoSuperficie }])}
        >
          <Text style={{ color: tema.color.fondo, fontFamily: tema.fuente.uiSemibold, fontSize: tema.tipo.chico }}>
            {gestion.etiquetaAvanzar}
          </Text>
        </Pressable>
      )}
      <Pressable
        testID={`midia-tarjeta-${tarjeta.id}-borrar`}
        accessibilityRole="button"
        accessibilityLabel="Borrar"
        onPress={() => {
          swipeableRef.current?.close();
          gestion?.onBorrar();
        }}
        style={pressableStyle([styles.botonSwipe, { backgroundColor: tema.color.peligro }])}
      >
        <Text style={{ color: tema.color.fondo, fontFamily: tema.fuente.uiSemibold, fontSize: tema.tipo.chico }}>
          Borrar
        </Text>
      </Pressable>
    </Animated.View>
  );

  const fila = (
      <Row
        onPress={onPress}
        testID={`midia-tarjeta-${tarjeta.id}`}
        accessibilityLabel={expandida ? `${tarjeta.texto}, contraer` : `${tarjeta.texto}, expandir`}
      >
        {/* El tile de la categoría (`TileCategoria`): sin categoría decidida por el backend, no hay tile. */}
        <View style={styles.cabTarjeta}>
          <TileCategoria categoria={tarjeta.categoria} testID={`midia-tarjeta-${tarjeta.id}-tile`} />
          <View style={styles.tarjeta}>
            <Text
              numberOfLines={expandida ? undefined : 2}
              style={{ color: tema.color.texto, fontFamily: tema.fuente.uiMedium, fontSize: tema.tipo.base }}
            >
              {tarjeta.texto}
            </Text>
            {expandida && prosa != null && (
              <Text
                testID={`midia-tarjeta-${tarjeta.id}-prosa`}
                style={{ color: tema.color.textoTenue, fontFamily: tema.fuente.ui, fontSize: tema.tipo.chico }}
              >
                {prosa}
              </Text>
            )}
            {expandida && chip != null && (
              <View
                testID={`midia-tarjeta-${tarjeta.id}-chip`}
                style={[styles.chipPresentacion, { borderColor: colorChip, borderRadius: tema.radio.completo }]}
              >
                <Text style={{ color: colorChip, fontFamily: tema.fuente.uiSemibold, fontSize: tema.tipo.chico }}>{chip.texto}</Text>
              </View>
            )}
            {expandida && accion != null && (
              <Pressable
                testID={`midia-tarjeta-${tarjeta.id}-accion`}
                accessibilityRole="button"
                accessibilityLabel={accion.texto}
                // Un destino que la app no sabe rutear (o sin handler) deja la píldora como rótulo: un botón
                // que no hace nada es peor que un rótulo (DEVICE15 H5).
                disabled={accionAlChat ? avisoDeAccion == null : rutaAccion == null || onAccion == null}
                onPress={() => {
                  if (accionAlChat) {
                    if (avisoDeAccion != null) onAviso?.(avisoDeAccion);
                    return;
                  }
                  if (rutaAccion != null) onAccion?.(rutaAccion);
                }}
                hitSlop={10}
                style={pressableStyle([styles.accionFila, { borderColor: tema.color.texto, borderRadius: tema.radio.completo }])}
              >
                <Text style={{ color: tema.color.texto, fontFamily: tema.fuente.uiSemibold, fontSize: tema.tipo.chico }}>
                  {accion.texto}
                </Text>
              </Pressable>
            )}
            {expandida && accion == null && tarjeta.verbo != null && aviso != null && (
              <Pressable
                testID={`midia-tarjeta-${tarjeta.id}-verbo`}
                accessibilityRole="button"
                accessibilityLabel={tarjeta.verbo}
                onPress={() => onAviso?.(aviso)}
                hitSlop={10}
                style={pressableStyle([styles.accionFila, { borderColor: tema.color.texto, borderRadius: tema.radio.completo }])}
              >
                <Text style={{ color: tema.color.texto, fontFamily: tema.fuente.uiSemibold, fontSize: tema.tipo.chico }}>
                  {tarjeta.verbo}
                </Text>
              </Pressable>
            )}
            {expandida && accion == null && tarjeta.verbo != null && aviso == null && tarjeta.regla == null && onBorrar != null && (
              <Pressable
                testID={`midia-tarjeta-${tarjeta.id}-verbo`}
                accessibilityRole="button"
                accessibilityLabel={tarjeta.verbo}
                onPress={onBorrar}
                hitSlop={10}
                style={pressableStyle([styles.accionFila, { borderColor: tema.color.texto, borderRadius: tema.radio.completo }])}
              >
                <Text style={{ color: tema.color.texto, fontFamily: tema.fuente.uiSemibold, fontSize: tema.tipo.chico }}>
                  {tarjeta.verbo}
                </Text>
              </Pressable>
            )}
            {expandida && accion == null && tarjeta.verbo != null && aviso == null && (tarjeta.regla != null || onBorrar == null) && (
              <Text
                testID={`midia-tarjeta-${tarjeta.id}-verbo`}
                style={{ color: tema.color.texto, fontFamily: tema.fuente.uiSemibold, fontSize: tema.tipo.chico }}
              >
                {tarjeta.verbo}
              </Text>
            )}
            {expandida && detalle.length > 0 && (
              <View testID={`midia-tarjeta-${tarjeta.id}-detalle`} style={styles.detalleKv}>
                {detalle.map((f) => (
                  <View key={f.clave} style={styles.filaKv}>
                    <Text style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico }}>{f.clave}</Text>
                    <Text style={{ color: tema.color.texto, fontFamily: tema.fuente.uiSemibold, fontSize: tema.tipo.chico, flexShrink: 1, textAlign: 'right' }}>
                      {f.valor}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>
      </Row>
  );

  if (gestion == null) return fila;

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
      {fila}
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  cabTarjeta: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  tarjeta: { flex: 1, gap: 4 },
  detalleKv: { gap: 4, paddingTop: 4 },
  chipPresentacion: { alignSelf: 'flex-start', borderWidth: 1, paddingHorizontal: 8, paddingVertical: 2 },
  accionFila: { alignSelf: 'flex-start', borderWidth: 1, paddingHorizontal: 12, paddingVertical: 6 },
  filaKv: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
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

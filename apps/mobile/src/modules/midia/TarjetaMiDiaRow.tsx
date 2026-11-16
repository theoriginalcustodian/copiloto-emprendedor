import { useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import type { SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, { type SharedValue } from 'react-native-reanimated';

import { avisoAlChat, type AvisoAlChat, type TarjetaMiDia } from '@copiloto/core';

import { llevaAlChat, rutaDeDestino, type RutaDestino } from './destinoTarjeta';
import { TileCategoria } from './TileCategoria';
import { Glifo } from '../../theme/glass/Glifo';
import { Row } from '../../theme/glass/Row';
import { conAlfa } from '../../theme/glass/conAlfa';
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

/** Las dos acciones de una tarjeta manual que el servidor ya permite. «Editar» todavía no tiene con qué guardar. */
export interface AccionesManual {
  /** Ausente en «Hechas»: ahí ya está realizada y sólo queda editar o borrar. */
  onRealizado?: () => void;
  onBorrar: () => void;
}

/**
 * ⚠️ El editor de una tarjeta manual: texto, y fecha y hora. **Se ve pero no guarda**: el servidor todavía no
 * permite cambiar el texto de una tarjeta ni tiene dónde guardar su fecha (pedido a David, 15/11). Está para
 * decidir el diseño; «Guardar» queda apagado y lo dice. Cuando exista el endpoint, se cablea acá.
 */
function EdicionManual({ tarjeta, onCancelar }: { tarjeta: TarjetaMiDia; onCancelar: () => void }) {
  const tema = useTema();
  const [texto, setTexto] = useState(tarjeta.texto);
  const [cuando, setCuando] = useState('');
  const linea = conAlfa(tema.color.texto, 0.12);
  const campo = [styles.campoManual, { borderColor: linea, color: tema.color.texto, fontSize: tema.tipo.base, fontFamily: tema.fuente.ui }];
  const rotulo = { color: tema.color.textoTenue, fontSize: tema.tipo.chico };
  return (
    <View testID={`midia-tarjeta-${tarjeta.id}-edicion`} style={styles.edicionManual}>
      <View style={styles.grupoCampo}>
        <Text style={rotulo}>Qué hay que hacer</Text>
        <TextInput
          testID={`midia-tarjeta-${tarjeta.id}-edicion-texto`}
          value={texto}
          onChangeText={setTexto}
          multiline
          style={campo}
          placeholderTextColor={tema.color.textoTenue}
        />
      </View>
      <View style={styles.grupoCampo}>
        <Text style={rotulo}>Fecha y hora</Text>
        <TextInput
          testID={`midia-tarjeta-${tarjeta.id}-edicion-cuando`}
          value={cuando}
          onChangeText={setCuando}
          placeholder="Mañana a las 9"
          style={campo}
          placeholderTextColor={tema.color.textoTenue}
        />
      </View>
      <Text testID={`midia-tarjeta-${tarjeta.id}-edicion-aviso`} style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico, lineHeight: 18 }}>
        Editar todavía no guarda: falta habilitarlo del lado del servidor.
      </Text>
      <View style={styles.accionesManual}>
        <View
          testID={`midia-tarjeta-${tarjeta.id}-edicion-guardar`}
          accessibilityRole="button"
          accessibilityLabel="Guardar"
          accessibilityState={{ disabled: true }}
          style={[
            styles.accionFila,
            styles.accionManual,
            styles.apagado,
            { backgroundColor: tema.color.acentoSuperficie, borderColor: tema.color.acentoSuperficie, borderRadius: tema.radio.completo },
          ]}
        >
          <Text style={{ color: tema.color.acentoTexto, fontFamily: tema.fuente.uiSemibold, fontSize: tema.tipo.chico }}>Guardar</Text>
        </View>
        <Pressable
          testID={`midia-tarjeta-${tarjeta.id}-edicion-cancelar`}
          accessibilityRole="button"
          accessibilityLabel="Cancelar"
          onPress={onCancelar}
          hitSlop={12}
          style={pressableStyle(styles.accionTexto)}
        >
          <Text style={{ color: tema.color.texto, fontFamily: tema.fuente.uiSemibold, fontSize: tema.tipo.chico }}>Cancelar</Text>
        </Pressable>
      </View>
    </View>
  );
}

export function TarjetaMiDiaRow({
  tarjeta,
  expandida,
  onPress,
  gestion,
  onBorrar,
  onAccion,
  onAviso,
  plana = false,
  enGrupo = false,
  manual,
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
  /** Tarjeta blanca (la de Tu día rediseñada) en lugar de la fila de vidrio. */
  plana?: boolean;
  /** Fila de una tarjeta que agrupa varias (Mi día): sin superficie propia; el divisor lo pone quien agrupa. */
  enGrupo?: boolean;
  /**
   * Lo que se puede hacer con una tarjeta que anotó el emprendedor (Martin 15/11): al desplegarla ofrece
   * «Realizado», «Editar» y «Borrar». Sólo aplica a tarjetas sin `regla`; las del detector se cierran solas.
   */
  manual?: AccionesManual;
}) {
  const tema = useTema();
  const [editando, setEditando] = useState(false);
  const esManual = manual != null && tarjeta.regla == null;
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
  // La píldora es un botón sólo si tiene a dónde llevar; si no, queda como rótulo (DEVICE15 H5).
  const accionViva = accionAlChat ? avisoDeAccion != null : rutaAccion != null && onAccion != null;
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
        gestual
        plana={plana}
        desnuda={enGrupo}
        // Con el editor abierto la fila no se cierra al tocarla: el toque es del campo.
        onPress={editando ? undefined : onPress}
        testID={`midia-tarjeta-${tarjeta.id}`}
        accessibilityLabel={expandida ? `${tarjeta.texto}, contraer` : `${tarjeta.texto}, expandir`}
      >
        {/* El tile de la categoría (`TileCategoria`): sin categoría decidida por el backend, no hay tile. */}
        <View style={styles.cabTarjeta}>
          <TileCategoria categoria={tarjeta.categoria} testID={`midia-tarjeta-${tarjeta.id}-tile`} />
          <View style={styles.tarjeta}>
            <Text
              numberOfLines={expandida ? undefined : 2}
              style={{ color: tema.color.texto, fontFamily: tema.fuente.uiSemibold, fontSize: tema.tipo.base, lineHeight: 21 }}
            >
              {tarjeta.texto}
            </Text>
            {/* Prototipo (`prototipo/index.html`, «Para hoy»): cerrada, la tarjeta es título + línea breve
                («Vence en 12 días», «31 días sin respuesta») en el color de su tono; el detalle va debajo de la flecha. */}
            {!expandida && chip != null && (
              <Text
                testID={`midia-tarjeta-${tarjeta.id}-resumen`}
                numberOfLines={1}
                style={{ color: colorChip, fontFamily: tema.fuente.uiSemibold, fontSize: tema.tipo.chico }}
              >
                {chip.texto}
              </Text>
            )}
            {/* En una tarjeta manual el dato («Anotado · Hoy, 08:10») va como segunda línea, bajo el título y
                alineado con los botones (Martin 15/11). Como tabla clave/valor quedaba con el valor contra el
                borde derecho, sin relación con nada de la fila. */}
            {esManual && chip == null && detalle.length > 0 && (
              <Text
                testID={`midia-tarjeta-${tarjeta.id}-dato`}
                numberOfLines={1}
                style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico, lineHeight: 18 }}
              >
                {detalle.map((f) => `${f.clave} ${f.valor.charAt(0).toLowerCase()}${f.valor.slice(1)}`).join(' · ')}
              </Text>
            )}
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
                disabled={!accionViva}
                onPress={() => {
                  if (accionAlChat) {
                    if (avisoDeAccion != null) onAviso?.(avisoDeAccion);
                    return;
                  }
                  if (rutaAccion != null) onAccion?.(rutaAccion);
                }}
                hitSlop={10}
                style={pressableStyle([
                  styles.accionFila,
                  accionViva
                    ? { backgroundColor: tema.color.acentoSuperficie, borderColor: tema.color.acentoSuperficie, borderRadius: tema.radio.completo }
                    : { borderColor: tema.color.textoTenue, borderRadius: tema.radio.completo },
                ])}
              >
                <Text style={{ color: accionViva ? tema.color.acentoTexto : tema.color.textoTenue, fontFamily: tema.fuente.uiSemibold, fontSize: tema.tipo.chico }}>
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
                style={pressableStyle([
                  styles.accionFila,
                  { backgroundColor: tema.color.acentoSuperficie, borderColor: tema.color.acentoSuperficie, borderRadius: tema.radio.completo },
                ])}
              >
                <Text style={{ color: tema.color.acentoTexto, fontFamily: tema.fuente.uiSemibold, fontSize: tema.tipo.chico }}>
                  {tarjeta.verbo}
                </Text>
              </Pressable>
            )}
            {expandida && esManual && !editando && (
              <View testID={`midia-tarjeta-${tarjeta.id}-manual`} style={styles.accionesManual}>
                {manual.onRealizado != null && (
                <Pressable
                  testID={`midia-tarjeta-${tarjeta.id}-realizado`}
                  accessibilityRole="button"
                  accessibilityLabel="Realizado"
                  onPress={manual.onRealizado}
                  hitSlop={8}
                  style={pressableStyle([
                    styles.accionFila,
                    styles.accionManual,
                    { backgroundColor: tema.color.acentoSuperficie, borderColor: tema.color.acentoSuperficie, borderRadius: tema.radio.completo },
                  ])}
                >
                  <Text style={{ color: tema.color.acentoTexto, fontFamily: tema.fuente.uiSemibold, fontSize: tema.tipo.chico }}>Realizado</Text>
                </Pressable>
                )}
                <Pressable
                  testID={`midia-tarjeta-${tarjeta.id}-editar`}
                  accessibilityRole="button"
                  accessibilityLabel="Editar"
                  onPress={() => setEditando(true)}
                  hitSlop={12}
                  style={pressableStyle(styles.accionTexto)}
                >
                  <Text style={{ color: tema.color.acentoTinta, fontFamily: tema.fuente.uiSemibold, fontSize: tema.tipo.chico }}>Editar</Text>
                </Pressable>
                <Pressable
                  testID={`midia-tarjeta-${tarjeta.id}-borrar-manual`}
                  accessibilityRole="button"
                  accessibilityLabel="Borrar"
                  onPress={manual.onBorrar}
                  hitSlop={12}
                  style={pressableStyle(styles.accionTexto)}
                >
                  <Text style={{ color: tema.color.peligro, fontFamily: tema.fuente.uiSemibold, fontSize: tema.tipo.chico }}>Borrar</Text>
                </Pressable>
              </View>
            )}
            {expandida && esManual && editando && (
              <EdicionManual tarjeta={tarjeta} onCancelar={() => setEditando(false)} />
            )}
            {expandida && !esManual && accion == null && tarjeta.verbo != null && aviso == null && tarjeta.regla == null && onBorrar != null && (
              <Pressable
                testID={`midia-tarjeta-${tarjeta.id}-verbo`}
                accessibilityRole="button"
                accessibilityLabel={tarjeta.verbo}
                onPress={onBorrar}
                hitSlop={10}
                style={pressableStyle([
                  styles.accionFila,
                  { backgroundColor: tema.color.acentoSuperficie, borderColor: tema.color.acentoSuperficie, borderRadius: tema.radio.completo },
                ])}
              >
                <Text style={{ color: tema.color.acentoTexto, fontFamily: tema.fuente.uiSemibold, fontSize: tema.tipo.chico }}>
                  {tarjeta.verbo}
                </Text>
              </Pressable>
            )}
            {expandida && accion == null && tarjeta.verbo != null && aviso == null && tarjeta.regla != null && (
              <Text
                testID={`midia-tarjeta-${tarjeta.id}-verbo`}
                style={{ color: tema.color.texto, fontFamily: tema.fuente.uiSemibold, fontSize: tema.tipo.chico }}
              >
                {tarjeta.verbo}
              </Text>
            )}
            {expandida && detalle.length > 0 && !(esManual && chip == null) && (
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
          {/* La flecha es la afordancia de «se abre para ver el detalle»: baja cerrada, sube abierta. */}
          <View
            testID={`midia-tarjeta-${tarjeta.id}-flecha`}
            accessible={false}
            importantForAccessibility="no"
            style={[styles.flecha, { transform: [{ rotate: expandida ? '-90deg' : '90deg' }] }]}
          >
            <Glifo nombre="caret-right" size={14} color={tema.color.textoTenue} />
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
      // Composición de gestos (SM-P16): esta tarjeta vive en Mi día, que es el FONDO del panel; el arrastre
      // del panel desde el cuerpo (`gestoCuerpo` de `PanelDeslizable`) envuelve sólo la conversación, así que
      // el Pan del cuerpo y este swipe NO comparten árbol de gestos y no hay nada que cablear entre ellos.
      // Con el panel ABAJO (Mi día visible) el swipe horizontal de acá y el scroll vertical de la lista se
      // resuelven por dirección con la arena por defecto de RNGH, igual que antes. Evidencia de device en el
      // `cierre_` de SM-P16; lo que quede sin medir está nombrado en su `Falta:`.
    >
      {fila}
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  cabTarjeta: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  tarjeta: { flex: 1, gap: 4 },
  detalleKv: { gap: 4, paddingTop: 4 },
  chipPresentacion: { alignSelf: 'flex-start', borderWidth: 1, paddingHorizontal: 8, paddingVertical: 2 },
  accionFila: { alignSelf: 'flex-start', borderWidth: 1, paddingHorizontal: 14, paddingVertical: 7, marginTop: 6 },
  flecha: { height: 21, justifyContent: 'center' },
  // Las acciones de una tarjeta manual: la principal llena a la izquierda y las otras dos como texto, al lado.
  accionesManual: { flexDirection: 'row', alignItems: 'center', gap: 20, paddingTop: 8 },
  // `accionFila` se ancla arriba (`alignSelf: flex-start`): acá va centrada con los textos de al lado.
  accionManual: { marginTop: 0, alignSelf: 'center' },
  // Mismo alto que la pastilla (7 + borde de 1), para que los tres compartan la línea de base.
  accionTexto: { paddingVertical: 8 },
  edicionManual: { gap: 12, paddingTop: 8 },
  grupoCampo: { gap: 4 },
  campoManual: { borderBottomWidth: 1, paddingVertical: 6, paddingHorizontal: 0 },
  apagado: { opacity: 0.4 },
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

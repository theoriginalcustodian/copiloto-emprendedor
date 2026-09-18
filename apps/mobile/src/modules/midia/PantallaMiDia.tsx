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
  horaDeEvento,
  leerCalendario,
  leerPortada,
  leerTablero,
  type CalendarioMiDia,
  type EventoCalendario,
  type IdSolapa,
  type Portada,
  type TarjetaMiDia,
  type TableroMiDia,
} from '@copiloto/core';

import { AvatarCuenta } from './AvatarCuenta';
import {
  CATEGORIAS,
  ETIQUETA_CATEGORIA,
  filtrarPorCategoria,
  type CategoriaTarjeta,
} from './categoriaTarjeta';
import { PortadaNegocio } from './PortadaNegocio';
import { EstadoVacio } from '../../theme/EstadoVacio';
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

/**
 * Los chips de categoría del prototipo. Filtran la solapa activa; **«Todo» es el default y no
 * filtra**.
 *
 * ⚠️ De qué categoría es cada tarjeta lo deriva el frontend hoy — ver `categoriaTarjeta.ts` y el
 * punto B-3 del pedido a backend. Los chips en sí no dependen de eso: el día que la categoría viaje
 * en la tarjeta, esto no cambia.
 */
function ChipsCategoria({
  activa,
  onCambiar,
}: {
  activa: CategoriaTarjeta;
  onCambiar: (c: CategoriaTarjeta) => void;
}) {
  const tema = useTema();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.chips}
      testID="midia-chips"
    >
      {CATEGORIAS.map((c) => {
        const seleccionada = c === activa;
        return (
          <Pressable
            key={c}
            testID={`midia-chip-${c}`}
            accessibilityRole="button"
            accessibilityState={{ selected: seleccionada }}
            onPress={() => onCambiar(c)}
            style={pressableStyle(undefined)}
          >
            {/* Borde y texto, SIN relleno: son atajos para mirar, no decisiones. Con fill competirían
                con los botones de acción de las tarjetas, que sí ejecutan algo (Decisión B: la
                terracota marca lo que hace algo al tocarlo). */}
            <View
              style={[
                styles.chip,
                { borderColor: seleccionada ? tema.color.acento : tema.color.borde },
              ]}
            >
              <Text
                style={{
                  color: seleccionada ? tema.color.acento : tema.color.textoTenue,
                  fontFamily: tema.fuente.uiMedium,
                  fontSize: tema.tipo.chico,
                }}
              >
                {ETIQUETA_CATEGORIA[c]}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/**
 * El contador del prototipo: «3 para hoy · 1 en curso».
 *
 * ⚠️ **Falta «· 1 crítico», y no se inventa.** La criticidad es una propiedad de la regla que hoy no
 * viaja en la tarjeta (B-3). Deducirla del nombre de la regla sería decidir, desde la vista, que un
 * CAE por vencer urge más que un margen negativo — una jerarquía sobre el negocio de otro. Por el
 * mismo motivo no está el **banner de alerta crítica** separado que el prototipo pone arriba.
 */
function ContadorTablero({ tablero }: { tablero: TableroMiDia | null }) {
  const tema = useTema();
  if (tablero == null) return null;
  const cuenta = (id: IdSolapa) => tablero.solapas.find((s) => s.id === id)?.tarjetas.length ?? 0;
  const paraHoy = cuenta('para_hoy');
  const enCurso = cuenta('haciendo');
  if (paraHoy === 0 && enCurso === 0) return null;

  return (
    <Text
      testID="midia-contador"
      style={{
        color: tema.color.textoTenue,
        fontSize: tema.tipo.chico,
        paddingHorizontal: 16,
        paddingTop: 8,
      }}
    >
      {paraHoy} para hoy · {enCurso} en curso
    </Text>
  );
}

/** A qué solapa avanza cada una, y cómo se llama la acción. `hecha` no tiene entrada: es terminal, no
 *  hay "siguiente" — sólo queda la acción de borrar. */
const SIGUIENTE: Partial<Record<IdSolapa, { estado: IdSolapa; etiqueta: string }>> = {
  para_hoy: { estado: 'haciendo', etiqueta: 'Empezar' },
  haciendo: { estado: 'hecha', etiqueta: 'Terminé' },
};

export interface PantallaMiDiaProps {
  /**
   * `true` cuando Mi día se monta como **la base de la app** y no como un glass encima del
   * escritorio (Ola 4). Cambia una sola cosa: el chrome. Como base no lleva `MarcoGlass` —no hay
   * "Volver" desde la pantalla a la que se vuelve— y en su lugar va el encabezado propio, con el
   * wordmark y el avatar, que es la única puerta a Ajustes.
   *
   * 🔴 **El cuerpo es EL MISMO en los dos casos, a propósito.** La ruta `/midia` sigue viva porque
   * las tarjetas de actividad y los enlaces internos la usan; si la base y la ruta tuvieran cuerpos
   * distintos, cada arreglo habría que hacerlo dos veces y la segunda copia se olvidaría.
   */
  comoPortada?: boolean;
  /** Tocar el avatar. Sólo se usa con `comoPortada`; la navegación la cablea el shell. */
  onAjustes?: () => void;
}

export function PantallaMiDia({ comoPortada = false, onAjustes }: PantallaMiDiaProps = {}) {
  const tema = useTema();
  const [estado, setEstado] = useState<EstadoLista>('cargando');
  const [tablero, setTablero] = useState<TableroMiDia | null>(null);
  const [solapaActiva, setSolapaActiva] = useState<IdSolapa>('para_hoy');
  const [categoria, setCategoria] = useState<CategoriaTarjeta>('todo');
  const [expandida, setExpandida] = useState<string | null>(null);
  const [estadoCalendario, setEstadoCalendario] = useState<EstadoLista>('cargando');
  const [calendario, setCalendario] = useState<CalendarioMiDia | null>(null);
  const [portada, setPortada] = useState<Portada | null>(null);
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

  // Panel aparte, independiente del Kanban (contrato CAL1 §3): un calendario caído no puede tapar
  // ni bloquear el tablero, así que carga y degrada en su propio estado, nunca comparte `estado`.
  const cargarCalendario = useCallback(async () => {
    try {
      const res = await leerCalendario();
      if (!vivo.current) return;
      if (res.status === 'ok') {
        setCalendario(res.calendario);
        setEstadoCalendario('ok');
        return;
      }
      setEstadoCalendario('no_disponible');
    } catch {
      if (vivo.current) setEstadoCalendario('no_disponible');
    }
  }, []);

  // Mismo criterio que el calendario (contrato CAL1 §3): la portada carga y degrada por su cuenta,
  // SIN compartir `estado` con el tablero. Si `/inteligencia` está caído, Mi día tiene que seguir
  // mostrando los avisos del detector — que es lo accionable. Y al revés: un tablero vacío no puede
  // esconder cómo viene la caja.
  const cargarPortada = useCallback(async () => {
    try {
      const res = await leerPortada();
      if (!vivo.current) return;
      if (res.status === 'ok') setPortada(res.portada);
    } catch {
      /* silencio deliberado: sin portada la pantalla no se rompe, sólo muestra menos. */
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      vivo.current = true;
      void cargar();
      void cargarCalendario();
      void cargarPortada();
      return () => {
        vivo.current = false;
      };
    }, [cargar, cargarCalendario, cargarPortada]),
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
  const tarjetas = solapa != null ? filtrarPorCategoria(solapa.tarjetas, categoria) : [];

  const cuerpo = (
      <View style={styles.raiz}>
        {/* La portada va PRIMERO: es lo que se mira de reojo antes que nada. Si no cargó, no se
            dibuja nada en su lugar — Mi día sigue sirviendo sin ella, y un esqueleto permanente
            sería peor que la ausencia. */}
        {portada != null && <PortadaNegocio portada={portada} />}

        <PanelCalendario estado={estadoCalendario} calendario={calendario} />

        <ContadorTablero tablero={tablero} />

        <Solapas activa={solapaActiva} onCambiar={setSolapaActiva} />

        <ChipsCategoria activa={categoria} onCambiar={setCategoria} />

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
            {tarjetas.length === 0 && categoria !== 'todo' && (
              <View style={styles.centro}>
                {/* Vacío POR EL FILTRO, no por el día: decirlo evita que un chip mal elegido se lea
                    como «no tengo nada pendiente». Sin ilustración — este vacío no se celebra. */}
                <EstadoVacio
                  testID="midia-vacio-filtro"
                  titulo={`Nada en ${ETIQUETA_CATEGORIA[categoria]} por acá.`}
                  cuerpo="Tocá «Todo» para ver el resto."
                />
              </View>
            )}

            {tarjetas.length === 0 && categoria === 'todo' && (
              <View style={styles.centro}>
                {/* La taza va SÓLO en «Para hoy» sin pendientes: ahí el vacío es una buena
                    noticia y la ilustración la celebra. En las otras solapas el vacío es
                    «todavía no hay nada acá», que no se celebra. */}
                {solapaActiva === 'para_hoy' ? (
                  <EstadoVacio
                    testID="midia-vacio"
                    ilustracion
                    titulo="Nada urgente por hoy"
                    cuerpo="Cuando el copiloto detecte algo, aparece acá."
                  />
                ) : (
                  <EstadoVacio testID="midia-vacio" titulo="No hay tarjetas acá todavía." />
                )}
              </View>
            )}

            {tarjetas.length > 0 && (
              <ScrollView contentContainerStyle={styles.lista} testID="midia-lista">
                {tarjetas.map((t) => (
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
  );

  if (!comoPortada) {
    return (
      <MarcoGlass titulo="Mi día" icono="miDia" testID="pantalla-midia">
        {cuerpo}
      </MarcoGlass>
    );
  }

  return (
    <View style={styles.portadaRaiz} testID="pantalla-midia">
      {/* El encabezado de la BASE: el wordmark a la izquierda, el avatar a la derecha. No lleva
          ícono de función ni "Volver" — no se entró a ningún lado, se está en el lugar. */}
      <View style={styles.encabezadoPortada}>
        <Text
          testID="midia-wordmark"
          style={{ color: tema.color.acentoTinta, fontFamily: tema.fuente.display, fontSize: tema.tipo.titulo }}
        >
          Odobi
        </Text>
        <AvatarCuenta onPress={onAjustes} />
      </View>
      {cuerpo}
    </View>
  );
}

/**
 * Panel de sólo lectura de eventos de hoy (CAL1 §3) — FUERA del Kanban, sin swipe, sin acciones:
 * "información para mostrar", como fija el contrato (§0, decisión de arquitectura ya cerrada). Un
 * evento sin hora reconocible (`horaDeEvento` → `null`, ver `@copiloto/core`) igual se muestra, sólo
 * con el título — no se descarta ni se inventa una hora.
 */
function PanelCalendario({ estado, calendario }: { estado: EstadoLista; calendario: CalendarioMiDia | null }) {
  const tema = useTema();

  // `cargando`/`no_disponible` no tienen su propio texto: un calendario que no está listo (o que
  // falló) no puede competir por atención con el Kanban, que sí tiene evidencia real detrás — se
  // omite en silencio, mismo criterio que el resto de los paneles "no disponible" del escritorio.
  if (estado !== 'ok' || calendario == null) return null;

  if (!calendario.conectado) {
    return (
      <View style={styles.calendario} testID="midia-calendario-no-conectado">
        <Text style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico }}>
          Conectá Google Calendar en Ajustes → Apps para ver acá tus eventos de hoy.
        </Text>
      </View>
    );
  }

  if (calendario.eventos.length === 0) {
    return (
      <View style={styles.calendario} testID="midia-calendario-vacio">
        <Text style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico }}>Sin eventos en tu calendario hoy.</Text>
      </View>
    );
  }

  return (
    <View style={styles.calendario} testID="midia-calendario">
      {calendario.eventos.map((ev: EventoCalendario) => {
        const hora = horaDeEvento(ev.inicioCrudo);
        return (
          <View key={ev.id} style={styles.calendarioEvento} testID={`midia-calendario-evento-${ev.id}`}>
            {hora != null && (
              <Text style={{ color: tema.color.acentoTinta, fontFamily: tema.fuente.uiSemibold, fontSize: tema.tipo.chico }}>
                {hora}
              </Text>
            )}
            <Text style={{ color: tema.color.texto, fontSize: tema.tipo.chico, flexShrink: 1 }} numberOfLines={1}>
              {ev.titulo}
            </Text>
          </View>
        );
      })}
    </View>
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
          style={[styles.botonSwipe, { backgroundColor: tema.color.acentoSuperficie }]}
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
  // Como base, la pantalla se pega al borde superior real: el `paddingTop` es el del prototipo para
  // que el wordmark quede debajo del reloj sin pedirle safe-area a un componente que no la conoce.
  portadaRaiz: { flex: 1, paddingTop: 58 },
  encabezadoPortada: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  raiz: { flex: 1 },
  calendario: { gap: 6, paddingHorizontal: 16, paddingTop: 12 },
  calendarioEvento: { flexDirection: 'row', gap: 8, alignItems: 'baseline' },
  solapas: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  chips: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 4, paddingBottom: 8 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
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

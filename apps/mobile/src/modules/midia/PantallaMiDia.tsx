import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import { Pressable, ScrollView } from 'react-native-gesture-handler';
import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import type { SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, { type SharedValue } from 'react-native-reanimated';

import {
  avisoAlChat,
  formatearInstanteDeCaida,
  borrarTarjetaMiDia,
  cambiarEstadoTarjetaMiDia,
  estadoDeServicio,
  fechaDeHoyMidia,
  horaDeEvento,
  KEY_GOOGLE_CALENDAR,
  leerCalendario,
  hayConexionCaida,
  leerPortada,
  listarCatalogo,
  leerTablero,
  type AvisoAlChat,
  type CalendarioMiDia,
  CATEGORIAS,
  ETIQUETA_CATEGORIA_TARJETA,
  filtrarPorCategoria,
  hayCategorias,
  tarjetasCriticas,
  type CategoriaTarjeta,
  type EstadoConexion,
  type EventoCalendario,
  type IdSolapa,
  type Portada,
  type TarjetaMiDia,
  type TableroMiDia,
} from '@copiloto/core';

import { AvatarCuenta } from './AvatarCuenta';
import { llevaAlChat, rutaDeDestino, type RutaDestino } from './destinoTarjeta';
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

/**
 * Las solapas con su contador pegado al rótulo («Para hoy 3» · «Haciendo 1» · «Hechas»), como el
 * `.segb` del prototipo (`index.html:2490`). «Hechas» no lleva número —es historia, no pendiente— y un
 * contador en 0 no se dibuja: «Haciendo 0» no informa nada que el vacío de la solapa no diga.
 */
function Solapas({
  activa,
  onCambiar,
  conteos = {},
}: {
  activa: IdSolapa;
  onCambiar: (id: IdSolapa) => void;
  conteos?: Partial<Record<IdSolapa, number>>;
}) {
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
                {o.valor !== 'hecha' && (conteos[o.valor] ?? 0) > 0 ? `${o.etiqueta} ${conteos[o.valor]}` : o.etiqueta}
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
 * Filtran por `t.categoria`, que decide el detector del backend (BL-J5, K-06) — la vista no deduce
 * nada. Con un backend previo al campo (ninguna tarjeta trae categoría) no se dibujan: un chip que
 * filtra a vacío mentiría.
 */
function ChipsCategoria({
  activa,
  onCambiar,
  tablero,
}: {
  activa: CategoriaTarjeta;
  onCambiar: (c: CategoriaTarjeta) => void;
  tablero: TableroMiDia | null;
}) {
  const tema = useTema();
  if (!hayCategorias(tablero)) return null;
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
                {ETIQUETA_CATEGORIA_TARJETA[c]}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/** El contador del prototipo: «3 para hoy · 1 en curso · 1 crítico». */
function ContadorTablero({ tablero }: { tablero: TableroMiDia | null }) {
  const tema = useTema();
  if (tablero == null) return null;
  const cuenta = (id: IdSolapa) => tablero.solapas.find((s) => s.id === id)?.tarjetas.length ?? 0;
  const paraHoy = cuenta('para_hoy');
  const enCurso = cuenta('haciendo');
  const criticas = tarjetasCriticas(tablero).length;
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
      {paraHoy} para hoy · {enCurso} en curso{criticas > 0 ? ` · ${criticas} crítico${criticas === 1 ? '' : 's'}` : ''}
    </Text>
  );
}

/**
 * El banner de alerta crítica (`.alerta` del prototipo): arriba de las solapas porque es transversal a
 * los tres estados. Sólo para `criticidad: 'critico'` — lo que ROMPE el negocio; usa el bloque (que ya
 * significa peso) en vez de un color de alarma. Sin tarjeta crítica no existe.
 */
function BannerCritico({
  tablero,
  onAccion,
}: {
  tablero: TableroMiDia | null;
  /** Recibe la tarjeta: a dónde lleva lo decide su `destino` (H5b), no el banner. */
  onAccion?: (tarjeta: TarjetaMiDia) => void;
}) {
  const tema = useTema();
  const criticas = tarjetasCriticas(tablero);
  if (criticas.length === 0) return null;
  return (
    <View
      testID="midia-alerta"
      accessibilityRole="alert"
      style={[styles.alerta, { backgroundColor: tema.color.bloque, borderRadius: tema.radio.lg }]}
    >
      {criticas.map((t) => (
        <View key={t.id} testID={`midia-alerta-${t.id}`} style={styles.alertaItem}>
          <Text style={{ color: tema.color.bloqueTexto, fontFamily: tema.fuente.uiMedium, fontSize: tema.tipo.base }}>
            {t.texto}
          </Text>
          {t.verbo != null && (
            <Pressable
              testID={`midia-alerta-${t.id}-accion`}
              accessibilityRole="button"
              accessibilityLabel={t.verbo}
              // Sin `onAccion` (quien monta no sabe a dónde llevar) la píldora queda como rótulo: un botón
              // que no hace nada es peor que un rótulo — DEVICE15 H5 lo midió `clickable=false`.
              disabled={onAccion == null}
              onPress={() => onAccion?.(t)}
              hitSlop={10}
              style={[
                styles.alertaAccion,
                { borderColor: tema.color.bloqueApoyo, borderRadius: tema.radio.completo },
              ]}
            >
              <Text style={{ color: tema.color.bloqueApoyo, fontFamily: tema.fuente.uiSemibold, fontSize: tema.tipo.chico }}>
                {t.verbo}
              </Text>
            </Pressable>
          )}
        </View>
      ))}
    </View>
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
  /** BL-J13: abre la agenda de varios días. La cablea el shell (`empujarUnaVez`); sin él no hay entrada. */
  onAgenda?: () => void;
  /**
   * H5b — abre la pantalla a la que apunta `destino` (la conexión, el comprobante, AFIP: ver
   * `rutaDeDestino`). Recibe la ruta YA resuelta; a qué pantalla de la app corresponde lo decide el
   * shell (`hrefDeRuta` + `empujarUnaVez`). Sin él, o con un `destino` ausente/desconocido, la acción
   * crítica cae a `onAjustes` y la de `presentacion` queda como rótulo.
   */
  onDestino?: (ruta: RutaDestino) => void;
  /**
   * `hitl (a)` — el puente tarjeta → chat (C-D5 Opción A). Tocar el verbo de una tarjeta detectada lleva su
   * aviso al chat principal, **sembrado en el composer**. Lo cablea el shell, porque el chat vive en la
   * misma pantalla que la base. Sin él (la ruta `/midia` como glass: el chat queda detrás de otra capa) el
   * verbo sigue siendo el rótulo de siempre: un botón que no lleva a ningún lado es peor que un rótulo.
   */
  onAvisoAlChat?: (aviso: AvisoAlChat) => void;
  /**
   * `hitl (a.5)` — el ciclo cierra donde empezó (`index.html:2779-2781`): al volver del chat con
   * `resultado: 'hecha'`, la tarjeta de origen pasa a «Hechas» **en el servidor** (`cambiarEstadoTarjeta`)
   * y el tablero se recarga. La fuente de verdad es el servidor, no un flag local: la tarjeta no vuelve a
   * ofrecerse aunque la pantalla se remonte. `n` crece con cada cierre (el mismo aviso dos veces actúa dos
   * veces). Lo cablea el shell, dueño del chat.
   */
  cierreDeAviso?: { tarjetaId: string; n: number } | null;
}

export function PantallaMiDia({
  comoPortada = false,
  onAjustes,
  onAgenda,
  onDestino,
  onAvisoAlChat,
  cierreDeAviso = null,
}: PantallaMiDiaProps = {}) {
  const tema = useTema();
  const [estado, setEstado] = useState<EstadoLista>('cargando');
  const [tablero, setTablero] = useState<TableroMiDia | null>(null);
  const [solapaActiva, setSolapaActiva] = useState<IdSolapa>('para_hoy');
  const [categoria, setCategoria] = useState<CategoriaTarjeta>('todo');
  const [expandida, setExpandida] = useState<string | null>(null);
  const [estadoCalendario, setEstadoCalendario] = useState<EstadoLista>('cargando');
  const [calendario, setCalendario] = useState<CalendarioMiDia | null>(null);
  const [portada, setPortada] = useState<Portada | null>(null);
  // K-09: ≥ 1 servicio con la conexión caída → punto en el avatar. Apagado si el catálogo no responde.
  const [conexionCaida, setConexionCaida] = useState(false);
  // BL-W11: la salud DE Google Calendar puntual (distinta de `conexionCaida`, que es "hay ≥1 caída
  // en cualquier servicio") — desempata "nunca conectada" de "caída" en `PanelCalendario`, algo que
  // `/mi-dia/calendario` no trae (ver `CalendarioMiDia`). `null` si el catálogo no responde.
  const [estadoGoogleCalendar, setEstadoGoogleCalendar] = useState<EstadoConexion | null>(null);
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

  const cargarSaludConexiones = useCallback(async () => {
    try {
      const res = await listarCatalogo();
      if (!vivo.current) return;
      if (res.status === 'ok') {
        setConexionCaida(hayConexionCaida(res.servicios));
        setEstadoGoogleCalendar(estadoDeServicio(res.servicios, KEY_GOOGLE_CALENDAR));
      }
    } catch {
      /* fail-soft: sin catálogo el punto queda como estaba. */
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      vivo.current = true;
      void cargar();
      void cargarCalendario();
      void cargarPortada();
      void cargarSaludConexiones();
      return () => {
        vivo.current = false;
      };
    }, [cargar, cargarCalendario, cargarPortada, cargarSaludConexiones]),
  );

  // a.5: el cierre del ciclo. Un `n` ya atendido no se repite (un re-render con el mismo cierre no manda
  // otro PATCH).
  const cierreAtendido = useRef(0);
  useEffect(() => {
    if (cierreDeAviso == null || cierreDeAviso.n === cierreAtendido.current) return;
    cierreAtendido.current = cierreDeAviso.n;
    void (async () => {
      const res = await cambiarEstadoTarjetaMiDia(cierreDeAviso.tarjetaId, 'hecha');
      if (res.status === 'ok') {
        void cargar();
        return;
      }
      Alert.alert('No se pudo marcar la tarjeta como hecha', 'Probá de nuevo desde el tablero.');
    })();
  }, [cierreDeAviso, cargar]);

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
      // 🔴 UN solo scroll para TODA la pantalla (DEVICE15 `tablero`, «viewport útil ≈120 dp»): antes el
      // encabezado (portada + aviso + resumen + banner + solapas) era fijo y sólo la lista scrolleaba, y con un
      // aviso crítico quedaban ~1,5 tarjetas a la vista. Ahora el encabezado se va con el dedo.
      <ScrollView style={styles.raiz} contentContainerStyle={styles.raizContenido} testID="midia-scroll">
        {/* La portada va PRIMERO: es lo que se mira de reojo antes que nada. Si no cargó, no se
            dibuja nada en su lugar — Mi día sigue sirviendo sin ella, y un esqueleto permanente
            sería peor que la ausencia. */}
        {portada != null && <PortadaNegocio portada={portada} />}

        <PanelCalendario estado={estadoCalendario} calendario={calendario} estadoConexion={estadoGoogleCalendar} />

        {/* AGCAID: con la conexión CAÍDA no hay agenda que mostrar -- mismo criterio que la web
            (MidiaScreen.tsx). Con `nunca_conectado` sigue visible. */}
        {estadoCalendario === 'ok' && onAgenda != null && estadoGoogleCalendar !== 'caido' && (
          <Pressable
            testID="midia-ver-agenda"
            accessibilityRole="button"
            accessibilityLabel="Ver agenda"
            onPress={onAgenda}
            style={styles.verAgenda}
            hitSlop={8}
          >
            <Text style={{ color: tema.color.acentoTinta, fontFamily: tema.fuente.uiSemibold, fontSize: tema.tipo.chico }}>
              Ver agenda
            </Text>
          </Pressable>
        )}

        <ContadorTablero tablero={tablero} />

        {/* 🔴 La píldora del banner lleva a Ajustes: es donde se resuelven las dos reglas críticas
            («Reconectala en Ajustes → Apps» · «Renovarlo» en ARCA) y lo único que `PantallaMiDia` ya
            sabe abrir sin inventar una tabla regla→ruta que el contrato no define. Un destino más fino
            necesita que el backend mande `destino` en la tarjeta (ver el `pedido_` de DEVICE15 H5). */}
        <BannerCritico
          tablero={tablero}
          // H5b: lleva a donde dice `destino`; sin destino conocido, a Ajustes (lo de antes). Sin
          // ninguno de los dos callbacks la píldora queda como rótulo (ver `BannerCritico`).
          onAccion={
            onAjustes != null || onDestino != null
              ? (t) => {
                  const ruta = rutaDeDestino(t.destino);
                  if (ruta != null && onDestino != null) onDestino(ruta);
                  else onAjustes?.();
                }
              : undefined
          }
        />

        <Solapas
          activa={solapaActiva}
          onCambiar={setSolapaActiva}
          conteos={{
            para_hoy: tablero?.solapas.find((s) => s.id === 'para_hoy')?.tarjetas.length ?? 0,
            haciendo: tablero?.solapas.find((s) => s.id === 'haciendo')?.tarjetas.length ?? 0,
          }}
        />

        <ChipsCategoria activa={categoria} onCambiar={setCategoria} tablero={tablero} />

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
                  titulo={`Nada en ${ETIQUETA_CATEGORIA_TARJETA[categoria]} por acá.`}
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
                    titulo="Nada urgente por hoy."
                    cuerpo="Cuando haya algo que mirar, te lo dejo acá. Si querés saber algo, preguntame."
                  />
                ) : (
                  <EstadoVacio testID="midia-vacio" titulo="No hay tarjetas acá todavía." />
                )}
              </View>
            )}

            {tarjetas.length > 0 && (
              <View style={styles.lista} testID="midia-lista">
                {tarjetas.map((t) => (
                  <TarjetaMiDiaRow
                    key={t.id}
                    tarjeta={t}
                    expandida={expandida === t.id}
                    etiquetaAvanzar={SIGUIENTE[solapaActiva]?.etiqueta ?? null}
                    onPress={() => setExpandida((prev) => (prev === t.id ? null : t.id))}
                    onAvanzar={() => void avanzar(t)}
                    onBorrar={() => void borrar(t)}
                    // §C: la acción de `presentacion` rutea por `rutaDeDestino` TAL CUAL. Sin handler (o con
                    // un `tipo` que esta versión no conoce) queda como rótulo — nunca cae a Ajustes por su
                    // cuenta: acá no hay una pantalla «por defecto» que no sea adivinar.
                    onAccion={onDestino}
                    onAviso={onAvisoAlChat}
                  />
                ))}
                {/* `.nota-sub` del prototipo (`index.html:2497`): cierra la lista y dice qué se mueve solo. */}
                <Text testID="midia-nota" style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico, paddingTop: 4 }}>
                  Las que detecta Odobi se cierran solas cuando hacés la acción real. Las que anotaste vos las movés vos.
                </Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
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
        <View>
          <Text
            testID="midia-wordmark"
            style={{ color: tema.color.acentoTinta, fontFamily: tema.fuente.display, fontSize: tema.tipo.titulo }}
          >
            Odobi
          </Text>
          {/* BL-W11 fila 4a: fecha de hoy, sin hora — bajo el wordmark, no compite con él. */}
          <Text testID="midia-fecha" style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico }}>
            {fechaDeHoyMidia()}
          </Text>
        </View>
        <AvatarCuenta avisa={conexionCaida} onPress={onAjustes} />
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
 *
 * BL-W11 fila 4b: `!calendario.conectado` agrupa "nunca conectada" y "caída" —
 * `/mi-dia/calendario` no las distingue. `estadoConexion` (leído del catálogo, K-09) desempata; sin
 * esa señal se degrada al texto de "nunca conectada", el menos alarmante ante la duda.
 */
function PanelCalendario({
  estado,
  calendario,
  estadoConexion,
}: {
  estado: EstadoLista;
  calendario: CalendarioMiDia | null;
  estadoConexion: EstadoConexion | null;
}) {
  const tema = useTema();

  // `cargando`/`no_disponible` no tienen su propio texto: un calendario que no está listo (o que
  // falló) no puede competir por atención con el Kanban, que sí tiene evidencia real detrás — se
  // omite en silencio, mismo criterio que el resto de los paneles "no disponible" del escritorio.
  if (estado !== 'ok' || calendario == null) return null;

  if (!calendario.conectado) {
    if (estadoConexion === 'caido') {
      return (
        <View style={styles.calendario} testID="midia-calendario-caida">
          <Text style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico }}>
            Se cayó la conexión con Google Calendar. Reconectala en Ajustes → Apps para volver a ver
            tus eventos de hoy.
          </Text>
        </View>
      );
    }
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
  onAccion,
  onAviso,
}: {
  tarjeta: TarjetaMiDia;
  expandida: boolean;
  /** `null` en la solapa "hecha": no hay siguiente, sólo se puede borrar. */
  etiquetaAvanzar: string | null;
  onPress: () => void;
  onAvanzar: () => void;
  onBorrar: () => void;
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
  // `caida`: el kv «Se cayó · hora» del prototipo (`index.html:3658`) sale de `datos.desde`, que el backend
  // manda SÓLO con un instante real (Mercado Pago; Composio no lo guarda). Sin instante la fila NO existe:
  // jamás se rellena con `creada_en` (cuándo corrió el detector, no cuándo cayó). Si el backend algún día
  // la manda ya en `presentacion.kv`, no se duplica.
  const seCayo = tarjeta.regla === 'conexion_caida' ? formatearInstanteDeCaida(tarjeta.desde) : null;
  const hayCayoEnKv = conCliente.some((f) => f.clave.trim().toLowerCase() === 'se cayó');
  const detalle: { clave: string; valor: string }[] =
    seCayo != null && !hayCayoEnKv ? [...conCliente, { clave: 'Se cayó', valor: seCayo }] : conCliente;
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
              style={[styles.accionFila, { borderColor: tema.color.texto, borderRadius: tema.radio.completo }]}
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
              style={[styles.accionFila, { borderColor: tema.color.texto, borderRadius: tema.radio.completo }]}
            >
              <Text style={{ color: tema.color.texto, fontFamily: tema.fuente.uiSemibold, fontSize: tema.tipo.chico }}>
                {tarjeta.verbo}
              </Text>
            </Pressable>
          )}
          {expandida && accion == null && tarjeta.verbo != null && aviso == null && (
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
  raizContenido: { flexGrow: 1 },
  calendario: { gap: 6, paddingHorizontal: 16, paddingTop: 12 },
  calendarioEvento: { flexDirection: 'row', gap: 8, alignItems: 'baseline' },
  verAgenda: { alignSelf: 'flex-start', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  solapas: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  chips: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 4, paddingBottom: 8 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  alerta: { marginHorizontal: 16, marginTop: 12, padding: 16, gap: 12 },
  alertaItem: { gap: 8, alignItems: 'flex-start' },
  alertaAccion: { borderWidth: 1, paddingHorizontal: 12, paddingVertical: 4 },
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

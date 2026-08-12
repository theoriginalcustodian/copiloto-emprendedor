/**
 * `EscritorioFunciones` — Capa 0 (fondo) del panel deslizable: el "escritorio" detrás del panel de
 * chat, con el grid de las 6 funciones del copiloto y la lista de actividad reciente. Composición
 * pura de primitivos ya existentes (`Tile`/`Row`/`GlassIcon`/`useTema`) — sin lógica de navegación ni
 * de red acá (eso lo cablea la ruta, vía los callbacks `onFuncion`/`onAbrirReciente`).
 *
 * Adaptado desde el escritorio equivalente de DocuMed (fork hermano, `_staging/documed/apps/mobile/
 * src/modules/escritorio/EscritorioFunciones.tsx`), acotado a las funciones del emprendedor en vez
 * de las 9 clínicas de esa app — ver `TILES` abajo, que además fija la REGLA DE ORDEN (frecuencia de
 * uso esperada, nunca "al final por defecto"). El mecanismo de grid se conserva TAL CUAL: el
 * pedido del operador que lo generó allá ("preparate para más funciones, esto no puede ser 3×2 fijo")
 * aplica igual acá — `automatizaciones recurrentes` y `trazabilidad` ya están anotadas como candidatas
 * post-v1 en la memoria del proyecto, así que este escritorio va a crecer.
 *
 * 🔵 **Grid: máximo 2 filas + scroll horizontal, nunca una 3ª fila fija.** `TILES` ya tenía 9
 * funciones en el original armadas en 3×3 fijo — ese layout se queda sin filas apenas se suma una
 * función más. Acá el grid crece en COLUMNAS hacia la derecha: `agruparEnColumnas` arma las columnas
 * de a lo sumo `FILAS_MAX_GRID` (2) a partir de `TILES` en tiempo de módulo — sumar una 7ª función es
 * agregar un item a `TILES`, sin tocar esta función ni el JSX que la consume.
 *
 * Layout: padding `64/22/20`, título, grid horizontal-scrolleable de `Tile`
 * (ancho fijo `ANCHO_TILE` por columna), el encabezado TAPEABLE "Actividad reciente" (→ `/recientes`)
 * scrolleable con `paddingBottom` generoso para no quedar tapada por el panel/handle que se superpone
 * encima (Capa 1+).
 *
 * **Afordancia de "hay más a la derecha":** un fade (`LinearGradient` transparente → `tema.color.
 * fondo`) + una solapa con flecha, pegados al borde derecho, pero SÓLO cuando el contenido mide más
 * que el ancho visible — medido con `onLayout`/`onContentSizeChange`, nunca con `Dimensions.get
 * ('window')` (mismo criterio que `PanelDeslizable.tsx`: el ancho REAL del contenedor, no el de la
 * ventana, es el que importa).
 */
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
/**
 * 🔴 **`ScrollView` sale de Gesture Handler, NO de `react-native`, y no es preferencia de estilo.**
 *
 * Es la OTRA mitad del arreglo que `Tile.tsx` ya tiene hecho (ahí está el detalle medido). Reportado
 * en documed: *"los botones tardan mucho en reaccionar… hay que hacer click muy profundo o mantener
 * el dedo presionado; con un tap rápido no abren las funciones"*. La causa es tener DOS sistemas de
 * toque en el mismo árbol: el `ScrollView` de RN usa el responder system de React Native, mientras la
 * app entera cuelga de un `GestureHandlerRootView` con gestos de RNGH vivos (el panel deslizable, el
 * marco de vidrio). El `ScrollView` de RN reclama el toque para decidir si es scroll y, al competir
 * con RNGH, un tap corto queda sin dueño.
 *
 * Con los dos en RNGH hay UNA sola arena: un toque quieto lo gana el tile, uno que se arrastra lo gana
 * el scroll. Software Mansion pide las dos mitades juntas —*"import ScrollView/FlatList from
 * react-native-gesture-handler"* Y *"use RectButton/Touchable for tappable items inside scroll
 * containers"*—; con una sola no alcanza. Clonado de
 * `documed-front/apps/mobile/src/modules/escritorio/EscritorioFunciones.tsx`.
 */
import { ScrollView } from 'react-native-gesture-handler';
import Animated, { useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

import type { ActividadItem } from '@copiloto/core';

import { FilaActividad } from '../actividad/FilaActividad';
import { EncabezadoListado } from '../../theme/glass/EncabezadoListado';
import { GlassIcon } from '../../theme/glass/GlassIcon';
import type { NombreIconoGlass } from '../../theme/glass/icons';
import { Tile } from '../../theme/glass/Tile';
import { useTema } from '../../theme/ThemeProvider';

/** Las funciones del escritorio del copiloto. Ver `TILES` para la regla que fija su ORDEN. */
export type FuncionKey =
  | 'facturacion'
  | 'ingresos'
  | 'gastos'
  | 'presupuestos'
  | 'clientes'
  | 'midia'
  | 'inteligencia'
  | 'contabilidad'
  | 'ajustes';

export interface DefinicionTile {
  key: FuncionKey;
  label: string;
  icono: NombreIconoGlass;
}

/**
 * Los 9 tiles del escritorio.
 *
 * 🔴 **`TILES` se ordena por FRECUENCIA DE USO ESPERADA. Agregar una función obliga a decidir su
 * posición: no existe "al final" como opción por omisión.**
 *
 * No es una preferencia de estilo — **el orden de este array decide qué se ve sin scrollear**, y hasta
 * el 2026-07-22 ese orden lo había decidido el azar de la cronología: los seis del diseño original y
 * después Presupuestos, Gastos y Clientes pegados al final a medida que se construían. El resultado
 * medido: el emprendedor abría la app y veía **las cuatro funciones que menos usa**, con Facturación
 * —la razón por la que instaló esto— fuera de pantalla y Ajustes en la segunda posición más visible.
 *
 * El invariante lo sostiene un test (`las primeras cuatro son las operativas`), no la buena memoria
 * del próximo que agregue una función. Una regla escrita sin test se degrada igual que ésta.
 *
 * **Íconos: ninguno se repite DENTRO de este grid** — entrar por un glifo y llegar a otra función
 * desorienta, y hay un test que lo impide. Desde ODOBI hito 5 cada tile usa el ícono de función que
 * lleva su MISMO nombre en el set de 21 (`icons.ts`) — ya no hace falta pedir prestado un glifo de
 * otra función ni agregar uno nuevo al catálogo compartido: el vocabulario alcanza.
 */
export const TILES: readonly DefinicionTile[] = [
  // Las CUATRO OPERATIVAS — los cuatro verbos diarios: facturar, cobrar, gastar, presupuestar. Es lo
  // único que tiene que verse SIN SCROLLEAR, y ése es el criterio de aceptación real del orden.
  { key: 'facturacion', label: 'Facturación', icono: 'facturacion' },
  // 🆕 2026-07-22. Simétrica de Gastos, y **por eso va al lado**: si el emprendedor ve Gastos y no
  // ve Ingresos, asume que la plata que entra no se registra — y no la va a ir a buscar adentro de
  // otra pantalla. Hoy un cobro sólo existe si pasó por MercadoPago; el efectivo y las
  // transferencias no dejaban rastro, así que la caja daba números coherentes y falsos.
  { key: 'ingresos', label: 'Ingresos', icono: 'ingresos' },
  { key: 'gastos', label: 'Gastos', icono: 'gastos' },
  { key: 'presupuestos', label: 'Presupuestos', icono: 'presupuestos' },
  // Baja al 5º: la cartera **se llena sola** a medida que se factura, así que casi no se entra a
  // mano. Los cuatro de arriba son los cuatro verbos diarios — facturar, cobrar, gastar, presupuestar.
  { key: 'clientes', label: 'Clientes', icono: 'clientes' },
  // Cascarón hasta que llegue su contrato (Kanban, hito 7 del sprint de Inteligencia de Negocio).
  // Va a un `MarcoGlass` que dice qué va a ser, NUNCA a una pantalla en blanco: un tile que abre el
  // vacío le enseña al emprendedor que hay funciones que no andan, y esa lección después se la
  // aplica a las que sí andan.
  { key: 'midia', label: 'Mi día', icono: 'miDia' },
  // Ex "Métricas". El módulo se REUSA —no se reescribe—, sólo cambia cómo se llama.
  { key: 'inteligencia', label: 'Inteligencia de Negocio', icono: 'inteligencia' },
  // Cascarón: su contrato ya está escrito y espera el cierre de Clientes.
  { key: 'contabilidad', label: 'Contabilidad', icono: 'contabilidad' },
  // Último a propósito: se toca una vez por mes. Estaba segundo.
  { key: 'ajustes', label: 'Ajustes', icono: 'ajustes' },
];

/**
 * Las funciones OPERATIVAS, en orden. Es lo que el DoD del contrato exige que se vea sin scrollear, y
 * lo que el test usa para frenar a quien meta una función nueva arriba sin pensarlo.
 */
export const KEYS_OPERATIVAS: readonly FuncionKey[] = [
  'facturacion',
  'ingresos',
  'gastos',
  'presupuestos',
];

/** Máximo de tiles apilados por columna — el resto de las funciones se alcanza con scroll horizontal,
 *  nunca agregando una 3ª fila. */
const FILAS_MAX_GRID = 2;

/** Ancho fijo de cada tile en el grid horizontal. Con `flex:1` el ancho se repartía entre las
 *  columnas que hubiera en ESA fila; con scroll horizontal eso ya no es una opción — el ancho de un
 *  tile no puede depender de cuántas funciones haya en total, tiene que ser un valor propio. */
const ANCHO_TILE = 104;

/**
 * Alto reservado para la etiqueta. Cada tile mide lo que mida su etiqueta: "Redes Sociales" envuelve
 * a 2 líneas y "Apps" o "Métricas" entran en 1, así que las cards de una misma fila saldrían de
 * alturas distintas sin esto. Reservando siempre 2 líneas, todas las cards miden lo mismo SOLAS.
 *
 * 2 líneas de `fontSize 11.5` con `lineHeight 14` = 28, redondeado a 30 para que un glifo con cola
 * (una "g", una "j") no quede recortado en el borde inferior.
 */
const ALTO_LABEL = 30;

/**
 * Agrupa `items` en columnas de a lo sumo `filasPorColumna` elementos cada una, preservando el orden.
 * Genérica y sin ningún número de función hardcodeado: agregar una 7ª, 10ª, etc. item a `TILES` sólo
 * cambia cuántas columnas salen de acá — nunca esta función ni el JSX que la consume. Exportada para
 * poder probar el invariante "máximo N por columna" directamente, sin acoplar el test al conteo actual
 * de `TILES`.
 */
export function agruparEnColumnas<T>(
  items: readonly T[],
  filasPorColumna: number,
): readonly (readonly T[])[] {
  const columnas: T[][] = [];
  for (let i = 0; i < items.length; i += filasPorColumna) {
    columnas.push(items.slice(i, i + filasPorColumna) as T[]);
  }
  return columnas;
}

const COLUMNAS_TILES = agruparEnColumnas(TILES, FILAS_MAX_GRID);


export interface EscritorioFuncionesProps {
  /** Un handler único para todas las funciones del grid — el tile tocado se identifica por `key`. */
  onFuncion?: (key: FuncionKey) => void;
  /**
   * Las últimas operaciones REALES del emprendedor (20, las trae el shell).
   *
   * 🔴 **Antes acá había un array hardcodeado** —*"Presupuesto Acme S.A."*, *"Factura #1042"*,
   * *"Publicación en Instagram"*— que se mostraba en la pantalla principal de producción.
   * *(El nombre de esa constante no se escribe acá a propósito: el DoD del contrato pide
   * `grep <nombre> apps/mobile/src/` → cero hits, y un comentario que lo mencione haría fallar el
   * check por hablar de él. Está en el mensaje del commit que lo borró.)* El tenant del operador
   * tenía 0 presupuestos y sus facturas iban del #1 al #18 — ninguna era la #1042. **Se borró y no se
   * deja fallback:** datos falsos de respaldo convierten cada caída del backend en una mentira
   * silenciosa, y un emprendedor nuevo que ve actividad ajena no concluye "está vacío" sino
   * **"esta app no es mía"**.
   *
   * Este componente NO consulta: recibe. El fetch vive en el shell, que es quien tiene el foco.
   */
  actividad?: readonly ActividadItem[];
  /** `true` mientras el shell trae la primera página — para no pintar el vacío antes de tiempo. */
  cargandoActividad?: boolean;
  /**
   * Tocar una operación. Llega del shell, que es quien navega — este componente no conoce
   * `expo-router`, igual que con `onFuncion`. Si no se pasa, las filas no son tocables.
   */
  onAbrirActividad?: (item: ActividadItem) => void;
  /**
   * Tocar el ENCABEZADO "Actividad reciente" → entra a la lista completa (`/recientes`). Del shell,
   * que es quien navega (`addendum_mi-dia` §3). Si no se pasa, el encabezado se muestra sin flecha, no
   * tapeable — nunca una flecha sin destino.
   */
  onVerRecientes?: () => void;
}

/** Margen de tolerancia antes de considerar que "hay más contenido a la derecha". RN mide con floats;
 *  un solape de 1-2px entre el ancho visible y el del contenido es ruido de redondeo entre
 *  plataformas, no una señal real de overflow — sin este umbral el fade podría parpadear en el borde
 *  exacto. */
const UMBRAL_OVERFLOW_PX = 4;

/**
 * C6 (cotas de chat y listas): el `ScrollView` horizontal de este grid actualizaba `desplazado` con
 * `setState` en CADA frame de scroll (`scrollEventThrottle={16}` = hasta 60 veces/seg), y ese estado
 * vivía en `EscritorioFunciones` — el componente padre de las 9 tiles + la lista de actividad. Cada
 * frame de scroll re-renderizaba TODO ese árbol para decidir la visibilidad de un fade y una flecha.
 * `Animated.createAnimatedComponent` envuelve el `ScrollView` de RNGH (no el de `react-native` — ver
 * el docstring de más arriba sobre la arena de gestos) para que `useAnimatedScrollHandler` escriba el
 * offset directo a un `SharedValue`, en el hilo de UI, sin pasar por React en absoluto.
 */
const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView);

export function EscritorioFunciones({
  onFuncion,
  actividad = [],
  cargandoActividad = false,
  onAbrirActividad,
  onVerRecientes,
}: EscritorioFuncionesProps) {
  const tema = useTema();

  // Ninguno de los dos anchos se pregunta con `Dimensions.get('window')`: se MIDEN, con el mismo
  // criterio que `PanelDeslizable.tsx` — preguntarle el tamaño a la screen en vez de al
  // contenedor/contenido real da un número que no sigue rotaciones ni el ancho real disponible.
  const [anchoVisible, setAnchoVisible] = useState(0);
  const [anchoContenido, setAnchoContenido] = useState(0);
  // Cuánto se desplazó ya el emprendedor. `SharedValue`, no `useState`: sólo alimenta la opacidad
  // animada de abajo, nunca una decisión de qué se MONTA — no hay motivo para que un valor que
  // cambia hasta 60 veces/seg pase por React.
  const desplazado = useSharedValue(0);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      desplazado.value = event.contentOffset.x;
    },
  });

  const hayOverflow = anchoContenido - anchoVisible > UMBRAL_OVERFLOW_PX;

  // La visibilidad SÍ depende del scroll (frame a frame): `useAnimatedStyle` la recalcula en el hilo
  // de UI a partir del `SharedValue`, así que llegar al final de la grilla nunca dispara un
  // re-render de React. `hayOverflow` decide si el bloque se MONTA (rara vez cambia, React normal);
  // esto sólo decide si se VE, dentro de ese bloque.
  const estiloAfordanciaAnimado = useAnimatedStyle(() => {
    const llegoAlFinal = anchoContenido - anchoVisible - desplazado.value <= UMBRAL_OVERFLOW_PX;
    return { opacity: llegoAlFinal ? 0 : 1 };
  });

  return (
    <View style={[styles.contenedor, { paddingHorizontal: 22 }]}>
      <View style={styles.headerFila}>
        <Text
          style={[
            styles.titulo,
            { color: tema.color.texto, fontFamily: tema.fuente.uiSemibold, fontSize: 24 },
          ]}
        >
          Funciones
        </Text>
      </View>

      <View
        style={styles.contenedorGrid}
        testID="escritorio-grid-contenedor"
        onLayout={(e) => setAnchoVisible(e.nativeEvent.layout.width)}
      >
        <AnimatedScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.contenidoGrid}
          onContentSizeChange={(w) => setAnchoContenido(w)}
          onScroll={scrollHandler}
          // El offset ya se lee en el hilo de UI (`scrollHandler`, `SharedValue`) — este throttle sólo
          // gobierna con qué frecuencia el driver nativo entrega eventos, no un `setState` de React.
          scrollEventThrottle={16}
          testID="escritorio-scroll-funciones"
        >
          {COLUMNAS_TILES.map((columna, iCol) => (
            <View key={iCol} style={styles.columnaGrid} testID={`col-escritorio-${iCol}`}>
              {columna.map((t) => (
                <Tile
                  key={t.key}
                  testID={`tile-${t.key}`}
                  accessibilityLabel={t.label}
                  onPress={() => onFuncion?.(t.key)}
                  style={styles.tile}
                >
                  <GlassIcon name={t.icono} size={46} />
                  {/* `numberOfLines={2}` acota el peor caso: una etiqueta más larga que las actuales
                      no puede volver a romper la grilla creciendo a 3 líneas — se recorta con "…". */}
                  <Text
                    numberOfLines={2}
                    style={[
                      styles.labelTile,
                      { color: tema.color.texto, fontFamily: tema.fuente.uiSemibold },
                    ]}
                  >
                    {t.label}
                  </Text>
                </Tile>
              ))}
            </View>
          ))}
        </AnimatedScrollView>

        {/* Se MONTA si queda contenido a la derecha (`hayOverflow`, React normal); la opacidad de si
            se ve AHORA MISMO (llegó o no al final) la maneja `estiloAfordanciaAnimado` en el hilo de
            UI — ver docstring del módulo. */}
        {hayOverflow && (
          <Animated.View
            style={[styles.afordanciaMasFunciones, estiloAfordanciaAnimado]}
            pointerEvents="none"
          >
            <LinearGradient
              colors={['transparent', tema.color.fondo]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.fadeDerecha}
              testID="escritorio-fade-mas-funciones"
            />
            {/* La solapa: va encima del fade y usa el acento del tema —no un color fijo— para seguir
                siendo visible en los 5 skins. */}
            <View
              style={[styles.solapa, { backgroundColor: tema.color.acento, opacity: 0.22 }]}
              testID="escritorio-solapa-mas-funciones"
            />
            <View style={styles.solapa}>
              <Text style={[styles.flechaSolapa, { color: tema.color.texto }]}>›</Text>
            </View>
          </Animated.View>
        )}
      </View>

      {/* 🔴 De texto muerto a encabezado TAPEABLE → `/recientes` (addendum_mi-dia §3). El CONTENIDO
          sigue siendo la actividad reciente: el rediseño del centro a "Mi Día" (tareas del día) espera
          su endpoint —hoy no existe— y el swipe-left, y sacar la actividad de acá sin ese reemplazo
          sería una regresión (quedaría inalcanzable desde el principal). El título tapeable, en cambio,
          es adelantable sobre el layout actual, y de yapa destraba ver la lista COMPLETA, que hoy no
          tiene entrada. */}
      <EncabezadoListado
        titulo="Actividad reciente"
        onPress={onVerRecientes}
        style={styles.encabezadoReciente}
        testID="escritorio-encabezado-recientes"
      />

      <ScrollView contentContainerStyle={styles.listaReciente} testID="escritorio-actividad">
        {!cargandoActividad && actividad.length === 0 && (
          <Text
            testID="escritorio-actividad-vacia"
            style={[styles.vacio, { color: tema.color.textoTenue, fontFamily: tema.fuente.mono }]}
          >
            Todavía no hay movimientos. Lo que hagas va a aparecer acá.
          </Text>
        )}
        {actividad.map((item) => (
          <FilaActividad key={item.id} item={item} onPress={onAbrirActividad} />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1, paddingTop: 64, paddingBottom: 20 },
  headerFila: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  titulo: {},
  contenedorGrid: { marginBottom: 20 },
  contenidoGrid: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  columnaGrid: { gap: 12 },
  // Sin `height`: el alto sale solo y es el mismo en todas las cards porque el bloque de la etiqueta
  // mide siempre igual (ver `ALTO_LABEL`).
  tile: { width: ANCHO_TILE, alignItems: 'center', justifyContent: 'center', gap: 8 },
  labelTile: { fontSize: 11.5, lineHeight: 14, height: ALTO_LABEL, textAlign: 'center' },
  // Llena `contenedorGrid` exacto: el fade/solapa de adentro siguen posicionándose `absolute` contra
  // ESTE wrapper igual que antes lo hacían contra `contenedorGrid` directamente.
  afordanciaMasFunciones: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 },
  fadeDerecha: { position: 'absolute', top: 0, bottom: 0, right: 0, width: 40 },
  solapa: {
    position: 'absolute',
    right: 0,
    top: '50%',
    marginTop: -26,
    width: 18,
    height: 52,
    borderTopLeftRadius: 9,
    borderBottomLeftRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flechaSolapa: { fontSize: 15, lineHeight: 15, marginLeft: -1 },
  encabezadoReciente: { marginBottom: 10 },
  listaReciente: { gap: 8, paddingBottom: 180 },
  vacio: { fontSize: 11, opacity: 0.8 },
});

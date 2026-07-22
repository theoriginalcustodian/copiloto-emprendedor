/**
 * `EscritorioFunciones` — Capa 0 (fondo) del panel deslizable: el "escritorio" detrás del panel de
 * chat, con el grid de las 6 funciones del copiloto y la lista de actividad reciente. Composición
 * pura de primitivos ya existentes (`Tile`/`Row`/`GlassIcon`/`useTema`) — sin lógica de navegación ni
 * de red acá (eso lo cablea la ruta, vía los callbacks `onFuncion`/`onAbrirReciente`).
 *
 * Adaptado desde el escritorio equivalente de DocuMed (fork hermano, `_staging/documed/apps/mobile/
 * src/modules/escritorio/EscritorioFunciones.tsx`), acotado a las 6 funciones del emprendedor en vez
 * de las 9 clínicas de esa app — ver `TILES` abajo. El mecanismo de grid se conserva TAL CUAL: el
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
 * (ancho fijo `ANCHO_TILE` por columna), header mono "ACTIVIDAD RECIENTE" y una lista de `Row`
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
import { LinearGradient } from 'expo-linear-gradient';

import type { ActividadItem } from '@copiloto/core';

import { FilaActividad } from '../actividad/FilaActividad';
import { GlassIcon } from '../../theme/glass/GlassIcon';
import type { NombreIconoGlass } from '../../theme/glass/icons';
import { Row } from '../../theme/glass/Row';
import { Tile } from '../../theme/glass/Tile';
import { useTema } from '../../theme/ThemeProvider';

/** Las 6 funciones del escritorio del copiloto (pedido del operador, sprint mobile-first 2026-07-20). */
export type FuncionKey =
  | 'apps'
  | 'ajustes'
  | 'recientes'
  | 'redes'
  | 'metricas'
  | 'facturacion'
  | 'presupuestos'
  | 'gastos'
  | 'clientes';

export interface DefinicionTile {
  key: FuncionKey;
  label: string;
  icono: NombreIconoGlass;
}

/**
 * Los 6 tiles del escritorio, en el orden del diseño.
 *
 * 🔴 **`apps` no tiene ícono 1:1 en el catálogo.** El diseño pedía un glifo tipo "grid" y
 * `src/theme/glass/icons.ts` no lo tiene — los 10 nombres semánticos son `folder | note | doc_search |
 * mic | chat | clock | settings | chart | media | user`. `folder` es el más cercano disponible: una
 * carpeta que agrupa, igual que "Apps" agrupa las integraciones conectadas (Gmail, Drive, Sheets,
 * HubSpot, Instagram, Calendar vía Composio) — y no colisiona con ningún otro ícono de este grid. Si
 * el catálogo suma un glifo de grid dedicado más adelante, este es el único lugar a tocar.
 *
 * El resto sale directo del catálogo sin adaptar: `ajustes→settings`, `recientes→clock`,
 * `redes→chat` (charla = red social), `metricas→chart`, `facturacion→doc_search` (documento que se
 * busca/consulta, el mismo glifo que DocuMed usa para "ingestar documento").
 */
export const TILES: readonly DefinicionTile[] = [
  { key: 'apps', label: 'Apps', icono: 'folder' },
  { key: 'ajustes', label: 'Ajustes', icono: 'settings' },
  { key: 'recientes', label: 'Recientes', icono: 'clock' },
  { key: 'redes', label: 'Redes Sociales', icono: 'chat' },
  { key: 'metricas', label: 'Métricas', icono: 'chart' },
  { key: 'facturacion', label: 'Facturación', icono: 'doc_search' },
  // La 7ª función, y la primera que ejercita de verdad el grid que crece en columnas: con el layout
  // 3×2 fijo del original este tile no se habría renderizado — habría desaparecido en silencio, sin
  // error, sólo porque el array creció (es exactamente lo que pasó en el grid de Ajustes al sumar el
  // séptimo). `note` = el documento que se redacta, y no colisiona con ningún otro de este grid.
  { key: 'presupuestos', label: 'Presupuestos', icono: 'note' },
  // La 8ª. `wallet` se AGREGÓ al catálogo para esta función en vez de reusar `chart`, que ya es
  // Métricas: dos tiles con el mismo glifo en el mismo grid no se distinguen de un vistazo.
  { key: 'gastos', label: 'Gastos', icono: 'wallet' },
  // La 9ª. `user` = la persona a la que le facturás; no colisiona con ningún otro de este grid.
  { key: 'clientes', label: 'Clientes', icono: 'user' },
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
}

/** Margen de tolerancia antes de considerar que "hay más contenido a la derecha". RN mide con floats;
 *  un solape de 1-2px entre el ancho visible y el del contenido es ruido de redondeo entre
 *  plataformas, no una señal real de overflow — sin este umbral el fade podría parpadear en el borde
 *  exacto. */
const UMBRAL_OVERFLOW_PX = 4;

export function EscritorioFunciones({
  onFuncion,
  actividad = [],
  cargandoActividad = false,
}: EscritorioFuncionesProps) {
  const tema = useTema();

  // Ninguno de los dos anchos se pregunta con `Dimensions.get('window')`: se MIDEN, con el mismo
  // criterio que `PanelDeslizable.tsx` — preguntarle el tamaño a la screen en vez de al
  // contenedor/contenido real da un número que no sigue rotaciones ni el ancho real disponible.
  const [anchoVisible, setAnchoVisible] = useState(0);
  const [anchoContenido, setAnchoContenido] = useState(0);
  // Cuánto se desplazó ya el emprendedor. Sin esto la solapa seguiría apuntando a la derecha después
  // de haber llegado al final — prometiendo funciones que no existen, la misma mentira que el fade
  // evita cuando no hay overflow.
  const [desplazado, setDesplazado] = useState(0);

  const hayOverflow = anchoContenido - anchoVisible > UMBRAL_OVERFLOW_PX;
  const llegoAlFinal = anchoContenido - anchoVisible - desplazado <= UMBRAL_OVERFLOW_PX;
  const hayMasFuncionesADerecha = hayOverflow && !llegoAlFinal;

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
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.contenidoGrid}
          onContentSizeChange={(w) => setAnchoContenido(w)}
          onScroll={(e) => setDesplazado(e.nativeEvent.contentOffset.x)}
          // 60 fps es innecesario para decidir si se muestra una solapa; 16 ms mantiene la respuesta
          // inmediata al ojo sin re-renderizar el grid entero en cada frame del gesto.
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
        </ScrollView>

        {/* Sólo se dibujan si queda contenido a la derecha — ver docstring del módulo. */}
        {hayMasFuncionesADerecha && (
          <>
            <LinearGradient
              colors={['transparent', tema.color.fondo]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.fadeDerecha}
              pointerEvents="none"
              testID="escritorio-fade-mas-funciones"
            />
            {/* La solapa: va encima del fade y usa el acento del tema —no un color fijo— para seguir
                siendo visible en los 5 skins. `pointerEvents="none"`: es una señal, no un control. */}
            <View
              style={[styles.solapa, { backgroundColor: tema.color.acento, opacity: 0.22 }]}
              pointerEvents="none"
              testID="escritorio-solapa-mas-funciones"
            />
            <View style={styles.solapa} pointerEvents="none">
              <Text style={[styles.flechaSolapa, { color: tema.color.texto }]}>›</Text>
            </View>
          </>
        )}
      </View>

      {/* Template: color de ACENTO con opacity .6 (no gris tenue), mono uppercase letter-spacing .14em. */}
      <Text
        style={[
          styles.headerReciente,
          { color: tema.color.acento, fontFamily: tema.fuente.mono },
        ]}
      >
        ACTIVIDAD RECIENTE
      </Text>

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
          <FilaActividad key={item.id} item={item} />
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
  headerReciente: { fontSize: 10, letterSpacing: 1.4, marginBottom: 10, opacity: 0.6, textTransform: 'uppercase' },
  listaReciente: { gap: 8, paddingBottom: 180 },
  vacio: { fontSize: 11, opacity: 0.8 },
});

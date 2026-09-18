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
 * 🔵 **Grid 3×2 FIJO, sin scroll (Ola 4).** Hasta el 2026-09-18 eran 9 tiles en dos filas con scroll
 * horizontal, más su afordancia de «hay más a la derecha» (fade + solapa + medición de anchos): la
 * mitad de las funciones vivía fuera de pantalla. Con 6 entra todo, así que el scroll y la
 * afordancia se fueron — una flecha que señala el vacío enseña a desconfiar de las que sí señalan
 * algo. Ver el docstring de `TILES` para por qué son 6 y no 9.
 *
 * Layout: padding `64/22/20`, título, el grid, el encabezado TAPEABLE "Actividad reciente"
 * (→ `/recientes`) y la lista, scrolleable con `paddingBottom` generoso para no quedar tapada por el
 * panel/handle que se superpone encima (Capa 1+).
 */
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
  | 'inteligencia';

export interface DefinicionTile {
  key: FuncionKey;
  label: string;
  icono: NombreIconoGlass;
}

/**
 * Los 6 tiles del escritorio.
 *
 * 🔴 **Eran 9 hasta el 2026-09-18 (Ola 4).** Bajaron a 6 por la razón que el sistema declara
 * (`odobi-ui/CLAUDE.md` §Modelo de capas, rev. 20/08): Hick-Hyman — elegir entre 9 cuesta, y tres de
 * esos nueve **no eran lugares de información**, que es lo único que este escritorio nombra:
 *   - **Mi día** salió porque **es la portada**, no un destino al que se entra;
 *   - **Ajustes** salió porque se entra **por el avatar**, su única puerta;
 *   - **Contabilidad** salió porque se **fundió** con Inteligencia — eran dos pantallas leyendo el
 *     mismo negocio, y la de Contabilidad sólo aportaba el acumulado del año y el tope de
 *     monotributo, que ahora viven allá.
 *
 * Con 6 el grid entra COMPLETO en 3×2 y **desaparece el scroll horizontal**: ya no hay funciones
 * fuera de pantalla, así que tampoco hace falta la afordancia de "hay más a la derecha".
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
  // Ex "Métricas", y desde el 2026-09-18 también ex "Contabilidad": las dos pantallas se fundieron
  // (ver `PantallaInteligencia`). El módulo se REUSA — sólo cambia qué contiene.
  { key: 'inteligencia', label: 'Inteligencia de Negocio', icono: 'inteligencia' },
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

/**
 * Columnas del grid. **3×2 fijo, sin scroll** (`odobi-ui/CLAUDE.md` §Modelo de capas): con 6
 * funciones entra todo, y lo que entra no se esconde.
 *
 * ⚠️ **Si mañana vuelven a ser 7+, esto NO se resuelve agregando una 3ª fila ni volviendo al scroll
 * horizontal** — se resuelve decidiendo qué función no es un lugar. El scroll horizontal existió
 * mientras el escritorio tenía 9 tiles, y lo que enseñó es que la mitad de las funciones vivían
 * fuera de pantalla.
 */
const COLUMNAS_GRID = 3;

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
 * Agrupa `items` en filas de `porFila` elementos, preservando el orden. Genérica y sin el conteo de
 * funciones adentro: es lo que se prueba directo, sin acoplar el test a cuántos tiles haya hoy.
 */
export function agruparEnFilas<T>(items: readonly T[], porFila: number): readonly (readonly T[])[] {
  const filas: T[][] = [];
  for (let i = 0; i < items.length; i += porFila) {
    filas.push(items.slice(i, i + porFila) as T[]);
  }
  return filas;
}

const FILAS_TILES = agruparEnFilas(TILES, COLUMNAS_GRID);


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

export function EscritorioFunciones({
  onFuncion,
  actividad = [],
  cargandoActividad = false,
  onAbrirActividad,
  onVerRecientes,
}: EscritorioFuncionesProps) {
  const tema = useTema();

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

      {/* 3×2 fijo. Se fue el `ScrollView` horizontal con su fade y su solapa: con 6 funciones no hay
          nada a la derecha que anunciar, y una afordancia que señala hacia el vacío enseña a
          desconfiar de las que sí señalan algo. */}
      <View style={styles.contenedorGrid} testID="escritorio-grid-contenedor">
        {FILAS_TILES.map((fila, iFila) => (
          <View key={iFila} style={styles.filaGrid} testID={`fila-escritorio-${iFila}`}>
            {fila.map((t) => (
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
  contenedorGrid: { marginBottom: 20, gap: 12 },
  filaGrid: { flexDirection: 'row', gap: 12 },
  // `flex:1` y NO un ancho fijo: sin scroll horizontal las tres columnas se reparten el ancho real
  // del teléfono, que es lo que hace que el grid entre igual en un 360 y en un 430.
  // Sin `height`: el alto sale solo y es el mismo en todas las cards porque el bloque de la etiqueta
  // mide siempre igual (ver `ALTO_LABEL`).
  tile: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  labelTile: { fontSize: 11.5, lineHeight: 14, height: ALTO_LABEL, textAlign: 'center' },
  encabezadoReciente: { marginBottom: 10 },
  listaReciente: { gap: 8, paddingBottom: 180 },
  vacio: { fontSize: 11, opacity: 0.8 },
});

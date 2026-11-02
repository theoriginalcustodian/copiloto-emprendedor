import { useRef, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import { Pressable, ScrollView } from 'react-native-gesture-handler';

import {
  cambiarEstadoTarjetaMiDia,
  crearTarjetaMiDia,
  type AvisoAlChat,
  CATEGORIAS,
  ETIQUETA_CATEGORIA_TARJETA,
  filtrarPorCategoria,
  hayCategorias,
  tarjetasCriticas,
  type CategoriaTarjeta,
  type IdSolapa,
  type TarjetaMiDia,
  type TableroMiDia,
} from '@copiloto/core';

import { rutaDeDestino, type RutaDestino } from './destinoTarjeta';
import { TarjetaMiDiaRow } from './TarjetaMiDiaRow';
import { useTableroMiDia } from './useTableroMiDia';
import { EstadoVacio } from '../../theme/EstadoVacio';
import { CampoTexto, FilaBotones, ScrollFormulario } from '../../theme/glass/campos';
import { MarcoGlass } from '../../theme/glass/MarcoGlass';
import { pressableStyle } from '../../theme/glass/presion';
import { useTema } from '../../theme/ThemeProvider';

/**
 * `PantallaTuDia` — el tablero del detector proactivo (hito 7), la puerta «Ver tablero ›» de Mi día
 * (`#tablero` del prototipo, `index.html:2469`): 3 solapas (Para hoy · Haciendo · Hechas), pobladas por las
 * tarjetas que las 8 reglas determinísticas del `contrato_mi-dia-y-el-detector-proactivo` van generando.
 * Mi día resume; acá se gestiona (`index.html:3097`), y por eso el swipe, las solapas, los chips, el alta a
 * mano y el banner crítico viven acá y no allá (SM-I1).
 *
 * 🔴 **Reemplaza al Kanban de 4 columnas retirado el 2026-07-23.** Ver `respuesta_planificacion-a-
 * frontend-backend_mi-dia-es-el-detector-3-solapas...`: el pipeline de facturación NO es Mi Día — son
 * conceptos distintos que compartían por error la misma URL.
 *
 * 🔴 **`GET /mi-dia/tablero` está VIVO** (backend PR#96, desplegado y verificado por HTTP —401 sin
 * token, no 404/500). Toda la pantalla habla con `leerTablero()`; si algo falla igual degrada a
 * `no_disponible` y lo DICE — no simula tarjetas.
 *
 * 🔴 **Lista vertical con solapas arriba, NUNCA columnas ni drag** (contrato §2.3): el arrastre lateral
 * con el pulgar compite con el Pan del panel glass — ya pagado dos veces en este repo (scroll de Apps,
 * glass apilado). El cambio de solapa es un tap sobre la pestaña, no un gesto.
 *
 * 🔴 **`estado` que se manda es una ASUNCIÓN razonada, no confirmada literal.** Backend documentó los
 * CAMPOS de la tarjeta pero no el conjunto de valores válidos de `estado`; asumo que coincide con los
 * `id` de solapa (mismo vocabulario ya confirmado: `para_hoy`/`haciendo`/`hecha`) — preguntado en
 * `pedido_frontend-a-backend_valores-reales-de-estado...`. Si la asunción es incorrecta, el 400 trae
 * el `detail` real de backend y se lo muestra tal cual al emprendedor (`estado_invalido` en
 * `cambiarEstadoTarjetaMiDia`) — no falla en silencio ni inventa un mensaje genérico.
 *
 * 🔴 **`ScrollView`/`Pressable` de gesture-handler, no de react-native** — convención del repo (ver
 * `Tile.tsx`): la app cuelga de un `GestureHandlerRootView` y mezclar el responder system de RN con
 * RNGH hace que un tap corto quede sin dueño.
 */

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
      style={styles.chipsScroll}
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

export interface PantallaTuDiaProps {
  /** Sin destino conocido, la píldora del banner crítico cae acá. La cablea la ruta. */
  onAjustes?: () => void;
  /**
   * H5b — abre la pantalla a la que apunta `destino` (la conexión, el comprobante, AFIP: ver
   * `rutaDeDestino`). Recibe la ruta YA resuelta. Sin él, o con un `destino` ausente/desconocido, la acción
   * crítica cae a `onAjustes` y la de `presentacion` queda como rótulo.
   */
  onDestino?: (ruta: RutaDestino) => void;
  /**
   * `hitl (a)` — el puente tarjeta → chat. Tu día es una ruta y el chat vive en la pantalla de atrás, así que
   * quien lo cablea (`app/midia.tsx`) deja el aviso y vuelve. Sin él el verbo es rótulo: un botón que no
   * lleva a ningún lado es peor que un rótulo.
   */
  onAvisoAlChat?: (aviso: AvisoAlChat) => void;
}

/**
 * El alta **a mano** de una tarjeta de Mi dia, gemelo de
 * `apps/copiloto-web/src/modules/midia/MidiaScreen.tsx`.
 *
 * Por que existe: `POST /mi-dia/tarjetas` esta en el backend desde siempre y `crearTarjetaMiDia`
 * en el cliente compartido (`miDia.ts:240`), pero **ninguna pantalla lo llamaba** -- la capacidad
 * estaba escrita y muerta (ficha SM-E3). Y esta misma pantalla ya se lo prometia al emprendedor:
 * la nota que cierra la lista dice *«Las que anotaste vos las moves vos»* cuando no habia con que
 * anotarlas.
 *
 * La tarjeta manual nace en `para_hoy` (`mi_dia_tarjeta_store.py:123` no fija estado: cae al
 * default de la tabla), asi que al crear se salta a esa solapa -- si no, el emprendedor toca
 * «Agregar» parado en «Haciendo» y no ve aparecer nada.
 *
 * El error va por `Alert`, el mismo camino que `avanzar` y `borrar` de esta pantalla: un segundo
 * lugar donde mirar errores es el que nadie mira.
 */
function AltaTarjeta({ onCreada }: { onCreada: () => void }) {
  const tema = useTema();
  const [texto, setTexto] = useState('');
  const [guardando, setGuardando] = useState(false);
  const vacio = texto.trim() === '';
  // El teclado tapaba el botón aunque el campo se revelara: se revela el grupo campo + «Agregar».
  const refGrupo = useRef<View>(null);

  async function agregar() {
    if (vacio || guardando) return;
    setGuardando(true);
    try {
      const res = await crearTarjetaMiDia(texto.trim());
      if (res.status === 'ok') {
        setTexto('');
        onCreada();
        return;
      }
      // El motivo del backend se muestra TAL CUAL: es el unico que dice que corregir.
      if (res.status === 'texto_vacio') {
        Alert.alert('No se pudo anotar la tarjeta', res.motivo);
        return;
      }
      Alert.alert('No se pudo anotar la tarjeta', 'Proba de nuevo en un momento.');
    } catch {
      Alert.alert('No se pudo anotar la tarjeta', 'Proba de nuevo en un momento.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <View ref={refGrupo} collapsable={false} style={{ gap: tema.espacio.sm, paddingHorizontal: 16 }} testID="midia-alta">
      <CampoTexto
        etiqueta="Anotar algo para hoy"
        revelarJunto={refGrupo}
        testID="midia-alta-texto"
        valor={texto}
        onChange={setTexto}
        placeholder="Llamar al proveedor"
      />
      <FilaBotones
        testID="midia-alta-acciones"
        compacto
        botones={[{
          etiqueta: 'Agregar',
          onPress: () => { void agregar(); },
          variante: 'primario',
          deshabilitado: vacio || guardando,
          testID: 'midia-alta-enviar',
        }]}
      />
    </View>
  );
}

export function PantallaTuDia({ onAjustes, onDestino, onAvisoAlChat }: PantallaTuDiaProps = {}) {
  const tema = useTema();
  const { estado, tablero, cargar, borrar } = useTableroMiDia();
  const [solapaActiva, setSolapaActiva] = useState<IdSolapa>('para_hoy');
  const [categoria, setCategoria] = useState<CategoriaTarjeta>('todo');
  const [expandida, setExpandida] = useState<string | null>(null);

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

  const solapa = tablero?.solapas.find((s) => s.id === solapaActiva) ?? null;
  const tarjetas = solapa != null ? filtrarPorCategoria(solapa.tarjetas, categoria) : [];

  return (
    <MarcoGlass titulo="Tu día" icono="miDia" testID="pantalla-tu-dia">
      <ScrollFormulario style={styles.raiz} contentContainerStyle={styles.raizContenido} testID="midia-scroll">
        <Text testID="tudia-subtitulo" style={[styles.subtitulo, { color: tema.color.textoTenue, fontSize: tema.tipo.chico }]}>
          Lo que Odobi detectó y lo que anotaste vos.
        </Text>

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

        {/* SM-E3: anotar a mano. Arriba de la lista, no al final: lo que se anota se anota antes de
            repasar el dia, y al final de una lista larga nadie lo encuentra. */}
        <AltaTarjeta
          onCreada={() => {
            setSolapaActiva('para_hoy');
            void cargar();
          }}
        />

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
                    onPress={() => setExpandida((prev) => (prev === t.id ? null : t.id))}
                    gestion={{
                      etiquetaAvanzar: SIGUIENTE[solapaActiva]?.etiqueta ?? null,
                      onAvanzar: () => void avanzar(t),
                      onBorrar: () => void borrar(t.id),
                    }}
                    // §C: la acción de `presentacion` rutea por `rutaDeDestino` TAL CUAL. Sin handler (o con
                    // un `tipo` que esta versión no conoce) queda como rótulo — nunca cae a Ajustes por su
                    // cuenta: acá no hay una pantalla «por defecto» que no sea adivinar.
                    onAccion={onDestino}
                    onAviso={onAvisoAlChat}
                    onBorrar={() => void borrar(t.id)}
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
      </ScrollFormulario>
    </MarcoGlass>
  );
}

const styles = StyleSheet.create({
  raiz: { flex: 1 },
  raizContenido: { flexGrow: 1 },
  subtitulo: { paddingHorizontal: 16 },
  solapas: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  // `ScrollView` crece por defecto: con la solapa vacía abría un hueco entre los chips y el alta.
  chipsScroll: { flexGrow: 0 },
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
});

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
import { elevacion } from '../../theme/BloqueCifra';
import { BotonAcceso, IconoLapiz } from '../../theme/BotonAcceso';
import { EstadoVacio } from '../../theme/EstadoVacio';
import { CampoTexto, FilaBotones, ScrollFormulario } from '../../theme/glass/campos';
import { conAlfa } from '../../theme/glass/conAlfa';
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
 * El fondo de la opción ELEGIDA en las solapas y los chips. En claro es la pastilla blanca apoyada sobre la
 * pista. En oscuro la superficie de tarjeta es casi el tono de la pista y la elegida no se distinguía
 * (Martin 17/11): ahí se levanta con un velo crema más alto, que sí se separa.
 */
function useRealceSeleccion(): string {
  const tema = useTema();
  return tema.glass.esLight ? tema.color.superficie : conAlfa(tema.color.texto, 0.18);
}

/**
 * Las solapas como **control segmentado** (Martin 15/11): una pista gris a todo el ancho con los tres tramos
 * iguales, y el activo como una pastilla blanca apoyada encima. Antes eran tres cajas con borde, la activa en
 * terracota: se leían como tres botones sueltos y no como «una de tres vistas».
 *
 * El contador va pegado al rótulo («Para hoy 3» · «Haciendo 1» · «Hechas»), más tenue. «Hechas» no lleva número
 * —es historia, no pendiente— y un contador en 0 no se dibuja: «Haciendo 0» no informa nada que el vacío no diga.
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
  const realce = useRealceSeleccion();
  return (
    <View style={[styles.solapas, { backgroundColor: conAlfa(tema.color.texto, 0.06) }]} testID="midia-solapas">
      {OPCIONES_SOLAPA.map((o) => {
        const seleccionada = o.valor === activa;
        const cuenta = o.valor !== 'hecha' ? (conteos[o.valor] ?? 0) : 0;
        return (
          <Pressable
            key={o.valor}
            testID={`midia-solapa-${o.valor}`}
            accessibilityRole="button"
            accessibilityState={{ selected: seleccionada }}
            onPress={() => onCambiar(o.valor)}
            hitSlop={{ top: 4, bottom: 4 }}
            style={pressableStyle(styles.solapaPresionable)}
          >
            <View
              style={[
                styles.solapa,
                seleccionada ? [elevacion(tema.color.sombra), { backgroundColor: realce }] : null,
              ]}
            >
              <Text
                numberOfLines={1}
                style={{
                  color: seleccionada ? tema.color.texto : tema.color.textoTenue,
                  fontFamily: seleccionada ? tema.fuente.uiSemibold : tema.fuente.uiMedium,
                  fontSize: tema.tipo.chico + 1,
                }}
              >
                {o.etiqueta}
                {cuenta > 0 && <Text style={{ color: tema.color.textoTenue, fontFamily: tema.fuente.uiMedium }}> {cuenta}</Text>}
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
  const realce = useRealceSeleccion();
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
            {/* Neutros, como el control segmentado (Martin 15/11): el activo es una pastilla blanca apoyada, los
                demás un contorno fino. Son atajos para mirar, no decisiones: la terracota queda para los botones
                de las tarjetas, que sí ejecutan algo (Decisión B). */}
            <View
              style={[
                styles.chip,
                seleccionada
                  ? [elevacion(tema.color.sombra), { backgroundColor: realce, borderColor: realce }]
                  : { borderColor: conAlfa(tema.color.texto, 0.12) },
              ]}
            >
              <Text
                style={{
                  color: seleccionada ? tema.color.texto : tema.color.textoTenue,
                  fontFamily: seleccionada ? tema.fuente.uiSemibold : tema.fuente.uiMedium,
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

/**
 * El aviso de lo crítico (`.alerta` del prototipo): arriba de las solapas porque es transversal a los tres
 * estados. Sólo para `criticidad: 'critico'` — lo que ROMPE el negocio. Sin tarjeta crítica no existe.
 *
 * 🔴 **Nunca sobre negro** (Martin 15/11: «las notificaciones con fondo negro no van»). Es una tarjeta blanca
 * como las demás; la urgencia la dicen el rótulo «Urgente» en rojo y el lugar que ocupa, no un bloque que grita.
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
      style={[styles.alerta, elevacion(tema.color.sombra), { backgroundColor: tema.color.superficie }]}
    >
      {criticas.map((t, i) => (
        <View
          key={t.id}
          testID={`midia-alerta-${t.id}`}
          style={[styles.alertaItem, i > 0 && { borderTopWidth: 1, borderTopColor: conAlfa(tema.color.texto, 0.12) }]}
        >
          <Text style={{ color: tema.color.peligro, fontFamily: tema.fuente.uiSemibold, fontSize: tema.tipo.chico }}>Urgente</Text>
          <Text style={{ color: tema.color.texto, fontFamily: tema.fuente.uiSemibold, fontSize: tema.tipo.base, lineHeight: 22 }}>
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
                onAccion != null
                  ? { backgroundColor: tema.color.acentoSuperficie, borderColor: tema.color.acentoSuperficie, borderRadius: tema.radio.completo }
                  : { borderColor: tema.color.textoTenue, borderRadius: tema.radio.completo },
              ]}
            >
              <Text style={{ color: onAccion != null ? tema.color.acentoTexto : tema.color.textoTenue, fontFamily: tema.fuente.uiSemibold, fontSize: tema.tipo.chico }}>
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
  // Cerrada es un botón, parejo con el «anotar a mano» de las funciones; el campo aparece al tocarlo.
  const [abierta, setAbierta] = useState(false);
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

  if (!abierta) {
    return (
      <View style={styles.alta} testID="midia-alta">
        <BotonAcceso
          testID="midia-alta-abrir"
          icono={<IconoLapiz color={tema.color.acentoTinta} />}
          etiqueta="Anotar algo para hoy"
          onPress={() => setAbierta(true)}
        />
      </View>
    );
  }

  return (
    <View
      ref={refGrupo}
      collapsable={false}
      style={[styles.alta, styles.altaAbierta, elevacion(tema.color.sombra), { backgroundColor: tema.color.superficie, gap: tema.espacio.sm }]}
      testID="midia-alta"
    >
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
          etiqueta: 'Cancelar',
          onPress: () => { setTexto(''); setAbierta(false); },
          variante: 'secundario',
          testID: 'midia-alta-cancelar',
        }, {
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

  /** «Realizado» de una tarjeta manual: derecho a «Hechas», esté en la solapa que esté. */
  async function realizar(t: TarjetaMiDia) {
    const res = await cambiarEstadoTarjetaMiDia(t.id, 'hecha');
    if (res.status === 'ok') {
      void cargar();
      return;
    }
    Alert.alert('No se pudo marcar como realizada', res.status === 'estado_invalido' ? res.motivo : 'Probá de nuevo en un momento.');
  }

  const solapa = tablero?.solapas.find((s) => s.id === solapaActiva) ?? null;
  const tarjetas = solapa != null ? filtrarPorCategoria(solapa.tarjetas, categoria) : [];

  return (
    <MarcoGlass titulo="Tu día" icono="miDia" sinIcono testID="pantalla-tu-dia">
      <ScrollFormulario style={styles.raiz} contentContainerStyle={styles.raizContenido} testID="midia-scroll">
        <Text testID="tudia-subtitulo" style={[styles.subtitulo, { color: tema.color.textoTenue, fontSize: tema.tipo.chico }]}>
          Lo que Odobi detectó y lo que anotaste vos.
        </Text>

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
                {/* Una sola tarjeta con sus filas, como «Para hoy» en Mi día. La sombra va afuera y el recorte
                    adentro: deslizar una fila deja ver sus acciones sin que se salgan de la tarjeta. */}
                <View style={[styles.tarjetaLista, elevacion(tema.color.sombra), { backgroundColor: tema.color.superficie }]}>
                  <View style={styles.recorteLista}>
                {tarjetas.map((t, i) => (
                  <View key={t.id} style={[styles.filaLista, i > 0 && { borderTopWidth: 1, borderTopColor: conAlfa(tema.color.texto, 0.12) }]}>
                  <TarjetaMiDiaRow
                    tarjeta={t}
                    enGrupo
                    manual={{
                      onRealizado: solapaActiva === 'hecha' ? undefined : () => void realizar(t),
                      onBorrar: () => void borrar(t.id),
                    }}
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
                  </View>
                ))}
                  </View>
                </View>
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
  subtitulo: { paddingHorizontal: 20, lineHeight: 20 },
  // La pista del control segmentado: 3 de aire para que la pastilla activa quede apoyada adentro.
  solapas: { flexDirection: 'row', marginHorizontal: 16, marginTop: 24, marginBottom: 16, padding: 3, borderRadius: 12 },
  alta: { paddingHorizontal: 16, paddingTop: 0 },
  altaAbierta: { marginHorizontal: 16, marginTop: 0, padding: 20, borderRadius: 22 },
  // `ScrollView` crece por defecto: con la solapa vacía abría un hueco entre los chips y el alta.
  chipsScroll: { flexGrow: 0 },
  // 10 abajo: lugar para la sombra de la pastilla activa, que el scroll horizontal recortaría.
  chips: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 0, paddingBottom: 16 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 },
  alerta: { marginHorizontal: 16, marginTop: 20, paddingHorizontal: 20, borderRadius: 22 },
  alertaItem: { gap: 8, alignItems: 'flex-start', paddingVertical: 20 },
  alertaAccion: { borderWidth: 1, paddingHorizontal: 16, paddingVertical: 8, marginTop: 6 },
  solapaPresionable: { flex: 1 },
  solapa: { height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 9 },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  lista: { gap: 16, padding: 16, paddingTop: 24, paddingBottom: 120 },
  tarjetaLista: { borderRadius: 22 },
  recorteLista: { borderRadius: 22, overflow: 'hidden', paddingVertical: 2 },
  filaLista: { marginHorizontal: 20 },
});

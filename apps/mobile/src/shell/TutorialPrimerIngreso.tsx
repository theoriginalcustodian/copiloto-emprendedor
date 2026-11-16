import { formatearImporte } from '@copiloto/core';
import { BlurView } from 'expo-blur';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Burbuja } from '../modules/chat/Burbuja';
import { ALTO_COMPOSER_REPOSO } from '../modules/chat/Composer';
import { pressableStyle } from '../theme/glass/presion';
import { useMovimientoReducido } from '../theme/movimientoReducido';
import { useTema } from '../theme/ThemeProvider';
import { ALTO_HANDLE } from './PanelDeslizable';
import { altoPestanaCon } from './PanelFunciones';

/**
 * Tutorial del primer ingreso (Martin 13/11/2026). Reemplaza a la pantalla «Guía» de la configuración:
 * en vez de EXPLICAR la app antes de entrar, la recorre encima de Mi día.
 *
 * 🔴 **Nunca sale de Mi día y no toca las capas reales.** Los dos gestos se muestran con HOJAS DE
 * DEMOSTRACIÓN propias, dibujadas en esta capa:
 *  - **La conversación** sube desde el borde de abajo con una charla de ejemplo. No se usa el panel real
 *    porque, mientras asoma, es transparente (el shell recién le pinta superficie pasada la mitad del
 *    recorrido) y en una cuenta nueva está vacío: lo único que se veía moverse era el campo.
 *  - **Las funciones** bajan desde arriba media pantalla con el contenido FIJO: una persiana que descubre el
 *    título y los accesos, en vez del panel real, que al bajar muestra primero su parte de abajo. Lo que
 *    se ve adentro es el `EscritorioFunciones` de verdad (`muestraFunciones`), no un dibujo.
 * Por eso `PanelDeslizable` y `PanelFunciones` quedan sin ningún cambio.
 *
 * **Vidrio.** Lo que queda fuera de foco se esmerila; lo que el paso nombra queda nítido. En iOS el
 * desenfoque es real (`expo-blur`); en Android no desenfoca de verdad —ver la historia en `CristalVidrio`—,
 * así que ahí el velo y la tarjeta son superficies casi opacas.
 *
 * **Mira y toca «Siguiente».** El tutorial nunca espera a que un gesto «salga», así no puede trabarse. Se
 * salta en cualquier paso. Mientras está visible traga los toques.
 *
 * **Las zonas se calculan, no se miden**, con las constantes del shell. Ojo con una que ya falló: la tira de
 * abajo NO suma el margen seguro inferior (el campo queda a 18 pt del borde); sumarlo dejaba a la vista el
 * «Nada urgente por hoy.» de Mi día dentro de la zona nítida.
 */

interface Paso {
  id: 'midia' | 'hablar' | 'chat' | 'funciones';
  titulo: string;
  cuerpo: string;
}

export const PASOS_TUTORIAL: readonly Paso[] = [
  { id: 'midia', titulo: 'Esto es Mi día', cuerpo: 'Lo primero que ves al entrar: tus avisos y lo que quedó pendiente.' },
  { id: 'hablar', titulo: 'Acá me hablás', cuerpo: 'Escribí lo que necesitás, o mantené apretado el micrófono y decímelo.' },
  { id: 'chat', titulo: 'Deslizá hacia arriba', cuerpo: 'Se abre nuestra conversación. Ahí te muestro cada cosa antes de guardarla.' },
  { id: 'funciones', titulo: 'Deslizá hacia abajo', cuerpo: 'Aparecen tus funciones y, tocando tu inicial, Ajustes.' },
];

/** Cuánto de la pantalla ocupa cada hoja de demostración cuando está abierta. */
const FRACCION_CHAT = 0.36;
/** Alto de la persiana de funciones mientras no se midió su contenido, y su tope una vez medido. */
const FRACCION_FUNCIONES = 0.5;
const TOPE_FUNCIONES = 0.72;
/** Lo que ocupa la barra de agarre al pie de la persiana: 10 de aire, 5 de barra, 10 de aire. */
const ZONA_BARRA = 25;
/** El escritorio termina con 32 pt de aire propio (16 bajo la grilla + 16 de relleno); con la barra justo debajo
 *  sobra. Se recorta parte: quedan 14 pt entre los accesos y la zona de la barra. */
const AIRE_SOBRANTE_ESCRITORIO = 18;
/** La muestra de funciones arranca más arriba que la pantalla real (Martin 13/11): en una persiana que no
 *  ocupa toda la pantalla, el aire de arriba le saca lugar a los accesos. Nunca menos de 12 pt del borde. */
const MENOS_MARGEN_FUNCIONES = 24;

/**
 * Ritmo de cada hoja. Se muestra DOS veces y queda abierta (Martin 13/11: «sólo dos veces, no tres»): abre,
 * se queda para que se lea, cierra, vuelve a abrir y ahí se queda. La de funciones es más lenta y se queda
 * un segundo más: hay que leer una pantalla entera, no una frase.
 */
interface Ritmo {
  /** Cuánto se queda quieta antes de la primera apertura. En la conversación es lo que deja VER la barra. */
  antesMs: number;
  abrirMs: number;
  quietaMs: number;
  cerrarMs: number;
  curva: (t: number) => number;
}
const RITMO_CHAT: Ritmo = { antesMs: 1300, abrirMs: 700, quietaMs: 1700, cerrarMs: 600, curva: Easing.bezier(0.3, 0, 0.2, 1) };
const RITMO_FUNCIONES: Ritmo = { antesMs: 450, abrirMs: 1250, quietaMs: 2700, cerrarMs: 950, curva: Easing.inOut(Easing.cubic) };
const ENTRE_VUELTAS_MS = 800;
/** Cuánto asoma la hoja de la conversación cuando está cerrada: su barra (8 de aire + 5 de alto) y un respiro. */
const ASOMA_BARRA = 22;
const VUELTAS = 2;

export interface TutorialPrimerIngresoProps {
  /** El escritorio real de la app (sin acciones), para la hoja del último paso. */
  muestraFunciones: ReactNode;
  onFin: () => void;
}

export function TutorialPrimerIngreso({ muestraFunciones, onFin }: TutorialPrimerIngresoProps) {
  const tema = useTema();
  const insets = useSafeAreaInsets();
  const { height: altoPantalla } = useWindowDimensions();
  const [indice, setIndice] = useState(0);
  const paso = PASOS_TUTORIAL[indice];
  const ultimo = indice === PASOS_TUTORIAL.length - 1;
  const reducido = useMovimientoReducido();
  // Bordes del shell. Arriba, la pestaña de funciones. Abajo, la tira de la conversación (asa + campo), y
  // dentro de ella sólo el campo y el micrófono: es lo único que el paso «Acá me hablás» deja nítido.
  const altoArriba = altoPestanaCon(insets.top);
  const altoTira = ALTO_HANDLE + ALTO_COMPOSER_REPOSO;
  const altoCampo = ALTO_COMPOSER_REPOSO - 6;
  const altoHojaChat = Math.round(altoPantalla * FRACCION_CHAT);
  // La persiana mide lo que mide su contenido (título + accesos) más la barra: sin espacio de sobra entre
  // los accesos y la barra (Martin 14/11). Hasta que el contenido se mide, media pantalla.
  const [altoFuncionesMedido, setAltoFuncionesMedido] = useState<number | null>(null);
  const altoHojaFunciones =
    altoFuncionesMedido == null
      ? Math.round(altoPantalla * FRACCION_FUNCIONES)
      : Math.min(Math.round(altoFuncionesMedido - AIRE_SOBRANTE_ESCRITORIO + ZONA_BARRA), Math.round(altoPantalla * TOPE_FUNCIONES));

  // Qué queda nítido en cada paso (lo demás se esmerila) y dónde va la tarjeta: pegada a lo que nombra.
  const zona =
    paso.id === 'midia'
      ? { nitidoDesde: altoArriba, nitidoHasta: altoPantalla - altoTira, tarjeta: { bottom: altoTira + 16 }, pico: 'arriba' as const }
      : paso.id === 'hablar'
        ? { nitidoDesde: altoPantalla - altoCampo, nitidoHasta: altoPantalla, tarjeta: { bottom: altoCampo + 16 }, pico: 'abajo' as const }
        : paso.id === 'chat'
          ? { nitidoDesde: altoPantalla - altoCampo, nitidoHasta: altoPantalla, tarjeta: { bottom: altoCampo + altoHojaChat + 16 }, pico: 'abajo' as const }
          : { nitidoDesde: altoPantalla, nitidoHasta: altoPantalla, tarjeta: { top: altoHojaFunciones + 16 }, pico: 'arriba' as const };
  // En el primer paso el velo sólo cubre los bordes; en los demás tapa Mi día y va denso para que lo de
  // atrás no se lea detrás de la tarjeta.
  const denso = paso.id !== 'midia';

  const apertura = useVaiven(paso.id === 'chat' ? RITMO_CHAT : paso.id === 'funciones' ? RITMO_FUNCIONES : null);

  // Entrada de la tarjeta en cada paso: 10 px y aparece.
  const entrada = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (reducido) {
      entrada.setValue(1);
      return;
    }
    entrada.setValue(0);
    Animated.timing(entrada, { toValue: 1, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [indice, entrada, reducido]);

  function siguiente() {
    if (ultimo) onFin();
    else setIndice((i) => i + 1);
  }

  const picoAbajo = zona.pico === 'abajo';

  return (
    <View testID="tutorial" style={StyleSheet.absoluteFill} accessibilityViewIsModal>
      {/* Traga los toques: nadie mueve un panel a mitad del recorrido. */}
      <Pressable testID="tutorial-fondo" style={StyleSheet.absoluteFill} onPress={() => {}} accessible={false} />

      {zona.nitidoDesde > 0 && <Esmerilado testID="tutorial-velo-arriba" denso={denso} style={{ top: 0, height: zona.nitidoDesde }} />}
      {zona.nitidoHasta < altoPantalla && <Esmerilado testID="tutorial-velo-abajo" denso={denso} style={{ top: zona.nitidoHasta, bottom: 0 }} />}

      {paso.id === 'chat' && <HojaChat apertura={apertura} alto={altoHojaChat} desdeAbajo={altoCampo} />}
      {paso.id === 'funciones' && (
        <HojaFunciones
          apertura={apertura}
          alto={altoHojaFunciones}
          margenArriba={Math.max(insets.top - MENOS_MARGEN_FUNCIONES, 12)}
          asomaCerrada={altoArriba - 20}
          onMedir={setAltoFuncionesMedido}
        >
          {muestraFunciones}
        </HojaFunciones>
      )}

      {/* La tarjeta: vidrio OSCURO (en vidrio claro no se distinguía de la pantalla, que es crema con tarjetas
          blancas), compacta, angosta y con un pico que apunta a lo que nombra. Usa los tokens del bloque de
          máximo contraste, que invierten con la piel; no es un `BloqueCifra` —eso sigue reservado a cifras
          del negocio— sino una meta-capa encima de la app, donde la spec admite la isla oscura. */}
      <Animated.View
        testID="tutorial-tarjeta"
        style={[
          styles.tarjeta,
          { shadowColor: tema.color.sombra },
          zona.tarjeta,
          { opacity: entrada, transform: [{ translateY: entrada.interpolate({ inputRange: [0, 1], outputRange: [picoAbajo ? -10 : 10, 0] }) }] },
        ]}
      >
        <View testID="tutorial-pico" style={[styles.pico, { backgroundColor: tema.color.bloque }, picoAbajo ? styles.picoAbajo : styles.picoArriba]} />
        <View style={[styles.vidrio, { borderRadius: tema.radio.md }]}>
          {Platform.OS === 'ios' && <BlurView intensity={40} tint={tema.glass.esLight ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />}
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: tema.color.bloque, opacity: Platform.OS === 'ios' ? 0.84 : 0.97 }]} />
          <View pointerEvents="none" style={[styles.luz, { backgroundColor: tema.color.bloqueTexto, opacity: 0.22 }]} />

          <View style={styles.cuerpoTarjeta}>
            <Text testID="tutorial-titulo" accessibilityRole="header" style={{ color: tema.color.bloqueTexto, fontFamily: tema.fuente.display, fontSize: 19, lineHeight: 24, letterSpacing: -0.3 }}>
              {paso.titulo}
            </Text>
            <Text testID="tutorial-cuerpo" style={{ color: tema.color.bloqueApoyo, fontFamily: tema.fuente.ui, fontSize: 15, lineHeight: 21, marginTop: 4 }}>
              {paso.cuerpo}
            </Text>
            <View style={styles.pie}>
              <View style={styles.progreso} testID="tutorial-progreso" accessible accessibilityLabel={`Paso ${indice + 1} de ${PASOS_TUTORIAL.length}`}>
                {PASOS_TUTORIAL.map((p, i) => (
                  <View key={p.id} style={[styles.tramo, { backgroundColor: i <= indice ? tema.color.acento : tema.color.bloqueChip }]} />
                ))}
              </View>
              <View style={styles.acciones}>
                {!ultimo && (
                  <Pressable testID="tutorial-saltar" accessibilityRole="button" onPress={onFin} hitSlop={12}>
                    <Text style={{ color: tema.color.bloqueApoyo, fontFamily: tema.fuente.uiMedium, fontSize: 14 }}>Saltar</Text>
                  </Pressable>
                )}
                <Pressable
                  testID="tutorial-siguiente"
                  accessibilityRole="button"
                  onPress={siguiente}
                  hitSlop={6}
                  style={pressableStyle([styles.siguiente, { backgroundColor: tema.color.acentoSuperficie, borderRadius: tema.radio.completo }])}
                >
                  <Text style={{ color: tema.color.acentoTexto, fontFamily: tema.fuente.display, fontSize: 15, letterSpacing: -0.2 }}>{ultimo ? 'Listo' : 'Siguiente'}</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

/**
 * El vaivén de las hojas: 0 = cerrada, 1 = abierta. Dos veces, y la segunda queda abierta.
 *
 * 🔴 Corre también con «Reducir movimiento» (Martin lo tiene activado y no veía nada). Regla de
 * `movimientoReducido.ts`: ese ajuste apaga lo que DECORA, no lo que INFORMA, y acá el movimiento es el
 * dato (hacia dónde se desliza y qué aparece). Lo que se respeta por diseño: no es un bucle.
 */
function useVaiven(ritmo: Ritmo | null): Animated.Value {
  const apertura = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    apertura.setValue(0);
    if (ritmo == null) return undefined;
    const nativo = { useNativeDriver: true };
    const abrir = () => Animated.timing(apertura, { toValue: 1, duration: ritmo.abrirMs, easing: ritmo.curva, ...nativo });
    const cerrar = () => Animated.timing(apertura, { toValue: 0, duration: ritmo.cerrarMs, easing: ritmo.curva, ...nativo });
    const pasos: Animated.CompositeAnimation[] = [Animated.delay(ritmo.antesMs)];
    for (let i = 1; i <= VUELTAS; i += 1) {
      pasos.push(abrir());
      if (i < VUELTAS) pasos.push(Animated.delay(ritmo.quietaMs), cerrar(), Animated.delay(ENTRE_VUELTAS_MS));
    }
    const secuencia = Animated.sequence(pasos);
    secuencia.start();
    return () => secuencia.stop();
  }, [ritmo, apertura]);
  return apertura;
}

/** Una franja fuera de foco: vidrio esmerilado sobre la app real. */
function Esmerilado({ style, testID, denso = false }: { style: object; testID: string; denso?: boolean }) {
  const tema = useTema();
  const ios = Platform.OS === 'ios';
  return (
    <View testID={testID} pointerEvents="none" style={[styles.franja, style]}>
      {ios && <BlurView intensity={denso ? 38 : 14} tint={tema.glass.esLight ? 'light' : 'dark'} style={StyleSheet.absoluteFill} />}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: tema.color.bloque, opacity: ios ? (denso ? 0.3 : 0.16) : denso ? 0.62 : 0.42 }]} />
    </View>
  );
}

/**
 * La conversación, de muestra. Una hoja que SUBE desde encima del campo, con su asa y una charla de ejemplo:
 * lo que dice la persona (con la `Burbuja` real del chat) y la tarjeta que Odobi le arma para confirmar.
 * La frase es, letra por letra, un `ejemplo` de `registrar_gasto` en el `tool_catalog.py` del backend.
 */
function HojaChat({ apertura, alto, desdeAbajo }: { apertura: Animated.Value; alto: number; desdeAbajo: number }) {
  const tema = useTema();
  // Cerrada no desaparece: queda asomando lo justo para que se vea la BARRA, sola, encima del campo — el
  // lugar de donde se tira (Martin 14/11). El papel de la hoja y la charla aparecen recién al empezar a subir.
  const cuerpo = apertura.interpolate({ inputRange: [0, 0.07, 1], outputRange: [0, 1, 1] });
  return (
    <View testID="tutorial-hoja-chat" pointerEvents="none" style={[styles.ventana, { bottom: desdeAbajo, height: alto }]}>
      <Animated.View style={[styles.hoja, { height: alto, transform: [{ translateY: apertura.interpolate({ inputRange: [0, 1], outputRange: [alto - ASOMA_BARRA, 0] }) }] }]}>
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            { opacity: cuerpo, backgroundColor: tema.color.fondo, borderTopLeftRadius: tema.radio.lg, borderTopRightRadius: tema.radio.lg, borderColor: tema.glass.bd, borderTopWidth: 1 },
          ]}
        />
        <View testID="tutorial-barra" style={[styles.asa, { backgroundColor: tema.color.texto, opacity: 0.42 }]} />
        <Animated.View style={{ opacity: cuerpo }}>
          <Text style={[styles.rotuloEjemplo, { color: tema.color.textoTenue, fontFamily: tema.fuente.uiMedium, fontSize: tema.tipo.chico }]}>Un ejemplo</Text>
          <View style={{ paddingHorizontal: tema.espacio.md, gap: tema.espacio.sm }}>
            <Burbuja role="user" text="Pagué 15 mil de mercadería" />
            <View style={[styles.tarjetaEjemplo, { backgroundColor: tema.color.superficie, borderRadius: tema.radio.md, padding: tema.espacio.md }]}>
              <Text style={{ color: tema.color.textoTenue, fontFamily: tema.fuente.ui, fontSize: tema.tipo.chico }}>Gasto para confirmar</Text>
              <Text style={{ color: tema.color.texto, fontFamily: tema.fuente.display, fontSize: 26, lineHeight: 32, letterSpacing: -0.5 }}>{formatearImporte('15000')}</Text>
              <Text style={{ color: tema.color.texto, fontFamily: tema.fuente.ui, fontSize: 15, lineHeight: 21 }}>Mercadería · Hoy</Text>
            </View>
          </View>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

/**
 * Las funciones, de muestra. Una persiana que BAJA desde arriba con el contenido FIJO: la ventana se
 * desplaza y lo de adentro se contra-desplaza lo mismo, así el título y los accesos no se mueven en la
 * pantalla — se van descubriendo. (El panel real, al bajar, muestra primero su parte de abajo.)
 */
function HojaFunciones({
  apertura,
  alto,
  margenArriba,
  asomaCerrada,
  onMedir,
  children,
}: {
  apertura: Animated.Value;
  alto: number;
  margenArriba: number;
  /** Cuánto asoma cerrada: lo justo para que la BARRA quede donde está la pestaña real de la app. */
  asomaCerrada: number;
  onMedir: (altoContenido: number) => void;
  children: ReactNode;
}) {
  const tema = useTema();
  // Cerrada no desaparece: deja ver la barra, sola, arriba — el lugar de donde se tira (igual que en el paso
  // de la conversación). El papel de la persiana y su contenido aparecen recién cuando empieza a bajar.
  const cerrado = apertura.interpolate({ inputRange: [0, 1], outputRange: [-alto + asomaCerrada, 0] });
  const contra = apertura.interpolate({ inputRange: [0, 1], outputRange: [alto - asomaCerrada, 0] });
  const cuerpo = apertura.interpolate({ inputRange: [0, 0.07, 1], outputRange: [0, 1, 1] });
  return (
    <Animated.View testID="tutorial-hoja-funciones" pointerEvents="none" style={[styles.persiana, { height: alto, transform: [{ translateY: cerrado }] }]}>
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { opacity: cuerpo, backgroundColor: tema.color.fondo, borderBottomLeftRadius: tema.radio.lg, borderBottomRightRadius: tema.radio.lg, borderColor: tema.glass.bd, borderBottomWidth: 1 },
        ]}
      />
      <Animated.View style={[styles.contenidoFijo, { opacity: cuerpo, transform: [{ translateY: contra }] }]}>
        {/* Se mide el contenido real para que la persiana termine justo debajo de los accesos. */}
        <View style={{ paddingTop: margenArriba }} onLayout={(e) => onMedir(e.nativeEvent.layout.height)}>
          {children}
        </View>
      </Animated.View>
      <View testID="tutorial-barra-funciones" style={[styles.asa, styles.asaAbajo, { backgroundColor: tema.color.texto, opacity: 0.42 }]} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  franja: { position: 'absolute', left: 0, right: 0, overflow: 'hidden' },
  tarjeta: { position: 'absolute', alignSelf: 'center', width: '82%', maxWidth: 330, shadowOpacity: 0.28, shadowRadius: 22, shadowOffset: { width: 0, height: 10 }, elevation: 14 },
  vidrio: { overflow: 'hidden' },
  cuerpoTarjeta: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 14 },
  pico: { position: 'absolute', alignSelf: 'center', width: 16, height: 16, borderRadius: 3, transform: [{ rotate: '45deg' }], opacity: 0.92 },
  picoAbajo: { bottom: -6 },
  picoArriba: { top: -6 },
  pie: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 },
  acciones: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  luz: { position: 'absolute', top: 0, left: 0, right: 0, height: 1.5 },
  progreso: { flexDirection: 'row', gap: 4 },
  tramo: { width: 14, height: 3, borderRadius: 2 },
  siguiente: { height: 36, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  ventana: { position: 'absolute', left: 0, right: 0, overflow: 'hidden' },
  hoja: { position: 'absolute', left: 0, right: 0, top: 0, overflow: 'hidden' },
  asa: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, marginTop: 8 },
  asaAbajo: { position: 'absolute', bottom: 10, marginTop: 0 },
  rotuloEjemplo: { textAlign: 'center', marginTop: 10, marginBottom: 10 },
  tarjetaEjemplo: { alignSelf: 'flex-start', minWidth: '62%', gap: 2 },
  persiana: { position: 'absolute', left: 0, right: 0, top: 0, overflow: 'hidden' },
  contenidoFijo: { position: 'absolute', left: 0, right: 0, top: 0 },
});

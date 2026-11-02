import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';

import {
  cambiarEstadoTarjetaMiDia,
  estadoDeServicio,
  fechaDeHoyMidia,
  horaDeEvento,
  KEY_GOOGLE_CALENDAR,
  leerCalendario,
  hayConexionCaida,
  leerPortada,
  listarCatalogo,
  type AvisoAlChat,
  type CalendarioMiDia,
  type EstadoConexion,
  type EventoCalendario,
  type Portada,
} from '@copiloto/core';

import { AvatarCuenta } from './AvatarCuenta';
import type { RutaDestino } from './destinoTarjeta';
import { PortadaNegocio } from './PortadaNegocio';
import { TarjetaMiDiaRow } from './TarjetaMiDiaRow';
import { useTableroMiDia, type EstadoLista } from './useTableroMiDia';
import { EstadoVacio } from '../../theme/EstadoVacio';
import { ScrollFormulario } from '../../theme/glass/campos';
import { PRESS_FADE, pressableStyle } from '../../theme/glass/presion';
import { useTema } from '../../theme/ThemeProvider';

/**
 * `PantallaMiDia` — la base de la app: *«el copiloto habla primero»*. Se lee de reojo, en el orden en que se
 * decide una mañana (`index.html:1251`): cuánto tengo, qué tengo ahora, qué tengo que hacer hoy.
 *
 * 🔴 **Resume, no gestiona (SM-I1).** Las solapas, los chips, el alta a mano, el swipe y el banner crítico
 * viven en Tu día (`PantallaTuDia`), detrás de «Ver tablero ›». Sin banner a propósito: acá la prioridad la
 * dice la tarjeta, con su chip y su acción (`index.html:1439`).
 *
 * 🔴 **La primera tarjeta arranca abierta** (`.ex.on`, `index.html:1668`): lo primero que hay que hacer se
 * lee sin tocar nada. Cerrarla es una decisión del emprendedor y se respeta: `undefined` es «todavía no
 * tocó», `null` es «cerró todo».
 *
 * 🔴 **Se relee al recuperar el FOCO, no sólo al montar:** una tarjeta puede morir por una acción hecha en
 * OTRA pantalla (cobrar una factura en Facturación, moverla en Tu día), y si esta pantalla sólo cargara al
 * montar, el emprendedor volvería a ver una tarjeta que ya resolvió.
 */

export interface PantallaMiDiaProps {
  /** Tocar el avatar, la única puerta a Ajustes. La navegación la cablea el shell. */
  onAjustes?: () => void;
  /** BL-J13: abre la agenda de varios días. La cablea el shell (`empujarUnaVez`); sin él no hay entrada. */
  onAgenda?: () => void;
  /** SM-I1: abre Tu día. La cablea el shell (`empujarUnaVez`). */
  onVerTablero?: () => void;
  /**
   * H5b — abre la pantalla a la que apunta `destino` (la conexión, el comprobante, AFIP: ver
   * `rutaDeDestino`). Recibe la ruta YA resuelta; a qué pantalla de la app corresponde lo decide el
   * shell (`hrefDeRuta` + `empujarUnaVez`). Sin él la acción de `presentacion` queda como rótulo.
   */
  onDestino?: (ruta: RutaDestino) => void;
  /**
   * `hitl (a)` — el puente tarjeta → chat (C-D5 Opción A). Tocar el verbo de una tarjeta detectada lleva su
   * aviso al chat principal, **sembrado en el composer**. Lo cablea el shell, porque el chat vive en la
   * misma pantalla que la base.
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

/** La hora de la sección «Ahora». */
function horaActual(): string {
  const ahora = new Date();
  return `${String(ahora.getHours()).padStart(2, '0')}:${String(ahora.getMinutes()).padStart(2, '0')}`;
}

/**
 * Se relee sola: la pantalla base queda abierta horas, y un «Ahora 16:12» a las 16:40 es un dato falso.
 * Cada 15 s y no cada 60: el timer no arranca alineado al minuto. Si la hora es la misma, React no redibuja.
 */
function useHoraActual(): string {
  const [hora, setHora] = useState(horaActual);
  useEffect(() => {
    const id = setInterval(() => setHora(horaActual()), 15_000);
    return () => clearInterval(id);
  }, []);
  return hora;
}

/** El rótulo de sección del prototipo (`.sec`): título, un dato al lado y, a la derecha, su puerta. */
function Seccion({
  titulo,
  dato,
  enlace,
}: {
  titulo: string;
  dato?: { texto: string; testID: string };
  enlace?: { texto: string; testID: string; onPress: () => void };
}) {
  const tema = useTema();
  return (
    <View style={styles.seccion}>
      <View style={styles.seccionTitulo}>
        <Text style={{ color: tema.color.texto, fontFamily: tema.fuente.display, fontSize: tema.tipo.grande }}>{titulo}</Text>
        {dato != null && (
          <Text testID={dato.testID} style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico }}>
            {dato.texto}
          </Text>
        )}
      </View>
      {enlace != null && (
        <Pressable
          testID={enlace.testID}
          accessibilityRole="button"
          accessibilityLabel={enlace.texto}
          onPress={enlace.onPress}
          hitSlop={8}
          style={pressableStyle(undefined, PRESS_FADE)}
        >
          <Text style={{ color: tema.color.acentoTinta, fontFamily: tema.fuente.uiMedium, fontSize: tema.tipo.chico }}>
            {enlace.texto} ›
          </Text>
        </Pressable>
      )}
    </View>
  );
}

export function PantallaMiDia({
  onAjustes,
  onAgenda,
  onVerTablero,
  onDestino,
  onAvisoAlChat,
  cierreDeAviso = null,
}: PantallaMiDiaProps = {}) {
  const hora = useHoraActual();
  const tema = useTema();
  const { estado, tablero, cargar, borrar } = useTableroMiDia();
  // `undefined`: no tocó nada, va abierta la primera. `null`: cerró la que estaba abierta.
  const [expandida, setExpandida] = useState<string | null | undefined>(undefined);
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
      void cargarCalendario();
      void cargarPortada();
      void cargarSaludConexiones();
      return () => {
        vivo.current = false;
      };
    }, [cargarCalendario, cargarPortada, cargarSaludConexiones]),
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

  const paraHoy = tablero?.solapas.find((s) => s.id === 'para_hoy')?.tarjetas ?? [];
  const abierta = expandida === undefined ? (paraHoy[0]?.id ?? null) : expandida;

  return (
    <View style={styles.portadaRaiz} testID="pantalla-midia">
      {/* 🔴 UN solo scroll para TODA la pantalla (DEVICE15 `tablero`, «viewport útil ≈120 dp»): lo único fijo
          arriba es el asidero del panel, que es el control del gesto y no un dato. */}
      <ScrollFormulario style={styles.raiz} contentContainerStyle={styles.raizContenido} testID="midia-scroll">
        <View style={styles.encabezadoPortada}>
          <AvatarCuenta avisa={conexionCaida} onPress={onAjustes} />
        </View>

        {/* La tarjeta de cabecera (`.stack`, `index.html:102`): blanca, detrás del bloque negro, y asoma con
            el wordmark y la fecha, así los números quedan fechados dentro del objeto que los muestra. La
            portada no se dibuja si no cargó —Mi día sigue sirviendo sin ella—, y la cabecera sí. */}
        <View style={styles.pila}>
          <View
            testID="midia-cabecera"
            style={[
              styles.cabecera,
              portada == null && styles.cabeceraSola,
              { backgroundColor: tema.color.superficieAlta, borderRadius: tema.radio.lg },
            ]}
          >
            <Text
              testID="midia-wordmark"
              style={{ color: tema.color.acentoTinta, fontFamily: tema.fuente.display, fontSize: tema.tipo.grande }}
            >
              Odobi
            </Text>
            {/* BL-W11 fila 4a: fecha de hoy, sin hora. */}
            <Text testID="midia-fecha" style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico }}>
              {fechaDeHoyMidia()}
            </Text>
          </View>
          {portada != null && <PortadaNegocio portada={portada} />}
        </View>

        {/* Un calendario que no está listo (o que falló) se omite entero, rótulo incluido: no compite por
            atención con lo que sí tiene evidencia detrás. */}
        {estadoCalendario === 'ok' && (
          <>
            <Seccion
              titulo="Ahora"
              dato={{ texto: hora, testID: 'midia-hora' }}
              // AGCAID: con la conexión CAÍDA no hay agenda que mostrar -- mismo criterio que la web
              // (MidiaScreen.tsx). Con `nunca_conectado` sigue visible.
              enlace={
                onAgenda != null && estadoGoogleCalendar !== 'caido'
                  ? { texto: 'Ver agenda', testID: 'midia-ver-agenda', onPress: onAgenda }
                  : undefined
              }
            />
            <PanelCalendario estado={estadoCalendario} calendario={calendario} estadoConexion={estadoGoogleCalendar} />
          </>
        )}

        {/* El rótulo queda SIEMPRE, también vacío o sin cargar (`index.html:3739`): la puerta al tablero no
            puede depender de que haya algo para hoy, porque ahí también se anota. */}
        <Seccion
          titulo="Para hoy"
          dato={
            paraHoy.length > 0
              ? { texto: `${paraHoy.length} ${paraHoy.length === 1 ? 'cosa' : 'cosas'}`, testID: 'midia-para-hoy-cuenta' }
              : undefined
          }
          enlace={onVerTablero != null ? { texto: 'Ver tablero', testID: 'midia-ver-tablero', onPress: onVerTablero } : undefined}
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

        {estado === 'ok' && paraHoy.length === 0 && (
          <View style={styles.centro}>
            {/* El vacío es una buena noticia y la ilustración la celebra. */}
            <EstadoVacio
              testID="midia-vacio"
              ilustracion
              titulo="Nada urgente por hoy."
              cuerpo="Cuando haya algo que mirar, te lo dejo acá. Si querés saber algo, preguntame."
            />
          </View>
        )}

        {estado === 'ok' && paraHoy.length > 0 && (
          <View style={styles.lista} testID="midia-para-hoy">
            {paraHoy.map((t) => (
              <TarjetaMiDiaRow
                key={t.id}
                tarjeta={t}
                expandida={abierta === t.id}
                onPress={() => setExpandida(abierta === t.id ? null : t.id)}
                onAccion={onDestino}
                onAviso={onAvisoAlChat}
                onBorrar={() => void borrar(t.id)}
              />
            ))}
          </View>
        )}
      </ScrollFormulario>
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

  const contenido = () => {
    if (!calendario.conectado) {
      return estadoConexion === 'caido' ? (
        <Text testID="midia-calendario-caida" style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico }}>
          Se cayó la conexión con Google Calendar. Reconectala en Ajustes → Apps para volver a ver
          tus eventos de hoy.
        </Text>
      ) : (
        <Text testID="midia-calendario-no-conectado" style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico }}>
          Conectá Google Calendar en Ajustes → Apps para ver acá tus eventos de hoy.
        </Text>
      );
    }
    if (calendario.eventos.length === 0) {
      return (
        <Text testID="midia-calendario-vacio" style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico }}>
          Sin eventos en tu calendario hoy.
        </Text>
      );
    }
    return (
      <View testID="midia-calendario">
        {calendario.eventos.map((ev: EventoCalendario, i: number) => {
          const hora = horaDeEvento(ev.inicioCrudo);
          return (
            <View
              key={ev.id}
              style={[styles.calendarioEvento, i > 0 && { borderTopWidth: 1, borderTopColor: tema.color.borde }]}
              testID={`midia-calendario-evento-${ev.id}`}
            >
              <Text style={[styles.calendarioHora, { color: tema.color.textoTenue, fontSize: tema.tipo.chico }]}>{hora ?? ''}</Text>
              <Text
                style={{ color: tema.color.texto, fontFamily: tema.fuente.uiMedium, fontSize: tema.tipo.base, flexShrink: 1 }}
                numberOfLines={1}
              >
                {ev.titulo}
              </Text>
            </View>
          );
        })}
      </View>
    );
  };

  return (
    <View style={[styles.calendario, { backgroundColor: tema.color.superficieAlta, borderRadius: tema.radio.md }]}>
      {contenido()}
    </View>
  );
}

const styles = StyleSheet.create({
  // La pantalla se pega al borde superior real: el `paddingTop` es el del prototipo para que el avatar quede
  // debajo del reloj sin pedirle safe-area a un componente que no la conoce.
  portadaRaiz: { flex: 1, paddingTop: 58 },
  encabezadoPortada: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 16, paddingBottom: 8 },
  raiz: { flex: 1 },
  raizContenido: { flexGrow: 1, paddingBottom: 120 },
  // `.stack`: la cabecera mide lo que asoma (52) más un tramo que queda tapado por el bloque negro, para que
  // su borde inferior no se vea recortado.
  pila: { marginHorizontal: 16, paddingTop: 52 },
  cabecera: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 104,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  cabeceraSola: { height: 52, position: 'relative', marginTop: -52 },
  seccion: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 8,
  },
  seccionTitulo: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  calendario: { marginHorizontal: 16, paddingHorizontal: 16, paddingVertical: 8 },
  calendarioEvento: { flexDirection: 'row', gap: 12, alignItems: 'baseline', paddingVertical: 10 },
  calendarioHora: { width: 42 },
  centro: { alignItems: 'center', justifyContent: 'center', padding: 24 },
  lista: { gap: 8, paddingHorizontal: 16 },
});

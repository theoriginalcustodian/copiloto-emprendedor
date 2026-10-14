import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Keyboard, KeyboardAvoidingView, StyleSheet, Text, View } from 'react-native';
import type { FlatList } from 'react-native-gesture-handler';

import {
  SOPORTE_ADJUNTO_SIN_TICKET,
  SOPORTE_ADJUNTO_SIN_TICKET_TITULO,
  SOPORTE_PLACEHOLDER,
  SOPORTE_PRESENTACION,
  SOPORTE_QUE_VIAJA,
  SOPORTE_QUIEN,
  SOPORTE_TIEMPO_RESPUESTA,
  type FuncionSoporte,
} from '@copiloto/core';

import { Onda } from '../captura/Onda';
import { useSession } from '../auth/useSession';
import { BarraSostenida, PistasGestoVoz } from '../chat/PistasVoz';
import { BotonVoz } from '../chat/BotonVoz';
import { Composer } from '../chat/Composer';
import { ControlesFlotantes } from '../chat/ControlesFlotantes';
import { ListaMensajes } from '../chat/ListaMensajes';
import { useCapturaFoto } from '../chat/useCapturaFoto';
import { useVozComando } from '../chat/useVozComando';
import { empujarUnaVez, reabrirNavegacion } from '../../navegacion/empujarUnaVez';
import { Marca } from '../../theme/Marca';
import { MarcoGlass } from '../../theme/glass/MarcoGlass';
import { useTema } from '../../theme/ThemeProvider';
import { TarjetaTicketSoporte } from './TarjetaTicketSoporte';
import { useChatSoporte } from './useChatSoporte';
import { useTicketsSoporte } from './useTicketsSoporte';

/** Soporte no tiene ejemplos propios (el prototipo arranca el hilo con mensajes y sólo invita con el campo
 *  «Contame qué pasó…»): `[]` = el vacío no monta el rodillo, en vez de heredar los de gasto/cobro. */
const SIN_EJEMPLOS: readonly string[] = [];

const TITULO: Record<FuncionSoporte, string> = {
  soporte_tecnico: 'Soporte técnico',
  como_uso_la_app: 'Cómo uso la app',
};

/** Puerto literal de `useTecladoVisible` en `modules/chat/ChatView.tsx` -- mismo porqué (esconder
 *  el botón de voz mientras se escribe), ver su docstring. */
function useTecladoVisible(): boolean {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const alMostrar = Keyboard.addListener('keyboardDidShow', () => setVisible(true));
    const alOcultar = Keyboard.addListener('keyboardDidHide', () => setVisible(false));
    return () => {
      alMostrar.remove();
      alOcultar.remove();
    };
  }, []);
  return visible;
}

export interface PantallaSoporteProps {
  /** Fija para toda la vida de la pantalla — dos entradas separadas en `PantallaCuenta` la fijan de
   * antemano (ver el docstring de `useChatSoporte` sobre por qué no cambia a mitad de conversación). */
  funcion: FuncionSoporte;
}

/**
 * `PantallaSoporte` — SOP5, el chat de soporte embebido en la app.
 *
 * Reusa `ListaMensajes`/`Composer` de `modules/chat/` **tal cual** — son genéricos de
 * presentación (no saben de negocio ni de soporte, sólo de `ChatMessage`/`SendStatus`), mismo
 * criterio que el propio contrato SOP5 pide para el backend del lado del cliente: no reinventar lo
 * que ya funciona. Lo que SÍ es propio: `useChatSoporte`, que apunta a `/soporte/chat` en vez de
 * `/chat` — ver su docstring.
 *
 * **Voz (ODOBI8 §C2)** — `BotonVoz`/`ControlesFlotantes`/`useVozComando`, MISMO patrón que
 * `modules/chat/ChatView.tsx` (hold-graba/soltar-envía/deslizar-fija, `scrollRef` compuesto contra
 * el scroll de `ListaMensajes`, `Onda` como único feedback visual mientras graba). Reusa esos
 * componentes/hooks TAL CUAL — son genéricos del gesto, no saben de negocio ni de soporte; lo único
 * propio es `useChatSoporte().enviarAudio`, que namespacea por `funcion` (ver su docstring).
 *
 * ⚠️ **Deuda declarada (DoD §F4, dueño frontend):** el DoD pide una ventana DISCRETA ("al estilo de
 * las apps del rubro", no una pantalla completa) — esta pantalla hoy es una ruta dedicada de
 * `expo-router`, no un widget flotante. Funciona end-to-end contra el shape real del backend; la
 * forma de presentación queda pendiente de un rediseño a sheet/modal, no de este fix.
 */
export function PantallaSoporte({ funcion }: PantallaSoporteProps) {
  const tema = useTema();
  const { me } = useSession();
  const { estado, send, enviarAudio } = useChatSoporte(me?.cliente_id ?? '', funcion);
  const tickets = useTicketsSoporte(estado?.sendStatus ?? 'idle');
  const captura = useCapturaFoto();
  const voz = useVozComando();
  const tecladoVisible = useTecladoVisible();
  const scrollRef = useRef<FlatList>(null);
  const [fijado, setFijado] = useState(false);
  const [cancelando, setCancelando] = useState(false);
  const [cerca, setCerca] = useState(false);

  // `voz` es un objeto NUEVO en cada render (niveles cambia ~10 veces/seg mientras graba) -- un
  // `useCallback` que lo tomara como dependencia se recrearía a la misma frecuencia, y con él el
  // `useMemo` del gesto compuesto de `BotonVoz` (causa raíz real de ODOBI8-C: sin esa estabilidad,
  // el recognizer se re-ataca en pleno LongPress y pierde el estado -- ver hallazgo2 en
  // `coordinacion/`). Mismo patrón que `estadoRef` en `useChatSoporte`: un ref espejo, actualizado
  // síncronamente en cada render, para leer el valor vigente sin declarar `voz` como dependencia.
  const vozRef = useRef(voz);
  vozRef.current = voz;

  // Misma puerta que ChatView: al volver `voz.fase` a `inactivo`, la próxima grabación arranca sin
  // fijar.
  useEffect(() => {
    if (voz.fase === 'inactivo') setFijado(false);
  }, [voz.fase]);

  const manejarEnvio = useCallback((text: string) => void send(text, { kind: 'text' }), [send]);

  // El chat de soporte no tiene gates de negocio (confirm/cancel) hoy — `ListaMensajes` exige el
  // callback igual porque es genérico; si el agente alguna vez devuelve un `choice`, esto ya lo
  // enruta como un turno más en vez de perderlo en silencio.
  const manejarEleccion = useCallback(
    (value: string) => void send(value, { kind: 'callback' }),
    [send],
  );

  const alIniciarVoz = useCallback(() => {
    void (async () => {
      const ok = await vozRef.current.iniciar();
      if (!ok) {
        Alert.alert(
          'Sin acceso al micrófono',
          'Activá el permiso de micrófono en Ajustes para dictarle al copiloto por voz.',
        );
      }
    })();
  }, []);

  // Mismo criterio que `alEnviarVoz` de ChatView: un solo lugar decide qué es "mandar el audio",
  // sea por soltar sin fijar o por el botón Enviar de los controles flotantes. Lee todo vía
  // `vozRef` (no `voz` directo) para que esta función quede referencialmente ESTABLE -- ver el
  // comentario de `vozRef` arriba.
  const alEnviarVoz = useCallback(async () => {
    const actual = vozRef.current;
    if (actual.fase === 'grabando' || actual.fase === 'pausado') {
      await actual.detener();
    }
    const audio = actual.tomar();
    if (audio === null) return; // no llegó a grabar nada
    void enviarAudio(audio);
  }, [enviarAudio]);

  const onSoltarSinFijarVoz = useCallback(() => void alEnviarVoz(), [alEnviarVoz]);
  const onFijarVoz = useCallback(() => setFijado(true), []);
  // BL-D2: deslizar a la izquierda / toque corto descarta lo grabado sin enviarlo.
  const onCancelarVoz = useCallback(() => void vozRef.current.descartar(), []);

  // §E: el clip adjunta a UN ticket (`POST /soporte/tickets/{id}/adjuntos`), no a la conversación. Sin un
  // ticket en curso no hay a dónde mandar la foto, y aceptarla para perderla sería peor que decirlo.
  const { vigente, adjuntarFoto, adjuntando } = tickets;
  const alAdjuntarFoto = useCallback(() => {
    if (adjuntando) return; // un upload a la vez: el clip sigue visible, sólo no dispara otro
    if (vigente === null) {
      Alert.alert(SOPORTE_ADJUNTO_SIN_TICKET_TITULO, SOPORTE_ADJUNTO_SIN_TICKET);
      return;
    }
    void (async () => {
      const archivo = await captura.elegir();
      if (archivo !== null) await adjuntarFoto(archivo);
    })();
  }, [vigente, captura, adjuntarFoto, adjuntando]);

  // Esta pantalla ya fue abierta con `empujarUnaVez` (la puerta quedó cerrada hasta que el lanzador
  // recupere el foco), así que abrir el ticket desde acá la reabre primero: es un toque deliberado
  // dentro de la pantalla, y `empujarUnaVez` la vuelve a cerrar de forma síncrona contra el doble toque.
  const abrirTicket = useCallback((ticketId: number) => {
    reabrirNavegacion();
    empujarUnaVez({ pathname: '/soporte-ticket', params: { ticketId: String(ticketId) } });
  }, []);

  const ondaVisible = voz.fase === 'grabando' || voz.fase === 'pausado';
  // PISTAFIJARSOPORTE: la pista del candado es la ALTERNATIVA que exige WCAG 2.5.1 al mantener apretado;
  // sin ella el gesto de fijar no tiene cartel (mismo cableado que `ChatView`/`MicFuncion`).
  const pistasVisibles = voz.fase === 'grabando' || cancelando;
  // G3: la barra del composer cede su lugar a la de grabación (misma transformación que `ChatView`).
  const enCaptura = voz.fase !== 'inactivo';

  return (
    <MarcoGlass
      titulo={TITULO[funcion]}
      icono="soporte"
      testID="pantalla-soporte"
      /**
       * 🔴 **La presentación de quién contesta, con el isotipo como avatar** (2026-09-18, Martin).
       * El prototipo traía un escudo genérico y no representaba a nadie: ni marca ni persona, y a 38
       * px se leía como un ícono de seguridad. El avatar dice **de qué producto es este chat**; que
       * del otro lado conteste el equipo se dice con PALABRAS —«Soporte de Odobi», «si no lo puedo
       * resolver, abro un ticket y lo sigue una persona»—, que es donde ese matiz se entiende.
       *
       * Va en `encabezadoExtra` (fijo, fuera del scroll) y no como primer mensaje del hilo: no es un
       * mensaje, es quién es el interlocutor — y si scrolleara, desaparecería justo cuando la
       * conversación se hace larga y uno duda de con quién está hablando.
       */
      encabezadoExtra={
        <View style={styles.presentacion}>
          <Marca size={38} tono="tinta" />
          <View style={styles.presentacionTextos}>
            <Text
              testID="soporte-quien"
              style={{ color: tema.color.texto, fontFamily: tema.fuente.uiSemibold, fontSize: tema.tipo.base }}
            >
              {SOPORTE_QUIEN}
            </Text>
            <Text style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico, lineHeight: 18 }}>
              {SOPORTE_PRESENTACION}
            </Text>
            <Text
              testID="soporte-detalle"
              style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico, lineHeight: 18 }}
            >
              {SOPORTE_TIEMPO_RESPUESTA} {SOPORTE_QUE_VIAJA}
            </Text>
          </View>
        </View>
      }
    >
      <KeyboardAvoidingView testID="soporte-view" behavior="padding" style={styles.contenedor}>
        <ListaMensajes
          ref={scrollRef}
          messages={estado?.messages ?? []}
          sendStatus={estado?.sendStatus}
          onChoice={manejarEleccion}
          ejemplos={SIN_EJEMPLOS}
          vacio="ninguno"
          pie={
            <TarjetaTicketSoporte
              vigente={tickets.vigente}
              anteriores={tickets.anteriores}
              cantidadAnteriores={tickets.cantidadAnteriores}
              respuestaEstimada={tickets.respuestaEstimada}
              aviso={tickets.aviso}
              onAbrirTicket={abrirTicket}
            />
          }
        />

        {!fijado && (
          <View
            testID="overlay-voz-soporte"
            style={[styles.overlayVoz, tecladoVisible && styles.oculto]}
            pointerEvents={tecladoVisible ? 'none' : 'box-none'}
          >
            {ondaVisible && (
              <View testID="onda-flotante" style={styles.ondaFlotante} pointerEvents="none">
                <Onda niveles={voz.niveles} />
              </View>
            )}
            {pistasVisibles && <PistasGestoVoz cancelando={cancelando} cerca={cerca} />}
            <BotonVoz
              onIniciar={alIniciarVoz}
              onSoltarSinFijar={onSoltarSinFijarVoz}
              onFijar={onFijarVoz}
              onCancelar={onCancelarVoz}
              onCancelando={setCancelando}
              onCerca={setCerca}
              disabled={voz.fase !== 'inactivo'}
              scrollRef={scrollRef}
            />
          </View>
        )}

        {enCaptura && !fijado && <BarraSostenida segundos={voz.segundos} cancelando={cancelando} />}
        {fijado && (
          <ControlesFlotantes
            fase={voz.fase}
            segundos={voz.segundos}
            niveles={voz.niveles}
            alPausar={voz.pausar}
            alReanudar={voz.reanudar}
            alEnviar={() => void alEnviarVoz()}
            alEliminar={() => void voz.descartar()}
          />
        )}

        <View style={enCaptura ? styles.oculto : undefined}>
          <Composer
            motivoFallo={estado?.motivoFallo ?? null}
            sendStatus={estado?.sendStatus ?? 'idle'}
            onSend={manejarEnvio}
            disabled={estado === null}
            placeholder={SOPORTE_PLACEHOLDER}
            onFoto={alAdjuntarFoto}
          />
        </View>
      </KeyboardAvoidingView>
    </MarcoGlass>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1 },
  presentacion: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingHorizontal: 16, paddingBottom: 12 },
  presentacionTextos: { flex: 1, gap: 2 },
  overlayVoz: { alignItems: 'center', paddingBottom: 8, gap: 8 },
  ondaFlotante: { width: '100%', paddingHorizontal: 24 },
  oculto: { display: 'none' },
});
